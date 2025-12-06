import { select, symbol, symbolTriangle } from 'd3';
import { triangleAreaFromSide } from './utils.js';

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
    this.state = treeState;

    // Store reference to the main SVG container
    this.svg = select(svgContainer);

    // Object containing references to SVG layers
    this.layers = {};

    // Object containing D3 selections for reusable elements
    this.selections = {};

    // Current zoom/pan transform
    this.currentTransform = { x: 0, y: 0, k: 1 };

    // Duration for animations (milliseconds)
    this.transitionDuration = options.transitionDuration || 500;

    // Flag to prevent overlapping transitions
    this.isTransitioning = false;

    // Track previous layout state to detect transitions
    this.wasCircularLayout = this.state.state.layout === 'circular';

    // Track if we're expanding a subtree (for delayed fade-in)
    this.isExpanding = false;

    // Store references to active transitions for cancellation
    this.activeTransitions = new Set();

    // Initialize SVG layers
    this.#initializeLayers();

    // Subscribe to TreeState events
    this.#subscribeToStateChanges();

    // Perform initial render
    this.#initialRender();
  }

  /**
   * Initialize SVG layers for branches, nodes, and legends
   */
  #initializeLayers() {
    const treeGroup = this.svg.append('g')
      .attr('class', 'tree-elements');
    this.layers.branchLayer = treeGroup.append('g')
      .attr('class', 'branch-layer');
    this.layers.nodeLayer = treeGroup.append('g')
      .attr('class', 'node-layer');
    this.layers.legendLayer = treeGroup.append('g')
      .attr('class', 'legend-layer');
    this.layers.treeGroup = treeGroup;
  }

  /**
   * Subscribe to TreeState events and set up event handlers
   */
  #subscribeToStateChanges() {
    // Subscribe to coordinate changes (position updates)
    this.state.subscribe('coordinateChange', () => {
      this.#handleCoordinateChange();
    });

    // Subscribe to layout changes (rectangular <-> circular)
    this.state.subscribe('layoutChange', () => {
      this.#handleLayoutChange();
    });

    // Subscribe to aesthetic changes
    this.state.subscribe('tipLabelTextChange', () => {
      this.#updateTipLabelText();
    });

    this.state.subscribe('tipLabelColorChange', () => {
      this.#updateTipLabelColor();
    });

    this.state.subscribe('tipLabelSizeChange', () => {
      this.#updateTipLabelSize();
    });

    this.state.subscribe('tipLabelFontChange', () => {
      this.#updateTipLabelFont();
    });

    this.state.subscribe('tipLabelStyleChange', () => {
      this.#updateTipLabelStyle();
    });

    this.state.subscribe('nodeLabelTextChange', () => {
      this.#updateNodeLabelText();
    });
  }

  /**
   * Perform initial render without transitions
   */
  #initialRender() {
    this.#updateBranches(false);
    this.#updateNodes(false);
  }

  /**
   * Handle coordinate changes from TreeState
   */
  #handleCoordinateChange() {
    if (this.isTransitioning) {
      return;
    }
    // Update branches and nodes with transition
    this.#updateBranches(true);
    this.#updateNodes(true);
  }

  /**
   * Handle layout changes from TreeState
   */
  #handleLayoutChange() {
    if (this.isTransitioning) {
      return;
    }
    // Update branches and nodes with transition
    this.#updateBranches(true);
    this.#updateNodes(true);
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
      .style('font-style', d => d.tipLabelStyle || 'normal');
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
   * Create a D3 transition with appropriate duration
   * @returns {Transition} D3 transition object
   */
  #createTransition() {
    const transition = this.svg.transition()
      .duration(this.transitionDuration);

    // Track this transition
    this.activeTransitions.add(transition);

    // Remove from tracking when complete
    transition.on('end interrupt cancel', () => {
      this.activeTransitions.delete(transition);
    });

    return transition;
  }

  /**
   * Handle transition start - sets transitioning flag and hides elements as needed
   */
  #handleTransitionStart() {
    this.isTransitioning = true;
  }

  /**
   * Handle transition end - clears flag, shows new elements, updates UI
   * @param {Selection} branchGroupsEnter - Entering branch groups (for delayed fade-in)
   * @param {Selection} nodeGroupsEnter - Entering node groups (for delayed fade-in)
   */
  #handleTransitionEnd(branchGroupsEnter, nodeGroupsEnter) {
    this.isTransitioning = false;

    // Delayed fade-in for newly expanded subtrees
    if (this.isExpanding && branchGroupsEnter && nodeGroupsEnter) {
      branchGroupsEnter
        .transition()
        .duration(150)
        .attr('opacity', 1);

      nodeGroupsEnter
        .transition()
        .duration(150)
        .attr('opacity', 1);
    }

    // Reset expanding flag
    this.isExpanding = false;
  }

  /**
   * Cancel any in-progress transitions
   */
  #cancelTransitions() {
    // Interrupt all active transitions
    this.activeTransitions.forEach(transition => {
      transition.interrupt();
    });

    // Clear the set
    this.activeTransitions.clear();

    // Reset flags
    this.isTransitioning = false;
    this.isExpanding = false;
  }

  /**
   * Main method to update all branches
   * @param {boolean} transition - Whether to animate the update
   */
  #updateBranches(transition = true) {
    const root = this.state.displayedRoot;
    if (!root) return;

    // Get all links (parent-child connections) from the tree
    const links = root.links();

    // Calculate branch thickness
    const branchWidth = this.state.labelSizeToPxFactor * this.state.state.branchThicknessProp;

    // DATA JOIN: bind links to branch groups using stable target node ID
    const branchGroups = this.layers.branchLayer
      .selectAll('.branch-group')
      .data(links, d => d.target.id);

    // EXIT: Remove branches that no longer exist
    const branchGroupsExit = branchGroups.exit();
    if (transition) {
      branchGroupsExit.each(function() {
        select(this).selectAll('path')
          .transition()
          .duration(this.transitionDuration)
          .attr('stroke-width', branchWidth)
          .attr('d', d => `M${d.source.xPx},${d.source.yPx}`);
      }.bind(this));
      branchGroupsExit
        .transition()
        .duration(this.transitionDuration)
        .remove();
    } else {
      branchGroupsExit.remove();
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
   * @param {Selection} selection - D3 selection of entering branch groups
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
    const isCircular = this.state.state.layout === 'circular';

    // Select offset and extension paths
    const offsetPaths = selection.select('.offset');
    const extensionPaths = selection.select('.extension');

    if (transition) {
      // Set transition start flag
      this.#handleTransitionStart();

      // Animate path changes
      offsetPaths
        .transition()
        .duration(this.transitionDuration)
        .attr('stroke-width', branchWidth)
        .attr('d', d => this.#getBranchPath(d, 'offset'));

      extensionPaths
        .transition()
        .duration(this.transitionDuration)
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
    const isCircular = this.state.state.layout === 'circular';

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
        return `M${link.source.xPx},${link.source.yPx} A2000,2000 0 0,${sweepFlag} ${link.source.xPx},${link.target.yPx}`;
      } else {
        // Rectangular extension: horizontal line from offset end to target
        return `M${link.source.xPx},${link.target.yPx} L${link.target.xPx},${link.target.yPx}`;
      }
    }
  }

  /**
   * Main method to update all nodes
   * @param {boolean} transition - Whether to animate the update
   */
  #updateNodes(transition = true) {
    const root = this.state.displayedRoot;
    if (!root) return;

    // Detect if we're transitioning between layouts
    const isCircular = this.state.state.layout === 'circular';
    const layoutChanged = this.wasCircularLayout !== isCircular;

    // Get all nodes from the tree
    const nodes = root.descendants();

    // Calculate triangle size for collapsed nodes
    const triangleHeight = this.state.labelSizeToPxFactor * 1.1;
    const triangleArea = triangleAreaFromSide(triangleHeight);
    const trianglePath = symbol().type(symbolTriangle).size(triangleArea)();

    // Calculate branch width for collapsed root lines
    const branchWidth = this.state.labelSizeToPxFactor * this.state.state.branchThicknessProp;

    // Calculate collapsed root line length
    const collapsedRootLineLength = this.#getCollapsedRootLineLength();

    // DATA JOIN: bind nodes to node groups using stable node ID
    const nodeGroups = this.layers.nodeLayer
      .selectAll('.node')
      .data(nodes, d => d.id);

    // EXIT: Remove nodes that no longer exist
    nodeGroups.exit().remove();

    // ENTER: Create new node groups
    const nodeGroupsEnter = nodeGroups.enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.xPx}, ${d.yPx})`);

    // Create node groups with shapes and labels
    this.#createNodeGroup(nodeGroupsEnter, trianglePath, branchWidth);

    // If expanding, hide new elements initially for delayed fade-in
    if (this.isExpanding && transition) {
      nodeGroupsEnter.attr('opacity', 0);
    }

    // UPDATE + ENTER: Merge and update all nodes
    const nodeGroupsUpdate = nodeGroupsEnter.merge(nodeGroups);

    // Update node positions
    this.#updateNodePositions(nodeGroupsUpdate, transition);

    // Handle instant 180° flip for labels transitioning between layouts
    if (layoutChanged) {
      this.#handleLayoutTransitionFlip(nodeGroupsUpdate);
    }

    // Update node labels (text, colors, sizes)
    this.#updateNodeLabels(nodeGroupsUpdate, transition);

    // Update node shapes (triangles for collapsed nodes)
    this.#updateNodeShapes(nodeGroupsUpdate, transition, trianglePath, triangleHeight);

    // Update collapsed indicators (root lines and labels)
    this.#updateCollapsedIndicators(nodeGroupsUpdate, transition, branchWidth, collapsedRootLineLength, triangleHeight);

    // Store the selection for future updates
    this.selections.nodes = nodeGroupsUpdate;

    // Handle transition end callback
    if (transition) {
      // Get the entering branch groups from the previous update
      const branchGroupsEnter = this.#updateBranches(false);

      // Use a single transition end callback
      nodeGroupsUpdate
        .transition()
        .duration(this.transitionDuration)
        .on('end', () => {
          this.#handleTransitionEnd(branchGroupsEnter, nodeGroupsEnter);
        });
    }

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
  #createNodeGroup(selection, trianglePath, branchWidth) {
    // Append a path for collapsed subtree triangle
    selection.append('path')
      .attr('class', 'node-shape')
      .attr('d', d => d.collapsedChildren ? trianglePath : null)
      .attr('fill', '#000')
      .style('display', d => d.collapsedChildren ? null : 'none');

    // Append line for collapsed root
    selection.append('line')
      .attr('class', 'collapsed-root-line')
      .attr('stroke', '#000')
      .attr('stroke-width', branchWidth)
      .style('display', d => d.collapsed_parent ? null : 'none');

    // Append text label for tips
    selection.append('text')
      .attr('class', 'tip-label')
      .style('text-anchor', d => this.#getLabelAnchor(d))
      .style('font-size', d => `${d.tipLabelSizePx}px`)
      .style('font-family', d => d.tipLabelFont || 'sans-serif')
      .style('font-style', d => d.tipLabelStyle || 'normal')
      .style('fill', d => d.tipLabelColor || '#000')
      .style('display', d => (d.children || d.collapsedChildren) ? 'none' : null)
      .text(d => d.tipLabelText || '');

    // Append text label for interior nodes
    selection.append('text')
      .attr('class', 'node-label')
      .style('text-anchor', d => this.#getLabelAnchor(d))
      .style('font-size', d => `${d.nodeLabelSizePx}px`)
      .style('fill', '#000')
      .style('display', d => (d.children || d.collapsedChildren) ? null : 'none')
      .text(d => d.nodeLabelText || '');

    // Append label showing number of tips in collapsed subtree
    selection.append('text')
      .attr('class', 'collapsed-subtree')
      .style('text-anchor', d => this.#getLabelAnchor(d))
      .style('font-size', `${this.state.labelSizeToPxFactor}px`)
      .style('font-weight', 'bold')
      .style('display', d => d.collapsedChildren ? null : 'none')
      .text(d => d.collapsedChildren ? `(${d.leafCount})` : '');
  }

  /**
   * Update node positions
   * @param {Selection} selection - D3 selection of node groups
   * @param {boolean} transition - Whether to animate the update
   */
  #updateNodePositions(selection, transition) {
    if (transition) {
      selection
        .transition()
        .duration(this.transitionDuration)
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
    const isCircular = this.state.state.layout === 'circular';

    // Update tip labels
    const tipLabels = selection.selectAll('.tip-label');

    if (transition) {
      tipLabels
        .transition()
        .duration(this.transitionDuration)
        .attr('dy', d => this.#getLabelDy(d, false))
        .attr('x', d => this.#getLabelOffset(d, false).x)
        .attr('transform', d => `rotate(${this.#getLabelRotation(d)})`)
        .style('text-anchor', d => this.#getLabelAnchor(d))
        .style('font-size', d => `${d.tipLabelSizePx}px`);
    } else {
      tipLabels
        .attr('dy', d => this.#getLabelDy(d, false))
        .attr('x', d => this.#getLabelOffset(d, false).x)
        .attr('transform', d => `rotate(${this.#getLabelRotation(d)})`)
        .style('text-anchor', d => this.#getLabelAnchor(d))
        .style('font-size', d => `${d.tipLabelSizePx}px`);
    }

    // Update text and color without transition
    tipLabels
      .text(d => d.tipLabelText || '')
      .style('fill', d => d.tipLabelColor || '#000')
      .style('font-family', d => d.tipLabelFont || 'sans-serif')
      .style('font-style', d => d.tipLabelStyle || 'normal')
      .style('display', d => (d.children || d.collapsedChildren) ? 'none' : null);

    // Update node labels (interior nodes)
    const nodeLabels = selection.selectAll('.node-label');

    if (transition) {
      nodeLabels
        .transition()
        .duration(this.transitionDuration)
        .attr('dy', d => this.#getLabelDy(d, true))
        .attr('x', d => this.#getLabelOffset(d, true).x)
        .attr('transform', d => `rotate(${this.#getLabelRotation(d)})`)
        .style('text-anchor', d => this.#getLabelAnchor(d))
        .style('font-size', d => `${d.nodeLabelSizePx}px`);
    } else {
      nodeLabels
        .attr('dy', d => this.#getLabelDy(d, true))
        .attr('x', d => this.#getLabelOffset(d, true).x)
        .attr('transform', d => `rotate(${this.#getLabelRotation(d)})`)
        .style('text-anchor', d => this.#getLabelAnchor(d))
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
   * @param {number} triangleHeight - Height of triangle
   */
  #updateNodeShapes(selection, transition, trianglePath, triangleHeight) {
    const nodeShapes = selection.selectAll('.node-shape');

    // Set translate offset immediately (no transition)
    nodeShapes
      .attr('transform', d => `rotate(${this.#getTriangleRotation(d)}) translate(0, ${0.52 * triangleHeight})`)
      .style('display', d => d.collapsedChildren ? null : 'none');

    // Animate only the shape/path changes
    if (transition) {
      nodeShapes
        .transition()
        .duration(this.transitionDuration)
        .attr('d', d => d.collapsedChildren ? trianglePath : null)
        .attr('transform', d => `rotate(${this.#getTriangleRotation(d)}) translate(0, ${0.52 * triangleHeight})`);
    } else {
      nodeShapes.attr('d', d => d.collapsedChildren ? trianglePath : null);
    }
  }

  /**
   * Update collapsed indicators (root lines and labels)
   * @param {Selection} selection - D3 selection of node groups
   * @param {boolean} transition - Whether to animate the update
   * @param {number} branchWidth - Width of branch strokes
   * @param {number} collapsedRootLineLength - Length of collapsed root line
   * @param {number} triangleHeight - Height of triangle for collapsed subtrees
   */
  #updateCollapsedIndicators(selection, transition, branchWidth, collapsedRootLineLength, triangleHeight) {
    const isCircular = this.state.state.layout === 'circular';

    // Update collapsed root lines
    const collapsedRootLines = selection.selectAll('.collapsed-root-line');

    if (transition) {
      collapsedRootLines
        .transition()
        .duration(this.transitionDuration)
        .attr('x2', d => this.#getCollapsedRootLineEnd(d, collapsedRootLineLength).x)
        .attr('y2', d => this.#getCollapsedRootLineEnd(d, collapsedRootLineLength).y)
        .attr('stroke-width', branchWidth);
    } else {
      collapsedRootLines
        .attr('x2', d => this.#getCollapsedRootLineEnd(d, collapsedRootLineLength).x)
        .attr('y2', d => this.#getCollapsedRootLineEnd(d, collapsedRootLineLength).y)
        .attr('stroke-width', branchWidth);
    }

    collapsedRootLines
      .attr('x1', 0)
      .attr('y1', 0)
      .style('display', d => d.collapsed_parent ? null : 'none');

    // Update collapsed subtree labels
    const collapsedSubtreeLabels = selection.selectAll('.collapsed-subtree');

    if (transition) {
      collapsedSubtreeLabels
        .transition()
        .duration(this.transitionDuration)
        .attr('dy', d => this.state.labelSizeToPxFactor / 2.5)
        .attr('x', d => {
          const offset = triangleHeight;
          return isCircular && this.#isLeftSide(d) ? -offset : offset;
        })
        .style('text-anchor', d => this.#getLabelAnchor(d))
        .style('font-size', `${this.state.labelSizeToPxFactor}px`);
    } else {
      collapsedSubtreeLabels
        .attr('dy', d => this.state.labelSizeToPxFactor / 2.5)
        .attr('x', d => {
          const offset = triangleHeight;
          return isCircular && this.#isLeftSide(d) ? -offset : offset;
        })
        .style('text-anchor', d => this.#getLabelAnchor(d))
        .style('font-size', `${this.state.labelSizeToPxFactor}px`);
    }

    collapsedSubtreeLabels
      .text(d => d.collapsedChildren ? `(${d.leafCount})` : '')
      .style('display', d => d.collapsedChildren ? null : 'none');
  }

  /**
   * Handle instant 180° flip for labels transitioning between layouts
   * @param {Selection} selection - D3 selection of node groups
   */
  #handleLayoutTransitionFlip(selection) {
    const isCircular = this.state.state.layout === 'circular';

    selection.selectAll('text').each(function(d) {
      const textElement = select(this);

      // Determine if this label needs an instant flip
      let needsFlip = false;
      if (isCircular && !this.wasCircularLayout) {
        // Transitioning to circular: flip labels that will be on the left
        needsFlip = this.#isLeftSide(d);
      } else if (!isCircular && this.wasCircularLayout) {
        // Transitioning from circular: flip labels that were on the left
        needsFlip = this.#wasLeftSide(d);
      }

      if (needsFlip) {
        // Get current rotation
        const currentTransform = textElement.attr('transform') || 'rotate(0)';
        const currentRotation = parseFloat(currentTransform.match(/rotate\(([-\d.]+)\)/)?.[1] || 0);

        // Apply instant 180° flip
        const flippedRotation = currentRotation + 180;
        textElement.attr('transform', `rotate(${flippedRotation})`);
      }
    }.bind(this));
  }

  /**
   * Get label rotation angle
   * @param {Object} node - Tree node
   * @returns {number} Rotation angle in degrees
   */
  #getLabelRotation(node) {
    const isCircular = this.state.state.layout === 'circular';
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
    const isCircular = this.state.state.layout === 'circular';
    if (!isCircular) return -90;
    return node.angle * (180 / Math.PI) - 90;
  }

  /**
   * Get text anchor based on node type and position
   * @param {Object} node - Tree node
   * @returns {string} Text anchor value ('start', 'end', 'middle')
   */
  #getLabelAnchor(node) {
    const isCircular = this.state.state.layout === 'circular';
    const isInterior = node.children || node.collapsedChildren;

    if (!isCircular) {
      return isInterior ? 'end' : 'start';
    }

    // In circular layout, flip the anchor for left-side nodes
    if (this.#isLeftSide(node)) {
      return isInterior ? 'start' : 'end';
    } else {
      return isInterior ? 'end' : 'start';
    }
  }

  /**
   * Get label x/y offsets for positioning
   * @param {Object} node - Tree node
   * @param {boolean} isInterior - Whether this is an interior node label
   * @returns {Object} Object with x and y offset values
   */
  #getLabelOffset(node, isInterior) {
    const isCircular = this.state.state.layout === 'circular';
    const offset = isInterior ? node.nodeLabelXOffsetPx : node.tipLabelXOffsetPx;

    // In circular layout, flip the offset for left-side nodes
    const xOffset = isCircular && this.#isLeftSide(node) ? -offset : offset;

    // Interior nodes get negative offset (left of node)
    const finalXOffset = isInterior ? -xOffset : xOffset;

    return { x: finalXOffset, y: 0 };
  }

  /**
   * Get label dy offset for vertical positioning
   * @param {Object} node - Tree node
   * @param {boolean} isInterior - Whether this is an interior node label
   * @returns {number} Vertical offset value
   */
  #getLabelDy(node, isInterior) {
    if (isInterior) {
      // Interior node labels
      if (node.collapsed_parent) {
        return this.state.labelSizeToPxFactor * 1.2;
      } else {
        const parentBelow = node.parent && node.parent.yPx > node.yPx;
        const size = node.nodeLabelSizePx;
        return parentBelow ? -size * 0.3 : size * 1;
      }
    } else {
      // Tip labels
      return node.tipLabelSizePx / 2.5;
    }
  }

  /**
   * Determine if a node is on the left side in circular layout
   * @param {Object} node - Tree node
   * @returns {boolean} True if node is on left side
   */
  #isLeftSide(node) {
    const isCircular = this.state.state.layout === 'circular';
    if (!isCircular) return false;
    return node.angle > Math.PI * 2.5 || node.angle < Math.PI * 1.5;
  }

  /**
   * Determine if a node was on the left side in the previous layout
   * @param {Object} node - Tree node
   * @returns {boolean} True if node was on left side
   */
  #wasLeftSide(node) {
    if (!this.wasCircularLayout) return false;
    return node.angle > Math.PI * 2.5 || node.angle < Math.PI * 1.5;
  }

  /**
   * Get collapsed root line end coordinates
   * @param {Object} node - Tree node
   * @param {number} lineLength - Length of the line
   * @returns {Object} Object with x and y coordinates
   */
  #getCollapsedRootLineEnd(node, lineLength) {
    if (!node.collapsed_parent) return { x: 0, y: 0 };

    const isCircular = this.state.state.layout === 'circular';

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
    const root = this.state.displayedRoot;
    if (!root) return 0;

    const isCircular = this.state.state.layout === 'circular';

    if (isCircular) {
      const maxRadius = Math.max(...root.leaves().map(d => d.radiusPx));
      return maxRadius * this.state.state.collapsedRootLineProp * 2;
    } else {
      const maxX = Math.max(...root.leaves().map(d => d.xPx));
      return maxX * this.state.state.collapsedRootLineProp;
    }
  }
}
