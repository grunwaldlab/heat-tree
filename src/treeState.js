import { Subscribable } from './utils.js';
import { calculateScalingFactors, calculateCircularScalingFactors } from './scaling.js';
import { NullScale } from './scales.js';
import { TextSizeEstimator } from './textAspectRatioPrediction.js'
import { cluster } from 'd3';

export class TreeState extends Subscribable {

  #AESTHETICS = {
    tipLabelText: {
      scaleType: 'text',
      downstream: ['updateTipLabelText', 'updateCoordinates'],
      default: ''
    },
    tipLabelColor: {
      scaleType: 'color',
      downstream: [],
      default: '#000000'
    },
    tipLabelSize: {
      scaleType: 'size',
      downstream: ['updateCoordinates'],
      default: 1
    },
    tipLabelFont: {
      scaleType: 'text',
      downstream: ['updateCoordinates'],
      default: 'sans-serif'

    },
    tipLabelStyle: {
      scaleType: 'text',
      downstream: ['updateCoordinates'],
      default: 'normal'
    },
    nodeLabelText: {
      scaleType: 'text',
      downstream: ['updateNodeLabelText'],
      default: ''
    },
    nodeLabelSize: {
      scaleType: 'size',
      downstream: ['updateCoordinates'],
      default: 1
    },
  }

  state = {
    treeData: null,
    layout: 'rectangular',
    aesthetics: Object.fromEntries(Object.keys(this.#AESTHETICS).map(key => [key, undefined])),
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
    branchLengthScale: 1,
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
    this.state.treeData.subscribe('treeUpdate', () => {
      this.#initalize();
    })
    this.state.treeData.subscribe('metadataRemoved', (info) => {
      this.setAesthetics(Object.fromEntries(info.columnIds.map(key => [key, undefined])));
    })
  }

  #initalize() {
    this.displayedRoot = this.state.treeData.tree;
    this.updateLayout();
    this.setAesthetics(this.state.aesthetics, true);
  }

  setLayout(layout, force = false) {
    const validLayoutTypes = ['circular', 'rectangular'];
    if (!validLayoutTypes.includes(layout)) {
      console.warn(`Invalid layout type: ${layout}`);
      return;
    }

    if (force || this.state.layout !== layout) {
      this.state.layout = layout;
      this.update();
      this.notify('layoutChange', { layout });
    }
  }

  setBranchLengthScale(scale) {
    if (scale < 0.01 || scale > 100) {
      console.warn(`Branch length scale out of range: ${scale}`);
      return;
    }

    this.state.branchLengthScale = scale;
    this.updateCoordinates();
    this.notify('branchLengthScaleChange', { scale });
  }

  setAesthetics(values, force = false) {
    const downstreams = new Set();
    for (const [aesthetic, columnId] of Object.entries(values)) {
      const aesData = this.#AESTHETICS[aesthetic];
      if (force || columnId !== this.state.aesthetics[aesthetic]) {
        // Record the name of the defined aestheric
        this.state.aesthetics[aesthetic] = columnId;

        // Update the scale for the aesthetic
        if (!columnId) {
          this.aestheticsScales[aesthetic] = new NullScale(aesData.default);
        } else {
          this.aestheticsScales[aesthetic] = this.state.treeData.getScale(columnId, aesData.scaleType);
        }

        // Update the tree data directly modified by the aesthetic
        this.state.treeData.tree.each(d => {
          if (columnId && columnId !== null && columnId !== undefined) {
            if (d.metadata && d.metadata[columnId]) {
              d[aesthetic] = this.aestheticsScales[aesthetic].getValue(d.metadata[columnId]);
            } else {
              d[aesthetic] = aesData.default;
            }
          } else {
            d[aesthetic] = this.aestheticsScales[aesthetic].getValue();
          }
        });

        // Record any functions to call later in a unique list
        for (const methodName of aesData.downstream) {
          downstreams.add(methodName);
        }
      }

      // notify subscribers of change to aesthetic
      this.notify(`${aesthetic}Change`);
    }

    // Call all unique functions needed to update downstream data from all the aesthetics applied
    for (const methodName of downstreams) {
      this[methodName]();
    }

  }

  setTargetTreeDimensions(width, height) {
    this.state.viewWidth = width;
    this.state.viewHeight = height;
    this.updateCoordinates();
  }

  collapseSubtree(node) {
    if (!node) {
      console.warn('Tried to collapse non-existant node');
      return;
    }
    if (!node.children) {
      console.warn('Tried to collapse node with no children');
      return;
    }

    node.collapsedChildren = node.children;
    delete node.children;

    this.update();
  }

  expandSubtree(node) {
    if (!node || !node.collapsedChildren) return;

    node.children = node.collapsedChildren;
    delete node.collapsedChildren;

    this.update();
  }

  collapseRoot(node) {
    if (!node || node === this.displayedRoot) return;

    this.displayedRoot = node;
    this.displayedRoot.collapsedParent = this.displayedRoot.parent;
    delete this.displayedRoot.parent;

    this.update();
  }

  expandRoot() {
    if (!this.displayedRoot || !this.displayedRoot.collapsedParent) return;

    this.displayedRoot.parent = this.displayedRoot.collapsedParent;
    delete this.displayedRoot.collapsedParent;

    // Find the new root (the topmost ancestor without a collapsed parent)
    let newRoot = this.displayedRoot;
    while (newRoot.parent && !newRoot.collapsedParent) {
      newRoot = newRoot.parent;
    }

    this.displayedRoot = newRoot;

    this.update();
  }

  updateTipLabelText() {
    this.state.treeData.tree.each(d => {
      // If tipLabelText aesthetic is set to null (None), don't show any labels
      if (this.state.aesthetics.tipLabelText === null) {
        d.tipLabelText = '';
      } else if ((d.children || d.collapsedChildren) && (this.state.aesthetics.tipLabelText === undefined || !d.tipLabelText)) {
        // For internal nodes with default or no aesthetic set
        d.tipLabelText = `Clade with ${d.leafCount} tips`;
      } else if (!d.tipLabelText) {
        // For leaf nodes with no label set
        d.tipLabelText = d.data.name || '';
      }
    })
  }

  updateNodeLabelText() {
    this.state.treeData.tree.each(d => {
      if (d.children || d.collapsedChildren) {
        d.nodeLabelText = d.data.name || '';
      } else if (!d.nodeLabelText) {
        d.tipLabel = d.data.name || '';
      }
    })
  }

  update() {
    this.updateLayout();
    this.updateCoordinates();
  }

  updateLayout() {
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
    if (this.state.layout === 'circular') {
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
  }

  getCollapsedTriangleHeight(d) {
    return d.tipLabelSizePx + 1.1;
  }

  getCollapsedTriangleOffset(d) {
    return this.getCollapsedTriangleHeight(d) * 0.52;
  }

  updateCoordinates() {
    // Estimate label dimensions
    this.displayedRoot.each(d => {
      d.tipLabelBounds = this.textSizeEstimator.getRelativeTextSize(
        d.tipLabelText,
        { 'font-family': d.tipLabelFont, 'font-style': d.tipLabelStyle }
      );
      d.nodeLabelBounds = this.textSizeEstimator.getRelativeTextSize(
        d.nodeLabelText,
        { 'font-family': d.nodeLabelFont, 'font-style': d.nodeLabelStyle }
      );
    })

    // Calculate scaling factors
    let scalingFactors;
    if (this.state.layout === 'circular') {
      scalingFactors = calculateCircularScalingFactors(this.displayedRoot, this.state);
    } else {
      scalingFactors = calculateScalingFactors(this.displayedRoot, this.state);
    }

    this.branchLenToPxFactor = scalingFactors.branchLenToPxFactor_max * this.state.branchLengthScale;
    this.labelSizeToPxFactor = scalingFactors.labelSizeToPxFactor_min;

    // Calculate pixel coordinates and sizes based on scaling factors
    this.displayedRoot.each(d => {
      d.branchLenPx = d.branchLen * this.branchLenToPxFactor;
      d.tipLabelSizePx = d.tipLabelSize * this.labelSizeToPxFactor;
      d.nodeLabelSizePx = d.nodeLabelSize * this.labelSizeToPxFactor * this.state.nodeLabelSizeScale;

      // Calculate tip label offset, incorporating collapsed triangle if present
      let tipLabelXOffset = d.tipLabelSizePx * this.state.nodeLabelOffset;
      if (d.collapsedChildren) {
        tipLabelXOffset += this.getCollapsedTriangleOffset(d) * 1.3;
      }
      d.tipLabelXOffsetPx = tipLabelXOffset;

      d.nodeLabelXOffsetPx = d.nodeLabelSizePx * this.state.nodeLabelOffset;
      d.tipLabelYOffsetPx = d.tipLabelSizePx * d.tipLabelBounds.height / 2;
      d.nodeLabelYOffsetPx = d.nodeLabelSizePx * d.nodeLabelBounds.height / 2;
      d.tipLabelBounds.widthPx = d.tipLabelBounds.width * d.tipLabelSizePx;
      d.tipLabelBounds.heightPx = d.tipLabelBounds.height * d.tipLabelSizePx;
    });
    if (this.state.layout === 'circular') {
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

    // Update bounds
    if (this.state.layout === 'circular') {
      this.state.treeData.tree.eachAfter(d => {
        if (d.children) {
          d.bounds = {
            minRadius: d.radiusPx,
            maxRadius: Math.max(...d.children.map(k => k.bounds.maxRadius)),
            minAngle: Math.min(...d.children.map(k => k.bounds.minAngle)),
            maxAngle: Math.max(...d.children.map(k => k.bounds.maxAngle)),
            minX: Math.min(...d.children.map(k => k.bounds.minX)),
            maxX: Math.max(...d.children.map(k => k.bounds.maxX)),
            minY: Math.min(...d.children.map(k => k.bounds.minY)),
            maxY: Math.max(...d.children.map(k => k.bounds.maxY))
          };
        } else {
          const minRadius = d.radiusPx;
          const maxRadius = minRadius + d.tipLabelXOffsetPx + d.tipLabelBounds.widthPx;
          const angleLabelOffset = Math.atan(d.tipLabelYOffsetPx / d.radiusPx);
          const minAngle = d.angle - angleLabelOffset;
          const maxAngle = d.angle + angleLabelOffset;
          const xValues = [
            minRadius * Math.cos(minAngle),
            minRadius * Math.cos(maxAngle),
            maxRadius * Math.cos(maxAngle),
            maxRadius * Math.cos(minAngle),
          ]
          const yValues = [
            minRadius * Math.sin(minAngle),
            minRadius * Math.sin(maxAngle),
            maxRadius * Math.sin(maxAngle),
            maxRadius * Math.sin(minAngle),
          ]
          d.bounds = {
            minRadius,
            maxRadius,
            minAngle,
            maxAngle,
            minX: Math.min(...xValues),
            maxX: Math.max(...xValues),
            minY: Math.min(...yValues),
            maxY: Math.max(...yValues)
          };
        }
      });
    } else {
      this.state.treeData.tree.eachAfter(d => {
        if (d.children) {
          d.bounds = {
            minX: d.xPx,
            maxX: Math.max(...d.children.map(k => k.bounds.maxX)),
            minY: Math.min(...d.children.map(k => k.bounds.minY)),
            maxY: Math.max(...d.children.map(k => k.bounds.maxY))
          };
        } else {
          d.bounds = {
            minX: d.xPx,
            maxX: d.xPx + d.tipLabelXOffsetPx + d.tipLabelBounds.widthPx,
            minY: d.yPx - d.tipLabelYOffsetPx,
            maxY: d.yPx + d.tipLabelYOffsetPx
          };
        }
      });
    }

    this.notify('coordinateChange');
  }

}
