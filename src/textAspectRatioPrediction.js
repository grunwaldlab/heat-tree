import { select } from "d3";

export class TextSizeEstimator {
  constructor() {
    this.metricsCache = new Map();
    this.setupHiddenEnvironment();
  }

  setupHiddenEnvironment() {
    // Create a dedicated hidden container
    this.hiddenContainer = document.createElement('div');
    this.hiddenContainer.style.cssText = `
      position: absolute;
      top: -9999px;
      left: -9999px;
      visibility: hidden;
      width: 5000px;
      height: 5000px;
      overflow: hidden;
    `;

    // Create SVG with namespace
    this.hiddenSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.hiddenSVG.setAttribute('width', '5000');
    this.hiddenSVG.setAttribute('height', '5000');
    this.hiddenSVG.setAttribute('viewBox', '0 0 5000 5000');

    this.hiddenContainer.appendChild(this.hiddenSVG);
    document.body.appendChild(this.hiddenContainer);

    // Create D3 reference
    this.hiddenD3SVG = select(this.hiddenSVG);

    // Create a reusable text group for better performance
    this.textGroup = this.hiddenD3SVG.append('g')
      .attr('id', 'text-measurement-group');
  }

  getRelativeTextSize(text, styles = {}) {
    const cacheKey = `${text}-${JSON.stringify(styles)}`;

    if (this.metricsCache.has(cacheKey)) {
      return this.metricsCache.get(cacheKey);
    }

    const tempText = this.textGroup.append("text")
      .attr("x", 1000)
      .attr("y", 2500)
      .text(text);

    // Apply all styles
    Object.keys(styles).forEach(key => {
      tempText.style(key, styles[key]);
    });

    // Force DOM rendering
    this.hiddenSVG.getBoundingClientRect();

    const bbox = tempText.node().getBBox();
    const computedStyle = window.getComputedStyle(tempText.node());
    const fontSize = parseFloat(computedStyle.fontSize);

    tempText.remove();

    const result = {
      width: bbox.width / fontSize,
      height: bbox.height / fontSize
    };

    this.metricsCache.set(cacheKey, result);
    return result;
  }

  getTextSize(text, fontSize, styles = {}) {
    const result = this.getRelativeTextSize(text, styles);
    return {
      width: result.width,
      height: result.height,
      widthPx: result.width * fontSize,
      heightPx: result.height * fontSize
    };
  }

  // Clear cache if needed
  clearCache() {
    this.metricsCache.clear();
  }

  // Proper cleanup
  destroy() {
    if (this.hiddenContainer && this.hiddenContainer.parentNode) {
      this.hiddenContainer.parentNode.removeChild(this.hiddenContainer);
    }
    this.metricsCache.clear();
  }
}
