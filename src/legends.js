import { niceNumber, columnToHeader, generateNiceTicks, formatTickLabel } from "./utils.js";
import { interpolateViridis } from "d3";

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

  //Adjust SVG width to fit text
  const bbox = leafCountText.node().getBBox();
  leafCountSvg.attr("width", bbox.width + 20);
}

/**
 * Initialize the color legend element
 * @param {Selection} legendDiv - D3 selection of the legend container
 * @param {Object} options - Configuration options
 * @returns {Object} Object containing the container div and update function
 */
export function initColorLegend(legendDiv, options) {
  const colorLegendDiv = legendDiv.append("div")
    .attr("class", "ht-color-legend")
    .style("height", `${options.legendElementHeight}px`)
    .style("flex", "0 0 auto")
    .style("margin-right", "auto")
    .style("display", "none")
    .style("align-items", "center")
    .style("gap", "5px");

  return {
    div: colorLegendDiv,
    update: (colorScale, columnName, columnType) => updateColorLegend(colorLegendDiv, colorScale, columnName, columnType, options)
  };
}

/**
 * Update the color legend based on the current color scale
 * @param {Selection} colorLegendDiv - D3 selection of the legend container
 * @param {Function} colorScale - D3 color scale (linear or ordinal)
 * @param {string} columnName - Name of the metadata column being visualized
 * @param {string} columnType - Type of column ('continuous' or 'categorical')
 * @param {Object} options - Configuration options
 */
function updateColorLegend(colorLegendDiv, colorScale, columnName, columnType, options) {
  // Clear existing content
  colorLegendDiv.selectAll("*").remove();

  // Hide if no color scale
  if (!colorScale || !columnName) {
    colorLegendDiv.style("display", "none");
    return;
  }

  colorLegendDiv.style("display", "flex");

  // Add column name label
  colorLegendDiv.append("span")
    .style("font-size", "14px")
    .style("font-weight", "bold")
    .text(columnToHeader(columnName) + ":");

  if (columnType === 'continuous') {
    // Create continuous gradient legend
    const legendWidth = 150;
    const tickHeight = 4;
    const labelFontSize = 10;
    const labelPadding = 2;
    const barHeight = options.legendElementHeight - tickHeight - labelFontSize - labelPadding;
    const leftMargin = 15;

    const svg = colorLegendDiv.append("svg")
      .attr("width", legendWidth + leftMargin * 2)
      .attr("height", options.legendElementHeight);

    // Get domain values
    const domain = colorScale.domain();
    const minVal = domain[0];
    const maxVal = domain[1];

    // Generate nice tick values
    const ticks = generateNiceTicks(minVal, maxVal, 4);

    // Create gradient definition
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "color-gradient")
      .attr("x1", "0%")
      .attr("x2", "100%");

    // Add color stops
    const numStops = 10;
    for (let i = 0; i <= numStops; i++) {
      const t = i / numStops;
      gradient.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", interpolateViridis(t));
    }

    // Draw gradient rectangle
    svg.append("rect")
      .attr("x", leftMargin)
      .attr("y", 0)
      .attr("width", legendWidth)
      .attr("height", barHeight)
      .style("fill", "url(#color-gradient)")
      .style("stroke", "#000")
      .style("stroke-width", 1);

    // Add tick marks and labels
    ticks.forEach(tickValue => {
      // Calculate position along the bar (0 to 1)
      const t = (tickValue - minVal) / (maxVal - minVal);
      const x = leftMargin + t * legendWidth;

      // Draw tick mark
      svg.append("line")
        .attr("x1", x)
        .attr("y1", barHeight)
        .attr("x2", x)
        .attr("y2", barHeight + tickHeight)
        .attr("stroke", "#000")
        .attr("stroke-width", 1);

      // Draw label
      svg.append("text")
        .attr("x", x)
        .attr("y", barHeight + tickHeight + labelPadding)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "hanging")
        .style("font-size", `${labelFontSize}px`)
        .text(formatTickLabel(tickValue, ticks));
    });

  } else {
    // Create categorical legend
    const categories = colorScale.domain();
    const maxCategoriesToShow = 10;
    const categoriesToShow = categories.slice(0, maxCategoriesToShow);
    const hasMore = categories.length > maxCategoriesToShow;

    const legendContainer = colorLegendDiv.append("div")
      .style("display", "flex")
      .style("gap", "8px")
      .style("align-items", "center")
      .style("flex-wrap", "wrap");

    categoriesToShow.forEach(category => {
      const itemDiv = legendContainer.append("div")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "3px");

      // Color square
      itemDiv.append("div")
        .style("width", "12px")
        .style("height", "12px")
        .style("background-color", colorScale(category))
        .style("border", "1px solid #000");

      // Category label
      itemDiv.append("span")
        .style("font-size", "12px")
        .text(category);
    });

    if (hasMore) {
      legendContainer.append("span")
        .style("font-size", "12px")
        .style("font-style", "italic")
        .text(`(+${categories.length - maxCategoriesToShow} more)`);
    }
  }
}
