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

  // Use D3 cluster layout to compute node positions (for x coordinate)
  const treeLayout = cluster()
    .size([treeHeight, treeWidth])
    .separation((a, b) => 1);
  treeLayout(root);

  // Infer lable size if needed
  if (labelSize === null) {
    const tipCount = root.leaves().length;
    labelSize = treeHeight / tipCount * (1 - labelSpacing);
    console.log(`labelSize: ${labelSize}`);
    console.log(`tipCount: ${tipCount}`);
  }

  // Override y coordinate using branch lengths encoded as "length"
  root.each(d => {
    if (d.parent) {
      d.y = d.parent.y + (d.data.length ? d.data.length : 0);
    } else {
      d.y = 0;
    }
  });
  const scaleFactor = Math.min(...root.leaves().map(d => (treeWidth - d.data.name.length * labelSize * 0.65) / d.y));
  root.each(d => d.y = d.y * scaleFactor);

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

  // Create links between nodes with right-angled connectors
  svg.selectAll(".link")
    .data(root.links())
    .enter().append("path")
    .attr("class", "link")
    .attr("fill", "none")
    .attr("stroke", "#000")
    .attr("stroke-opacity", 1)
    .attr("stroke-treeWidth", 1.5)
    .attr("d", d => `M${d.source.y},${d.source.x} V${d.target.x} H${d.target.y}`);

  // Create node groups
  const node = svg.selectAll(".node")
    .data(root.descendants())
    .enter().append("g")
    .attr("class", "node")
    .attr("transform", d => `translate(${d.y},${d.x})`);

  // Append circles for nodes
  // node.filter(d => !d.children)
  //   .append("circle")
  //   .attr("r", 4)
  //   .attr("fill", "#000");

  // Append text labels for nodes
  node.append("text")
    .attr("dy", labelSize / 2.5)
    // .attr("x", d => d.children ? -labelSize : labelSize)
    .style("text-anchor", d => d.children ? "end" : "start")
    .style("font-size", `${labelSize}px`)
    .text(d => d.data.name || "");

  return { root, svg };
}
