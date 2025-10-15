import { niceNumber } from "./utils.js";

/**
 * Initialize the zoom indicator legend element
 * @param {Selection} legendDiv - D3 selection of the legend container
 * @param {Object} options - Configuration options
 * @returns {Object} Object containing the SVG and text elements, plus update function
 */
export function initZoomIndicator(legendDiv, options) {
  const zoomIndicatorDiv = legendDiv.append("div")
    .attr("class", "ht-zoom-indicator")
    .style("height", `${options.legendElementHeight}px`)
    .style("flex", "0 0 auto");
  const zoomIndicatorSvg = zoomIndicatorDiv.append("svg")
    .attr("width", 40)
    .attr("height", options.legendElementHeight);
  const zoomIndicatorText = zoomIndicatorSvg.append("text")
    .attr("x", "50%")
    .attr("y", "50%")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .style("font-size", "16px")
    .style("fill", "#999")
    .text("100%");

  return {
    svg: zoomIndicatorSvg,
    text: zoomIndicatorText,
    update: (zoomLevel) => updateZoomIndicator(zoomIndicatorText, zoomLevel)
  };
}

/**
 * Update the zoom indicator text and color
 * @param {Selection} zoomIndicatorText - D3 selection of the text element
 * @param {number} zoomLevel - Current zoom level (1.0 = 100%)
 */
function updateZoomIndicator(zoomIndicatorText, zoomLevel) {
  const percentage = Math.round(zoomLevel * 100);
  zoomIndicatorText
    .text(`${percentage}%`)
    .style("fill", percentage === 100 ? "#999" : "#000");
}

/**
 * Initialize the scale bar legend element
 * @param {Selection} legendDiv - D3 selection of the legend container
 * @param {Object} options - Configuration options
 * @returns {Object} Object containing the SVG and group elements, plus update function
 */
export function initScaleBar(legendDiv, options) {
  const scaleBarEdgeHeight = 6;
  const scaleBarDiv = legendDiv.append("div")
    .attr("class", "ht-scale-bar")
    .style("height", `${options.legendElementHeight}px`)
    .style("flex", "0 0 auto");
  const scaleBarSvg = scaleBarDiv.append("svg")
    .attr("width", options.scaleBarSize.max)
    .attr("height", options.legendElementHeight);
  const scaleBarGroup = scaleBarSvg.append("g")
    .attr("transform", `translate(1,${options.legendElementHeight - scaleBarEdgeHeight})`)
    .attr("stroke", "#000")
    .attr("stroke-width", 2)
    .attr("fill", "none");
  scaleBarGroup.append("line").attr("class", "bar");
  scaleBarGroup.append("line").attr("class", "left-tick");
  scaleBarGroup.append("line").attr("class", "right-tick");
  scaleBarSvg.append("text")
    .attr("transform", `translate(1,${options.legendElementHeight - scaleBarEdgeHeight})`)
    .attr("class", "label")
    .attr("dy", -scaleBarEdgeHeight)
    .attr("text-anchor", "middle")
    .style("font-size", "14px");

  return {
    svg: scaleBarSvg,
    group: scaleBarGroup,
    update: (pxPerUnit) => updateScaleBar(scaleBarSvg, scaleBarGroup, pxPerUnit, options)
  };
}

/**
 * Update the scale bar graphics according to current pixel-per-unit scale
 * @param {Selection} scaleBarSvg - D3 selection of the scale bar SVG
 * @param {Selection} scaleBarGroup - D3 selection of the scale bar group
 * @param {number} pxPerUnit - Current pixels per unit of branch length
 * @param {Object} options - Configuration options
 */
function updateScaleBar(scaleBarSvg, scaleBarGroup, pxPerUnit, options) {
  if (!isFinite(pxPerUnit) || pxPerUnit <= 0) return;

  // choose an initial "nice" distance then adjust to keep bar within limits
  let units = niceNumber(1);      // start from 1 unit
  let barPx = units * pxPerUnit;

  // expand / shrink until within [min,max] pixels
  if (barPx < options.scaleBarSize.min || barPx > options.scaleBarSize.max) {
    // estimate a closer starting length
    units = niceNumber(options.scaleBarSize.min / pxPerUnit);
    barPx = units * pxPerUnit;
  }
  while (barPx < options.scaleBarSize.min) {
    units *= 2;
    barPx = units * pxPerUnit;
  }
  while (barPx > options.scaleBarSize.max) {
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
  scaleBarSvg.select(".label")
    .attr("x", barPx / 2)
    .text(units.toPrecision(3));
}

/**
 * Initialize the leaf count legend element
 * @param {Selection} legendDiv - D3 selection of the legend container
 * @param {Object} options - Configuration options
 * @returns {Object} Object containing the SVG and text elements, plus update function
 */
export function initLeafCount(legendDiv, options) {
  const leafCountDiv = legendDiv.append("div")
    .attr("class", "ht-leaf-count")
    .style("height", `${options.legendElementHeight}px`)
    .style("flex", "0 0 auto");
  const leafCountSvg = leafCountDiv.append("svg")
    .attr("width", 100)
    .attr("height", options.legendElementHeight);
  const leafCountText = leafCountSvg.append("text")
    .attr("x", "50%")
    .attr("y", "50%")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .style("font-size", "16px")
    .style("fill", "#000")
    .text("0 leaves");

  return {
    svg: leafCountSvg,
    text: leafCountText,
    update: (visibleLeaves, totalLeaves) => updateLeafCount(leafCountSvg, leafCountText, visibleLeaves, totalLeaves)
  };
}

/**
 * Update the leaf count text
 * @param {Selection} leafCountSvg - D3 selection of the SVG element
 * @param {Selection} leafCountText - D3 selection of the text element
 * @param {number} visibleLeaves - Number of currently visible leaves (excluding collapsed placeholders)
 * @param {number} totalLeaves - Total number of leaves in the full tree
 */
function updateLeafCount(leafCountSvg, leafCountText, visibleLeaves, totalLeaves) {
  let text;
  if (visibleLeaves === totalLeaves) {
    text = `${totalLeaves} leaves`;
  } else {
    text = `${visibleLeaves}/${totalLeaves} leaves`;
  }

  leafCountText.text(text);

  // Adjust SVG width to fit text
  const bbox = leafCountText.node().getBBox();
  leafCountSvg.attr("width", bbox.width + 20);
}
