import { parseNewick } from "./parsers.js"
import {
  hierarchy, tree, select, linkHorizontal, zoom, cluster, ascending,
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

  // Infer lable size if needed
  if (labelSize === null) {
    const tipCount = displayedRoot.leaves().length;
    labelSize = treeHeight / tipCount * (1 - labelSpacing);
  }

  // Toolbar with a “Collapse selected” button
  const toolbar = select(containerSelector)
    .insert("div", ":first-child")
    .attr("class", "ht-toolbar")
    .style("margin-bottom", "4px");

  let selectedNode = null; // Currently selected subtree root
  toolbar.append("button")
    .attr("type", "button")
    .text("Collapse selected")
    .on("click", () => {
      if (selectedNode && selectedNode.children) {
        selectedNode.collapsed_children = selectedNode.children;
        selectedNode.children = null;
        selectedNode = null;
        selectionRect.style("display", "none");
        update();
      }
    });

  // Button to collapse the current root to the selected subtree
  toolbar.append("button")
    .attr("type", "button")
    .style("margin-left", "8px")
    .text("Collapse root")
    .on("click", () => {
      if (selectedNode && selectedNode !== displayedRoot) {
        displayedRoot = selectedNode;
        displayedRoot.collapsed_parent = displayedRoot.parent;
        displayedRoot.parent = null;
        selectedNode = null;
        selectionRect.style("display", "none");
        update();
      }
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
          svg.attr("transform", event.transform);
        })
    )
    .append("g")
    .attr("transform", "translate(0,0)");

  // Layer for invisible hit-test rectangles (kept above links/nodes)
  const hitLayer = svg.append("g").attr("class", "hit-layer");

  // Visible bounding-box shown when a subtree is selected
  let selectionRect = svg.append("rect")
    .attr("class", "selection-rect")
    .attr("fill", "none")
    .attr("stroke", "grey")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "5,5")
    .attr("pointer-events", "none")
    .style("display", "none");

  function update(onEnd = null, expanding = false) {

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
    console.log(`scaleFactor: ${scaleFactor}`)

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
      } else {
        selectedNode = node;
        selectionRect
          .attr("x", node.y)
          .attr("y", node.x0bbox)
          .attr("width", node.y1bbox - node.y)
          .attr("height", node.x1bbox - node.x0bbox)
          .style("display", "block");
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


