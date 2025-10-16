import { parseNewick } from "./parsers.js"
import { appendIcon } from "./icons.js"
import { triangleAreaFromSide, calculateTreeBounds, createDashArray } from "./utils.js"
import { calculateScalingFactors, calculateCircularScalingFactors } from "./scaling.js"
import { initZoomIndicator, initScaleBar, initLeafCount, initColorLegend } from "./legends.js"
import {
  initResetButton,
  initExpandRootButton,
  initToggleZoomButton,
  initToggleCircularButton,
  initLabelColoringDropdown
} from "./controls.js"

import {
  hierarchy, select, zoom, zoomIdentity, cluster, ascending,
  symbol, symbolTriangle, scaleLinear, scaleOrdinal, interpolateViridis
} from "d3";


export function heatTree(newickStr, containerSelector, options = {}) {

  // Set defualt options
  options = {
    buttonSize: 25,
    labelSpacing: 0.1,
    manualZoomAndPanEnabled: true,
    scaleBarSize: { min: 60, max: 150 },
    controlsMargin: 3,
    buttonPadding: 2,
    legendElementHeight: 25,
    nodeLabelSizeScale: 0.67,
    nodeLabelOffset: 0.3,                   // What propotion of text height (font size) labels are moved from nodes
    maxLabelWidthProportion: 0.03,
    branchThicknessProp: 0.15,
    circularLayoutEnabled: false,
    minFontPx: 11,
    idealFontPx: 16,
    maxFontPx: 32,
    minBranchThicknessPx: 1,
    minBranchLenProp: 0.5,
    transitionSpeedFactor: 1,
    collapsedRootLineProp: 0.04,
    metadata: null,
    ...options
  };

  const characterWidthProportion = 0.65;

  // Parse metadata TSV if provided
  let metadataMap = new Map();
  let metadataColumns = [];
  let columnTypes = new Map(); // Track whether each column is continuous or categorical

  if (options.metadata) {
    const lines = options.metadata.trim().split('\n');
    if (lines.length > 1) {
      const headers = lines[0].split('\t');
      const nodeIdIndex = headers.indexOf('node_id');

      if (nodeIdIndex === -1) {
        console.warn('Metadata TSV must contain a "node_id" column');
      } else {
        // Get column names (excluding node_id)
        metadataColumns = headers.filter((h, i) => i !== nodeIdIndex);

        // Initialize column type detection
        const columnValues = new Map();
        metadataColumns.forEach(col => columnValues.set(col, []));

        // Parse metadata rows
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split('\t');
          const nodeId = values[nodeIdIndex];
          const metadata = {};

          for (let j = 0; j < headers.length; j++) {
            if (j !== nodeIdIndex) {
              const colName = headers[j];
              const value = values[j];
              metadata[colName] = value;
              columnValues.get(colName).push(value);
            }
          }

          metadataMap.set(nodeId, metadata);
        }

        // Determine column types (continuous vs categorical)
        metadataColumns.forEach(col => {
          const values = columnValues.get(col);
          const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));

          // If all non-empty values can be converted to numbers, treat as continuous
          const isContinuous = numericValues.length > 0 &&
            numericValues.length === values.filter(v => v !== '').length;

          columnTypes.set(col, isContinuous ? 'continuous' : 'categorical');
        });
      }
    }
  }

  // Current label coloring state
  let currentColorColumn = null;
  let colorScale = null;

  // Function to create color scale for a given column
  function createColorScale(columnName) {
    if (!columnName) {
      return null;
    }

    const columnType = columnTypes.get(columnName);
    const values = [];

    // Collect all values for this column
    metadataMap.forEach(metadata => {
      if (metadata[columnName] !== undefined && metadata[columnName] !== '') {
        values.push(metadata[columnName]);
      }
    });

    if (values.length === 0) {
      return null;
    }

    if (columnType === 'continuous') {
      // Continuous scale using viridis
      const numericValues = values.map(v => parseFloat(v));
      const minVal = Math.min(...numericValues);
      const maxVal = Math.max(...numericValues);

      return scaleLinear()
        .domain([minVal, maxVal])
        .range([0, 1])
        .interpolate(() => interpolateViridis);
    } else {
      // Categorical scale using colors sampled from viridis
      const uniqueValues = [...new Set(values)];
      const numCategories = uniqueValues.length;

      // Sample colors evenly from viridis palette
      const colors = [];
      for (let i = 0; i < numCategories; i++) {
        const t = i / Math.max(1, numCategories - 1);
        colors.push(interpolateViridis(t));
      }

      return scaleOrdinal()
        .domain(uniqueValues)
        .range(colors);
    }
  }

  // Function to get color for a node
  function getNodeColor(node) {
    if (!currentColorColumn || !colorScale) {
      return "#000"; // Default black
    }

    const nodeName = node.data.name;
    if (!nodeName || !metadataMap.has(nodeName)) {
      return "#000";
    }

    const metadata = metadataMap.get(nodeName);
    const value = metadata[currentColorColumn];

    if (value === undefined || value === '') {
      return "#000";
    }

    const columnType = columnTypes.get(currentColorColumn);
    if (columnType === 'continuous') {
      const numericValue = parseFloat(value);
      if (isNaN(numericValue)) {
        return "#000";
      }
      return colorScale(numericValue);
    } else {
      return colorScale(value);
    }
  }

  // Initalize main divs where components are placed
  const parentContainer = select(containerSelector);
  const widgetDiv = parentContainer
    .append("div")
    .attr("class", "ht-widget")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("width", "100%")
    .style("height", "100%")
  const toolbarDiv = widgetDiv
    .append("div")
    .attr("class", "ht-toolbar")
    .style("flex", "0 0 auto")
    .style("margin-bottom", "4px")
    .style("display", "flex")
    .style("gap", `${options.controlsMargin}px`)
    .style("align-items", "flex-start");
  const treeDiv = widgetDiv
    .append("div")
    .attr("class", "ht-tree")
    .style("flex", "1 1 auto")
    .style("min-height", "0")
  const legendDiv = widgetDiv
    .append("div")
    .attr("class", "ht-legend")
    .style("flex", "0 0 auto")
    .style("margin-top", "4px")
    .style("display", "flex")
    .style("gap", `${options.controlsMargin}px`)
    .style("align-items", "center");

  // Toggle state for user-initiated zooming/panning
  let manualZoomAndPanEnabled = options.manualZoomAndPanEnabled;

  // Toggle state for circular layout
  let isCircularLayout = options.circularLayoutEnabled;

  // Track previous layout state to detect transitions
  let wasCircularLayout = isCircularLayout;

  // Track the current zoom/pan transform so UI controls can keep a constant on-screen size.
  let currentTransform = { x: 0, y: 0, k: 1 };

  // Currently selected subtree root
  let selectedNode = null;

  // Parse the Newick string
  const treeData = parseNewick(newickStr);

  // Create a D3 hierarchy from the tree data and sort by size of subtree and branch length
  const root = hierarchy(treeData, d => d.children)
    .sum(d => d.children ? 0 : 1)
    .each(function(d) {
      d.leafCount = d.value;
      delete d.value;
    })
    .sort((a, b) => (a.leafCount - b.leafCount) || ascending(a.data.length, b.data.length));
  let displayedRoot = root;

  // Assign a stable, unique id to every node so D3 can track elements across updates
  let nodeId = 0;
  root.each(d => { d.id = ++nodeId; });

  // Attach metadata to nodes
  root.each(d => {
    if (d.data.name && metadataMap.has(d.data.name)) {
      d.metadata = metadataMap.get(d.data.name);
    }
  });

  // Create reset button
  const resetButton = initResetButton(toolbarDiv, options, () => {
    // Uncollapse every node
    root.each(d => {
      if (d.collapsed_children) {
        d.children = d.collapsed_children;
        d.collapsed_children = null;
      }
      if (d.collapsed_parent) {
        d.parent = d.collapsed_parent;
        d.collapsed_parent = null;
      }
    });

    // Restore original root, clear selections, reset view
    displayedRoot = root;
    selectedNode = null;
    selectionRect.style("display", "none");
    selectionBtns.style("display", "none");

    update();
  });

  // Create expand root button
  const expandRootButton = initExpandRootButton(toolbarDiv, options, () => {
    if (displayedRoot.collapsed_parent) {
      selectedNode = null;
      selectionRect.style("display", "none");
      selectionBtns.style("display", "none");
      displayedRoot.parent = displayedRoot.collapsed_parent;
      displayedRoot.collapsed_parent = null;
      displayedRoot = displayedRoot.ancestors().find(d => d.parent === null || d.collapsed_parent);
      update(true, true);
    }
  });
  expandRootButton.update(false);

  // Create toggle zoom/pan button
  const toggleZoomButton = initToggleZoomButton(toolbarDiv, options, () => {
    manualZoomAndPanEnabled = !manualZoomAndPanEnabled;
    toggleZoomButton.update(manualZoomAndPanEnabled);
  });
  toggleZoomButton.update(manualZoomAndPanEnabled);

  // Create toggle circular layout button
  const toggleCircularButton = initToggleCircularButton(toolbarDiv, options, () => {
    isCircularLayout = !isCircularLayout;
    toggleCircularButton.update(isCircularLayout);
    update(false, true);
  });
  toggleCircularButton.update(isCircularLayout);

  // Create label coloring dropdown (only if metadata is provided)
  if (metadataColumns.length > 0) {
    const labelColoringDropdown = initLabelColoringDropdown(
      toolbarDiv,
      options,
      metadataColumns,
      (columnName) => {
        currentColorColumn = columnName || null;
        colorScale = createColorScale(currentColorColumn);
        const columnType = currentColorColumn ? columnTypes.get(currentColorColumn) : null;
        colorLegend.update(colorScale, currentColorColumn, columnType);
        update(false, false);
      }
    );
  }

  // Create scale bar (left-aligned)
  const scaleBar = initScaleBar(legendDiv, options);

  // Create color legend (appears after scale bar when active)
  const colorLegend = initColorLegend(legendDiv, options);

  // Create spacer to push right-aligned elements to the right
  const spacer = legendDiv.append("div")
    .attr("class", "ht-legend-spacer")
    .style("flex", "1 1 auto");

  // Create zoom indicator (right-aligned group starts here)
  const zoomIndicator = initZoomIndicator(legendDiv, options);

  // Create leaf count indicator
  const leafCount = initLeafCount(legendDiv, options);

  // group containing the rendered tree
  let treeSvg;

  // Outer SVG that receives zoom / pan
  const outerSvg = treeDiv
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%");

  // Re-usable zoom behaviour so we can reset it programmatically
  let labelSizeToPxFactor, branchLenToPxFactor;
  const treeZoom = zoom()
    .filter(event => {
      if (!manualZoomAndPanEnabled) return false;      // honour toggle button
      if (event.type === 'dblclick') return false;
      return true;
    })
    .on("zoom", (event) => {
      currentTransform = event.transform;          // keep latest zoom
      treeSvg.attr("transform", currentTransform); // move tree
      updateSelectionButtons();                    // reposition buttons
      scaleBar.update(branchLenToPxFactor * currentTransform.k); // rescale bar
      zoomIndicator.update(currentTransform.k);     // update zoom indicator
    });

  // Attach zoom behaviour to the outer SVG
  outerSvg.call(treeZoom);

  // Group that holds all tree graphics (subject to zoom / pan)
  treeSvg = outerSvg.append("g").attr("class", "tree-elements");

  // Group for branches
  const branchLayer = treeSvg.append("g").attr("class", "branch-layer");

  // Group for nodes
  const nodeLayer = treeSvg.append("g").attr("class", "node-layer");

  // Layer for invisible hit-test rectangles (kept above branches/nodes)
  const hitLayer = treeSvg.append("g").attr("class", "hit-layer");

  // Reference to the outer <svg> (not zoomed) – used for UI overlays
  const overlaySvg = treeDiv.select("svg");

  // Visible bounding-box shown when a subtree is selected
  let selectionRect = treeSvg.append("rect")
    .attr("class", "selection-rect")
    .attr("fill", "none")
    .attr("stroke", "grey")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "5,5")
    .attr("pointer-events", "none")
    .style("display", "none");

  // Floating button group for subtree actions (added to outer SVG so it ignores zoom)
  const selectionBtns = overlaySvg.append("g")
    .attr("class", "selection-btns")
    .style("display", "none");

  // Button to collapse the selected subtree
  const btnCollapseSelected = selectionBtns.append("svg")
    .attr("width", options.buttonSize)
    .attr("height", options.buttonSize)
    .style("cursor", "pointer")
    .on("click", () => {
      if (selectedNode && selectedNode.children) {
        selectedNode.collapsed_children = selectedNode.children;
        selectedNode.children = null;
        selectedNode = null;
        selectionRect.style("display", "none");
        selectionBtns.style("display", "none");
        update(false, false);
      }
    });
  appendIcon(btnCollapseSelected, "compress", options.buttonSize, options.buttonPadding);

  // Button to collapse root to the selected subtree
  const btnCollapseRoot = selectionBtns.append("svg")
    .attr("transform", `translate(0, ${options.buttonSize + options.controlsMargin})`)
    .attr("width", options.buttonSize)
    .attr("height", options.buttonSize)
    .style("cursor", "pointer")
    .on("click", () => {
      if (selectedNode && selectedNode !== displayedRoot) {
        displayedRoot = selectedNode;
        displayedRoot.collapsed_parent = displayedRoot.parent;
        displayedRoot.parent = null;
        selectedNode = null;
        selectionRect.style("display", "none");
        selectionBtns.style("display", "none");
        update();
      }
    });
  appendIcon(btnCollapseRoot, "expand", options.buttonSize, options.buttonPadding);

  // Helper to position / toggle the floating button group
  function updateSelectionButtons() {
    if (!selectedNode) {
      selectionBtns.style("display", "none");
      return;
    }
    const screenX = selectedNode.x * currentTransform.k + currentTransform.x - options.buttonSize - options.controlsMargin;
    const screenY = selectedNode.y0bbox * currentTransform.k + currentTransform.y - options.controlsMargin;
    selectionBtns
      .attr("transform", `translate(${screenX},${screenY})`)
      .style("display", "block");
  }


  function update(expanding = false, fit = true, initial = false) {

    // Detect if we're transitioning between layouts
    const layoutChanged = wasCircularLayout !== isCircularLayout;

    // Helper to determine if a node is on the left side in circular layout
    function isLeftSide(d) {
      if (!isCircularLayout) return false;
      return d.angle > Math.PI * 2.5 | d.angle < Math.PI * 1.5;
    }

    // Helper to determine if a node was on the left side in the previous layout
    function wasLeftSide(d) {
      if (!wasCircularLayout) return false;
      return d.angle > Math.PI * 2.5 | d.angle < Math.PI * 1.5;
    }

    // Helper to get the rotation angle for labels in circular layout
    function getLabelRotation(d) {
      if (!isCircularLayout) return 0;
      const angleDeg = d.angle * (180 / Math.PI);
      // Flip labels on the left side so they're readable
      return isLeftSide(d) ? angleDeg + 180 : angleDeg;
    }

    // Helper to get the rotation angle for triangles in circular layout
    function getTriangleRotation(d) {
      if (!isCircularLayout) return -90;
      return d.angle * (180 / Math.PI) - 90;
    }

    // Helper to get text anchor based on node type and position
    function getTextAnchor(d) {
      const isInterior = d.children;
      if (!isCircularLayout) {
        return isInterior ? "end" : "start";
      }
      // In circular layout, flip the anchor for left-side nodes
      if (isLeftSide(d)) {
        return isInterior ? "start" : "end";
      } else {
        return isInterior ? "end" : "start";
      }
    }

    // The estimated width in pixels of the printed label
    function getLabelWidth(node) {
      let nameLen;
      if (node.collapsed_children) {
        nameLen = node.collapsed_children_name ? node.collapsed_children_name.length : 0;
      } else if (node.collapsed_parent) {
        nameLen = 0; // No label for collapsed parent
      } else {
        nameLen = node.data.name ? node.data.name.length : 0;
      }
      return nameLen * labelSizeToPxFactor * characterWidthProportion;
    }

    // The width in pixels of how far the begining of labels are moved right
    function getLabelXOffset(node) {
      return fontSizeForNode(node) * options.nodeLabelOffset
    }

    // The width in pixels of how far the begining of labels are moved down
    function getLabelYOffset(node) {
      return fontSizeForNode(node) / 2.5
    }

    // Helper functions for node label sizing & positioning
    function fontSizeForNode(d) {
      return (d.children || d.collapsed_children)
        ? labelSizeToPxFactor * options.nodeLabelSizeScale     // interior node
        : labelSizeToPxFactor;                         // leaf
    }

    // Return the appropriate vertical offset (dy) so interior node
    // labels stay on the opposite side of the branch line from
    // their parent to avoid overlap.
    function computeDy(d) {
      const size = fontSizeForNode(d);
      if (d.children || d.collapsed_children) {
        if (d.collapsed_parent) {
          return labelSizeToPxFactor * 1.2;
        } else {
          const parentBelow = d.parent && d.parent.y > d.y;
          return parentBelow ? - size * 0.3 : size * 1;
        }
      }
      return size / 2.5;
    }

    // Ensure the full tree is visible with extra space on the left for
    // the floating selection buttons.  This is invoked after the very
    // first render and every time the user clicks the "reset" button.
    function fitToView(transition = true) {
      const { width: viewW, height: viewH } = treeDiv.select('svg').node().getBoundingClientRect();

      // Calculate bounds of all tree elements (branches + labels)
      const bounds = calculateTreeBounds(
        displayedRoot,
        isCircularLayout,
        getLabelWidth,
        getLabelXOffset,
        fontSizeForNode,
        collapsedRootLineLength
      );

      // Calculate tree dimensions
      const treeWidth = bounds.maxX - bounds.minX;
      const treeHeight = bounds.maxY - bounds.minY;

      // Left margin for control buttons
      const marginLeft = options.buttonSize + options.controlsMargin;

      // Available space (allow tree to touch right boundary)
      const availableWidth = viewW - marginLeft;
      const availableHeight = viewH;

      // Calculate scale to fit tree within available space
      const scaleX = availableWidth / treeWidth;
      const scaleY = availableHeight / treeHeight;
      const scale = Math.min(scaleX, scaleY);

      // Calculate translation to center tree with the calculated scale
      let tx, ty;

      tx = marginLeft + availableWidth / 2 - (bounds.minX + bounds.maxX) / 2 * scale;
      ty = availableHeight / 2 - (bounds.minY + bounds.maxY) / 2 * scale;

      const transform = zoomIdentity.translate(tx, ty).scale(scale);
      // Apply through zoom behaviour with transition so internal state & listeners update
      if (transition) {
        overlaySvg.transition()
          .duration(500 * options.transitionSpeedFactor)
          .call(treeZoom.transform, transform);
      } else {
        overlaySvg.call(treeZoom.transform, transform);
      }
    }

    //  Infer window dimensions if needed, taking into account padding
    let treeDivSize = treeDiv.select('svg').node().getBoundingClientRect();

    // Set the names for collapsed parents and children
    root.each(d => {
      if (d.collapsed_parent) {
        d.collapsed_parent_name = `(${root.leafCount - d.leafCount})`;
      }
      if (d.collapsed_children) {
        d.collapsed_children_name = `(${d.leafCount})`;
      }
    });

    // Use D3 cluster layout to compute node positions (for x coordinate)
    let treeLayout = cluster()
      .separation((a, b) => 1);

    // Recompute layout
    treeLayout(displayedRoot);

    // Apply branch lengths override
    displayedRoot.each(d => {
      if (d.parent) {
        d.y = d.parent.y + (d.data.length ? d.data.length : 0);
      } else {
        d.y = 0;
      }
    });

    // Save original coordinates so that the displayed ones can be modified depending on the layout
    displayedRoot.each(d => {
      d.originalX = d.x;
      d.originalY = d.y;
      d.x = d.originalY; // D3 uses y for what is the x axis in our case
      d.y = d.originalX;
      d.angle = d.y * Math.PI * 2 + Math.PI;
      d.cos = Math.cos(d.angle);
      d.sin = Math.sin(d.angle);
      d.radius = d.x;
    })

    // Move tree so root is at 0,0
    displayedRoot.eachAfter(d => {
      d.x = d.x - displayedRoot.x;
      d.y = d.y - displayedRoot.y;
    })

    // Determine how to convert unitless branch lengths and relative text sizes to pixels
    let scalingFactors;
    if (isCircularLayout) {
      scalingFactors = calculateCircularScalingFactors(displayedRoot, treeDivSize.width, treeDivSize.height, options, characterWidthProportion);
    } else {
      scalingFactors = calculateScalingFactors(displayedRoot, treeDivSize.width, treeDivSize.height, options, characterWidthProportion);
    }
    branchLenToPxFactor = scalingFactors.branchLenToPxFactor_max;
    labelSizeToPxFactor = scalingFactors.labelSizeToPxFactor_min;

    // Calculate x, y coordinates of nodes in pixel space
    const tipCount = displayedRoot.leaves().length;
    if (isCircularLayout) {
      displayedRoot.each(d => {
        d.radius = d.radius * branchLenToPxFactor;
        d.x = d.radius * d.cos;
        d.y = d.radius * d.sin;
      })
    } else {
      displayedRoot.each(d => {
        d.x = d.x * branchLenToPxFactor;
        d.y = d.y * tipCount * labelSizeToPxFactor * (1 + options.labelSpacing);
      })
    }

    // Update scale bar to reflect new scaling factors
    scaleBar.update(branchLenToPxFactor * currentTransform.k);

    // Calculate the max root-to-tip distance for collapsed root line length
    let maxRootToTip = 0;
    displayedRoot.leaves().forEach(leaf => {
      maxRootToTip = Math.max(maxRootToTip, leaf.x);
    });
    const collapsedRootLineLength = maxRootToTip * options.collapsedRootLineProp * (isCircularLayout ? 3 : 1);

    // Calculate visible leaf count (excluding collapsed placeholders)
    const visibleLeaves = displayedRoot.leaves().filter(d => !d.collapsed_children && !d.collapsed_parent).length;
    const totalLeaves = root.leafCount;
    leafCount.update(visibleLeaves, totalLeaves);

    // Update expand root button state
    expandRootButton.update(displayedRoot.collapsed_parent !== null && displayedRoot.collapsed_parent !== undefined);

    // Branch thickness proportional to label font size
    let branchWidth = labelSizeToPxFactor * options.branchThicknessProp;


    if (fit || !manualZoomAndPanEnabled) fitToView(!initial);

    // Compute bounding rectangles for every subtree node
    displayedRoot.eachAfter(d => {
      if (d.children) {
        const kids = d.children;
        d.y0bbox = Math.min(...kids.map(k => k.y0bbox));
        d.y1bbox = Math.max(...kids.map(k => k.y1bbox));
        d.x1bbox = Math.max(...kids.map(k => k.x1bbox));
      } else {
        d.y0bbox = d.y - getLabelYOffset(d);
        d.y1bbox = d.y + getLabelYOffset(d);
        d.x1bbox = d.x + getLabelXOffset(d) + getLabelWidth(d);
      }
    });

    // Hide selection rectangle if the node was collapsed, otherwise reposition it with the updated layout.
    if (selectedNode && !selectedNode.children) {
      selectedNode = null;
      selectionRect.style("display", "none");
    } else if (selectedNode) {
      selectionRect
        .attr("x", selectedNode.x)
        .attr("y", selectedNode.y0bbox)
        .attr("width", selectedNode.x1bbox - selectedNode.x)
        .attr("height", selectedNode.y1bbox - selectedNode.y0bbox);
      updateSelectionButtons();
    }

    // Update invisible hit rectangles for every subtree
    const hits = hitLayer.selectAll(".hit")
      .data(displayedRoot.descendants().filter(d => d.children), d => d.id);
    hits.exit().remove();

    function selectSubtree(node) {
      if (selectedNode == node) {
        selectedNode = null;
        selectionRect
          .style("display", "none");
        selectionBtns.style("display", "none");
      } else {
        selectedNode = node;
        selectionRect
          .attr("x", node.x)
          .attr("y", node.y0bbox)
          .attr("width", node.x1bbox - node.x)
          .attr("height", node.y1bbox - node.y0bbox)
          .style("display", "block");
        updateSelectionButtons();
      }
    }

    const hitsEnter = hits.enter().append("rect")
      .attr("class", "hit")
      .attr("fill", "transparent")
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        selectSubtree(d);
        event.stopPropagation(); // don't trigger node click
      });

    hitsEnter.merge(hits)
      .attr("x", d => d.x)
      .attr("y", d => d.y0bbox)
      .attr("width", d => d.x1bbox - d.x)
      .attr("height", d => d.y1bbox - d.y0bbox);

    // Deeper nodes (greater depth) rendered above shallower ones
    hitLayer.selectAll(".hit").sort((a, b) => a.depth - b.depth);

    // Shared transition for this update
    const t = treeSvg.transition().duration(500 * options.transitionSpeedFactor);

    // DATA JOIN for branch groups (use stable target.id as key)
    const branchGroups = branchLayer.selectAll(".branch-group")
      .data(displayedRoot.links(), d => d.target.id);

    // EXIT branch groups – collapse back to the parent's new position
    branchGroups.exit().each(function() {
      select(this).selectAll("path").transition(t)
        .attr("stroke-width", branchWidth)
        .attr("d", d => `M${d.source.x},${d.source.y}`);
    }).transition(t).remove();

    // ENTER branch groups – start at the parent's previous position
    const branchGroupsEnter = branchGroups.enter().append("g")
      .attr("class", "branch-group");

    // Append offset path (the part that separates branches along y-axis or angle)
    branchGroupsEnter.append("path")
      .attr("class", "offset")
      .attr("fill", "none")
      .attr("stroke", "#000")
      .attr("stroke-opacity", 1)
      .attr("stroke-width", branchWidth);

    // Append extension path (the part that extends along x-axis or radius)
    branchGroupsEnter.append("path")
      .attr("class", "extension")
      .attr("fill", "none")
      .attr("stroke", "#000")
      .attr("stroke-opacity", 1)
      .attr("stroke-width", branchWidth);

    // UPDATE + ENTER => one unified selection
    const branchGroupsUpdate = branchGroupsEnter.merge(branchGroups);

    // UPDATE offset and extension paths to new positions
    function radialOffset(d) {
      const arcEnd = {
        x: d.source.radius * d.target.cos,
        y: d.source.radius * d.target.sin
      };
      return `M${d.source.x},${d.source.y} A${d.source.radius},${d.source.radius} 0 0,${d.target.angle > d.source.angle ? 1 : 0} ${arcEnd.x},${arcEnd.y}`;
    }

    function radialExtension(d) {
      const arcEnd = {
        x: d.source.radius * d.target.cos,
        y: d.source.radius * d.target.sin
      };
      return `M${arcEnd.x},${arcEnd.y} L${d.target.x},${d.target.y}`;
    }

    function rectangularOffset(d) {
      return `M${d.source.x},${d.source.y} A2000,2000 0 0,${d.target.angle > d.source.angle ? 1 : 0} ${d.source.x},${d.target.y}`;
    }

    function rectangularExtension(d) {
      return `M${d.source.x},${d.target.y} L${d.target.x},${d.target.y}`;
    }

    if (isCircularLayout) {
      branchGroupsUpdate.select(".offset").transition(t)
        .attr("stroke-width", branchWidth)
        .attr("d", radialOffset);
      branchGroupsUpdate.select(".extension").transition(t)
        .attr("stroke-width", branchWidth)
        .attr("d", radialExtension);
    } else {
      branchGroupsUpdate.select(".offset").transition(t)
        .attr("stroke-width", branchWidth)
        .attr("d", rectangularOffset);
      branchGroupsUpdate.select(".extension").transition(t)
        .attr("stroke-width", branchWidth)
        .attr("d", rectangularExtension);
    }

    // DATA JOIN for nodes (use stable id)
    const node = nodeLayer.selectAll(".node")
      .data(displayedRoot.descendants(), d => d.id);
    node.exit().remove();
    node.transition(t)
      .attr("transform", d => `translate(${d.x}, ${d.y})`);
    const nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.x}, ${d.y})`)
      .on("click", (event, d) => {
        if (d.collapsed_children) {       // expand (delayed reveal)
          d.children = d.collapsed_children;
          d.collapsed_children = null;
          update(true, false);
        } else if (d === displayedRoot && d.collapsed_parent) { // un-collapse root
          selectedNode = null;
          selectionRect.style("display", "none");
          d.parent = d.collapsed_parent;
          d.collapsed_parent = null;
          displayedRoot = d.ancestors().find(d => d.parent === null || d.collapsed_parent);
          update(true, true);
        }
      });

    // Pre-computed symbol paths used for node icons
    let triangleHeight = labelSizeToPxFactor * 1.1;
    let triangleArea = triangleAreaFromSide(triangleHeight);
    let trianglePath = symbol().type(symbolTriangle).size(triangleArea)();

    // Append a path that will show a triangle only when subtree is collapsed
    nodeEnter.append("path")
      .attr("class", "node-shape")
      .attr("d", d => d.collapsed_children ? trianglePath : null)
      .attr("fill", "#000")
      .style("display", d => d.collapsed_children ? null : "none");

    // Append line for collapsed root
    nodeEnter.append("line")
      .attr("class", "collapsed-root-line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", d => {
        if (!d.collapsed_parent) return 0;
        if (isCircularLayout) {
          // Calculate average angle of children
          const children = d.children || [];
          if (children.length === 0) return -collapsedRootLineLength;
          const avgAngle = children.reduce((sum, child) => sum + child.angle, 0) / children.length;
          // Line perpendicular to average angle
          const perpAngle = avgAngle;
          return -collapsedRootLineLength * Math.cos(perpAngle);
        }
        return -collapsedRootLineLength;
      })
      .attr("y2", d => {
        if (!d.collapsed_parent) return 0;
        if (isCircularLayout) {
          // Calculate average angle of children
          const children = d.children || [];
          if (children.length === 0) return 0;
          const avgAngle = children.reduce((sum, child) => sum + child.angle, 0) / children.length;
          // Line perpendicular to average angle
          const perpAngle = avgAngle;
          return -collapsedRootLineLength * Math.sin(perpAngle);
        }
        return 0;
      })
      .attr("stroke", "#999")
      .attr("stroke-width", branchWidth)
      .attr("stroke-dasharray", createDashArray(collapsedRootLineLength, branchWidth, 5))
      .style("display", d => d.collapsed_parent ? null : "none");

    // Update collapsed-subtree labels visibility and text
    nodeLayer.selectAll(".collapsed-subtree")
      .transition(t)
      .attr("dy", labelSizeToPxFactor / 2.5)
      .attr("x", triangleHeight)
      .text(d => d.collapsed_children ? d.collapsed_children_name : "")
      .style("font-weight", "bold")
      .style("display", d => d.collapsed_children ? null : "none");

    // Update collapsed-root lines
    nodeLayer.selectAll(".collapsed-root-line")
      .transition(t)
      .attr("x2", d => {
        if (!d.collapsed_parent) return 0;
        if (isCircularLayout) {
          // Calculate average angle of children
          const children = d.children || [];
          if (children.length === 0) return -collapsedRootLineLength;
          const avgAngle = children.reduce((sum, child) => sum + child.angle, 0) / children.length;
          // Line perpendicular to average angle
          const perpAngle = avgAngle;
          return -collapsedRootLineLength * Math.cos(perpAngle);
        }
        return -collapsedRootLineLength;
      })
      .attr("y2", d => {
        if (!d.collapsed_parent) return 0;
        if (isCircularLayout) {
          // Calculate average angle of children
          const children = d.children || [];
          if (children.length === 0) return 0;
          const avgAngle = children.reduce((sum, child) => sum + child.angle, 0) / children.length;
          // Line perpendicular to average angle
          const perpAngle = avgAngle;
          return -collapsedRootLineLength * Math.sin(perpAngle);
        }
        return 0;
      })
      .attr("stroke-width", branchWidth)
      .style("display", d => d.collapsed_parent ? null : "none");

    // Append text labels for nodes
    nodeEnter.append("text")
      .attr("class", "node-label")
      .attr("dy", d => computeDy(d))
      .attr("x", d => {
        const isInterior = d.children || d.collapsed_children;
        const offset = isInterior ? -getLabelXOffset(d) : getLabelXOffset(d);
        // In circular layout, flip the offset for left-side nodes
        return isCircularLayout && isLeftSide(d) ? -offset : offset;
      })
      .attr("transform", d => `rotate(${getLabelRotation(d)})`)
      .style("text-anchor", d => getTextAnchor(d))
      .style("font-size", d => `${fontSizeForNode(d)}px`)
      .style("fill", d => getNodeColor(d))
      .style("display", d => d.collapsed_children ? "none" : null)
      .text(d => d.data.name || "");

    // Append label showing number of tips in collapsed subtree
    nodeEnter.append("text")
      .attr("class", "collapsed-subtree")
      .attr("dy", labelSizeToPxFactor / 2.5)
      .attr("x", d => {
        return isCircularLayout && isLeftSide(d) ? -triangleHeight : triangleHeight;
      })
      .style("text-anchor", d => getTextAnchor(d))
      .style("font-size", `${labelSizeToPxFactor}px`)
      .text(d => d.collapsed_children ? d.collapsed_children_name : "")
      .style("display", d => d.collapsed_children ? null : "none");

    // Update visibility and orientation of node-shapes (triangles)
    const nodeShapes = nodeLayer.selectAll(".node-shape")
      // set translate offset immediately (no transition)
      .attr("transform", d => `rotate(${getTriangleRotation(d)}) translate(0, ${0.52 * triangleHeight})`)
      .style("display", d => d.collapsed_children ? null : "none");

    // animate only the shape/path changes (e.g., rotation)
    nodeShapes.transition(t)
      .attr("d", d => d.collapsed_children ? trianglePath : null)
      .attr("transform", d => `rotate(${getTriangleRotation(d)}) translate(0, ${0.52 * triangleHeight})`);

    // Delay the appearance of newly-entered subtree when expanding
    if (expanding) {
      branchGroupsEnter.attr("opacity", 0);
      nodeEnter.attr("opacity", 0);
    }

    t.on("end", () => {
      if (expanding) {
        branchGroupsEnter.transition().duration(150 * options.transitionSpeedFactor).attr("opacity", 1);
        nodeEnter.transition().duration(150 * options.transitionSpeedFactor).attr("opacity", 1);
      }
    });

    // Handle label rotation transitions with instant 180° flip for left-side labels
    if (layoutChanged) {
      // When transitioning between layouts, apply instant 180° flip for labels that need it
      nodeLayer.selectAll(".node text").each(function(d) {
        const textElement = select(this);

        // Determine if this label needs an instant flip
        let needsFlip = false;
        if (isCircularLayout && !wasCircularLayout) {
          // Transitioning to circular: flip labels that will be on the left
          needsFlip = isLeftSide(d);
        } else if (!isCircularLayout && wasCircularLayout) {
          // Transitioning from circular: flip labels that were on the left
          needsFlip = wasLeftSide(d);
        }

        if (needsFlip) {
          // Get current rotation
          const currentTransform = textElement.attr("transform") || "rotate(0)";
          const currentRotation = parseFloat(currentTransform.match(/rotate\(([-\d.]+)\)/)?.[1] || 0);

          // Apply instant 180° flip
          const flippedRotation = currentRotation + 180;
          textElement.attr("transform", `rotate(${flippedRotation})`);
        }
      });
    }

    // Update label font sizes and offsets according to the latest labelSize
    nodeLayer.selectAll(".node text")
      .transition(t)
      .attr("dy", d => computeDy(d))
      .attr("x", d => {
        const isInterior = d.children || d.collapsed_children;
        const offset = isInterior ? -getLabelXOffset(d) : getLabelXOffset(d);
        // In circular layout, flip the offset for left-side nodes
        return isCircularLayout && isLeftSide(d) ? -offset : offset;
      })
      .attr("transform", d => `rotate(${getLabelRotation(d)})`)
      .style("text-anchor", d => getTextAnchor(d))
      .style("font-size", d => `${fontSizeForNode(d)}px`);

    // Update label colors
    nodeLayer.selectAll(".node-label")
      .style("fill", d => getNodeColor(d))
      .style("display", d => d.collapsed_children ? "none" : null);

    nodeLayer.selectAll(".collapsed-subtree")
      .transition(t)
      .attr("dy", labelSizeToPxFactor / 2.5)
      .attr("x", d => {
        return isCircularLayout && isLeftSide(d) ? -triangleHeight : triangleHeight;
      })
      .style("text-anchor", d => getTextAnchor(d))
      .style("font-size", `${labelSizeToPxFactor}px`);

    // Store current positions for the next update so every branch has
    // previous coordinates to interpolate from.
    displayedRoot.each(d => {
      d.previousX = d.x;
      d.previousY = d.y;
    });

    // Update the previous layout state for next transition
    wasCircularLayout = isCircularLayout;
  }

  // Initial render then auto-fit so the whole tree is visible and
  // a margin is left on the left for the floating action buttons.
  update(false, true, true);

  return { root: displayedRoot, svg: treeSvg };
}
