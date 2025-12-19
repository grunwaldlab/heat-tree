import { select, symbol, symbolTriangle, zoom, zoomIdentity } from 'd3';
import { triangleAreaFromSide, calculateTreeBounds, createDashArray } from './utils.js';
import { appendIcon } from './icons.js';
import { TextSizeLegend, TextColorLegend, BranchLengthLegend } from './legends.js';

export class TreeView {
  constructor(treeState, svgContainer, options = {}) {
    // Validate inputs
    if (!treeState) {
      throw new Error('TreeView requires a TreeState instance');
    }
    if (!svgContainer) {
      throw new Error('TreeView requires an SVG container element');
    }

    // Store reference to the TreeState instance
    this.treeState = treeState;

    // Store reference to the main SVG container
    this.svg = select(svgContainer);

    // Store options
    this.options = {
      buttonSize: 25,
      controlsMargin: 3,
      buttonPadding: 2,
      manualZoomAndPanEnabled: true,
      autoZoomEnabled: true,
      autoPanEnabled: true,
      transitionDuration: 500,
      legendSpacing: 10,
      legendPadding: 10,
      ...options
    };

    // Object containing references to SVG layers
    this.layers = {};

    // Object containing D3 selections for reusable elements
    this.selections = {};

    // Array of legend instances
    this.legendInstances = [];

    // Current zoom/pan transform
    this.currentTransform = { x: 0, y: 0, k: 1 };

    // Flag to prevent overlapping transitions
    this.isTransitioning = false;

    // Track previous layout state to detect transitions
    this.wasCircularLayout = this.treeState.state.layout === 'circular';

    // Track if we're expanding a subtree (for delayed fade-in)
    this.isExpanding = false;

    // Store references to active transitions for cancellation
    this.activeTransitions = new Set();

    // Toggle state for user-initiated zooming/panning
    this.manualZoomAndPanEnabled = this.options.manualZoomAndPanEnabled;

    // Toggle state for automatic zoom to fit
    this.autoZoomEnabled = this.options.autoZoomEnabled;

    // Toggle state for automatic panning
    this.autoPanEnabled = this.options.autoPanEnabled;

    // Currently selected subtree node
    this.selectedNode = null;

    // Initialize SVG layers
    this.#initializeLayers();

    // Initialize zoom behavior
    this.#initializeZoom();

    // Subscribe to TreeState events
    this.#subscribeToStateChanges();

    // Perform initial render
    this.#initialRender();
  }

  /**
   * Destroy the TreeView and clean up DOM elements
   */
  destroy() {
    // Clear all SVG content
    this.svg.selectAll('*').remove();

    // Clear references
    this.layers = {};
    this.selections = {};
    this.selectedNode = null;
    this.legendInstances = [];
  }

  /**
   * Reattach the TreeView to a new SVG container
   * @param {SVGElement} svgContainer - New SVG container element
   */
  reattach(svgContainer) {
    // Update SVG reference
    this.svg = select(svgContainer);

    // Reinitialize layers
    this.#initializeLayers();

    // Reinitialize zoom behavior
    this.#initializeZoom();

    // Re-render without transition
    this.#updateBranches(false);
    this.#updateNodes(false);
    this.#updateHitAreas(false);
    this.#updateLegends(false);
    this.#fitToView(false);
  }

  /**
   * Handle resize event - recalculate and refit the tree to the new viewport
   */
  handleResize() {
    // Refit the tree to the new viewport dimensions
    if (this.autoZoomEnabled || this.autoPanEnabled) {
      this.#fitToView(true);
    }
  }

  /**
   * Initialize SVG layers for branches, nodes, hit areas, and UI overlays
   */
  #initializeLayers() {
    const treeGroup = this.svg.append('g')
      .attr('class', 'tree-elements');
    this.layers.branchLayer = treeGroup.append('g')
      .attr('class', 'branch-layer');
    this.layers.nodeLayer = treeGroup.append('g')
      .attr('class', 'node-layer');
    this.layers.hitLayer = treeGroup.append('g')
      .attr('class', 'hit-layer');
    this.layers.legendLayer = treeGroup.append('g')
      .attr('class', 'legend-layer');
    this.layers.treeGroup = treeGroup;

    // Selection rectangle (shown when a subtree is selected)
    this.layers.selectionRect = treeGroup.append('path')
      .attr('class', 'selection-rect')
      .attr('fill', 'none')
      .attr('stroke', 'grey')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('pointer-events', 'none')
      .style('display', 'none');

    // Floating button group for subtree actions (added to outer SVG so it ignores zoom)
    this.layers.selectionBtns = this.svg.append('g')
      .attr('class', 'selection-btns')
      .style('display', 'none');

    // Create selection buttons
    this.#createSelectionButtons();
  }

  #clearSelection() {
    this.selectedNode = null;
    this.layers.selectionRect.style('display', 'none');
    this.layers.selectionBtns.style('display', 'none');
  }

  /**
   * Create floating buttons for subtree actions
   */
  #createSelectionButtons() {
    const btnGroup = this.layers.selectionBtns;

    // Button to collapse the selected subtree
    const btnCollapseSelected = btnGroup.append('svg')
      .attr('width', this.options.buttonSize)
      .attr('height', this.options.buttonSize)
      .style('cursor', 'pointer')
      .on('click', () => {
        if (this.selectedNode && this.selectedNode !== this.treeState.displayedRoot) {
          this.treeState.collapseSubtree(this.selectedNode);
          this.#clearSelection()
        }
      });
    appendIcon(btnCollapseSelected, 'compress', this.options.buttonSize, this.options.buttonPadding);

    // Button to collapse root to the selected subtree
    const btnCollapseRoot = btnGroup.append('svg')
      .attr('transform', `translate(0, ${this.options.buttonSize + this.options.controlsMargin})`)
      .attr('width', this.options.buttonSize)
      .attr('height', this.options.buttonSize)
      .style('cursor', 'pointer')
      .on('click', () => {
        if (this.selectedNode && this.selectedNode !== this.treeState.displayedRoot) {
          this.treeState.collapseRoot(this.selectedNode);
          this.#clearSelection()
        }
      });
    appendIcon(btnCollapseRoot, 'expand', this.options.buttonSize, this.options.buttonPadding);
  }

  /**
   * Initialize zoom and pan behavior
   */
  #initializeZoom() {
    this.treeZoom = zoom()
      .filter(event => {
        if (!this.manualZoomAndPanEnabled) return false;
        if (event.type === 'dblclick') return false;
        return true;
      })
      .on('zoom', (event) => {
        this.currentTransform = event.transform;
        this.layers.treeGroup.attr('transform', event.transform);
        this.#updateSelectionButtons(event.sourceEvent === null);
      });

    this.svg.call(this.treeZoom);
  }

  /**
   * Subscribe to TreeState events and set up event handlers
   */
  #subscribeToStateChanges() {
    // Subscribe to coordinate changes (position updates)
    this.treeState.subscribe('coordinateChange', () => {
      this.#handleCoordinateChange();
    });

    // Subscribe to layout changes (rectangular <-> circular)
    this.treeState.subscribe('layoutChange', () => {
      this.#handleCoordinateChange();
    });

    // Subscribe to legend changes
    this.treeState.subscribe('legendsChange', () => {
      this.#updateLegends(true);
    });

    // Subscribe to aesthetic changes
    this.treeState.subscribe('tipLabelTextChange', () => {
      this.#updateTipLabelText();
    });

    this.treeState.subscribe('tipLabelColorChange', () => {
      this.#updateTipLabelColor();
    });

    this.treeState.subscribe('tipLabelSizeChange', () => {
      this.#updateTipLabelSize();
      this.#updateLegends(true);
    });

    this.treeState.subscribe('tipLabelFontChange', () => {
      this.#updateTipLabelFont();
    });

    this.treeState.subscribe('tipLabelStyleChange', () => {
      this.#updateTipLabelStyle();
    });

    this.treeState.subscribe('nodeLabelTextChange', () => {
      this.#updateNodeLabelText();
    });
  }

  /**
   * Perform initial render without transitions
   */
  #initialRender() {
    this.#updateBranches(false);
    this.#updateNodes(false);
    this.#updateHitAreas(false);
    this.#updateLegends(false);
    this.#fitToView(false);
  }

  /**
   * Handle coordinate changes from TreeState
   */
  #handleCoordinateChange() {

    // Update branches, nodes, and hit areas with transition
    const branchGroupsEnter = this.#updateBranches(true);
    const nodeGroupsEnter = this.#updateNodes(true);
    this.#updateHitAreas(true);
    this.#updateLegends(true);

    // Update selection rectangle if a node is selected
    if (this.selectedNode && this.selectedNode.children) {
      this.#updateSelectionRect(true);
    }

    // Handle delayed fade-in for expanded subtrees
    if (this.isExpanding && branchGroupsEnter && nodeGroupsEnter) {
      // Wait for the main transition to complete, then fade in
      setTimeout(() => {
        branchGroupsEnter
          .transition('branch group fade in')
          .duration(150)
          .attr('opacity', 1);

        nodeGroupsEnter
          .transition('node group fade in')
          .duration(150)
          .attr('opacity', 1);

        this.layers.selectionBtns
          .attr('opacity', 0)
          .transition('fade in selection buttons')
          .duration(150)
          .attr('opacity', 1);

        // Reset expanding flag after fade-in completes
        setTimeout(() => {
          this.isExpanding = false;
        }, 150);
      }, this.options.transitionDuration);
    }

    // Auto-fit if enabled
    if (this.autoZoomEnabled || this.autoPanEnabled) {
      this.#fitToView(true);
    }
  }

  /**
   * Update tip label text attribute
   */
  #updateTipLabelText() {
    if (!this.selections.nodes) return;

    this.selections.nodes.selectAll('.tip-label')
      .text(d => d.tipLabelText || '');
  }

  /**
   * Update tip label color attribute
   */
  #updateTipLabelColor() {
    if (!this.selections.nodes) return;

    this.selections.nodes.selectAll('.tip-label')
      .style('fill', d => d.tipLabelColor || '#000');
  }

  /**
   * Update tip label size attribute
   */
  #updateTipLabelSize() {
    if (!this.selections.nodes) return;

    this.selections.nodes.selectAll('.tip-label')
      .style('font-size', d => `${d.tipLabelSizePx || 12}px`);
  }

  /**
   * Update tip label font attributes
   * This function handles both font-family
   */
  #updateTipLabelFont() {
    if (!this.selections.nodes) return;

    this.selections.nodes.selectAll('.tip-label')
      .style('font-family', d => d.tipLabelFont || 'sans-serif');
  }

  /**
   * Update tip label style attributes
   * This function handles both font-style
   */
  #updateTipLabelStyle() {
    if (!this.selections.nodes) return;

    this.selections.nodes.selectAll('.tip-label')
      .style('font-style', d => d.tipLabelStyle || 'normal')
      .style('font-weight', d => d.tipLabelStyle === 'bold' ? 'bold' : 'normal');
  }

  /**
   * Update node label text attribute
   */
  #updateNodeLabelText() {
    if (!this.selections.nodes) return;

    this.selections.nodes.selectAll('.node-label')
      .text(d => d.nodeLabelText || '');
  }

  /**
   * Update legends based on current TreeState
   * @param {boolean} transition - Whether to animate the update
   */
  #updateLegends(transition = true) {
    // Clear existing legend instances
    this.layers.legendLayer.selectAll('*').remove();
    this.legendInstances = [];

    // Get tree bounds
    const treeBounds = this.#getCurrentBounds();
    if (!treeBounds) return;

    // Get available width (tree width)
    const availableWidth = treeBounds.maxX - treeBounds.minX;

    // Starting position for legends (below tree)
    let currentX = treeBounds.minX;
    let currentY = treeBounds.maxY + this.options.legendSpacing;

    // Always add branch length legend first
    const branchLengthLegend = new BranchLengthLegend({
      treeState: this.treeState,
      x: currentX,
      y: currentY,
      origin: 'top left',
      maxX: treeBounds.maxX,
      maxY: Infinity
    });

    branchLengthLegend.render(this.layers.legendLayer);
    this.legendInstances.push(branchLengthLegend);

    // Update position for next legend
    currentX += branchLengthLegend.coordinates.width + this.options.legendSpacing;

    // Process each legend from TreeState
    for (const legendData of this.treeState.legends) {

      // Create appropriate legend type
      let legend;
      if (legendData.type === 'size') {
        legend = new TextSizeLegend({
          treeState: this.treeState,
          aesthetic: legendData.aesthetic,
          x: currentX,
          y: currentY,
          origin: 'top left',
          maxX: treeBounds.maxX,
          maxY: Infinity
        });
      } else if (legendData.type === 'color') {
        legend = new TextColorLegend({
          treeState: this.treeState,
          aesthetic: legendData.aesthetic,
          x: currentX,
          y: currentY,
          origin: 'top left',
          maxX: treeBounds.maxX,
          maxY: Infinity
        });
      }

      if (currentX + legend.coordinates.width + this.options.legendSpacing > treeBounds.maxX) {
        currentX = treeBounds.minX;
        currentY += Math.max(...this.legendInstances.map(x => x.coordinates.height));
      }

      if (legend) {
        // Render the legend
        legend.render(this.layers.legendLayer);
        this.legendInstances.push(legend);

        // Update position for next legend
        currentX += legend.coordinates.width + this.options.legendSpacing;
      }
    }
    this.handleResize();
  }

  /**
   * Enable or disable manual zoom and pan
   * @param {boolean} enabled - Whether to enable manual zoom/pan
   */
  setManualZoomAndPanEnabled(enabled) {
    this.manualZoomAndPanEnabled = enabled;
  }

  /**
   * Enable or disable automatic zoom to fit
   * @param {boolean} enabled - Whether to enable auto zoom
   */
  setAutoZoomEnabled(enabled) {
    this.autoZoomEnabled = enabled;
  }

  /**
   * Enable or disable automatic panning
   * @param {boolean} enabled - Whether to enable auto pan
   */
  setAutoPanEnabled(enabled) {
    this.autoPanEnabled = enabled;
  }

  /**
   * Fit the tree to the view with optional transition
   * @param {boolean} transition - Whether to animate the fit
   */
  #fitToView(transition = true, padding = 5) {
    const { width: viewW, height: viewH } = this.svg.node().getBoundingClientRect();

    // Calculate bounds of all tree elements (including legends)
    const bounds = this.#getCurrentBoundsWithLegends();
    if (!bounds) return;

    // Apply padding
    bounds.minX -= padding;
    bounds.maxX += padding;
    bounds.minY -= padding;
    bounds.maxY += padding;

    const treeWidth = bounds.maxX - bounds.minX;
    const treeHeight = bounds.maxY - bounds.minY;

    // Left margin for control buttons
    const marginLeft = 0; // this.options.buttonSize;

    // Available space
    const availableWidth = viewW - marginLeft;
    const availableHeight = viewH;

    // Calculate scale to fit tree within available space
    let scale = this.currentTransform.k;
    let tx = this.currentTransform.x;
    let ty = this.currentTransform.y;

    // Apply auto-zoom if enabled
    if (this.autoZoomEnabled) {
      const scaleX = availableWidth / treeWidth;
      const scaleY = availableHeight / treeHeight;
      scale = Math.min(scaleX, scaleY);
    }

    // Apply auto-pan if enabled
    if (this.autoPanEnabled) {
      // Check if tree fits in each dimension
      const scaledTreeWidth = treeWidth * scale;
      const scaledTreeHeight = treeHeight * scale;

      if (scaledTreeWidth <= availableWidth) {
        // Tree fits horizontally - center it
        tx = marginLeft + (availableWidth - scaledTreeWidth) / 2 - bounds.minX * scale;
      } else {
        // Tree doesn't fit - minimize unused space
        const leftSpace = -bounds.minX * scale - marginLeft;
        const rightSpace = viewW - bounds.maxX * scale;

        if (leftSpace > 0) {
          // Unused space on left - shift right
          tx = marginLeft - bounds.minX * scale;
        } else if (rightSpace > 0) {
          // Unused space on right - shift left
          tx = viewW - bounds.maxX * scale;
        } else {
          // No unused space - keep current pan or center
          tx = marginLeft + availableWidth / 2 - (bounds.minX + bounds.maxX) / 2 * scale;
        }
      }

      if (scaledTreeHeight <= availableHeight) {
        // Tree fits vertically - center it
        ty = (availableHeight - scaledTreeHeight) / 2 - bounds.minY * scale;
      } else {
        // Tree doesn't fit - minimize unused space
        const topSpace = -bounds.minY * scale;
        const bottomSpace = viewH - bounds.maxY * scale;

        if (topSpace > 0) {
          // Unused space on top - shift down
          ty = -bounds.minY * scale;
        } else if (bottomSpace > 0) {
          // Unused space on bottom - shift up
          ty = viewH - bounds.maxY * scale;
        } else {
          // No unused space - keep current pan or center
          ty = availableHeight / 2 - (bounds.minY + bounds.maxY) / 2 * scale;
        }
      }
    }

    const transform = zoomIdentity.translate(tx, ty).scale(scale);

    // Apply through zoom behavior
    if (transition) {
      this.svg.transition('zoom')
        .duration(this.options.transitionDuration)
        .call(this.treeZoom.transform, transform);
    } else {
      this.svg.call(this.treeZoom.transform, transform);
    }
  }

  /**
   * Get current tree bounds
   * @returns {Object} Bounds object with minX, maxX, minY, maxY
   */
  #getCurrentBounds() {
    const root = this.treeState.displayedRoot;
    return {
      minX: root.bounds.minX,
      maxX: root.bounds.maxX,
      minY: root.bounds.minY,
      maxY: root.bounds.maxY
    };
  }

  /**
   * Get current bounds including legends
   * @returns {Object} Bounds object with minX, maxX, minY, maxY
   */
  #getCurrentBoundsWithLegends() {
    const treeBounds = this.#getCurrentBounds();
    if (!treeBounds) return null;

    let maxY = treeBounds.maxY;
    let minX = treeBounds.minX;

    // Add legend heights
    for (const legend of this.legendInstances) {
      if (legend.coordinates) {
        maxY = Math.max(maxY, legend.state.y + legend.coordinates.height);
      }
    }

    // Add width of collapsed parent branch line
    if (this.treeState.state.layout !== 'circular' && this.treeState.displayedRoot.collapsedParent) {
      minX -= this.#getCollapsedRootLineLength();
    }

    return {
      minX,
      maxX: treeBounds.maxX,
      minY: treeBounds.minY,
      maxY
    };
  }

  /**
   * Select or deselect a subtree
   * @param {Object} node - Tree node to select
   */
  #selectSubtree(node) {
    if (this.selectedNode === node) {
      this.#clearSelection();
    } else {
      // Select
      this.selectedNode = node;
      this.layers.selectionRect
        .attr('d', this.#generateSelectionPath(node))
        .style('display', 'block');
      this.#updateSelectionButtons(false);
    }
  }

  /**
   * Update selection rectangle with optional transition
   * @param {boolean} transition - Whether to animate the update
   */
  #updateSelectionRect(transition = false) {
    if (!this.selectedNode || !this.selectedNode.children) {
      return;
    }

    if (transition) {
      this.layers.selectionRect
        .transition('update selection rect')
        .duration(this.options.transitionDuration)
        .attr('d', this.#generateSelectionPath(this.selectedNode));
    } else {
      this.layers.selectionRect
        .attr('d', this.#generateSelectionPath(this.selectedNode));
    }
  }

  /**
   * Generate selection rectangle path
   * @param {Object} node - Tree node
   * @returns {string} SVG path string
   */
  #generateSelectionPath(node) {
    if (!node || !node.children) return '';

    const isCircular = this.treeState.state.layout === 'circular';

    if (isCircular) {
      const innerStart = {
        x: node.bounds.minRadius * Math.cos(node.bounds.minAngle),
        y: node.bounds.minRadius * Math.sin(node.bounds.minAngle)
      };
      const innerEnd = {
        x: node.bounds.minRadius * Math.cos(node.bounds.maxAngle),
        y: node.bounds.minRadius * Math.sin(node.bounds.maxAngle)
      };
      const outerStart = {
        x: node.bounds.maxRadius * Math.cos(node.bounds.minAngle),
        y: node.bounds.maxRadius * Math.sin(node.bounds.minAngle)
      };
      const outerEnd = {
        x: node.bounds.maxRadius * Math.cos(node.bounds.maxAngle),
        y: node.bounds.maxRadius * Math.sin(node.bounds.maxAngle)
      };

      const largeArcFlag = (node.bounds.maxAngle - node.bounds.minAngle) > Math.PI ? 1 : 0;

      return `M${innerStart.x},${innerStart.y} L${outerStart.x},${outerStart.y} A${node.bounds.maxRadius},${node.bounds.maxRadius} 0 ${largeArcFlag},1 ${outerEnd.x},${outerEnd.y} L${innerEnd.x},${innerEnd.y} A${node.bounds.minRadius},${node.bounds.minRadius} 0 ${largeArcFlag},0 ${innerStart.x},${innerStart.y} Z`;
    } else {
      const topLeft = { x: node.bounds.minX, y: node.bounds.minY };
      const topRight = { x: node.bounds.maxX, y: node.bounds.minY };
      const bottomRight = { x: node.bounds.maxX, y: node.bounds.maxY };
      const bottomLeft = { x: node.bounds.minX, y: node.bounds.maxY };

      return `M${topLeft.x},${topLeft.y} L${topRight.x},${topRight.y} L${bottomRight.x},${bottomRight.y} L${bottomLeft.x},${bottomLeft.y} L${topLeft.x},${topLeft.y} Z`;
    }
  }

  /**
   * Update selection buttons position
   * @param {boolean} transition - Whether to animate the update
   */
  #updateSelectionButtons(transition = true) {
    if (!this.selectedNode || !this.selectedNode.children) {
      this.layers.selectionBtns.style('display', 'none');
      return;
    }

    const isCircular = this.treeState.state.layout === 'circular';
    let x, y;

    if (isCircular) {
      // For circular layout, find the leftmost point
      const minAngle = this.selectedNode.bounds.minAngle;
      const maxAngle = this.selectedNode.bounds.maxAngle;
      const minRadius = this.selectedNode.bounds.minRadius;
      const maxRadius = this.selectedNode.bounds.maxRadius;

      const numSamples = 20;
      let minX = Infinity;
      let minXY = 0;

      for (let i = 0; i <= numSamples; i++) {
        const angle = minAngle + (maxAngle - minAngle) * i / numSamples;

        const innerX = minRadius * Math.cos(angle);
        const innerY = minRadius * Math.sin(angle);
        const outerX = maxRadius * Math.cos(angle);
        const outerY = maxRadius * Math.sin(angle);

        if (innerX < minX) {
          minX = innerX;
          minXY = innerY;
        }
        if (outerX < minX) {
          minX = outerX;
          minXY = outerY;
        }
      }

      x = minX;
      y = minXY;
    } else {
      x = this.selectedNode.bounds.minX;
      y = this.selectedNode.bounds.minY;
    }

    // Calculate screen position
    let screenX = x * this.currentTransform.k + this.currentTransform.x - this.options.buttonSize - this.options.controlsMargin;
    let screenY = y * this.currentTransform.k + this.currentTransform.y - this.options.controlsMargin;

    // Keep within viewable area
    const { width: viewW, height: viewH } = this.svg.node().getBoundingClientRect();
    screenX = Math.max(screenX, 0);
    screenX = Math.min(screenX, viewW - this.options.buttonSize);
    screenY = Math.max(screenY, 0);
    screenY = Math.min(screenY, viewH - this.options.buttonSize * 2 - this.options.controlsMargin);

    if (transition) {
      // Hide buttons immediately, then move and fade in after transition
      this.layers.selectionBtns
        .attr('opacity', 0)
        .attr('transform', `translate(${screenX},${screenY})`);
    } else {
      this.layers.selectionBtns
        .attr('transform', `translate(${screenX},${screenY})`)
        .attr('opacity', 1)
        .style('display', 'block');
    }
  }

  /**
   * Update hit areas for interaction
   */
  #updateHitAreas() {
    const root = this.treeState.displayedRoot;
    if (!root) return;

    const isCircular = this.treeState.state.layout === 'circular';
    const branchWidth = this.treeState.labelSizeToPxFactor * this.treeState.state.branchThicknessProp;
    const collapsedRootLineLength = this.#getCollapsedRootLineLength();

    // Update hit areas for subtree selection
    const hits = this.layers.hitLayer.selectAll('.hit')
      .data(root.descendants().filter(d => d.children), d => d.id);

    hits.exit().remove();

    const hitsEnter = hits.enter().append('path')
      .attr('class', 'hit')
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        this.#selectSubtree(d);
        event.stopPropagation();
      });

    hitsEnter.merge(hits)
      .attr('d', d => this.#generateSelectionPath(d));

    // Sort by depth so deeper nodes are on top
    this.layers.hitLayer.selectAll('.hit').sort((a, b) => a.depth - b.depth);

    // Update hit areas for collapsed subtrees
    const collapsedHits = this.layers.hitLayer.selectAll('.collapsed-hit')
      .data(root.descendants().filter(d => d.collapsedChildren), d => d.id);

    collapsedHits.exit().remove();

    const collapsedHitsEnter = collapsedHits.enter().append('rect')
      .attr('class', 'collapsed-hit')
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (d.collapsedChildren) {
          this.isExpanding = true;
          this.treeState.expandSubtree(d);
        }
        event.stopPropagation();
      });

    collapsedHitsEnter.merge(collapsedHits)
      .attr('transform', d => `translate(${d.xPx}, ${d.yPx}) rotate(${this.#getLabelRotation(d)})`)
      .attr('x', d => {
        return this.#isLeftSide(d) ? -(this.treeState.getCollapsedTriangleHeight(d) + d.tipLabelBounds.width * this.treeState.labelSizeToPxFactor) : 0;
      })
      .attr('y', d => -d.tipLabelYOffsetPx * 1.5)
      .attr('width', d => this.treeState.getCollapsedTriangleHeight(d) + d.tipLabelBounds.width * this.treeState.labelSizeToPxFactor)
      .attr('height', d => Math.max(d.tipLabelSizePx, this.treeState.getCollapsedTriangleHeight(d)));

    // Update hit areas for collapsed roots
    const collapsedRootHits = this.layers.hitLayer.selectAll('.collapsed-root-hit')
      .data(root.collapsedParent ? [root] : [], d => d.id);

    collapsedRootHits.exit().remove();

    const collapsedRootHitsEnter = collapsedRootHits.enter().append('rect')
      .attr('class', 'collapsed-root-hit')
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (d.collapsedParent) {
          this.isExpanding = true;
          this.treeState.expandRoot();
        }
        event.stopPropagation();
      });

    collapsedRootHitsEnter.merge(collapsedRootHits)
      .attr('transform', d => {
        if (!d.collapsedParent) return `translate(${d.xPx}, ${d.yPx})`;

        let rotationAngle = 0;
        if (isCircular) {
          const children = d.children || [];
          if (children.length > 0) {
            const avgAngle = children.reduce((sum, child) => sum + child.angle, 0) / children.length;
            rotationAngle = avgAngle * (180 / Math.PI);
          }
        }

        return `translate(${d.xPx}, ${d.yPx}) rotate(${rotationAngle})`;
      })
      .attr('x', -collapsedRootLineLength)
      .attr('y', -branchWidth * 5)
      .attr('width', collapsedRootLineLength)
      .attr('height', branchWidth * 10);
  }

  /**
   * Main method to update all branches
   * @param {boolean} transition - Whether to animate the update
   */
  #updateBranches(transition = true) {
    const root = this.treeState.displayedRoot;
    if (!root) return;

    // Get all links (parent-child connections) from the tree
    const links = root.links();

    // Calculate branch thickness
    const branchWidth = this.treeState.labelSizeToPxFactor * this.treeState.state.branchThicknessProp;

    // DATA JOIN: bind links to branch groups using stable target node ID
    const branchGroups = this.layers.branchLayer
      .selectAll('.branch-group')
      .data(links, d => d.target.id);

    // EXIT: Remove branches that no longer exist
    if (transition) {
      branchGroups.exit()
        .attr('opacity', 0)
        .remove();
    } else {
      branchGroups.exit().remove();
    }

    // ENTER: Create new branch groups
    const branchGroupsEnter = branchGroups.enter()
      .append('g')
      .attr('class', 'branch-group');

    // Create branch groups with offset and extension paths
    this.#createBranchGroup(branchGroupsEnter);

    // If expanding, hide new elements initially for delayed fade-in
    if (this.isExpanding && transition) {
      branchGroupsEnter.attr('opacity', 0);
    }

    // UPDATE + ENTER: Merge and update all branches
    const branchGroupsUpdate = branchGroupsEnter.merge(branchGroups);

    // Update branch paths based on current layout
    this.#updateBranchPaths(branchGroupsUpdate, transition, branchWidth);

    // Store the selection for future updates
    this.selections.branches = branchGroupsUpdate;

    return branchGroupsEnter;
  }

  /**
   * Create initial branch group with offset and extension paths
   * @param {Selection} selection -D3 selection of entering branch groups
   */
  #createBranchGroup(selection) {
    // Append offset path (the part that separates branches along y-axis or angle)
    selection.append('path')
      .attr('class', 'offset')
      .attr('fill', 'none')
      .attr('stroke', '#000')
      .attr('stroke-opacity', 1)
      .attr('stroke-linecap', 'round');

    // Append extension path (the part that extends along x-axis or radius)
    selection.append('path')
      .attr('class', 'extension')
      .attr('fill', 'none')
      .attr('stroke', '#000')
      .attr('stroke-opacity', 1)
      .attr('stroke-linecap', 'round');
  }

  /**
   * Update branch paths based on layout
   * @param {Selection} selection - D3 selection of branch groups
   * @param {boolean} transition - Whether to animate the update
   * @param {number} branchWidth - Width of branch strokes
   */
  #updateBranchPaths(selection, transition, branchWidth) {
    const isCircular = this.treeState.state.layout === 'circular';

    // Select offset and extension paths
    const offsetPaths = selection.select('.offset');
    const extensionPaths = selection.select('.extension');

    if (transition) {
      // Animate path changes
      offsetPaths
        .transition()
        .duration(this.options.transitionDuration)
        .attr('stroke-width', branchWidth)
        .attr('d', d => this.#getBranchPath(d, 'offset'));

      extensionPaths
        .transition()
        .duration(this.options.transitionDuration)
        .attr('stroke-width', branchWidth)
        .attr('d', d => this.#getBranchPath(d, 'extension'));
    } else {
      // Update immediately without animation
      offsetPaths
        .attr('stroke-width', branchWidth)
        .attr('d', d => this.#getBranchPath(d, 'offset'));

      extensionPaths
        .attr('stroke-width', branchWidth)
        .attr('d', d => this.#getBranchPath(d, 'extension'));
    }
  }

  /**
   * Generate SVG path string for a branch segment
   * @param {Object} link - D3 link object with source and target nodes
   * @param {string} pathType - Either 'offset' or 'extension'
   * @returns {string} SVG path string
   */
  #getBranchPath(link, pathType) {
    const isCircular = this.treeState.state.layout === 'circular';

    if (isCircular) {
      if (pathType === 'offset') {
        // Radial offset: arc from source to point at source radius but target angle
        const arcEnd = {
          x: link.source.radiusPx * link.target.cos,
          y: link.source.radiusPx * link.target.sin
        };
        const sweepFlag = link.target.angle > link.source.angle ? 1 : 0;
        return `M${link.source.xPx},${link.source.yPx} A${link.source.radiusPx},${link.source.radiusPx} 0 0,${sweepFlag} ${arcEnd.x},${arcEnd.y}`;
      } else {
        // Radial extension: straight line from arc end to target
        const arcEnd = {
          x: link.source.radiusPx * link.target.cos,
          y: link.source.radiusPx * link.target.sin
        };
        return `M${arcEnd.x},${arcEnd.y} L${link.target.xPx},${link.target.yPx}`;
      }
    } else {
      if (pathType === 'offset') {
        // Rectangular offset: arc from source to point at source x but target y
        const sweepFlag = link.target.angle > link.source.angle ? 1 : 0;
        // return `M${link.source.xPx},${link.source.yPx} A2000,2000 0 0,${sweepFlag} ${link.source.xPx},${link.target.yPx}`;
        return `M${link.source.xPx},${link.source.yPx} L${link.source.xPx},${link.target.yPx}`;
      } else {
        // Rectangular extension: horizontal line from offset end to target
        return `M${link.source.xPx},${link.target.yPx} L${link.target.xPx},${link.target.yPx}`;
      }
    }
  }

  #getCollapsedTrianglePath(d) {
    const triangleArea = triangleAreaFromSide(this.treeState.getCollapsedTriangleHeight(d));
    return symbol().type(symbolTriangle).size(triangleArea)();
  }

  /**
   * Main method to update all nodes
   * @param {boolean} transition - Whether to animate the update
   */
  #updateNodes(transition = true) {
    const root = this.treeState.displayedRoot;
    if (!root) return;

    // Detect if we're transitioning between layouts
    const isCircular = this.treeState.state.layout === 'circular';
    const layoutChanged = this.wasCircularLayout !== isCircular;

    // Get all nodes from the tree
    const nodes = root.descendants();

    // Calculate branch width for collapsed root lines
    const branchWidth = this.treeState.labelSizeToPxFactor * this.treeState.state.branchThicknessProp;

    // Calculate collapsed root line length
    const collapsedRootLineLength = this.#getCollapsedRootLineLength();

    // DATA JOIN: bind nodes to node groups using stable node ID
    const nodeGroups = this.layers.nodeLayer
      .selectAll('.node')
      .data(nodes, d => d.id);

    // EXIT: Remove nodes that no longer exist
    if (transition) {
      nodeGroups.exit()
        .attr('opacity', 0)
        .remove();
    } else {
      nodeGroups.exit().remove();
    }

    // ENTER: Create new node groups
    const nodeGroupsEnter = nodeGroups.enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.xPx}, ${d.yPx})`);

    // Create node groups with shapes and labels
    this.#createNodeGroup(nodeGroupsEnter, branchWidth);

    // If expanding, hide new elements initially for delayed fade-in
    if (this.isExpanding && transition) {
      nodeGroupsEnter.attr('opacity', 0);
    }

    // UPDATE + ENTER: Merge and update all nodes
    const nodeGroupsUpdate = nodeGroupsEnter.merge(nodeGroups);

    // Update node positions
    this.#updateNodePositions(nodeGroupsUpdate, transition);

    // Update node labels (text, colors, sizes)
    this.#updateNodeLabels(nodeGroupsUpdate, transition);

    // Update node shapes (triangles for collapsed nodes)
    this.#updateNodeShapes(nodeGroupsUpdate, transition);

    // Update collapsed indicators (root lines and labels)
    this.#updateCollapsedIndicators(nodeGroupsUpdate, transition, branchWidth, collapsedRootLineLength);

    // Store the selection for future updates
    this.selections.nodes = nodeGroupsUpdate;

    // Update the previous layout state for next transition
    this.wasCircularLayout = isCircular;

    return nodeGroupsEnter;
  }

  /**
   * Create initial node group with shape and labels
   * @param {Selection} selection - D3 selection of entering node groups
   * @param {string} trianglePath - SVG path for triangle symbol
   * @param {number} branchWidth - Width of branch strokes
   */
  #createNodeGroup(selection, branchWidth) {
    // Append a path for collapsed subtree triangle
    selection.append('path')
      .attr('class', 'node-shape')
      .attr('d', d => d.collapsedChildren ? this.#getCollapsedTrianglePath(d) : null)
      .attr('fill', '#000')
      .style('display', d => d.collapsedChildren ? null : 'none');

    // Append line for collapsed root
    selection.append('line')
      .attr('class', 'collapsed-root-line')
      .attr('stroke', '#000')
      .attr('stroke-width', branchWidth)
      .style('display', d => d.collapsedParent ? null : 'none');

    // Append text label for tips
    selection
      .filter(d => d.tipLabelText && d.tipLabelText.trim() !== '')
      .append('text')
      .attr('class', 'tip-label')
      .style('text-anchor', d => this.#getTipLabelAnchor(d))
      .style('font-size', d => `${d.tipLabelSizePx}px`)
      .style('font-family', d => d.tipLabelFont || 'sans-serif')
      .style('font-style', d => d.tipLabelStyle || 'normal')
      .style('font-weight', d => d.tipLabelStyle === 'bold' ? 'bold' : 'normal')
      .style('fill', d => d.tipLabelColor || '#000')
      .style('display', d => (d.children) ? 'none' : null)
      .text(d => d.tipLabelText || '');

    // Append text label for interior nodes
    selection
      .filter(d => d.nodeLabelText && d.nodeLabelText.trim() !== '')
      .append('text')
      .attr('class', 'node-label')
      .style('text-anchor', d => this.#getNodeLabelAnchor(d))
      .style('font-size', d => `${d.nodeLabelSizePx}px`)
      .style('fill', '#000')
      .style('display', d => (d.children || d.collapsedChildren) ? null : 'none')
      .text(d => d.nodeLabelText || '');
  }

  /**
   * Update node positions
   * @param {Selection} selection - D3 selection of node groups
   * @param {boolean} transition - Whether to animate the update
   */
  #updateNodePositions(selection, transition) {
    if (transition) {
      selection
        .transition('update node positions')
        .duration(this.options.transitionDuration)
        .attr('transform', d => `translate(${d.xPx}, ${d.yPx})`);
    } else {
      selection.attr('transform', d => `translate(${d.xPx}, ${d.yPx})`);
    }
  }

  /**
   * Update node labels (text, colors, sizes, positions)
   * @param {Selection} selection - D3 selection of node groups
   * @param {boolean} transition - Whether to animate the update
   */
  #updateNodeLabels(selection, transition) {
    const isCircular = this.treeState.state.layout === 'circular';

    // Update tip labels
    const tipLabels = selection.selectAll('.tip-label');

    if (transition) {
      tipLabels
        .attr('x', d => this.#isLeftSide(d) ? -d.tipLabelXOffsetPx : d.tipLabelXOffsetPx)
      tipLabels
        .transition('update tip labels')
        .duration(this.options.transitionDuration)
        .attr('dy', d => d.tipLabelSizePx / 2.5)
        .attr('transform', d => `rotate(${this.#getLabelRotation(d)})`)
        .style('text-anchor', d => this.#getTipLabelAnchor(d))
        .style('font-size', d => `${d.tipLabelSizePx}px`);
    } else {
      tipLabels
        .attr('dy', d => d.tipLabelSizePx / 2.5)
        .attr('x', d => this.#isLeftSide(d) ? -d.tipLabelXOffsetPx : d.tipLabelXOffsetPx)
        .attr('transform', d => `rotate(${this.#getLabelRotation(d)})`)
        .style('text-anchor', d => this.#getTipLabelAnchor(d))
        .style('font-size', d => `${d.tipLabelSizePx}px`);
    }

    // Update text and color without transition
    tipLabels
      .text(d => d.tipLabelText || '')
      .style('fill', d => d.tipLabelColor || '#000')
      .style('font-family', d => d.tipLabelFont || 'sans-serif')
      .style('font-style', d => d.tipLabelStyle || 'normal')
      .style('display', d => (d.children) ? 'none' : null);

    // Update node labels (interior nodes)
    const nodeLabels = selection.selectAll('.node-label');

    if (transition) {
      nodeLabels
        .transition('update node labels')
        .duration(this.options.transitionDuration)
        .attr('dy', d => this.#getNodeLabelDy(d))
        .attr('x', d => this.#isLeftSide(d) ? d.nodeLabelXOffsetPx : -d.nodeLabelXOffsetPx)
        .attr('transform', d => `rotate(${this.#getLabelRotation(d)})`)
        .style('text-anchor', d => this.#getNodeLabelAnchor(d))
        .style('font-size', d => `${d.nodeLabelSizePx}px`);
    } else {
      nodeLabels
        .attr('dy', d => this.#getNodeLabelDy(d))
        .attr('x', d => this.#isLeftSide(d) ? d.nodeLabelXOffsetPx : -d.nodeLabelXOffsetPx)
        .attr('transform', d => `rotate(${this.#getLabelRotation(d)})`)
        .style('text-anchor', d => this.#getNodeLabelAnchor(d))
        .style('font-size', d => `${d.nodeLabelSizePx}px`);
    }

    // Update text without transition
    nodeLabels
      .text(d => d.nodeLabelText || '')
      .style('display', d => (d.children || d.collapsedChildren) ? null : 'none');
  }

  /**
   * Update node shapes (triangles for collapsed nodes)
   * @param {Selection} selection - D3 selection of node groups
   * @param {boolean} transition - Whether to animate the update
   * @param {string} trianglePath - SVG path for triangle symbol
   */
  #updateNodeShapes(selection, transition) {
    const nodeShapes = selection.selectAll('.node-shape');

    // Set translate offset immediately (no transition)
    nodeShapes
      .attr('transform', d => `rotate(${this.#getTriangleRotation(d)}) translate(0, ${this.treeState.getCollapsedTriangleOffset(d)})`)
      .style('display', d => d.collapsedChildren ? null : 'none');

    // Animate only the shape/path changes
    if (transition) {
      nodeShapes
        .transition()
        .duration(this.options.transitionDuration)
        .attr('d', d => d.collapsedChildren ? this.#getCollapsedTrianglePath(d) : null)
        .attr('transform', d => `rotate(${this.#getTriangleRotation(d)}) translate(0, ${this.treeState.getCollapsedTriangleOffset(d)})`);
    } else {
      nodeShapes.attr('d', d => d.collapsedChildren ? this.#getCollapsedTrianglePath(d) : null);
    }
  }

  /**
   * Update collapsed indicators (root lines and labels)
   * @param {Selection} selection - D3 selection of node groups
   * @param {boolean} transition - Whether to animate the update
   * @param {number} branchWidth - Width of branch strokes
   * @param {number} collapsedRootLineLength - Length of collapsed root line
   */
  #updateCollapsedIndicators(selection, transition, branchWidth, collapsedRootLineLength) {
    const isCircular = this.treeState.state.layout === 'circular';

    // Update collapsed root lines
    const collapsedRootLines = selection.selectAll('.collapsed-root-line');

    if (transition) {
      collapsedRootLines
        .transition()
        .duration(this.options.transitionDuration)
        .attr('x2', d => this.#getCollapsedRootLineEnd(d, collapsedRootLineLength).x)
        .attr('y2', d => this.#getCollapsedRootLineEnd(d, collapsedRootLineLength).y)
        .attr('stroke-width', branchWidth)
        .attr('stroke-dasharray', d => d.collapsedParent ? createDashArray(collapsedRootLineLength, branchWidth, 4) : null);
    } else {
      collapsedRootLines
        .attr('x2', d => this.#getCollapsedRootLineEnd(d, collapsedRootLineLength).x)
        .attr('y2', d => this.#getCollapsedRootLineEnd(d, collapsedRootLineLength).y)
        .attr('stroke-width', branchWidth)
        .attr('stroke-dasharray', d => d.collapsedParent ? createDashArray(collapsedRootLineLength, branchWidth, 4) : null);
    }

    collapsedRootLines
      .attr('x1', 0)
      .attr('y1', 0)
      .style('display', d => d.collapsedParent ? null : 'none');

  }

  /**
   * Get label rotation angle
   * @param {Object} node - Tree node
   * @returns {number} Rotation angle in degrees
   */
  #getLabelRotation(node) {
    const isCircular = this.treeState.state.layout === 'circular';
    if (!isCircular) return 0;

    const angleDeg = node.angle * (180 / Math.PI);
    // Flip labels on the left side so they're readable
    return this.#isLeftSide(node) ? angleDeg + 180 : angleDeg;
  }

  /**
   * Get triangle rotation angle
   * @param {Object} node - Tree node
   * @returns {number} Rotation angle in degrees
   */
  #getTriangleRotation(node) {
    const isCircular = this.treeState.state.layout === 'circular';
    if (!isCircular) return -90;
    return node.angle * (180 / Math.PI) - 90;
  }

  /**
   * Get text anchor based on node type and position
   * @param {Object} node - Tree node
   * @returns {string} Text anchor value ('start', 'end', 'middle')
   */
  #getTipLabelAnchor(node) {
    if (this.treeState.state.layout === 'circular' && this.#isLeftSide(node)) {
      return node.children ? 'start' : 'end';
    } else {
      return node.children ? 'end' : 'start';
    }
  }

  /**
   * Get text anchor based on node type and position
   * @param {Object} node - Tree node
   * @returns {string} Text anchor value ('start', 'end', 'middle')
   */
  #getNodeLabelAnchor(node) {
    if (this.treeState.state.layout === 'circular' && this.#isLeftSide(node)) {
      return node.children || node.collapsedChildren ? 'start' : 'end';
    } else {
      return node.children || node.collapsedChildren ? 'end' : 'start';
    }
  }

  /**
   * Get label dy offset for vertical positioning
   * @param {Object} node - Tree node
   * @returns {number} Vertical offset value
   */
  #getNodeLabelDy(node) {
    // Interior node labels
    if (node.collapsedParent) {
      return this.treeState.labelSizeToPxFactor * 1.2;
    } else {
      const parentBelow = node.parent && node.parent.yPx > node.yPx;
      const size = node.nodeLabelSizePx;
      return parentBelow ? -size * 0.3 : size * 1;
    }
  }

  /**
   * Determine if a node is on the left side in circular layout
   * @param {Object} node - Tree node
   * @returns {boolean} True if node is on left side
   */
  #isLeftSide(node) {
    const isCircular = this.treeState.state.layout === 'circular';
    if (!isCircular) return false;
    console.log(node.tipLabelText);
    console.log(node.angle);
    return node.angle < Math.PI * 1.5 || node.angle > Math.PI * 2.5;
  }

  /**
   * Get collapsed root line end coordinates
   * @param {Object} node - Tree node
   * @param {number} lineLength - Length of the line
   * @returns {Object} Object with x and y coordinates
   */
  #getCollapsedRootLineEnd(node, lineLength) {
    if (!node.collapsedParent) return { x: 0, y: 0 };

    const isCircular = this.treeState.state.layout === 'circular';

    if (isCircular) {
      // Calculate average angle of children
      const children = node.children || [];
      if (children.length === 0) return { x: -lineLength, y: 0 };

      const avgAngle = children.reduce((sum, child) => sum + child.angle, 0) / children.length;
      return {
        x: -lineLength * Math.cos(avgAngle),
        y: -lineLength * Math.sin(avgAngle)
      };
    }

    return { x: -lineLength, y: 0 };
  }

  /**
   * Calculate collapsed root line length
   * @returns {number} Line length in pixels
   */
  #getCollapsedRootLineLength() {
    const root = this.treeState.displayedRoot;
    if (!root) return 0;

    const isCircular = this.treeState.state.layout === 'circular';

    if (isCircular) {
      const maxRadius = Math.max(...root.leaves().map(d => d.radiusPx));
      return maxRadius * this.treeState.state.collapsedRootLineProp * 2;
    } else {
      const maxX = Math.max(...root.leaves().map(d => d.xPx));
      return maxX * this.treeState.state.collapsedRootLineProp;
    }
  }
}
