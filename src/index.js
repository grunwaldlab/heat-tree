import { parseNewick } from "./parsers.js"
import {
  hierarchy, select, zoom, cluster, ascending,
  symbol, symbolTriangle, symbolCircle
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
  windowWidth = null,
  windowHeight = null,
  treeWidth = windowWidth,
  treeHeight = windowHeight,
  labelSize = null,
  labelSpacing = 0.1,
) {
  console.log('buildPannableTree')

  // Track the current zoom/pan transform so UI controls
  // can keep a constant on-screen size.
  let currentTransform = { x: 0, y: 0, k: 1 };

  // Infer window dimensions if needed, taking into account padding
  const container = document.querySelector(containerSelector);
  const style = window.getComputedStyle(container);
  if (windowWidth === null) {
    windowWidth = container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  }
  if (windowHeight === null) {
    windowHeight = container.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  }

  // Infer plotted tree dimensions if needed
  if (treeWidth === null) {
    treeWidth = windowWidth;
  }
  if (treeHeight === null) {
    treeHeight = windowHeight;
  }

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
  displayedRoot.each(d => { d.id = ++nodeId; });

  // Use D3 cluster layout to compute node positions (for x coordinate)
  const treeLayout = cluster()
    .size([treeHeight, treeWidth])
    .separation((a, b) => 1);

  // Determine label size and whether it should auto-scale on each update
  let autoLabelSize = false;
  if (labelSize === null) {
    autoLabelSize = true;
    const tipCount = displayedRoot.leaves().length;
    labelSize = treeHeight / tipCount * (1 - labelSpacing);
  }

  // Toolbar with a “Collapse selected” button
  const toolbar = select(containerSelector)
    .insert("div", ":first-child")
    .attr("class", "ht-toolbar")
    .style("margin-bottom", "4px");

  let selectedNode = null; // Currently selected subtree root

  // Button to reset the tree to its original, fully-expanded state
  toolbar.append("button")
    .attr("type", "button")
    .style("margin-left", "8px")
    .text("Reset tree")
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
      svg.attr("transform", "translate(0,0)");

      update();
    });

  // Create an SVG element in the specified container with pan & zoom behavior
  const svg = select(containerSelector)
    .append("svg")
    .attr("width", treeWidth)
    .attr("height", treeHeight)
    .call(
      zoom()
        .filter(event => {
          if (event.type === 'dblclick') return false;
          return true;
        })
        .on("zoom", (event) => {
          currentTransform = event.transform;               // keep latest zoom
          svg.attr("transform", currentTransform);          // move tree
          updateSelectionButtons();                         // reposition buttons
        })
    )
    .append("g")
    .attr("transform", "translate(0,0)");

  // Layer for invisible hit-test rectangles (kept above links/nodes)
  const hitLayer = svg.append("g").attr("class", "hit-layer");

  // Reference to the outer <svg> (not zoomed) – used for UI overlays
  const outerSvg = select(containerSelector).select("svg");

  // Visible bounding-box shown when a subtree is selected
  let selectionRect = svg.append("rect")
    .attr("class", "selection-rect")
    .attr("fill", "none")
    .attr("stroke", "grey")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "5,5")
    .attr("pointer-events", "none")
    .style("display", "none");

  // Floating button group for subtree actions (added to outer SVG so it ignores zoom)
  const selectionBtns = outerSvg.append("g")
    .attr("class", "selection-btns")
    .style("display", "none");

  const buttonSize = 25;
  const buttonMargin = 3;
  const buttonPadding = 3;
  const buttonCornerRadius = 5;

  // First button – collapse the selected subtree
  // ── Collapse-selected button ────────────────────────────────────────────────
  const btnCollapseSelected = selectionBtns.append("g")
    .style("cursor", "pointer")
    .on("click", () => {
      if (selectedNode && selectedNode.children) {
        selectedNode.collapsed_children = selectedNode.children;
        selectedNode.children = null;
        selectedNode = null;
        selectionRect.style("display", "none");
        selectionBtns.style("display", "none");
        update();
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
  const compressScale = (buttonSize - buttonPadding * 2) /
    Math.max(compressBBox.w, compressBBox.h);          // scale by longest side
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

  // Second button – collapse root to the selected subtree
  // ── Collapse-root button ───────────────────────────────────────────────────
  const btnCollapseRoot = selectionBtns.append("g")
    .attr("transform", `translate(0, ${buttonSize + buttonMargin})`)
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
  const expandScale = (buttonSize - buttonPadding * 2) /
    Math.max(expandBBox.w, expandBBox.h);                // scale by longest side
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
    const screenX = selectedNode.y * currentTransform.k + currentTransform.x - buttonSize - buttonMargin;
    const screenY = selectedNode.x0bbox * currentTransform.k + currentTransform.y - buttonMargin;
    selectionBtns
      .attr("transform", `translate(${screenX},${screenY})`)
      .style("display", "block");
  }

  function update(onEnd = null, expanding = false) {
    // Recompute label size if auto-scaling is enabled
    if (autoLabelSize) {
      const tipCount = displayedRoot.leaves().length;
      labelSize = treeHeight / tipCount * (1 - labelSpacing);
    }

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
      return (treeWidth - getLabelWidth(d) - getLabelXOffset(d)) / (d.y || 1);
    }));
    displayedRoot.each(d => d.y = d.y * scaleFactor);

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
    const link = svg.selectAll(".link")
      .data(displayedRoot.links(), d => d.target.id);

    // Shared transition for this update
    const t = svg.transition().duration(500);

    // ENTER links – start at the parent's previous position
    const linkEnter = link.enter().append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#000")
      .attr("stroke-opacity", 1)
      .attr("stroke-width", 1.5)
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
    const node = svg.selectAll(".node")
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
          update(null, true);
        } else if (d === displayedRoot && d.collapsed_parent) { // un-collapse root
          selectedNode = null;
          selectionRect.style("display", "none");
          d.parent = d.collapsed_parent;
          d.collapsed_parent = null;
          displayedRoot = d.ancestors().find(d => d.parent === null || d.collapsed_parent);
          update(null, true);
        }
      });

    // Pre-computed symbol paths used for node icons
    const circlePath = symbol().type(symbolCircle).size(64)();
    const triangleHeight = labelSize * 1.3;
    const triangleArea = triangleAreaFromSide(triangleHeight);
    const trianglePath = symbol().type(symbolTriangle).size(triangleArea)();

    // Append a path that will show a triangle only when subtree is collapsed
    nodeEnter.append("path")
      .attr("class", "node-shape")
      .attr("d", d => (d.collapsed_children || d.collapsed_parent) ? trianglePath : null)
      .attr("fill", "#000")
      .style("display", d => (d.collapsed_children || d.collapsed_parent) ? null : "none");

    // Update collapsed-count labels visibility and text
    svg.selectAll(".collapsed-count")
      .transition(t)
      .text(d => d.collapsed_children ? `Collapsed Subtree (${d.leafCount})` : "")
      .style("font-weight", "bold")
      .style("display", d => d.collapsed_children ? null : "none");

    // Append label for collapsed root
    nodeEnter.append("text")
      .attr("class", "collapsed-root")
      .attr("dy", labelSize / 2.5)
      .attr("x", -triangleHeight)
      .style("text-anchor", "end")
      .style("font-size", `${labelSize}px`)
      .style("font-weight", "bold")
      .text(d => d.collapsed_parent ? `Collapsed Root (${root.leafCount - d.leafCount})` : "")
      .style("display", d => d.collapsed_parent ? null : "none");

    // Update collapsed-root labels
    svg.selectAll(".collapsed-root")
      .transition(t)
      .text(d => d.collapsed_parent ? `Collapsed Root (${root.leafCount - d.leafCount})` : "")
      .style("display", d => d.collapsed_parent ? null : "none");

    // Append text labels for nodes
    nodeEnter.append("text")
      .attr("dy", labelSize / 2.5)
      .attr("x", d => (d.children || d.collapsed_children ? -getLabelXOffset(d) : getLabelXOffset(d)))
      .style("text-anchor", d => (d.children || d.collapsed_children ? "end" : "start"))
      .style("font-size", `${labelSize}px`)
      .text(d => d.data.name || "");

    // Append label showing number of tips in collapsed subtree
    nodeEnter.append("text")
      .attr("class", "collapsed-count")
      .attr("dy", labelSize / 2.5)
      .attr("x", triangleHeight)
      .style("text-anchor", "start")
      .style("font-size", `${labelSize}px`)
      .text(d => d.collapsed_children ? `${d.leafCount} collapsed tips` : "")
      .style("display", d => d.collapsed_children ? null : "none");

    // Update visibility and orientation of node-shapes (triangles)
    const nodeShapes = svg.selectAll(".node-shape")
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
    svg.selectAll(".node text")
      .attr("dy", labelSize / 2.5)
      .style("font-size", `${labelSize}px`);

    svg.selectAll(".collapsed-root")
      .attr("dy", labelSize / 2.5)
      .style("font-size", `${labelSize}px`);

    svg.selectAll(".collapsed-count")
      .attr("dy", labelSize / 2.5)
      .style("font-size", `${labelSize}px`);

    // Store current positions for the next update so every branch has
    // previous coordinates to interpolate from.
    displayedRoot.each(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  update();


  // The estimated width in pixels of the printed label
  function getLabelWidth(node) {
    const nameLen = node.data.name ? node.data.name.length : 0;
    return nameLen * labelSize * 0.65;
  }

  // The width in pixels of how far the begining of labels are moved right
  function getLabelXOffset(node) {
    return labelSize / 3
  }

  // The width in pixels of how far the begining of labels are moved down
  function getLabelYOffset(node) {
    return labelSize / 2.5
  }

  function triangleSideFromArea(area) {
    return Math.sqrt(2.309401 * area); // 2.309401 = 4 / sqrt(3)
  }

  function triangleAreaFromSide(side) {
    return 0.4330127 * side * side; // 0.4330127 == sqrt(3) / 4
  }

  return { root: displayedRoot, svg };
}


