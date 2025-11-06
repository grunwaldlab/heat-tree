import { Subscribable } from './utils.js';
import { calculateScalingFactors, calculateCircularScalingFactors } from './scaling.js';
import { ContinuousSizeScale, ContinuousColorScale, CategoricalColorScale } from './scales.js';
import { cluster } from 'd3';

export class TreeState extends Subscribable {

  treeData;
  displayedRoot;
  textSizeEstimator;
  layout = 'rectangular';
  labelTextSource = null;
  labelColorSource = null;
  labelSizeSource = null;
  labelFontSource = null;
  labelStyleSource = null;
  branchLenToPxFactor = 1;
  labelSizeToPxFactor = 1;
  targetViewWidth = 800;
  targetViewHeight = 600;
  occupiedViewWidth = 0;
  occupiedViewHeight = 0;
  labelSizeScale = null;
  labelColorScale = null;

  constructor(treeData, textSizeEstimator, options = {}) {
    super();

    // Check input parameters
    if (!treeData || !treeData.tree) {
      console.error('TreeState initialized without valid tree data');
      return;
    }
    if (!textSizeEstimator) {
      console.error('TreeState initialized without textSizeEstimator');
      return;
    }

    // Set defualt option values
    this.options = {
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
      ...options
    };

    // State properties
    this.treeData = treeData;
    this.displayedRoot = this.treeData.tree;
    this.textSizeEstimator = textSizeEstimator;

    // Initial coordinate calculation
    this.#updateLabels();
  }

  set layout(layout) {
    const validLayoutTypes = ['circular', 'rectangular'];
    if (!validLayoutTypes.includes(layout)) {
      console.warn(`Invalid layout type: ${layout}`);
      return;
    }

    if (this.layout !== layout) {
      this.layout = layout;
      this.#updateLayout();
    }
  }

  set labelTextSource(columnId) {
    if (columnId != this.labelTextSource) {
      this.labelTextSource = columnId || null;
      this.#updateLabels();
    }
  }

  set labelColorSource(columnId) {
    if (columnId != this.labelColorSource) {
      this.labelColorSource = columnId || null;
      this.#updateColorScale();
      this.#updateLabels();
      this.notify('fontChange');
    }
  }

  set labelSizeSource(columnId) {
    if (columnId != this.labelSizeSource) {
      this.labelSizeSource = columnId || null;
      this.#updateSizeScale();
      this.#updateLabels();
    }
  }

  set labelFontSource(columnId) {
    if (columnId != this.labelFontSource) {
      this.labelFontSource = columnId || null;
      this.#updateLabels();
    }
  }

  set labelStyleSource(columnId) {
    if (columnId != this.labelStyleSource) {
      this.labelStyleSource = columnId || null;
      this.#updateLabels();
      this.notify('fontChange');
    }
  }

  setTargetTreeDimensions(width, height) {
    this.targetViewWidth = width;
    this.targetViewHeight = height;
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

  #updateColorScale() {
    // If no scale is defined, return placeholder scale that always returns a default value
    if (!this.labelColorSource) {
      this.labelColorScale = new NullScale('#000000');
      return;
    }

    // Collect values from tree nodes
    const values = [];
    this.tree.each(node => {
      if (node.metadata && node.metadata[this.labelColorSource] !== undefined) {
        values.push(node.metadata[this.labelColorSource]);
      }
    });

    // Return a continuous or cateforical scale depending on the column type
    const columnType = this.treeData.columnType.get(this.labelColorSource);
    if (columnType === 'continuous') {
      const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      this.labelColorScale = new ContinuousColorScale(min, max);
    } else {
      this.labelColorScale = new CategoricalColorScale(values);
    }
  }

  #updateSizeScale() {
    // If no scale is defined, return placeholder scale that always returns a default value
    if (!this.labelSizeSource) {
      this.labelSizeScale = new NullScale(1);
      return;
    }

    // Only use a size scale for continuous variables
    const columnType = this.treeData.columnType.get(this.labelSizeSource);
    if (columnType !== 'continuous') {
      this.labelSizeScale = new NullScale(1);
      return;
    }

    // Collect numeric values from tree nodes
    const values = [];
    this.tree.each(node => {
      if (node.metadata && node.metadata[this.labelSizeSource] !== undefined) {
        const numValue = parseFloat(node.metadata[this.labelSizeSource]);
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

  #updateLabels() {
    this.tree.each(d => {
      // Set tip label content
      if (d.children) {
        d.tipLabel = '';
      } else if (d.collapsed_parent) {
        d.tipLabel = `(${d.leafCount})`;
      } else {
        if (this.labelTextSource) {
          d.tipLabel = String(d.metadata[this.labelTextSource]);
        } else {
          d.tipLabel = d.data.name || '';
        }
      }

      // Set node label content
      if (d.children || d.collapsedChildren) {
        d.nodeLabel = d.data.name || '';
      } else {
        d.nodeLabel = '';
      }

      // Apply relative label size (not in pixels) scale if specified
      if (this.labelSizeSource) {
        const value = parseFloat(d.metadata[this.labelSizeSource]);
        d.tipLabelSize = this.labelSizeScale.getValue(value);
      }
      d.nodeLabelSize = options.nodeLabelSizeScale;

      // Set label color
      if (this.labelColorSource) {
        d.tipLabelColor = this.labelColorScale.getValue(d.metadata[this.labelColorSource]);
      } else {
        d.tipLabelColor = this.labelColorScale.getValue();
      }

      // Set label font (simplified - would need font mapping)
      d.tipLabelFont = 'sans-serif';

      // Set label style
      if (this.labelStyleSource) {
        const styleValue = String(d.metadata[this.labelStyleSource]).toLowerCase();
        if (styleValue.includes('bold') && styleValue.includes('italic')) {
          d.tipLabelStyle = 'bold italic';
        } else if (styleValue.includes('bold')) {
          d.tipLabelStyle = 'bold';
        } else if (styleValue.includes('italic')) {
          d.tipLabelStyle = 'italic';
        } else {
          d.tipLabelStyle = 'normal';
        }
      } else {
        d.tipLabelStyle = 'normal';
      }
    });

    // Estimate label dimensions
    this.tree.each(d => {
      const size = this.textSizeEstimator.getRelativeTextSize(d.label)
      d.labelWidthRatio = size.width;
      d.labelHeightRatio = size.height;
    })

    this.#updateScaling();
  }

  #updateLayout() {
    // Apply D3 cluster layout to compute base positions
    const treeLayout = cluster().separation((a, b) => 1);
    treeLayout(this.tree);

    // Apply branch lengths
    this.tree.each(d => {
      if (d.parent) {
        d.branchLen = d.data.length ? d.data.length : 0;
        d.y = d.parent.y + d.branchLen;
      } else {
        d.y = 0;
      }
    });

    // Save original coordinates and prepare for layout transformation
    this.tree.each(d => {
      const originalX = d.x;
      const originalY = d.y;
      d.x = originalY; // D3 uses y for what is the x axis in our case
      d.y = originalX;
    });
    if (this.layout === 'circular') {
      this.tree.each(d => {
        d.angle = d.y * Math.PI * 2 + Math.PI;
        d.cos = Math.cos(d.angle);
        d.sin = Math.sin(d.angle);
        d.radius = d.x;
      });
    }

    // Move tree so root is at 0,0
    this.tree.eachAfter(d => {
      d.x = d.x - this.tree.x;
      d.y = d.y - this.tree.y;
    });

    this.#updateScaling();
  }

  #updateScaling() {
    // Calculate scaling factors
    let scalingFactors;
    if (this.layout === 'circular') {
      scalingFactors = calculateCircularScalingFactors(
        this.tree,
        this.targetViewWidth,
        this.targetViewHeight,
        this.options
      );
    } else {
      scalingFactors = calculateScalingFactors(
        this.tree,
        this.targetViewWidth,
        this.targetViewHeight,
        this.options
      );
    }

    this.branchLenToPxFactor = scalingFactors.branchLenToPxFactor_max;
    this.labelSizeToPxFactor = scalingFactors.labelSizeToPxFactor_min;

    this.#updateCoordinates();
  }

  #updateCoordinates() {
    // Calculate pixel coordinates and sizes based on scaling factors
    this.tree.each(d => {
      d.branchLenPx = d.branchLen * this.branchLenToPxFactor;
      d.tipLabelSizePx = d.tipLabelSize * this.labelSizeToPxFactor;
      d.nodeLabelSizePx = d.nodeLabelSize * this.labelSizeToPxFactor;
      d.tipLabelXOffsetPx = d.tipLabelSizePx * this.options.nodeLabelOffset;
      d.nodeLabelXOffsetPx = d.nodeLabelSizePx * this.options.nodeLabelOffset;
      d.tipLabelYOffsetPx = d.tipLabelSizePx * d.labelHeightRatio / 2;
      d.nodeLabelYOffsetPx = d.nodeLabelSizePx * d.labelHeightRatio / 2;
    });
    if (this.layout === 'circular') {
      this.tree.each(d => {
        d.radiusPx = d.radius * this.branchLenToPxFactor;
        d.xPx = d.radiusPx * d.cos;
        d.yPx = d.radiusPx * d.sin;
      });
    } else {
      this.tree.each(d => {
        d.xPx = d.x * this.branchLenToPxFactor;
        d.yPx = d.y * this.tree.leaves().length * this.labelSizeToPxFactor * (1 + this.options.labelSpacing);
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
      this.tree.eachAfter(d => {
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
      this.tree.eachAfter(d => {
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
