import {
  select
} from "d3";

// Function to export the entire tree to SVG
export function exportToSvg(treeSvg, bounds) {
  // Clone the tree SVG group
  const treeClone = treeSvg.node().cloneNode(true);

  // Remove any transformaitons or translations 
  treeClone.setAttribute("transform", null);

  // Remove the selection rectangle and hit layer from the clone
  select(treeClone).select(".selection-rect").remove();
  select(treeClone).select(".hit-layer").remove();

  // Calculate bounds of the entire tree
  const treeWidth = bounds.maxX - bounds.minX;
  const treeHeight = bounds.maxY - bounds.minY;
  const padding = 20;

  // Create a new SVG element with appropriate dimensions
  const exportSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  exportSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  exportSvg.setAttribute("width", treeWidth + padding * 2);
  exportSvg.setAttribute("height", treeHeight + padding * 2);
  exportSvg.setAttribute("viewBox", `${bounds.minX - padding} ${bounds.minY - padding} ${treeWidth + padding * 2} ${treeHeight + padding * 2}`);

  // Append the cloned tree
  exportSvg.appendChild(treeClone);

  // Serialize the SVG to a string
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(exportSvg);

  // Create a blob and download link
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tree.svg";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
