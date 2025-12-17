import { niceNumber, columnToHeader, generateNiceTicks, formatTickLabel, interpolateViridisSubset } from "./utils.js";
import { TextSizeEstimator } from './textAspectRatioPrediction.js'
import { interpolateViridis } from "d3";

/**
 * Base class for all legend types
 * Manages common legend functionality like positioning and rendering
 */
export class LegendBase {
  constructor(options = {}, textSizeEstimator = new TextSizeEstimator()) {
    this.state = {
      aesthetic: null,
      x: 0,
      y: 0,
      origin: "top left",
      maxX: Infinity,
      maxY: Infinity,
      titleFontSize: 20,
      labelFontSize: 14,
      ...options
    };

    this.coordinates = {};
    this.group = null;
    this.textSizeEstimator = textSizeEstimator;
  }

  /**
   * Render the legend in the specified SVG element
   * @param {Selection} svg - D3 selection of the SVG element
   */
  render(svg) {
    // Create main group for this legend
    this.group = svg.append("g")
      .attr("class", "ht-legend");

    // Update coordinates and position
    this.updateCoordinates();
    this.updatePosition();
  }

  /**
   * Calculate the size and location of legend elements
   * Must be implemented by subclasses
   */
  updateCoordinates() {
    throw new Error("updateCoordinates must be implemented by subclass");
  }

  /**
   * Update the position of the rendered legend
   */
  updatePosition() {
    if (!this.group) return;

    let translateX = this.state.x;
    let translateY = this.state.y;

    // Adjust based on origin
    const { width, height } = this.coordinates;

    if (this.state.origin.includes("right")) {
      translateX -= width;
    }
    if (this.state.origin.includes("bottom")) {
      translateY -= height;
    }

    this.group.attr("transform", `translate(${translateX}, ${translateY})`);
  }

  /**
   * Render the legend title
   * @param {string} title - The title text
   * @returns {Selection} The title text element
   */
  renderTitle(title) {
    const titleText = this.group.append("text")
      .attr("class", "legend-title")
      .attr("x", 0)
      .attr("y", 0)
      .attr("text-anchor", "start")
      .style("font-size", "14px")
      // .style("font-weight", "bold")
      .style("text-decoration", "underline")
      .text(title);

    return titleText;
  }
}

/**
 * Legend for branch length scale bar
 * Shows the relationship between branch length units and visual distance
 */
export class BranchLengthLegend extends LegendBase {
  constructor(options = {}) {
    super(options);
    this.scaleBarEdgeHeight = 6;
    this.titleSpacing = 10;
    this.unitLabelSpacing = 2;
    this.minBarLength = 80;
    this.maxBarLength = 160;
    this.lineThickness = 2;
    this.showTitle = false;
    this.title = 'Branch length';
  }

  /**
   * Calculate the size and location of legend elements
   */
  updateCoordinates() {
    // Choose an initial "nice" distance then adjust to keep bar within limits
    let units = niceNumber(1);
    let barWidth = units * this.state.treeState.branchLenToPxFactor;
    console.log(this.state.treeState.branchLenToPxFactor);

    // Expand/shrink until within [min,max] pixels
    if (barWidth < this.minBarLength || barWidth > this.maxBarLength) {
      units = niceNumber(this.minBarLength / this.state.treeState.branchLenToPxFactor);
      barWidth = units * this.state.treeState.branchLenToPxFactor;
    }
    while (barWidth < this.minBarLength) {
      units *= 2;
      barWidth = units * this.state.treeState.branchLenToPxFactor;
    }
    while (barWidth > this.maxBarLength) {
      units /= 2;
      barWidth = units * this.state.treeState.branchLenToPxFactor;
    }

    units = units.toPrecision(3);

    const unitLabelSize = this.textSizeEstimator.getTextSize(units, this.state.labelFontSize);
    const titleSize = this.textSizeEstimator.getTextSize(this.title, this.state.titleFontSize);
    let titleHeightOffset = 0;
    if (this.showTitle) {
      titleHeightOffset = titleSize.heightPx + this.titleSpacing;
    }
    const barY = titleHeightOffset + this.unitLabelSpacing + unitLabelSize.heightPx;

    this.coordinates = {
      width: barWidth + this.lineThickness,
      height: titleHeightOffset + this.scaleBarEdgeHeight + this.unitLabelSpacing + unitLabelSize.heightPx,
      title: {
        x: 0,
        y: titleSize.heightPx,
        text: "Branch Length"
      },
      bar: {
        x1: 0,
        y1: barY,
        x2: barWidth,
        y2: barY,
      },
      leftTick: {
        x1: 0,
        y1: barY - this.scaleBarEdgeHeight,
        x2: 0,
        y2: barY + this.scaleBarEdgeHeight
      },
      rightTick: {
        x1: barWidth,
        y1: barY - this.scaleBarEdgeHeight,
        x2: barWidth,
        y2: barY + this.scaleBarEdgeHeight
      },
      label: {
        x: barWidth / 2,
        y: titleHeightOffset + unitLabelSize.heightPx,
        text: units
      }
    };
  }

  /**
   * Render the legend in the specified SVG element
   * @param {Selection} svg - D3 selection of the SVG element
   */
  render(svg) {
    super.render(svg);

    // Render title
    if (this.showTitle) {
      this.renderTitle(this.coordinates.title.text)
        .attr("x", this.coordinates.title.x)
        .attr("y", this.coordinates.title.y);
    }

    // Render bar
    this.group.append("line")
      .attr("class", "bar")
      .attr("x1", this.coordinates.bar.x1)
      .attr("y1", this.coordinates.bar.y1)
      .attr("x2", this.coordinates.bar.x2)
      .attr("y2", this.coordinates.bar.y2)
      .attr("stroke", "#000")
      .attr("stroke-width", this.lineThickness);

    // Render left tick
    this.group.append("line")
      .attr("class", "left-tick")
      .attr("x1", this.coordinates.leftTick.x1)
      .attr("y1", this.coordinates.leftTick.y1)
      .attr("x2", this.coordinates.leftTick.x2)
      .attr("y2", this.coordinates.leftTick.y2)
      .attr("stroke", "#000")
      .attr("stroke-width", this.lineThickness);

    // Render right tick
    this.group.append("line")
      .attr("class", "right-tick")
      .attr("x1", this.coordinates.rightTick.x1)
      .attr("y1", this.coordinates.rightTick.y1)
      .attr("x2", this.coordinates.rightTick.x2)
      .attr("y2", this.coordinates.rightTick.y2)
      .attr("stroke", "#000")
      .attr("stroke-width", this.lineThickness);

    // Render label
    this.group.append("text")
      .attr("class", "label")
      .attr("x", this.coordinates.label.x)
      .attr("y", this.coordinates.label.y)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "ideographic")
      .style("font-size", "14px")
      .text(this.coordinates.label.text);
  }
}

/**
 * Legend for text size mappings
 * Shows how numeric input values map to text size in labels
 */
export class TextSizeLegend extends LegendBase {
  constructor(options = {}) {
    super(options);
    this.letterSize = 16; // Base size for the "A" characters
    this.padding = 10;
    this.exampleLetter = 'A';
    this.tickHeight = 5;
    this.verticalSpacing = 5;
    this.showTitle = true;
  }

  /**
   * Calculate the size and location of legend elements
   */
  updateCoordinates() {
    // Get the data range from the scale
    const minValue = this.state.aesthetic.scale.dataMin;
    const maxValue = this.state.aesthetic.scale.dataMax;
    const minSize = this.state.aesthetic.scale.sizeMin;
    const maxSize = this.state.aesthetic.scale.sizeMax;

    // Generate nice tick values
    const ticks = generateNiceTicks(minValue, maxValue, 5);

    // Calculate dimensions
    const maxLetterFont = maxSize * this.state.treeState.labelSizeToPxFactor;
    const maxLetterSize = this.textSizeEstimator.getTextSize(this.exampleLetter, maxLetterFont);
    const minLetterFont = minSize * this.state.treeState.labelSizeToPxFactor;
    const minLetterSize = this.textSizeEstimator.getTextSize(this.exampleLetter, minLetterFont);
    const titleSize = this.textSizeEstimator.getTextSize(this.state.aesthetic.state.title, this.state.titleFontSize);

    // Calculate width based on number of ticks
    const letterSpacing = 30;
    const baseWidth = Math.max(ticks.length * letterSpacing, 100);

    // Calculate tick label sizes to account for overhang
    const tickLabelSizes = ticks.map(tickValue => {
      const labelText = formatTickLabel(tickValue, ticks);
      return this.textSizeEstimator.getTextSize(labelText, this.state.labelFontSize);
    });

    // Calculate overhang on left (first tick label)
    const leftOverhang = tickLabelSizes[0].widthPx / 2;

    // Calculate overhang on right (last tick label)
    const rightOverhang = tickLabelSizes[tickLabelSizes.length - 1].widthPx / 2;

    // Total width includes base width plus overhangs
    const width = baseWidth + leftOverhang + rightOverhang;

    // Calculate title height offset
    let titleHeightOffset = 0;
    if (this.showTitle) {
      titleHeightOffset = titleSize.heightPx + this.verticalSpacing;
    }

    // Calculate total height
    const height = titleHeightOffset +
      maxLetterSize.heightPx * 0.62 + this.tickHeight + this.state.labelFontSize +
      this.verticalSpacing + this.state.labelFontSize;

    // Store coordinates for each element
    this.coordinates = {
      width,
      height,
      leftOverhang,
      title: {
        x: leftOverhang,
        y: titleSize.heightPx,
        text: this.state.aesthetic.state.title
      },
      polygon: [],
      ticks: [],
      labels: [],
      units: {
        x: width / 2,
        y: height - this.state.labelFontSize + this.verticalSpacing,
        text: this.state.aesthetic.state.inputUnits || ""
      }
    };

    // Calculate polygon and tick positions (offset by leftOverhang)
    const letterY = titleHeightOffset + maxLetterSize.heightPx * 0.62;
    ticks.forEach((tickValue, i) => {
      const t = (tickValue - minValue) / (maxValue - minValue);
      const x = leftOverhang + (i / (ticks.length - 1)) * baseWidth;
      const size = minSize + t * (maxSize - minSize);
      const fontSize = this.state.treeState.labelSizeToPxFactor * size;
      const exampleLetterSize = this.textSizeEstimator.getTextSize(this.exampleLetter, fontSize);

      // Tick marks
      this.coordinates.ticks.push({
        x1: x,
        y1: letterY,
        x2: x,
        y2: letterY + this.tickHeight
      });

      // Labels
      this.coordinates.labels.push({
        x,
        y: letterY + this.tickHeight,
        text: formatTickLabel(tickValue, ticks)
      });
    });

    // Calculate polygon points (background shape) - offset by leftOverhang
    this.coordinates.polygon = [
      { x: leftOverhang, y: letterY },
      { x: leftOverhang, y: letterY - minLetterSize.heightPx * 0.62 },
      { x: leftOverhang + baseWidth, y: letterY - maxLetterSize.heightPx * 0.62 },
      { x: leftOverhang + baseWidth, y: letterY }
    ];
    console.log(this.coordinates.polygon)
  }

  /**
   * Render the legend in the specified SVG element
   * @param {Selection} svg - D3 selection of the SVG element
   */
  render(svg) {
    super.render(svg);

    // Render title
    if (this.showTitle) {
      this.renderTitle(this.coordinates.title.text)
        .attr("x", this.coordinates.title.x)
        .attr("y", this.coordinates.title.y);
    }

    // Render background polygon
    const polygonPoints = this.coordinates.polygon
      .map(p => `${p.x},${p.y}`)
      .join(" ");

    this.group.append("polygon")
      .attr("points", polygonPoints)
      .attr("fill", "#f0f0f0")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1);

    // Render tick marks
    this.coordinates.ticks.forEach(tick => {
      this.group.append("line")
        .attr("x1", tick.x1)
        .attr("y1", tick.y1)
        .attr("x2", tick.x2)
        .attr("y2", tick.y2)
        .attr("stroke", "#000")
        .attr("stroke-width", 1);
    });

    // Render labels
    this.coordinates.labels.forEach(label => {
      this.group.append("text")
        .attr("x", label.x)
        .attr("y", label.y)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "hanging")
        .style("font-size", "12px")
        .text(label.text);
    });

    // Render units label
    if (this.coordinates.units.text) {
      this.group.append("text")
        .attr("x", this.coordinates.units.x)
        .attr("y", this.coordinates.units.y)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "ideographic")
        .style("font-size", "12px")
        .style("font-style", "italic")
        .text(this.coordinates.units.text);
    }
  }
}

/**
 * Legend for text color mappings
 * Shows how categorical or continuous input values map to text color in labels
 */
export class TextColorLegend extends LegendBase {
  constructor(options = {}) {
    super(options);
    this.exampleLetter = 'A';
    this.verticalSpacing = 5;
    this.horizontalSpacing = 10;
    this.showTitle = true;

    // Categorical-specific settings
    this.squareSize = 12;
    this.itemLabelGap = 5;
    this.itemGap = 15;
    this.maxCategoriesPerRow = 5;

    // Continuous-specific settings
    this.gradientHeight = 20;
    this.tickHeight = 5;
    this.numGradientStops = 20;
  }

  /**
   * Calculate the size and location of legend elements
   */
  updateCoordinates() {
    const aesthetic = this.state.aesthetic;
    const isCategorical = aesthetic.state.isCategorical;
    const titleSize = this.textSizeEstimator.getTextSize(aesthetic.state.title, this.state.titleFontSize);

    let titleHeightOffset = 0;
    if (this.showTitle) {
      titleHeightOffset = titleSize.heightPx + this.verticalSpacing;
    }

    if (isCategorical) {
      this.#updateCoordinatesCategorical(titleHeightOffset, titleSize);
    } else {
      this.#updateCoordinatesContinuous(titleHeightOffset, titleSize);
    }
  }

  /**
   * Calculate coordinates for categorical color legend
   */
  #updateCoordinatesCategorical(titleHeightOffset, titleSize) {
    const aesthetic = this.state.aesthetic;
    const categories = aesthetic.scale.categories;
    const maxWidth = this.state.maxX - this.state.x;

    this.coordinates = {
      width: 0,
      height: titleHeightOffset,
      title: {
        x: 0,
        y: titleSize.heightPx,
        text: aesthetic.state.title
      },
      items: [],
      isCategorical: true
    };

    let currentX = 0;
    let currentY = titleHeightOffset + this.squareSize / 2;
    let rowHeight = this.squareSize;

    categories.forEach((category, i) => {
      const color = aesthetic.scale.getValue(category);
      const labelSize = this.textSizeEstimator.getTextSize(category, this.state.labelFontSize);
      const itemWidth = this.squareSize + this.itemLabelGap + labelSize.widthPx;

      // Check if we need to wrap to next row
      if (currentX > 0 && currentX + itemWidth > maxWidth) {
        currentX = 0;
        currentY += rowHeight + this.verticalSpacing;
        rowHeight = this.squareSize;
      }

      this.coordinates.items.push({
        x: currentX,
        y: currentY,
        color: color,
        label: category,
        squareX: currentX,
        squareY: currentY - this.squareSize / 2,
        labelX: currentX + this.squareSize + this.itemLabelGap,
        labelY: currentY
      });

      currentX += itemWidth + this.itemGap;
      this.coordinates.width = Math.max(this.coordinates.width, currentX - this.itemGap);
    });

    this.coordinates.height = currentY + this.squareSize / 2;
  }

  /**
   * Calculate coordinates for continuous color legend
   */
  #updateCoordinatesContinuous(titleHeightOffset, titleSize) {
    const aesthetic = this.state.aesthetic;
    const minValue = aesthetic.scale.dataMin;
    const maxValue = aesthetic.scale.dataMax;

    // Generate nice tick values
    const ticks = generateNiceTicks(minValue, maxValue, 5);

    // Calculate dimensions for letters above gradient
    const letterFontSize = this.state.labelFontSize * 1.2;
    const letterSize = this.textSizeEstimator.getTextSize(this.exampleLetter, letterFontSize);

    // Calculate width based on number of ticks
    const letterSpacing = 30;
    const baseWidth = Math.max(ticks.length * letterSpacing, 120);

    // Calculate tick label sizes to account for overhang
    const tickLabelSizes = ticks.map(tickValue => {
      const labelText = formatTickLabel(tickValue, ticks);
      return this.textSizeEstimator.getTextSize(labelText, this.state.labelFontSize);
    });

    // Calculate overhang on left (first tick label)
    const leftOverhang = tickLabelSizes[0].widthPx / 2;

    // Calculate overhang on right (last tick label)
    const rightOverhang = tickLabelSizes[tickLabelSizes.length - 1].widthPx / 2;

    // Total width includes base width plus overhangs
    const width = baseWidth + leftOverhang + rightOverhang;

    // Calculate positions
    const lettersY = titleHeightOffset + letterSize.heightPx * 0.7;
    const gradientY = lettersY + this.verticalSpacing;
    const ticksY = gradientY + this.gradientHeight;
    const labelsY = ticksY + this.tickHeight;

    // Calculate total height
    const unitsSize = this.textSizeEstimator.getTextSize(aesthetic.state.inputUnits || "", this.state.labelFontSize);
    const height = labelsY + this.state.labelFontSize + this.verticalSpacing + unitsSize.heightPx;

    this.coordinates = {
      width,
      height,
      leftOverhang,
      isCategorical: false,
      title: {
        x: leftOverhang,
        y: titleSize.heightPx,
        text: aesthetic.state.title
      },
      gradient: {
        x: leftOverhang,
        y: gradientY,
        width: baseWidth,
        height: this.gradientHeight
      },
      letters: [],
      ticks: [],
      labels: [],
      units: {
        x: width / 2,
        y: height,
        text: aesthetic.state.inputUnits || ""
      }
    };

    // Calculate letter and tick positions
    ticks.forEach((tickValue, i) => {
      const t = (tickValue - minValue) / (maxValue - minValue);
      const x = leftOverhang + (i / (ticks.length - 1)) * baseWidth;
      const color = aesthetic.scale.getValue(tickValue);

      // Letters
      this.coordinates.letters.push({
        x,
        y: lettersY,
        text: this.exampleLetter,
        color: color,
        fontSize: letterFontSize
      });

      // Tick marks
      this.coordinates.ticks.push({
        x1: x,
        y1: ticksY,
        x2: x,
        y2: ticksY + this.tickHeight
      });

      // Labels
      this.coordinates.labels.push({
        x,
        y: labelsY,
        text: formatTickLabel(tickValue, ticks)
      });
    });
  }

  /**
   * Render the legend in the specified SVG element
   * @param {Selection} svg - D3 selection of the SVG element
   */
  render(svg) {
    super.render(svg);

    // Render title
    if (this.showTitle) {
      this.renderTitle(this.coordinates.title.text)
        .attr("x", this.coordinates.title.x)
        .attr("y", this.coordinates.title.y);
    }

    if (this.coordinates.isCategorical) {
      this.#renderCategorical();
    } else {
      this.#renderContinuous();
    }
  }

  /**
   * Render categorical color legend
   */
  #renderCategorical() {
    // Render each category item
    this.coordinates.items.forEach(item => {
      // Color square
      this.group.append("rect")
        .attr("x", item.squareX)
        .attr("y", item.squareY)
        .attr("width", this.squareSize)
        .attr("height", this.squareSize)
        .attr("fill", item.color)
        .attr("stroke", "#000")
        .attr("stroke-width", 1);

      // Category label
      this.group.append("text")
        .attr("x", item.labelX)
        .attr("y", item.labelY)
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "central")
        .style("font-size", `${this.state.labelFontSize}px`)
        .text(item.label);
    });
  }

  /**
   * Render continuous color legend
   */
  #renderContinuous() {
    const aesthetic = this.state.aesthetic;
    const minValue = aesthetic.scale.dataMin;
    const maxValue = aesthetic.scale.dataMax;

    // Create gradient definition
    const gradientId = `color-gradient-${Math.random().toString(36).substr(2, 9)}`;
    const defs = this.group.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", gradientId)
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%");

    // Add color stops
    for (let i = 0; i <= this.numGradientStops; i++) {
      const t = i / this.numGradientStops;
      const value = minValue + t * (maxValue - minValue);
      const color = aesthetic.scale.getValue(value);
      gradient.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", color);
    }

    // Draw gradient rectangle
    this.group.append("rect")
      .attr("x", this.coordinates.gradient.x)
      .attr("y", this.coordinates.gradient.y)
      .attr("width", this.coordinates.gradient.width)
      .attr("height", this.coordinates.gradient.height)
      .style("fill", `url(#${gradientId})`)
      .style("stroke", "#000")
      .style("stroke-width", 1);

    // Render colored letters above gradient
    this.coordinates.letters.forEach(letter => {
      this.group.append("text")
        .attr("x", letter.x)
        .attr("y", letter.y)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "ideographic")
        .style("font-size", `${letter.fontSize}px`)
        .style("fill", letter.color)
        .style("font-weight", "bold")
        .text(letter.text);
    });

    // Render tick marks
    this.coordinates.ticks.forEach(tick => {
      this.group.append("line")
        .attr("x1", tick.x1)
        .attr("y1", tick.y1)
        .attr("x2", tick.x2)
        .attr("y2", tick.y2)
        .attr("stroke", "#000")
        .attr("stroke-width", 1);
    });

    // Render tick labels
    this.coordinates.labels.forEach(label => {
      this.group.append("text")
        .attr("x", label.x)
        .attr("y", label.y)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "hanging")
        .style("font-size", `${this.state.labelFontSize}px`)
        .text(label.text);
    });

    // Render units label
    if (this.coordinates.units.text) {
      this.group.append("text")
        .attr("x", this.coordinates.units.x)
        .attr("y", this.coordinates.units.y)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "ideographic")
        .style("font-size", `${this.state.labelFontSize}px`)
        .style("font-style", "italic")
        .text(this.coordinates.units.text);
    }
  }
}

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
    .attr("width", 100)
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
    .text(`Zoom: ${percentage}%`)
    .style("fill", percentage === 100 ? "#999" : "#000");
}

/**
 * Initialize the scale bar legend element
 * @param {Selection} legendDiv - D3 selection of the legend container
 * @param {Object} options - Configuration options
 * @returns {Object} Object containing the SVG and group elements, plus update function
 */
export function initScaleBar(scaleBarSvg, options) {
  const scaleBarEdgeHeight = 6;
  const scaleBarGroup = scaleBarSvg.append("g")
  const scaleBarLineGroup = scaleBarGroup.append("g")
    .attr("stroke", "#000")
    .attr("stroke-width", 2)
    .attr("fill", "none");
  scaleBarLineGroup.append("line").attr("class", "bar");
  scaleBarLineGroup.append("line").attr("class", "left-tick");
  scaleBarLineGroup.append("line").attr("class", "right-tick");
  scaleBarGroup.append("text")
    .attr("class", "label")
    .attr("dy", -scaleBarEdgeHeight)
    .attr("text-anchor", "middle")
    .style("font-size", "14px");

  return {
    group: scaleBarGroup,
    update: (pxPerUnit) => updateScaleBar(scaleBarGroup, pxPerUnit, options)
  };
}

function updateScaleBar(scaleBarGroup, pxPerUnit, options) {
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
  scaleBarGroup.select(".label")
    .attr("x", barPx / 2)
    .text(units.toPrecision(3));
}

/**
 * Initialize the scale bar in the tree SVG (for export)
 * @param {Selection} treeSvg - D3 selection of the tree SVG group
 * @param {Object} options - Configuration options
 * @returns {Object} Object containing the group element and update function
 */
export function initTreeScaleBar(treeSvg, options) {
  const scaleBarEdgeHeight = 6;
  const scaleBarGroup = treeSvg.append("g")
    .attr("class", "tree-scale-bar")
    .attr("stroke", "#000")
    .attr("stroke-width", 2)
    .attr("fill", "none");

  scaleBarGroup.append("line").attr("class", "bar");
  scaleBarGroup.append("line").attr("class", "left-tick");
  scaleBarGroup.append("line").attr("class", "right-tick");
  scaleBarGroup.append("text")
    .attr("class", "label")
    .attr("dy", -scaleBarEdgeHeight)
    .attr("text-anchor", "middle")
    .style("font-size", "14px");

  return {
    group: scaleBarGroup,
    update: (pxPerUnit, bounds, options) => updateTreeScaleBar(scaleBarGroup, pxPerUnit, bounds, options)
  };
}

/**
 * Update the tree scale bar graphics and position
 * @param {Selection} scaleBarGroup - D3 selection of the scale bar group
 * @param {number} pxPerUnit - Current pixels per unit of branch length
 * @param {Object} bounds - Tree bounds object with minX, maxX, minY, maxY
 * @param {Object} options - Configuration options
 */
function updateTreeScaleBar(scaleBarGroup, pxPerUnit, bounds, options) {
  if (!isFinite(pxPerUnit) || pxPerUnit <= 0) return;

  const scaleBarEdgeHeight = 6;
  const padding = 20;

  // choose an initial "nice" distance then adjust to keep bar within limits
  let units = niceNumber(1);
  let barPx = units * pxPerUnit;

  // expand / shrink until within [min,max] pixels
  if (barPx < options.scaleBarSize.min || barPx > options.scaleBarSize.max) {
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

  // Position scale bar below and to the left of the tree
  const xPos = bounds.minX + padding;
  const yPos = bounds.maxY + padding + options.legendElementHeight;

  scaleBarGroup.attr("transform", `translate(${xPos}, ${yPos})`);

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
  scaleBarGroup.select(".label")
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
    .text("Leaves: 0");

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
    text = `Leaves: ${totalLeaves}`;
  } else {
    text = `Leaves: ${visibleLeaves}/${totalLeaves}`;
  }

  leafCountText.text(text);

  //Adjust SVG width to fit text
  const bbox = leafCountText.node().getBBox();
  leafCountSvg.attr("width", bbox.width + 20);
}

/**
 * Initialize the color legend element
 * @param {Selection} parentSvg - D3 selection of the parent SVG
 * @param {Object} options - Configuration options
 * @returns {Object} Object containing the group element and update function
 */
export function initColorLegend(parentSvg, options) {
  const colorLegendGroup = parentSvg.append("g")
    .attr("class", "ht-color-legend")
    .style("display", "none");

  return {
    group: colorLegendGroup,
    update: (colorScale, columnName, columnType) => updateColorLegend(colorLegendGroup, colorScale, columnName, columnType, options)
  };
}

/**
 * Update the color legend based on the current color scale
 * @param {Selection} colorLegendGroup - D3 selection of the legend group
 * @param {Function} colorScale - D3 color scale (linear or ordinal)
 * @param {string} columnName - Name of the metadata column being visualized
 * @param {string} columnType - Type of column ('continuous' or 'categorical')
 * @param {Object} options - Configuration options
 */
function updateColorLegend(colorLegendGroup, colorScale, columnName, columnType, options) {
  // Clear existing content
  colorLegendGroup.selectAll("*").remove();

  // Hide if no color scale
  if (!colorScale || !columnName) {
    colorLegendGroup.style("display", "none");
    return;
  }

  colorLegendGroup.style("display", "block");

  let currentX = 0;
  const labelFontSize = 16;
  const verticalCenter = options.legendElementHeight / 2;

  // Add column name label
  const columnLabel = colorLegendGroup.append("text")
    .attr("x", currentX)
    .attr("y", verticalCenter)
    .attr("dominant-baseline", "central")
    .style("font-size", `${labelFontSize}px`)
    .text(columnToHeader(columnName) + ":");

  const columnLabelBBox = columnLabel.node().getBBox();
  currentX += columnLabelBBox.width + 5;

  if (columnType === 'continuous') {
    // Create continuous gradient legend
    const legendWidth = 150;
    const tickHeight = 4;
    const tickLabelFontSize = 10;
    const labelPadding = 2;
    const barHeight = options.legendElementHeight - tickHeight - tickLabelFontSize - labelPadding;
    const leftMargin = 15;

    const legendGroup = colorLegendGroup.append("g")
      .attr("transform", `translate(${currentX}, 0)`);

    // Get domain values
    const domain = colorScale.domain();
    const minVal = domain[0];
    const maxVal = domain[1];

    // Generate nice tick values
    const ticks = generateNiceTicks(minVal, maxVal, 4);

    // Create gradient definition
    const defs = colorLegendGroup.append("defs");
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
        .attr("stop-color", interpolateViridisSubset(t));
    }

    // Draw gradient rectangle
    legendGroup.append("rect")
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
      legendGroup.append("line")
        .attr("x1", x)
        .attr("y1", barHeight)
        .attr("x2", x)
        .attr("y2", barHeight + tickHeight)
        .attr("stroke", "#000")
        .attr("stroke-width", 1);

      // Draw label
      legendGroup.append("text")
        .attr("x", x)
        .attr("y", barHeight + tickHeight + labelPadding)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "hanging")
        .style("font-size", `${tickLabelFontSize}px`)
        .text(formatTickLabel(tickValue, ticks));
    });

  } else {
    // Create categorical legend
    const categories = colorScale.domain();
    const maxCategoriesToShow = 10;
    const categoriesToShow = categories.slice(0, maxCategoriesToShow);

    const itemGap = 8;
    const squareSize = 12;
    const itemLabelGap = 3;
    const itemFontSize = 12;
    const maxWidth = 500;

    let currentY = verticalCenter;

    categoriesToShow.forEach(category => {
      const itemGroup = colorLegendGroup.append("g")
        .attr("transform", `translate(${currentX}, ${currentY})`);

      // Color square
      itemGroup.append("rect")
        .attr("x", 0)
        .attr("y", -squareSize / 2)
        .attr("width", squareSize)
        .attr("height", squareSize)
        .style("fill", colorScale(category))
        .style("stroke", "#000")
        .style("stroke-width", 1);

      // Category label
      const label = itemGroup.append("text")
        .attr("x", squareSize + itemLabelGap)
        .attr("y", 0)
        .attr("dominant-baseline", "central")
        .style("font-size", `${itemFontSize}px`)
        .text(category);

      const itemGroupExtent = itemGroup.node().getBBox().width + itemGap;

      if (itemGroupExtent + currentX > maxWidth) {
        currentX = columnLabelBBox.width + 5;
        currentY = currentY + options.legendElementHeight;
      }

      itemGroup.attr("transform", `translate(${currentX}, ${currentY})`);
      currentX += itemGroupExtent;
    });

    if (categories.length > maxCategoriesToShow) {
      const moreText = colorLegendGroup.append("text")
        .attr("dominant-baseline", "central")
        .style("font-size", `${itemFontSize}px`)
        .style("font-style", "italic")
        .text(`(+${categories.length - maxCategoriesToShow} more)`);

      const moreTextExtent = moreText.node().getBBox().width + itemGap;
      if (moreTextExtent + currentX > maxWidth) {
        currentX = columnLabelBBox.width + 5;
        currentY = currentY + options.legendElementHeight;
      }

      moreText.attr("transform", `translate(${currentX}, ${currentY})`);
    }
  }
}
