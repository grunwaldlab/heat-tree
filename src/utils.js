import { interpolateViridis } from "d3";
import styles from './styles.css?inline';

/**
 * Inject styles into the document if not already present
 */
export function injectStyles() {
  const styleId = 'heat-tree-styles';
  if (!document.getElementById(styleId)) {
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }
}

// helper to choose a "nice" rounded scale bar length
export function niceNumber(n) {
  const exponent = Math.floor(Math.log10(n));
  const fraction = n / Math.pow(10, exponent);
  let niceFraction;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * Math.pow(10, exponent);
}

export function triangleSideFromArea(area) {
  return Math.sqrt(2.309401 * area); // 2.309401 = 4 / sqrt(3)
}

export function triangleAreaFromSide(side) {
  return 0.4330127 * side * side; // 0.4330127 == sqrt(3) / 4
}

export function calculateTreeBounds(displayedRoot, isCircularLayout, getLabelWidth, getLabelXOffset, fontSizeForNode, collapsedRootLineLength = 0) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  displayedRoot.each(d => {
    const labelWidth = getLabelWidth(d);
    const labelOffset = getLabelXOffset(d);
    const fontSize = fontSizeForNode(d);

    if (isCircularLayout) {
      // For circular layout, calculate the x/y extent of label ends
      const labelEndRadius = d.radius + labelOffset + labelWidth;
      const labelEndX = labelEndRadius * d.cos;
      const labelEndY = labelEndRadius * d.sin;

      // Consider label end position
      if (labelEndX < minX) minX = labelEndX;
      if (labelEndX > maxX) maxX = labelEndX;
      if (labelEndY < minY) minY = labelEndY;
      if (labelEndY > maxY) maxY = labelEndY;
    } else {
      // For rectangular layout
      // Consider collapsed root line (extends left)
      const leftExtent = d.x - (d.collapsedParent ? collapsedRootLineLength : 0);
      if (leftExtent < minX) minX = leftExtent;

      // Consider node position and right-pointing labels
      const rightExtent = d.x + labelOffset + labelWidth;
      if (rightExtent > maxX) maxX = rightExtent;

      // Consider vertical extent (y ± fontSize)
      const topExtent = d.y - fontSize;
      const bottomExtent = d.y + fontSize;
      if (topExtent < minY) minY = topExtent;
      if (bottomExtent > maxY) maxY = bottomExtent;
    }
  });

  return { minX, maxX, minY, maxY };
}

export function createDashArray(repeatLen, width, nDash) {
  const totalUnits = (nDash * 2) - 1; // This works for the 3-dash case
  const summedDashLength = repeatLen - (nDash - 1) * width
  let sum = 0;
  for (let i = 1; i <= nDash; i++) {
    sum += i;
  }
  const smallestDashLength = summedDashLength / sum
  const pattern = [];
  for (let i = 0; i < totalUnits; i++) {
    if (i % 2 === 0) {
      pattern.push(smallestDashLength * (nDash - i / 2));
    } else {
      pattern.push(width);
    }
  }
  return pattern.join(',');
}

export function columnToHeader(columnName, options = {}) {
  const {
    capitalizeFirstOnly = true,
    preserveAcronyms = true
  } = options;

  let result = columnName;
  result = result.replace(/[_]/g, ' ');

  if (preserveAcronyms) {
    result = result.replace(/([a-z])([A-Z])/g, '$1 $2');
  } else {
    result = result.replace(/([A-Z])/g, ' $1');
  }

  if (capitalizeFirstOnly) {
    result = result.charAt(0).toUpperCase() + result.slice(1).toLowerCase();
  } else {
    result = result.replace(/\b\w/g, char => char.toUpperCase());
  }

  return result.trim().replace(/\s+/g, ' ');
}

export function generateNiceTicks(min, max, targetCount = 5) {
  const range = max - min;

  if (range === 0) {
    return [min];
  }

  // Calculate rough step size
  const roughStep = range / (targetCount - 1);

  // Find the magnitude (power of 10)
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));

  // Normalize the step to be between 1 and 10
  const normalizedStep = roughStep / magnitude;

  // Choose a nice step size (1, 2, 5, or 10)
  let niceStep;
  if (normalizedStep <= 1) {
    niceStep = 1;
  } else if (normalizedStep <= 2) {
    niceStep = 2;
  } else if (normalizedStep <= 5) {
    niceStep = 5;
  } else {
    niceStep = 10;
  }

  // Scale back to original magnitude
  const step = niceStep * magnitude;

  // Find the first tick (round down to nearest step)
  const firstTick = Math.floor(min / step) * step;

  // Generate ticks
  const ticks = [];
  let tick = firstTick;

  // Include ticks from before min to after max
  while (tick <= max + step * 0.001) { // small epsilon for floating point
    if (tick >= min - step * 0.001) {
      ticks.push(tick);
    }
    tick += step;
  }

  // Ensure we have at least min and max
  if (ticks.length === 0 || ticks[0] > min) {
    ticks.unshift(min);
  }
  if (ticks[ticks.length - 1] < max) {
    ticks.push(max);
  }

  return ticks;
}

export function formatTickLabel(value, allTicks) {
  // Determine appropriate precision based on the range and step size
  const range = Math.max(...allTicks) - Math.min(...allTicks);
  const step = allTicks.length > 1 ? Math.abs(allTicks[1] - allTicks[0]) : range;

  if (range === 0) {
    return value.toPrecision(3);
  }

  // Calculate how many significant figures we need
  const magnitude = Math.floor(Math.log10(Math.abs(step)));

  if (magnitude >= 0) {
    // For large numbers, use no decimal places
    return Math.round(value).toString();
  } else {
    // For small numbers, use appropriate decimal places
    const decimals = Math.min(3, -magnitude);
    return value.toFixed(decimals);
  }
}

export function interpolateViridisSubset(t, start = 0.1, end = 0.9) {
  return interpolateViridis(start + t * (end - start));
}

/**
 * Base class for objects that support pub/sub pattern
 */
export class Subscribable {
  constructor() {
    this.subscribers = new Map();
  }

  subscribe(event, callback) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event).add(callback);

    return () => this.unsubscribe(event, callback);
  }

  unsubscribe(event, callback) {
    if (this.subscribers.has(event)) {
      this.subscribers.get(event).delete(callback);
    }
  }

  notify(event, data) {
    if (this.subscribers.has(event)) {
      this.subscribers.get(event).forEach(callback => {
        callback(data);
      });
    }
  }
}
