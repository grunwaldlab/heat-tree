import { Subscribable } from './utils.js';
import { calculateScalingFactors, calculateCircularScalingFactors } from './scaling.js';
import { ContinuousSizeScale, ContinuousColorScale, CategoricalColorScale, NullScale, IdentityScale } from './scales.js';
import { TextSizeEstimator } from './textAspectRatioPrediction.js'
import { cluster } from 'd3';

export class TreeState extends Subscribable {

  #AESTHETICS = {
    tipLabelText: {
      scale: '#makeIdentityScale',
      downstream: ['#updateScaling'],
      default: ''
    },
    tipLabelColor: {
      scale: '#makeColorScale',
      downstream: [],
      default: '#000000'
    },
    tipLabelSize: {
      scale: '#makeSizeScale',
      downstream: ['#updateScaling'],
      default: 1
    },
    tipLabelFont: {
      scale: '#makeIdentityScale',
      downstream: ['#updateScaling'],
      default: 'sans-serif'

    },
    tipLabelStyle: {
      scale: '#makeIdentityScale',
      downstream: ['#updateScaling'],
      default: 'normal'
    },
  }

  state = {
    treeData: null,
    layout: 'rectangular',
    aesthetics: Object.fromEntries(Object.keys(this.#AESTHETICS).map(key => [key, null])),
    viewWidth: 800,
    viewHeight: 600,
    labelSpacing: 0.1,
    nodeLabelSizeScale: 0.67,
    nodeLabelOffset: 0.3,
    maxLabelWidthProportion: 0.03,
    branchThicknessProp: 0.15,
    minFontPx: 12,
    idealFontPx: 18,
    maxFontPx: 32,
    minBranchThicknessPx: 1,
    minBranchLenProp: 0.5,
    collapsedRootLineProp: 0.04,
  }

  textSizeEstimator;
  displayedRoot;
  occupiedWidth;
  occupiedHeight;
  branchLenToPxFactor;
  labelSizeToPxFactor;
  aestheticsScales = {};


  constructor(state = {}, textSizeEstimator = new TextSizeEstimator()) {
    super();

    // Check input parameters
    if (!state.treeData || !state.treeData.tree) {
      console.error('TreeState initialized without valid tree data');
      return;
    }
    if (!textSizeEstimator) {
      console.error('TreeState initialized without textSizeEstimator');
      return;
    }

    // Apply received state by overwriting defualt values
    state.aesthetics = { ...this.state.aesthetics, ...state.aesthetics };
    this.state = { ...this.state, ...state };

    // Initialize values derived from state
    this.textSizeEstimator = textSizeEstimator;
    this.#initalize();

    // Watch for changes to the upderlying tree data or settings
    this.state.treeData.treeData.subscribe('treeUpdate', () => {
      this.#initalize();
    })
    this.state.treeData.treeData.subscribe('metadataRemoved', (info) => {
      this.setAesthetics(Object.fromEntries(info.columnIds.map(key => [key, null])));
    })
  }

  #initalize() {
    this.displayedRoot = this.state.treeData.tree;
    this.setAesthetics(this.state.aesthetics, true);
  }

  setLayout(layout) {
    const validLayoutTypes = ['circular', 'rectangular'];
    if (!validLayoutTypes.includes(layout)) {
      console.warn(`Invalid layout type: ${layout}`);
      return;
    }

    if (this.state.layout !== layout) {
      this.state.layout = layout;
      this.#updateLayout();
    }
  }

  setAesthetics(values, force = false) {
    const downstreams = Set();
    for (const [aesthetic, columnId] of Object.entries(values)) {
      const aesData = this.#AESTHETICS[aesthetic];
      if (force || columnId != this.state.aesthetics[aesthetic]) {
        // Record the name of the defined aestheric
        this.state.aesthetics[aesthetic] = columnId;

        // Update the scale for the aesthetic
        if (columnId === null) {
          this.aestheticsScales[aesthetic] = new NullScale(aesData.default);
        } else {
          this.aestheticsScales[aesthetic] = this[aesData.scale](columnId);
        }

        // Update the tree data directly modified by the aesthetic
        this.state.treeData.tree.each(d => {
          d[aesthetic] = this.aestheticsScales[aesthetic].getValue(d.metadata[columnId]);
        });

        // Record any functions to call later in a unique list
        downstreams.add(aesData.downstream);
      }
    }

    // Call all unique functions needed to update downstream data from all the aesthetics applied
    for (const methodName of downstreams) {
      this[methodName]();
    }
  }

  setTargetTreeDimensions(width, height) {
    this.state.viewWidth = width;
    this.state.viewHeight = height;
    this.#updateScaling();
  }

  collapseSubtree(node) {
    if (!node || !node.children) return;

    node.collapsedChildren = node.children;
    node.children = null;

    this.#updateLayout();
  }

  expandSubtree(node) {
    if (!node || !node.collapsedChildren) return;

    node.children = node.collapsedChildren;
    node.collapsedChildren = null;

    this.#updateLayout();
  }

  collapseRoot(node) {
    if (!node || node === this.displayedRoot) return;

    this.displayedRoot = node;
    this.displayedRoot.collapsed_parent = this.displayedRoot.parent;
    this.displayedRoot.parent = null;

    this.#updateLayout();
  }

  expandRoot() {
    if (!this.displayedRoot || !this.displayedRoot.collapsed_parent) return;

    this.displayedRoot.parent = this.displayedRoot.collapsed_parent;
    this.displayedRoot.collapsed_parent = null;

    // Find the new root (the topmost ancestor without a collapsed parent)
    let newRoot = this.displayedRoot;
    while (newRoot.parent && !newRoot.collapsed_parent) {
      newRoot = newRoot.parent;
    }

    this.displayedRoot = newRoot;

    this.#updateLayout();
  }

  #makeColorScale(colorSource) {
    // Collect values from tree nodes
    const values = [];
    this.displayedRoot.each(node => {
      if (node.metadata && node.metadata[colorSource] !== undefined) {
        values.push(node.metadata[colorSource]);
      }
    });

    // Return a continuous or categorical scale depending on the column type
    const columnType = this.state.treeData.columnType.get(colorSource);
    if (columnType === 'continuous') {
      const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      return new ContinuousColorScale(min, max);
    } else {
      return new CategoricalColorScale(values);
    }
  }

  #makeSizeScale(sizeSource) {
    // Only use a size scale for continuous variables
    const columnType = this.state.treeData.columnType.get(sizeSource);
    if (columnType !== 'continuous') {
      return new NullScale(1);
    }

    // Collect numeric values from tree nodes
    const values = [];
    this.displayedRoot.each(node => {
      if (node.metadata && node.metadata[sizeSource] !== undefined) {
        const numValue = parseFloat(node.metadata[sizeSource]);
        if (!isNaN(numValue)) {
          values.push(numValue);
        }
      }
    });

    // Size scale from 0.5x to 1.5x of base size
    const min = Math.min(...values);
    const max = Math.max(...values);
    this.labelSizeScale = new ContinuousSizeScale(min, max, 0.5, 1.5);
  }

  #makeIdentityScale(source) {
    return new IdentityScale()
  }

  #updateTipLabelText() {
    this.state.treeData.tree.each(d => {
      if (d.children) {
        d.tipLabel = '';
      } else if (d.collapsed_parent) {
        d.tipLabel = `(${d.leafCount})`;
      } else {
        if (this.aesthetics.tipLabelText) {
          d.tipLabel = String(d.metadata[this.aesthetics.tipLabelText]);
        } else {
          d.tipLabel = d.data.name || '';
        }
      }
    })
  }

  #updateNodeLabelText() {
    this.state.treeData.tree.each(d => {
      if (d.children || d.collapsedChildren) {
        d.nodeLabel = d.data.name || '';
      } else {
        if (this.aesthetics.nodeLabelText) {
          d.tipLabel = String(d.metadata[this.aesthetics.nodeLabelText]);
        } else {
          d.tipLabel = d.data.name || '';
        }
      }
    })
  }

  #updateLayout() {
    // Apply D3 cluster layout to compute base positions
    const treeLayout = cluster().separation((a, b) => 1);
    treeLayout(this.displayedRoot);

    // Apply branch lengths
    this.displayedRoot.each(d => {
      if (d.parent) {
        d.branchLen = d.data.length ? d.data.length : 0;
        d.y = d.parent.y + d.branchLen;
      } else {
        d.y = 0;
      }
    });

    // Save original coordinates and prepare for layout transformation
    this.displayedRoot.each(d => {
      const originalX = d.x;
      const originalY = d.y;
      d.x = originalY; // D3 uses y for what is the x axis in our case
      d.y = originalX;
    });
    if (this.layout === 'circular') {
      this.displayedRoot.each(d => {
        d.angle = d.y * Math.PI * 2 + Math.PI;
        d.cos = Math.cos(d.angle);
        d.sin = Math.sin(d.angle);
        d.radius = d.x;
      });
    }

    // Move tree so root is at 0,0
    this.displayedRoot.eachAfter(d => {
      d.x = d.x - this.displayedRoot.x;
      d.y = d.y - this.displayedRoot.y;
    });

    this.#updateScaling();
  }

  #updateScaling() {
    // Estimate label dimensions
    this.displayedRoot.each(d => {
      d.labelBounds = this.textSizeEstimator.getRelativeTextSize(d.label)
    })

    // Calculate scaling factors
    let scalingFactors;
    if (this.layout === 'circular') {
      scalingFactors = calculateCircularScalingFactors(
        this.displayedRoot,
        this.viewWidth,
        this.viewHeight,
        this.state
      );
    } else {
      scalingFactors = calculateScalingFactors(
        this.displayedRoot,
        this.viewWidth,
        this.viewHeight,
        this.state
      );
    }

    this.branchLenToPxFactor = scalingFactors.branchLenToPxFactor_max;
    this.labelSizeToPxFactor = scalingFactors.labelSizeToPxFactor_min;

    this.#updateCoordinates();
  }

  #updateCoordinates() {
    // Calculate pixel coordinates and sizes based on scaling factors
    this.displayedRoot.each(d => {
      d.branchLenPx = d.branchLen * this.branchLenToPxFactor;
      d.tipLabelSizePx = d.tipLabelSize * this.labelSizeToPxFactor;
      d.nodeLabelSizePx = d.nodeLabelSize * this.labelSizeToPxFactor;
      d.tipLabelXOffsetPx = d.tipLabelSizePx * this.state.nodeLabelOffset;
      d.nodeLabelXOffsetPx = d.nodeLabelSizePx * this.state.nodeLabelOffset;
      d.tipLabelYOffsetPx = d.tipLabelSizePx * d.tipLabelBounds.height / 2;
      d.nodeLabelYOffsetPx = d.nodeLabelSizePx * d.nodeLabelBounds.height / 2;
    });
    if (this.layout === 'circular') {
      this.displayedRoot.each(d => {
        d.radiusPx = d.radius * this.branchLenToPxFactor;
        d.xPx = d.radiusPx * d.cos;
        d.yPx = d.radiusPx * d.sin;
      });
    } else {
      this.displayedRoot.each(d => {
        d.xPx = d.x * this.branchLenToPxFactor;
        d.yPx = d.y * this.displayedRoot.leaves().length * this.labelSizeToPxFactor * (1 + this.state.labelSpacing);
      });
    }

    // Calculate bounds for each node
    this.#updateBounds();

    this.notify('coordinateChange');
  }

  #updateBounds() {
    const getLabelWidth = (node) => {
      return node.labelWidthRatio * this.labelSizeToPxFactor;
    };

    if (this.layout === 'circular') {
      this.state.treeData.tree.eachAfter(d => {
        if (d.children) {
          d.bounds = {
            minRadius: d.radiusPx,
            maxRadius: Math.max(...d.children.map(k => k.bounds.maxRadius)),
            minAngle: Math.min(...d.children.map(k => k.bounds.minAngle)),
            maxAngle: Math.max(...d.children.map(k => k.bounds.maxAngle))
          };
        } else {
          const angleLabelOffset = Math.atan(d.tipLabelYOffsetPx / d.radiusPx);
          d.bounds = {
            minRadius: d.radiusPx,
            maxRadius: d.radiusPx + d.tipLabelXOffsetPx + getLabelWidth(d),
            minAngle: d.angle - angleLabelOffset,
            maxAngle: d.angle + angleLabelOffset
          };
        }
        d.width = d.bounds.maxX - d.bounds.minX;
        d.height = d.bounds.maxY - d.bounds.minY;
      });
    } else {
      this.state.treeData.tree.eachAfter(d => {
        if (d.children) {
          d.bounds = {
            minX: d.x,
            maxX: Math.max(...d.children.map(k => k.bounds.maxX)),
            minY: Math.min(...d.children.map(k => k.bounds.minY)),
            maxY: Math.max(...d.children.map(k => k.bounds.maxY))
          };
        } else {
          d.bounds = {
            minX: d.x,
            maxX: d.x + d.tipLabelXOffsetPx + getLabelWidth(d),
            minY: d.y - d.tipLabelYOffsetPx,
            maxY: d.y + d.tipLabelYOffsetPx
          };
        }
        d.width = (bounds.maxRadius - bounds.minRadius) * 2;
        d.height = (bounds.maxRadius - bounds.minRadius) * 2;
      });
    }
  }

}
