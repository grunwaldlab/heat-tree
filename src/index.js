import { parseNewick } from "./parsers.js"
import { hierarchy, tree, select, linkHorizontal, zoom } from "d3";


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

export function buildPannableTree(newickStr, containerSelector) {
  console.log('here')

  // Parse the Newick string
  const treeData = parseNewick(newickStr);

  // Set dimensions for the SVG
  const width = 960, height = 600;

  // Create a D3 hierarchy from the tree data
  const root = hierarchy(treeData);

  // Use D3 tree layout to compute node positions
  const treeLayout = tree().size([height, width - 160]);
  treeLayout(root);

  // Create an SVG element in the specified container with pan & zoom behavior
  const svg = select(containerSelector)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(zoom().on("zoom", (event) => {
      svg.attr("transform", event.transform);
    }))
    .append("g")
    .attr("transform", "translate(80,0)");

  // Create links between nodes
  svg.selectAll(".link")
    .data(root.links())
    .enter().append("path")
    .attr("class", "link")
    .attr("fill", "none")
    .attr("stroke", "#555")
    .attr("stroke-opacity", 0.4)
    .attr("stroke-width", 1.5)
    .attr("d", linkHorizontal()
      .x(d => d.y)
      .y(d => d.x)
    );

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
    .attr("dy", 3)
    .attr("x", d => d.children ? -8 : 8)
    .style("text-anchor", d => d.children ? "end" : "start")
    .text(d => d.data.name || "");

  return { root, svg };
}
