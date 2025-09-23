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
    .sort((a, b) => (a.value - b.value) || ascending(a.data.length, b.data.length));

  // Assign a stable, unique id to every node so D3 can track elements across updates
  let nodeId = 0;
  root.each(d => { d.id = ++nodeId; });

  // Use D3 cluster layout to compute node positions (for x coordinate)
  const treeLayout = cluster()
    .size([treeHeight, treeWidth])
    .separation((a, b) => 1);

  // Infer lable size if needed
  if (labelSize === null) {
    const tipCount = root.leaves().length;
    labelSize = treeHeight / tipCount * (1 - labelSpacing);
  }

  // Pre-computed symbol paths used for node icons
  const circlePath = symbol().type(symbolCircle).size(64)();
  const trianglePath = symbol().type(symbolTriangle).size(64)();

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
    treeLayout(root);

    // Apply branch lengths override
    root.each(d => {
      if (d.parent) {
        d.y = d.parent.y + (d.data.length ? d.data.length : 0);
      } else {
        d.y = 0;
      }
    });

    // The estimated width in pixels of the printed label
    function getLabelWidth(node) {
      const nameLen = node.data.name ? node.data.name.length : 0;
      return nameLen * labelSize * 0.65;
    }

    // The width in pixels of how far the begining of labels are moved right
    function getLabelXOffset(node) {
      return labelSize
    }

    // The width in pixels of how far the begining of labels are moved down
    function getLabelYOffset(node) {
      return labelSize / 2.5
    }

    const scaleFactor = Math.min(...root.leaves().map(d => {
      return (treeWidth - getLabelWidth(d) - getLabelXOffset(d)) / (d.y || 1);
    }));
    root.each(d => d.y = d.y * scaleFactor);

    // Compute bounding rectangles for every subtree node
    root.eachAfter(d => {
      if (d.children || d.collapsed_children) {
        const kids = (d.children || d.collapsed_children);
        d.x0bbox = Math.min(...kids.map(k => k.x0bbox));
        d.x1bbox = Math.max(...kids.map(k => k.x1bbox));
        d.y1bbox = Math.max(...kids.map(k => k.y1bbox));
      } else { // is leaf
        d.x0bbox = d.x - getLabelYOffset(d);
        d.x1bbox = d.x + getLabelYOffset(d);
        d.y1bbox = d.y + getLabelXOffset(d) + getLabelWidth(d);
      }
    });

    // Update invisible hit rectangles for every subtree
    const hits = hitLayer.selectAll(".hit")
      .data(root.descendants(), d => d.id);
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
      .data(root.links(), d => d.target.id);

    // Shared transition for this update
    const t = svg.transition().duration(750);

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
      });

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
      .data(root.descendants(), d => d.id);
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
        }
      });

    // Append circles for nodes
    nodeEnter.append("circle")
      .attr("r", 4)
      .attr("fill", "#000");

    // Append text labels for nodes
    nodeEnter.append("text")
      .attr("dy", labelSize / 2.5)
      .attr("x", d => (d.children || d.collapsed_children ? -getLabelXOffset(d) : getLabelXOffset(d)))
      .style("text-anchor", d => (d.children || d.collapsed_children ? "end" : "start"))
      .style("font-size", `${labelSize}px`)
      .text(d => d.data.name || "");

    // Update icon (circle / triangle) for all nodes
    nodeEnter.select(".node-shape")
      .transition(t)
      .attr("d", d => d.collapsed_children ? trianglePath : circlePath)
      .attr("transform", d => d.collapsed_children ? "rotate(-90)" : null)
      .attr("dy", labelSize / 2.5)
      .attr("x", d => (d.children || d.collapsed_children ? -getLabelXOffset(d) : getLabelXOffset(d)))
      .style("text-anchor", d => (d.children || d.collapsed_children ? "end" : "start"))
      .style("font-size", `${labelSize}px`)
      .text(d => d.data.name || "");

    // Delay the appearance of newly-entered subtree when expanding
    if (expanding) {
      linkEnter.attr("opacity", 0);
      nodeEnter.attr("opacity", 0);
    }

    t.on("end", () => {
      if (expanding) {
        linkEnter.transition().duration(250).attr("opacity", 1);
        nodeEnter.transition().duration(250).attr("opacity", 1);
      }
      if (onEnd) onEnd();
    });

    // Store current positions for the next update so every branch has
    // previous coordinates to interpolate from.
    root.each(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  update();


  return { root, svg };
}
