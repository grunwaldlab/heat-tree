import { parseNewick } from "./parsers.js"
import { hierarchy, tree, select, linkHorizontal, zoom, cluster, ascending } from "d3";

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

  // Create a D3 hierarchy from the tree data
  const root = hierarchy(treeData, d => d.children)
    .sum(d => d.children ? 0 : 1)
    .sort((a, b) => (a.value - b.value) || ascending(a.data.length, b.data.length));

  // ------------------------------------------------------------------
  // Assign a stable, unique id to every node so D3 can track elements
  // across updates.  Stable keys ensure *all* links animate smoothly.
  // ------------------------------------------------------------------
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
    console.log(`labelSize: ${labelSize}`);
    console.log(`tipCount: ${tipCount}`);
  }

  // Create an SVG element in the specified container with pan & zoom behavior
  const svg = select(containerSelector)
    .append("svg")
    .attr("width", treeWidth)
    .attr("height", treeHeight)
    .call(zoom().on("zoom", (event) => {
      svg.attr("transform", event.transform);
    }))
    .append("g")
    .attr("transform", "translate(0,0)");

  function update() {
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
    const scaleFactor = Math.min(...root.leaves().map(d => {
      const nameLen = d.data.name ? d.data.name.length : 0;
      return (treeWidth - nameLen * labelSize * 0.65) / (d.y || 1);
    }));
    root.each(d => d.y = d.y * scaleFactor);

    // DATA JOIN for links (use stable target.id as key)
    const link = svg.selectAll(".link")
      .data(root.links(), d => d.target.id);

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
    linkUpdate.transition().duration(750)
      .attr("d", d => `M${d.source.y},${d.source.x} V${d.target.x} H${d.target.y}`);

    // EXIT links – collapse back to the parent's new position
    link.exit().transition().duration(750)
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
    node.transition().duration(750)
      .attr("transform", d => `translate(${d.y},${d.x})`);
    const nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.y},${d.x})`)
      .on("click", (event, d) => {
        if (d.children) {
          d._children = d.children;
          d.children = null;
        } else if (d._children) {
          d.children = d._children;
          d._children = null;
        }
        update();
      });

    // Append circles for nodes
    nodeEnter.append("circle")
      .attr("r", 4)
      .attr("fill", "#000");

    // Append text labels for nodes
    nodeEnter.append("text")
      .attr("dy", labelSize / 2.5)
      .attr("x", d => (d.children || d._children ? -labelSize : labelSize))
      .style("text-anchor", d => (d.children || d._children ? "end" : "start"))
      .style("font-size", `${labelSize}px`)
      .text(d => d.data.name || "");

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
