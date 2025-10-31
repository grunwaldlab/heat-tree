import { Subscribable } from './utils.js';
import { calculateScalingFactors, calculateCircularScalingFactors } from './scaling.js';
import { ContinuousSizeScale, ContinuousColorScale, CategoricalColorScale } from './scales.js';
import { cluster } from 'd3';

export class TreeState extends Subscribable {
  constructor(treeData, textSizeEstimator, options = {}) {

    const validLayoutTypes = ['circular', 'rectangular'];


    super();

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
    this.layout = 'rectangular'; // 'circular' or 'rectangular'
    this.labelTextSource = null; // metadata column ID
    this.labelColorSource = null; // metadata column ID
    this.labelSizeSource = null; // metadata column ID
    this.labelFontSource = null; // metadata column ID
    this.labelStyleSource = null; // metadata column ID
    this.labelOffsetPx = 0;
    this.displayedRoot = null;
    this.branchLenToPxFactor = 1;
    this.labelSizeToPxFactor = 1;
    this.targetViewWidth = 800;
    this.targetViewHeight = 600;
    this.occupiedViewWidth = 0;
    this.occupiedViewHeight = 0;
    this.labelSizeScale = null;
    this.labelColorScale = null;

    // Initialize
    this.textSizeEstimator = textSizeEstimator;
    this.treeData = treeData;
    if (!this.treeData || !this.treeData.tree) {
      console.warn('TreeState initialized without valid tree data');
      return;
    }
    this.displayedRoot = this.treeData.tree;

    // Initial coordinate calculation
    this.updateCoordinates();
  }


  setLayout(layoutType) {
    if (!validLayoutTypes.includes(layoutType)) {
      console.warn(`Invalid layout type: ${layoutType}`);
      return;
    }

    if (this.layout !== layoutType) {
      this.layout = layoutType;
      this.updateScaling();
    }
  }

  setTipLabelTextSource(columnId) {
    this.labelTextSource = columnId || null;
    this.updateScaling();
  }

  setTipLabelColorSource(columnId) {
    this.labelColorSource = columnId || null;
    this._updateColorScale();
    this.notify('fontChange');
  }

  setTipLabelSizeSource(columnId) {
    this.labelSizeSource = columnId || null;
    this._updateSizeScale();
    this.updateScaling();
  }

  setTipLabelFontSource(columnId) {
    this.labelFontSource = columnId || null;
    this.updateScaling();
  }

  setTipLabelStyleSource(columnId) {
    this.labelStyleSource = columnId || null;
    this.notify('fontChange');
  }

  setTargetTreeDimensions(width, height) {
    this.targetViewWidth = width;
    this.targetViewHeight = height;
    this.updateScaling();
  }

  setLabelOffset(offsetPx) {
    this.labelOffsetPx = offsetPx;
    this.updateScaling();
  }

  getTreeDimensions() {
    if (!this.tree || !this.tree.bounds) {
      return { width: 0, height: 0 };
    }

    const bounds = this.tree.bounds;

    if (this.layout === 'circular') {
      const width = (bounds.maxRadius - bounds.minRadius) * 2;
      const height = (bounds.maxRadius - bounds.minRadius) * 2;
      return { width, height };
    } else {
      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      return { width, height };
    }
  }

  _updateColorScale() {
    if (!this.labelColorSource || !this.treeData) {
      this.labelColorScale = null;
      return;
    }

    const columnType = this.treeData.columnType.get(this.labelColorSource);
    if (!columnType) {
      this.labelColorScale = null;
      return;
    }

    // Collect values from tree nodes
    const values = [];
    this.tree.each(node => {
      if (node.metadata && node.metadata[this.labelColorSource] !== undefined) {
        values.push(node.metadata[this.labelColorSource]);
      }
    });

    if (values.length === 0) {
      this.labelColorScale = null;
      return;
    }

    if (columnType === 'continuous') {
      const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
      if (numericValues.length === 0) {
        this.labelColorScale = null;
        return;
      }
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      this.labelColorScale = new ContinuousColorScale(min, max);
    } else {
      // Categorical
      this.labelColorScale = new CategoricalColorScale(values);
    }
  }

  _updateSizeScale() {
    if (!this.labelSizeSource || !this.treeData) {
      this.labelSizeScale = null;
      return;
    }

    const columnType = this.treeData.columnType.get(this.labelSizeSource);
    if (columnType !== 'continuous') {
      this.labelSizeScale = null;
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

    if (values.length === 0) {
      this.labelSizeScale = null;
      return;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    // Size scale from 0.5x to 1.5x of base size
    this.labelSizeScale = new ContinuousSizeScale(min, max, 0.5, 1.5);
  }

  updateScaling() {
    if (!this.tree) return;

    // Apply D3 cluster layout to compute base positions
    const treeLayout = cluster().separation((a, b) => 1);
    treeLayout(this.tree);

    // Apply branch lengths
    this.tree.each(d => {
      if (d.parent) {
        d.y = d.parent.y + (d.data.length ? d.data.length : 0);
      } else {
        d.y = 0;
      }
    });

    // Save original coordinates and prepare for layout transformation
    this.tree.each(d => {
      d.originalX = d.x;
      d.originalY = d.y;
      d.x = d.originalY; // D3 uses y for what is the x axis in our case
      d.y = d.originalX;
      d.angle = d.y * Math.PI * 2 + Math.PI;
      d.cos = Math.cos(d.angle);
      d.sin = Math.sin(d.angle);
      d.radius = d.x;
    });

    // Move tree so root is at 0,0
    this.tree.eachAfter(d => {
      d.x = d.x - this.tree.x;
      d.y = d.y - this.tree.y;
    });

    // Set displayed labels
    this.tree.each(d => {
      if (d.collapsed_children) {
        d.tipLabel = '';
      } else if (d.collapsed_parent) {
        d.tipLabel = '';
      } else {
        // Get label from metadata if source is specified
        if (this.labelTextSource && d.metadata && d.metadata[this.labelTextSource] !== undefined) {
          d.tipLabel = String(d.metadata[this.labelTextSource]);
        } else {
          d.tipLabel = d.data.name || '';
        }
        d.nodeLabel = d.tipLabel;
      }
    });

    // Estimate label dimensions
    this.tree.each(d => {
      const size = this.textSizeEstimator.getRelativeTextSize(d.label)
      d.labelWidthRatio = size.width;
      d.labelHeightRatio = size.height;
    })

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

    this.updateCoordinates();
  }

  updateCoordinates() {
    if (!this.tree) return;

    const tipCount = this.tree.leaves().length;

    // Calculate pixel coordinates based on layout
    if (this.layout === 'circular') {
      this.tree.each(d => {
        d.lengthPx = d.data.length * this.branchLenToPxFactor;
        d.radiusPx = d.radius * this.branchLenToPxFactor;
        d.angle = d.angle;
        d.cos = d.cos;
        d.sin = d.sin;
        d.x = d.radiusPx * d.cos;
        d.y = d.radiusPx * d.sin;
      });
    } else {
      this.tree.each(d => {
        d.lengthPx = d.data.length * this.branchLenToPxFactor;
        d.x = d.x * this.branchLenToPxFactor;
        d.y = d.y * tipCount * this.labelSizeToPxFactor * (1 + this.options.labelSpacing);
        d.angle = null;
        d.radiusPx = null;
        d.cos = null;
        d.sin = null;
      });
    }

    // Set label properties
    this.tree.each(d => {
      const isInterior = d.children || d.collapsed_children;

      // Base font size
      let baseFontSize = isInterior
        ? this.labelSizeToPxFactor * this.options.nodeLabelSizeScale
        : this.labelSizeToPxFactor;

      // Apply size scale if specified
      if (this.labelSizeSource && d.metadata && d.metadata[this.labelSizeSource] !== undefined) {
        const value = parseFloat(d.metadata[this.labelSizeSource]);
        if (!isNaN(value) && this.labelSizeScale) {
          const sizeMultiplier = this.labelSizeScale.getValue(value);
          baseFontSize *= sizeMultiplier;
        }
      }

      d.tipLabelSize = baseFontSize;

      // Set label color
      if (this.labelColorSource && d.metadata && d.metadata[this.labelColorSource] !== undefined) {
        const value = d.metadata[this.labelColorSource];
        if (this.labelColorScale) {
          d.tipLabelColor = this.labelColorScale.getValue(value);
        } else {
          d.tipLabelColor = '#000';
        }
      } else {
        d.tipLabelColor = '#000';
      }

      // Set label font (simplified - would need font mapping)
      d.tipLabelFont = 'sans-serif';

      // Set label style
      if (this.labelStyleSource && d.metadata && d.metadata[this.labelStyleSource] !== undefined) {
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

    // Calculate bounds for each node
    this._calculateBounds();

    // Update occupied dimensions
    if (this.tree.bounds) {
      const bounds = this.tree.bounds;
      if (this.layout === 'circular') {
        this.occupiedViewWidth = (bounds.maxRadius - bounds.minRadius) * 2;
        this.occupiedViewHeight = (bounds.maxRadius - bounds.minRadius) * 2;
      } else {
        this.occupiedViewWidth = bounds.maxX - bounds.minX;
        this.occupiedViewHeight = bounds.maxY - bounds.minY;
      }
    }

    this.notify('treeChange');
  }

  _calculateBounds() {
    if (!this.tree) return;

    const getLabelWidth = (node) => {
      return node.labelWidthRatio * this.labelSizeToPxFactor;
    };

    const getLabelXOffset = (node) => {
      return node.tipLabelSize * this.options.nodeLabelOffset;
    };

    const getLabelYOffset = (node) => {
      return node.tipLabelSize * node.labelHeightRatio / 2;
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
          const angleLabelOffset = Math.atan(getLabelYOffset(d) / d.radiusPx);
          d.bounds = {
            minRadius: d.radiusPx,
            maxRadius: d.radiusPx + getLabelXOffset(d) + getLabelWidth(d),
            minAngle: d.angle - angleLabelOffset,
            maxAngle: d.angle + angleLabelOffset
          };
        }
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
            maxX: d.x + getLabelXOffset(d) + getLabelWidth(d),
            minY: d.y - getLabelYOffset(d),
            maxY: d.y + getLabelYOffset(d)
          };
        }
      });
    }
  }

  collapseSubtree(node) {
    if (!node || !node.children) return;

    node.collapsed_children = node.children;
    node.children = null;

    this.updateScaling();
  }

  expandSubtree(node) {
    if (!node || !node.collapsed_children) return;

    node.children = node.collapsed_children;
    node.collapsed_children = null;

    this.updateScaling();
  }

  collapseRoot(node) {
    if (!node || node === this.displayedRoot) return;

    this.displayedRoot = node;
    this.displayedRoot.collapsed_parent = this.displayedRoot.parent;
    this.displayedRoot.parent = null;

    this.updateScaling();
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

    this.updateScaling();
  }
}
