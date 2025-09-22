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
  windowWidth = document.querySelector(containerSelector).clientWidth,
  windowHeight = document.querySelector(containerSelector).clientHeight
) {
  console.log('buildPannableTree')

  // Set the total plot size, which may be different from the display window size
  var treeWidth = windowWidth;
  var treeHeight = windowHeight;

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

  // Override y coordinate using branch lengths encoded as "length"
  root.each(d => {
    if (d.parent) {
      d.y = d.parent.y + (d.data.length ? d.data.length * treeWidth : 0);
    } else {
      d.y = 0;
    }
  });

  // Create an SVG element in the specified container with pan & zoom behavior
  const svg = select(containerSelector)
    .append("svg")
    .attr("width", treeWidth)
    .attr("height", treeHeight)
    .call(zoom().on("zoom", (event) => {
      svg.attr("transform", event.transform);
    }))
    .append("g")
    .attr("transform", "translate(10,0)");

  // Create links between nodes with right-angled connectors
  svg.selectAll(".link")
    .data(root.links())
    .enter().append("path")
    .attr("class", "link")
    .attr("fill", "none")
    .attr("stroke", "#555")
    .attr("stroke-opacity", 0.4)
    .attr("stroke-treeWidth", 1.5)
    .attr("d", d => `M${d.source.y},${d.source.x} V${d.target.x} H${d.target.y}`);

  // Create node groups
  const node = svg.selectAll(".node")
    .data(root.descendants())
    .enter().append("g")
    .attr("class", "node")
    .attr("transform", d => `translate(${d.y},${d.x})`);

  // Append circles for nodes
  node.append("circle")
    .attr("r", 4)
    .attr("fill", d => d.children ? "#555" : "#999");

  // Append text labels for nodes
  node.append("text")
    .attr("dy", 4)
    .attr("x", d => d.children ? -8 : 8)
    .style("text-anchor", d => d.children ? "end" : "start")
    .style("font-size", "12px")
    .text(d => d.data.name || "");

  return { root, svg };
}
