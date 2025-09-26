import { parseNewick } from "./parsers.js"
import {
  hierarchy, select, zoom, zoomIdentity, cluster, ascending,
  symbol, symbolTriangle,
} from "d3";

export { parseNewick }

/**
 * Main function to initialize the heat-tree visualization.
 * @param {object} options - Initialization options.
 */
export function heatTree(options = {}) {
  if (options.newick) {
    const treeData = parseNewick(options.newick);
    console.log("Parsed tree data:", treeData);
  }
  console.log('hello world')
}

export function buildPannableTree(
  newickStr,
  containerSelector,
  labelSpacing = 0.1,
  zoomInitiallyEnabled = true,
) {

  // Set constant display settings
  const buttonSize = 25;
  const controlsMargin = 3;
  const buttonPadding = 3;
  const buttonCornerRadius = 5;
  const legendElementHeight = 25;
  const nodeLabelSizeScale = 0.66;
  const maxLabelWidthProportion = 0.03;
  const branchThicknessProp = 0.2;

  // Scale-bar width limits (pixels)
  const SCALE_BAR_MIN_PX = 60;
  const SCALE_BAR_MAX_PX = 150;

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
    .style("display", "flex")                 // lay out buttons in a row
    .style("gap", `${controlsMargin}px`)      // gap between buttons
    .style("align-items", "flex-start");      // align to the top/left
  const treeDiv = widgetDiv
    .append("div")
    .attr("class", "ht-tree")
    .style("flex", "1 1 auto")
    .style("min-height", "0")
  const legendDiv = widgetDiv
    .append("div")
    .attr("class", "ht-legend")
    .style("flex", "0 0 auto")
    .style("margin-top", "4px");

  // ---------------- Branch length scale bar -----------------
  const scaleBarEdgeHeight = 6;
  const scaleBarSvg = legendDiv.append("svg")
    .attr("class", "ht-scale-bar")
    .attr("width", "100%")
    .attr("height", legendElementHeight);

  const scaleBarGroup = scaleBarSvg.append("g")
    .attr("transform", `translate(1,${legendElementHeight - scaleBarEdgeHeight})`)
    .attr("stroke", "#000")
    .attr("stroke-width", 2)
    .attr("fill", "none");

  // main bar and ticks
  scaleBarGroup.append("line").attr("class", "bar");
  scaleBarGroup.append("line").attr("class", "left-tick");
  scaleBarGroup.append("line").attr("class", "right-tick");
  // label
  scaleBarGroup.append("text")
    .attr("class", "label")
    .attr("dy", -scaleBarEdgeHeight)
    .attr("text-anchor", "middle")
    .attr("stroke-width", 1)
    .style("font-size", "12px");

  // helper to choose a “nice” rounded scale bar length
  function niceNumber(n) {
    const exponent = Math.floor(Math.log10(n));
    const fraction = n / Math.pow(10, exponent);
    let niceFraction;
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
    return niceFraction * Math.pow(10, exponent);
  }

  // Update the scale-bar graphics according to current pixel-per-unit scale
  function updateScaleBar(pxPerUnit) {
    if (!isFinite(pxPerUnit) || pxPerUnit <= 0) return;

    // choose an initial “nice” distance then adjust to keep bar within limits
    let units = niceNumber(1);      // start from 1 unit
    let barPx = units * pxPerUnit;

    // expand / shrink until within [min,max] pixels
    if (barPx < SCALE_BAR_MIN_PX || barPx > SCALE_BAR_MAX_PX) {
      // estimate a closer starting length
      units = niceNumber(SCALE_BAR_MIN_PX / pxPerUnit);
      barPx = units * pxPerUnit;
    }
    while (barPx < SCALE_BAR_MIN_PX) {
      units *= 2;
      barPx = units * pxPerUnit;
    }
    while (barPx > SCALE_BAR_MAX_PX) {
      units /= 2;
      barPx = units * pxPerUnit;
    }

    // bar & ticks
    scaleBarGroup.select(".bar")
      .attr("x1", 0).attr("y1", 0)
      .attr("x2", barPx).attr("y2", 0);

    scaleBarGroup.select(".left-tick")
      .attr("x1", 0).attr("y1", -5)
      .attr("x2", 0).attr("y2", 5);

    scaleBarGroup.select(".right-tick")
      .attr("x1", barPx).attr("y1", -5)
      .attr("x2", barPx).attr("y2", 5);

    // centre label
    scaleBarGroup.select(".label")
      .attr("x", barPx / 2)
      .text(units.toPrecision(3));
  }

  // Toggle state for user-initiated zooming/panning
  let zoomEnabled = zoomInitiallyEnabled;

  // Track the current zoom/pan transform so UI controls
  // can keep a constant on-screen size.
  let currentTransform = { x: 0, y: 0, k: 1 };

  // Pixel-per-branch-length unit before zoom is applied
  let basePxPerUnit = 1;

  // Currently selected subtree root
  let selectedNode = null;

  // SVG button to reset the tree to its original, fully-expanded state
  const btnReset = toolbarDiv.append("div")
    .style("flex", "0 0 auto")
    .append("svg")
    .attr("width", buttonSize)
    .attr("height", buttonSize)
    .style("cursor", "pointer")
    .on("click", () => {
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

  // Background rectangle for the button
  btnReset.append("rect")
    .attr("width", buttonSize)
    .attr("height", buttonSize)
    .attr("rx", buttonCornerRadius)
    .attr("ry", buttonCornerRadius)
    .attr("fill", "#CCC");

  // Referesh icon
  const refreshIcon = btnReset.append("g")
    .attr("stroke", "#555")
    .attr("fill", "none")
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("stroke-width", 2);
  refreshIcon.append("path")
    .attr("d", "M8 4a8 8 0 1 0 8 8 M8 4V0l4 4-4 4V4");


  // Calculate scale & translation for the refresh icon
  const refreshBBox = refreshIcon.node().getBBox(); // native icon bounds
  const refreshScale = (buttonSize - buttonPadding * 2) / Math.max(refreshBBox.width, refreshBBox.height);
  const refreshTx = (buttonSize - refreshBBox.width * refreshScale) / 2;
  const refreshTy = (buttonSize - refreshBBox.height * refreshScale) / 2;

  // Draw refresh icon (circular arrow)
  refreshIcon
    .attr("transform", `translate(${refreshTx},${refreshTy}) scale(${refreshScale})`);

  // ---------- Toggle Zoom/Pan button ----------
  const btnToggleZoom = toolbarDiv.append("div")
    .style("flex", "0 0 auto")
    .append("svg")
    .attr("width", buttonSize)
    .attr("height", buttonSize)
    .style("cursor", "pointer")
    .on("click", () => {
      zoomEnabled = !zoomEnabled;
      updateToggleZoomAppearance();
    });

  const btnToggleBg = btnToggleZoom.append("rect")
    .attr("width", buttonSize)
    .attr("height", buttonSize)
    .attr("rx", buttonCornerRadius)
    .attr("ry", buttonCornerRadius)
    .attr("fill", "#CCC");

  const arrowsIcon = btnToggleZoom.append("g")
    .attr("stroke", "#555")
    .attr("fill", "none")
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("stroke-width", 2);

  [
    "M10 8 H16 M16 8 L14 6 M16 8 L14 10",
    "M6 8 H0 M0 8 L2 6 M0 8 L2 10",
    "M8 6 V0 M8 0 L6 2 M8 0 L10 2",
    "M8 10 V16 M8 16 L6 14 M8 16 L10 14"
  ].forEach(d => arrowsIcon.append("path").attr("d", d));

  // Calculate scale & translation for the refresh icon
  const arrowsBBox = arrowsIcon.node().getBBox(); // native icon bounds
  const arrowsScale = (buttonSize - buttonPadding * 2) / Math.max(arrowsBBox.width, arrowsBBox.height);
  const arrowsTx = (buttonSize - arrowsBBox.width * arrowsScale) / 2;
  const arrowsTy = (buttonSize - arrowsBBox.height * arrowsScale) / 2;

  // Draw refresh icon (circular arrow)
  arrowsIcon
    .attr("transform", `translate(${arrowsTx},${arrowsTy}) scale(${arrowsScale})`);

  function updateToggleZoomAppearance() {
    btnToggleBg.attr("fill", zoomEnabled ? "#CCC" : "#EEE");
  }
  updateToggleZoomAppearance();

  let treeSvg; // group containing the rendered tree

  // Outer SVG that receives zoom / pan
  const outerSvg = treeDiv
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%");

  // Re-usable zoom behaviour so we can reset it programmatically
  const treeZoom = zoom()
    .filter(event => {
      if (!zoomEnabled) return false;      // honour toggle button
      if (event.type === 'dblclick') return false;
      return true;
    })
    .on("zoom", (event) => {
      currentTransform = event.transform;          // keep latest zoom
      treeSvg.attr("transform", currentTransform); // move tree
      updateSelectionButtons();                    // reposition buttons
      updateScaleBar(basePxPerUnit * currentTransform.k); // rescale bar
    });

  // Attach zoom behaviour to the outer SVG
  outerSvg.call(treeZoom);

  // Group that holds all tree graphics (subject to zoom / pan)
  treeSvg = outerSvg.append("g");

  // Layer for invisible hit-test rectangles (kept above links/nodes)
  const hitLayer = treeSvg.append("g").attr("class", "hit-layer");

  // Reference to the outer <svg> (not zoomed) – used for UI overlays
  const overlaySvg = treeDiv.select("svg");

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
  const btnCollapseSelected = selectionBtns.append("g")
    .style("cursor", "pointer")
    .on("click", () => {
      if (selectedNode && selectedNode.children) {
        selectedNode.collapsed_children = selectedNode.children;
        selectedNode.children = null;
        selectedNode = null;
        selectionRect.style("display", "none");
        selectionBtns.style("display", "none");
        update(null, false, false);
      }
    });
  btnCollapseSelected.insert("rect", ":first-child")
    .attr("width", buttonSize)
    .attr("height", buttonSize)
    .attr("rx", buttonCornerRadius)
    .attr("ry", buttonCornerRadius)
    .attr("fill", "#CCC");

  // Calculate centering transform for compress icon
  const compressBBox = { w: 14, h: 18 };                                 // icon native bounds
  const compressScale = (buttonSize - buttonPadding * 2) / Math.max(compressBBox.w, compressBBox.h);
  const compressTx = (buttonSize - compressBBox.w * compressScale) / 2; // horizontal centering
  const compressTy = (buttonSize - compressBBox.h * compressScale) / 2; // vertical   centering

  // draw “compress” icon paths
  const compressIcon = btnCollapseSelected.append("g")
    .attr("transform", `translate(${compressTx},${compressTy}) scale(${compressScale})`)
    .attr("stroke", "#555")
    .attr("fill", "none")
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("stroke-width", 2);

  [
    "M4.5 4.5 L7.5 7.5 L10.5 4.5",
    "M7.5 0.5 V7.5",
    "M4.5 14.5 L7.5 11.5 L10.5 14.5",
    "M7.5 11.5 V18.5",
    "M0.5 9.5 H14.5"
  ].forEach(d => compressIcon.append("path").attr("d", d));

  // Button to collapse root to the selected subtree
  const btnCollapseRoot = selectionBtns.append("g")
    .attr("transform", `translate(0, ${buttonSize + controlsMargin})`)
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
  btnCollapseRoot.insert("rect", ":first-child")
    .attr("width", buttonSize)
    .attr("height", buttonSize)
    .attr("rx", buttonCornerRadius)
    .attr("ry", buttonCornerRadius)
    .attr("fill", "#CCC");

  // Calculate centering transform for expand icon
  const expandBBox = { w: 16.02, h: 18 };                                 // icon native bounds
  const expandScale = (buttonSize - buttonPadding * 2) / Math.max(expandBBox.w, expandBBox.h);
  const expandTx = (buttonSize - expandBBox.w * expandScale) / 2;       // horizontal centering
  const expandTy = (buttonSize - expandBBox.h * expandScale) / 2;       // vertical   centering

  // draw “expand” icon paths
  const expandIcon = btnCollapseRoot.append("g")
    .attr("transform", `translate(${expandTx},${expandTy}) scale(${expandScale})`)
    .attr("stroke", "#555")
    .attr("fill", "none")
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("stroke-width", 2);

  [
    { d: "M16.51 0.51 H0.49" },
    { d: "M16.51 18.51 H0.49" },
    { d: "m6.503 18.525 4-4 -4-4.015", transform: "matrix(0 1 -1 0 23.021 6.015)" },
    { d: "m10.503 8.525 -4-4 4-4.015", transform: "matrix(0 1 -1 0 13.021 -3.985)" },
    { d: "M8.51 16.51 V2.51" }
  ].forEach(p => {
    const path = expandIcon.append("path").attr("d", p.d);
    if (p.transform) path.attr("transform", p.transform);
  });

  // Helper to position / toggle the floating button group
  function updateSelectionButtons() {
    if (!selectedNode) {
      selectionBtns.style("display", "none");
      return;
    }
    const screenX = selectedNode.y * currentTransform.k + currentTransform.x - buttonSize - controlsMargin;
    const screenY = selectedNode.x0bbox * currentTransform.k + currentTransform.y - controlsMargin;
    selectionBtns
      .attr("transform", `translate(${screenX},${screenY})`)
      .style("display", "block");
  }

  function update(onEnd = null, expanding = false, fit = true) {

    // Ensure the full tree is visible with extra space on the left for
    // the floating selection buttons.  This is invoked after the very
    // first render and every time the user clicks the “reset” button.
    function fitToView() {
      // Extra space needed on the left for the button column
      const marginLeft = buttonSize + controlsMargin;

      // Size of rendered tree in the internal coordinate system
      const treeWidth = displayedRoot.y1bbox + getLabelWidth(displayedRoot);                       // 0 … max-x
      const treeHeight = displayedRoot.x1bbox - displayedRoot.x0bbox; // y-span

      const { width: viewW, height: viewH } = treeDiv.select('svg').node().getBoundingClientRect();

      // Find a uniform scale that fits the tree (after margin) in both axes
      let k = 1;
      if (treeWidth + marginLeft > viewW) k = (viewW - marginLeft) / treeWidth;
      if (treeHeight * k > viewH) k = viewH / treeHeight;

      if (!Number.isFinite(k) || k <= 0) k = 1;

      // Translate so left margin is honoured and tree is vertically centred
      const tx = Math.max(marginLeft, getLabelWidth(displayedRoot) * k);
      const ty = (viewH - treeHeight * k) / 2 - displayedRoot.x0bbox * k;

      const transform = zoomIdentity.translate(tx, ty).scale(k);
      // Apply through zoom behaviour so internal state & listeners update
      overlaySvg.call(treeZoom.transform, transform);
    }

    // The estimated width in pixels of the printed label
    function getLabelWidth(node) {
      let nameLen;
      if (node.collapsed_children) {
        nameLen = node.collapsed_children_name ? node.collapsed_children_name.length : 0;
      } else if (node.collapsed_parent) {
        nameLen = node.collapsed_parent_name ? node.collapsed_parent_name.length : 0;
      } else {
        nameLen = node.data.name ? node.data.name.length : 0;
      }
      return nameLen * leafLabelSize * 0.65;
    }

    // The width in pixels of how far the begining of labels are moved right
    function getLabelXOffset(node) {
      return fontSizeForNode(node) / 3
    }

    // The width in pixels of how far the begining of labels are moved down
    function getLabelYOffset(node) {
      return fontSizeForNode(node) / 2.5
    }

    function triangleSideFromArea(area) {
      return Math.sqrt(2.309401 * area); // 2.309401 = 4 / sqrt(3)
    }

    function triangleAreaFromSide(side) {
      return 0.4330127 * side * side; // 0.4330127 == sqrt(3) / 4
    }

    // Helper functions for node label sizing & positioning
    function fontSizeForNode(d) {
      return (d.children || d.collapsed_children)
        ? leafLabelSize * nodeLabelSizeScale     // interior node
        : leafLabelSize;                         // leaf
    }

    // Return the appropriate vertical offset (dy) so interior node
    // labels stay on the opposite side of the branch line from
    // their parent to avoid overlap.
    function computeDy(d) {
      const size = fontSizeForNode(d);
      if (d.children || d.collapsed_children) {
        if (d.collapsed_parent) {
          return leafLabelSize * 1.2;
        } else {
          const parentBelow = d.parent && d.parent.x > d.x;
          return parentBelow ? - size * 0.3 : size * 1;
        }
      }
      return size / 2.5; // leaves unchanged
    }


    // Infer window dimensions if needed, taking into account padding
    let treeDivSize = treeDiv.select('svg').node().getBoundingClientRect();

    // Infer label size based on room available
    const tipCount = displayedRoot.leaves().length;
    let leafLabelSize = treeDivSize.height / tipCount * (1 - labelSpacing);
    if (leafLabelSize > maxLabelWidthProportion * treeDivSize.width) {
      leafLabelSize = maxLabelWidthProportion * treeDivSize.width;
    }

    // Branch thickness proportional to label font size
    const branchWidth = leafLabelSize * branchThicknessProp;

    // Use D3 cluster layout to compute node positions (for x coordinate)
    let treeLayout = cluster()
      .size([treeDivSize.height, treeDivSize.width])
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

    const scaleFactor = Math.min(...displayedRoot.leaves().map(d => {
      return (treeDivSize.width - getLabelWidth(d) - getLabelXOffset(d)) / d.y;
    }));

    // Store base pixel-per-unit and refresh scale bar for current zoom level
    basePxPerUnit = scaleFactor;
    updateScaleBar(basePxPerUnit * currentTransform.k);
    displayedRoot.each(d => d.y = d.y * scaleFactor);

    // Set the names for collapsed parents and children
    root.each(d => {
      if (d.collapsed_parent) {
        d.collapsed_parent_name = `Collapsed Root (${root.leafCount - d.leafCount})`;
      }
      if (d.collapsed_children) {
        d.collapsed_children_name = `Collapsed Subtree (${d.leafCount})`;
      }
    });

    // Compute bounding rectangles for every subtree node
    displayedRoot.eachAfter(d => {
      if (d.children) {                     // only visible children count
        const kids = d.children;
        d.x0bbox = Math.min(...kids.map(k => k.x0bbox));
        d.x1bbox = Math.max(...kids.map(k => k.x1bbox));
        d.y1bbox = Math.max(...kids.map(k => k.y1bbox));
      } else { // leaf OR collapsed node
        d.x0bbox = d.x - getLabelYOffset(d);
        d.x1bbox = d.x + getLabelYOffset(d);
        d.y1bbox = d.y + getLabelXOffset(d) + getLabelWidth(d);
      }
    });

    if (fit || !zoomEnabled) fitToView();

    // Hide selection rectangle if the node was collapsed,
    // otherwise reposition it with the updated layout.
    if (selectedNode && !selectedNode.children) {
      selectedNode = null;
      selectionRect.style("display", "none");
    } else if (selectedNode) {
      selectionRect
        .attr("x", selectedNode.y)
        .attr("y", selectedNode.x0bbox)
        .attr("width", selectedNode.y1bbox - selectedNode.y)
        .attr("height", selectedNode.x1bbox - selectedNode.x0bbox);
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
          .attr("x", node.y)
          .attr("y", node.x0bbox)
          .attr("width", node.y1bbox - node.y)
          .attr("height", node.x1bbox - node.x0bbox)
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
      .attr("x", d => d.y)
      .attr("y", d => d.x0bbox)
      .attr("width", d => d.y1bbox - d.y)
      .attr("height", d => d.x1bbox - d.x0bbox);

    // Deeper nodes (greater depth) rendered above shallower ones
    hitLayer.selectAll(".hit").sort((a, b) => a.depth - b.depth);

    // DATA JOIN for links (use stable target.id as key)
    const link = treeSvg.selectAll(".link")
      .data(displayedRoot.links(), d => d.target.id);

    // Shared transition for this update
    const t = treeSvg.transition().duration(500);

    // ENTER links – start at the parent's previous position
    const linkEnter = link.enter().append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#000")
      .attr("stroke-opacity", 1)
      .attr("stroke-width", branchWidth)
      .attr("d", d => {
        const sy = d.source.y0 ?? d.source.y;
        const sx = d.source.x0 ?? d.source.x;
        return `M${sy},${sx}`;
      })
      .lower(); // make sure branches appear below selection hit layers

    // UPDATE + ENTER => one unified selection
    const linkUpdate = linkEnter.merge(link);

    // UPDATE links to new position
    linkUpdate.transition(t)
      .attr("stroke-width", branchWidth)
      .attr("d", d => `M${d.source.y},${d.source.x} V${d.target.x} H${d.target.y}`);

    // EXIT links – collapse back to the parent's new position
    link.exit().transition(t)
      .attr("d", d => {
        const sy = d.source.y;
        const sx = d.source.x;
        return `M${sy},${sx}`;
      })
      .remove();

    // DATA JOIN for nodes (use stable id)
    const node = treeSvg.selectAll(".node")
      .data(displayedRoot.descendants(), d => d.id);
    node.exit().remove();
    node.transition(t)
      .attr("transform", d => `translate(${d.y},${d.x})`);
    const nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.y},${d.x})`)
      .on("click", (event, d) => {
        if (d.collapsed_children) {       // expand (delayed reveal)
          d.children = d.collapsed_children;
          d.collapsed_children = null;
          update(null, true, false);
        } else if (d === displayedRoot && d.collapsed_parent) { // un-collapse root
          selectedNode = null;
          selectionRect.style("display", "none");
          d.parent = d.collapsed_parent;
          d.collapsed_parent = null;
          displayedRoot = d.ancestors().find(d => d.parent === null || d.collapsed_parent);
          update(null, true, true);
        }
      });

    // Pre-computed symbol paths used for node icons
    let triangleHeight = leafLabelSize * 1.1;
    let triangleArea = triangleAreaFromSide(triangleHeight);
    let trianglePath = symbol().type(symbolTriangle).size(triangleArea)();

    // Append a path that will show a triangle only when subtree is collapsed
    nodeEnter.append("path")
      .attr("class", "node-shape")
      .attr("d", d => (d.collapsed_children || d.collapsed_parent) ? trianglePath : null)
      .attr("fill", "#000")
      .style("display", d => (d.collapsed_children || d.collapsed_parent) ? null : "none");

    // Update collapsed-subtree labels visibility and text
    treeSvg.selectAll(".collapsed-subtree")
      .transition(t)
      .attr("dy", leafLabelSize / 2.5)
      .attr("x", triangleHeight)
      .text(d => d.collapsed_children ? d.collapsed_children_name : "")
      .style("font-weight", "bold")
      .style("display", d => d.collapsed_children ? null : "none");

    // Append label for collapsed root
    nodeEnter.append("text")
      .attr("class", "collapsed-root")
      .attr("dy", leafLabelSize / 2.5)
      .attr("x", -triangleHeight)
      .style("text-anchor", "end")
      .style("font-size", `${leafLabelSize}px`)
      .style("font-weight", "bold")
      .text(d => d.collapsed_parent ? d.collapsed_parent_name : "")
      .style("display", d => d.collapsed_parent ? null : "none");

    // Update collapsed-root labels
    treeSvg.selectAll(".collapsed-root")
      .transition(t)
      .attr("dy", leafLabelSize / 2.5)
      .attr("x", -triangleHeight)
      .text(d => d.collapsed_parent ? d.collapsed_parent_name : "")
      .style("display", d => d.collapsed_parent ? null : "none");

    // Append text labels for nodes
    nodeEnter.append("text")
      .attr("dy", d => computeDy(d))
      .attr("x", d => (d.children || d.collapsed_children ? -getLabelXOffset(d) : getLabelXOffset(d)))
      .style("text-anchor", d => (d.children || d.collapsed_children ? "end" : "start"))
      .style("font-size", d => `${fontSizeForNode(d)}px`)
      .text(d => d.data.name || "");

    // Append label showing number of tips in collapsed subtree
    nodeEnter.append("text")
      .attr("class", "collapsed-subtree")
      .attr("dy", leafLabelSize / 2.5)
      .attr("x", triangleHeight)
      .style("text-anchor", "start")
      .style("font-size", `${leafLabelSize}px`)
      .text(d => d.collapsed_children ? `${d.leafCount} collapsed tips` : "")
      .style("display", d => d.collapsed_children ? null : "none");

    // Update visibility and orientation of node-shapes (triangles)
    const nodeShapes = treeSvg.selectAll(".node-shape")
      // set translate offset immediately (no transition)
      .attr("transform", d => `rotate(-90) translate(0, ${(d.collapsed_parent ? -0.33 : 0.52) * triangleHeight})`)
      .style("display", d => (d.collapsed_children || d.collapsed_parent) ? null : "none");

    // animate only the shape/path changes (e.g., rotation)
    nodeShapes.transition(t)
      .attr("d", d => (d.collapsed_children || d.collapsed_parent) ? trianglePath : null);

    // Delay the appearance of newly-entered subtree when expanding
    if (expanding) {
      linkEnter.attr("opacity", 0);
      nodeEnter.attr("opacity", 0);
    }

    t.on("end", () => {
      if (expanding) {
        linkEnter.transition().duration(150).attr("opacity", 1);
        nodeEnter.transition().duration(150).attr("opacity", 1);
      }
      if (onEnd) onEnd();
    });

    // Update label font sizes and offsets according to the latest labelSize
    treeSvg.selectAll(".node text")
      .attr("dy", d => computeDy(d))
      .style("font-size", d => `${fontSizeForNode(d)}px`);

    treeSvg.selectAll(".collapsed-root")
      .attr("dy", leafLabelSize / 2.5)
      .style("font-size", `${leafLabelSize}px`);

    treeSvg.selectAll(".collapsed-subtree")
      .attr("dy", leafLabelSize / 2.5)
      .style("font-size", `${leafLabelSize}px`);

    // Store current positions for the next update so every branch has
    // previous coordinates to interpolate from.
    displayedRoot.each(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  // Initial render then auto-fit so the whole tree is visible and
  // a margin is left on the left for the floating action buttons.
  update();



  return { root: displayedRoot, svg: treeSvg };
}


