import { Subscribable } from './utils.js';
import { calculateScalingFactors, calculateCircularScalingFactors } from './scaling.js';
import { NullScale } from './scales.js';
import { TextSizeEstimator } from './textAspectRatioPrediction.js'
import { cluster } from 'd3';

export class TreeState extends Subscribable {

  #AESTHETICS = {
    tipLabelText: {
      title: 'Tip label text',
      scaleType: 'identity',
      default: '',
      downstream: ['updateTipLabelText', 'updateCoordinates'],
      hasLegend: false,
    },
    tipLabelColor: {
      title: 'Tip label color',
      scaleType: 'color',
      default: '#000000',
      otherCategory: "#555555",
      downstream: [],
      hasLegend: true,
    },
    tipLabelSize: {
      title: 'Tip label size',
      scaleType: 'size',
      default: 1,
      isCategorical: false,
      outputRange: [0.5, 2],
      downstream: ['updateCoordinates'],
      hasLegend: true,
    },
    tipLabelFont: {
      title: 'Tip label font',
      scaleType: 'identity',
      default: 'sans-serif',
      downstream: ['updateCoordinates'],
      hasLegend: false,
    },
    tipLabelStyle: {
      title: 'Tip label font style',
      scaleType: 'text',
      outputValues: ['normal', 'bold', 'italic', 'bold italic'],
      default: 'normal',
      otherCategory: 'italic',
      downstream: ['updateCoordinates'],
      hasLegend: false,
    },
    nodeLabelText: {
      title: 'Node label text',
      scaleType: 'identity',
      default: '',
      downstream: ['updateNodeLabelText'],
      hasLegend: false,
    },
    nodeLabelSize: {
      title: 'Node label size',
      scaleType: 'size',
      default: 1,
      isCategorical: false,
      outputRange: [0.5, 2],
      downstream: ['updateCoordinates'],
      hasLegend: false,
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
    collapsedRootLineProp: 0.05,
    branchLengthScale: 1,
    treeHeightScale: 1,
  }

  textSizeEstimator;
  displayedRoot;
  occupiedWidth;
  occupiedHeight;
  branchLenToPxFactor;
  labelSizeToPxFactor;
  aestheticsScales = {};
  legends = [];


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

  setTreeHeightScale(scale) {
    if (scale < 0.1 || scale > 10) {
      console.warn(`Tree height scale out of range: ${scale}`);
      return;
    }

    this.state.treeHeightScale = scale;
    this.updateCoordinates();
    this.notify('treeHeightScaleChange', { scale });
  }

  setAesthetics(values, force = false) {
    const downstreams = new Set();
    let legendsChanged = false;

    for (const [aestheticId, columnId] of Object.entries(values)) {
      const aesData = this.#AESTHETICS[aestheticId];
      if (!aesData) {
        console.warn(`Unknown aesthetic: ${aestheticId}`);
        continue;
      }

      if (force || columnId !== this.state.aesthetics[aestheticId]) {
        // Record the name of the defined aesthetic
        this.state.aesthetics[aestheticId] = columnId;

        // Update the aesthetic for the column
        if (!columnId) {
          this.aestheticsScales[aestheticId] = new NullScale(aesData.default);
        } else {
          // Get or create the aesthetic with default state from #AESTHETICS
          this.aestheticsScales[aestheticId] = this.state.treeData.getAesthetic(columnId, aestheticId, aesData);
        }

        // Update the tree data directly modified by the aesthetic
        this.state.treeData.tree.each(d => {
          if (columnId && columnId !== null && columnId !== undefined) {
            if (d.metadata && d.metadata[columnId] !== undefined) {
              d[aestheticId] = this.aestheticsScales[aestheticId].getValue(d.metadata[columnId]);
            } else {
              d[aestheticId] = aesData.default;
            }
          } else {
            d[aestheticId] = this.aestheticsScales[aestheticId].getValue();
          }
        });

        // Record any functions to call later in a unique list
        for (const methodName of aesData.downstream) {
          downstreams.add(methodName);
        }

        // Check if this aesthetic has a legend
        if (aesData.hasLegend) {
          legendsChanged = true;
        }
      }

      // notify subscribers of change to aesthetic
      this.notify(`${aestheticId}Change`);
    }

    // Update legends if any aesthetic with a legend changed
    if (legendsChanged) {
      this.#updateLegends();
    }

    // Call all unique functions needed to update downstream data from all the aesthetics applied
    for (const methodName of downstreams) {
      this[methodName]();
    }

  }

  #updateLegends() {
    // Clear existing legends
    this.legends = [];

    // Create legends for each aesthetic that has one and is not using the default
    for (const [aestheticId, columnId] of Object.entries(this.state.aesthetics)) {
      const aesData = this.#AESTHETICS[aestheticId];

      // Skip if no legend for this aesthetic or using default (undefined/null)
      if (!aesData.hasLegend || !columnId) {
        continue;
      }

      // Get the aesthetic scale
      const aesthetic = this.aestheticsScales[aestheticId];
      if (!aesthetic) {
        continue;
      }

      this.legends.push({
        aestheticId,
        aesthetic,
        type: aesData.scaleType
      });
    }

    // Notify that legends have changed
    this.notify('legendsChange');
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

  rotateSubtree(node) {
    if (!node) {
      console.warn('Tried to rotate non-existent node');
      return;
    }
    if (!node.children || node.children.length < 2) {
      console.warn('Tried to rotate node with fewer than 2 children');
      return;
    }

    // Rotate children array by moving first element to end
    const firstChild = node.children.shift();
    node.children.push(firstChild);

    this.update();
  }

  hideSubtree(node) {
    if (!node) {
      console.warn('Tried to hide non-existent node');
      return;
    }
    if (!node.parent) {
      console.warn('Cannot hide the root node');
      return;
    }

    // Mark the node as hidden
    node.hidden = true;

    // Remove from parent's children array
    const parent = node.parent;
    if (parent.children) {
      parent.hiddenChildren = parent.hiddenChildren || [];
      parent.hiddenChildren.push(node);
      parent.children = parent.children.filter(child => child !== node);

      // If parent has no more visible children, delete the children property
      if (parent.children.length === 0) {
        delete parent.children;

        // Recursively hide the parent if it now has no children
        this.hideSubtree(parent);
      }
    }

    this.update();
  }

  showSubtree(node) {
    if (!node || !node.hidden) return;

    const parent = node.parent;
    if (!parent || !parent.hiddenChildren) return;

    // Remove from hiddenChildren array
    parent.hiddenChildren = parent.hiddenChildren.filter(child => child !== node);
    if (parent.hiddenChildren.length === 0) {
      delete parent.hiddenChildren;
    }

    // Add back to children array
    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push(node);

    // Sort children to maintain original order (by data index if available)
    parent.children.sort((a, b) => {
      const aIndex = parent.data.children ? parent.data.children.indexOf(a.data) : 0;
      const bIndex = parent.data.children ? parent.data.children.indexOf(b.data) : 0;
      return aIndex - bIndex;
    });

    // Unmark as hidden
    delete node.hidden;

    this.update();
  }

  showAllHidden() {
    // Collect all hidden nodes
    const hiddenNodes = [];
    this.state.treeData.tree.each(d => {
      if (d.hiddenChildren) {
        hiddenNodes.push(...d.hiddenChildren);
      }
    });

    // Show each hidden node
    for (const node of hiddenNodes) {
      this.showSubtree(node);
    }
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
      d.angle = d.y * Math.PI * 2 + Math.PI;
      d.cos = Math.cos(d.angle);
      d.sin = Math.sin(d.angle);
      d.radius = d.x;
    });

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
        d.yPx = d.y * this.displayedRoot.leaves().length * this.labelSizeToPxFactor * (1 + this.state.labelSpacing) * this.state.treeHeightScale;
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
