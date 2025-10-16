
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
      const leftExtent = d.x - (d.collapsed_parent ? collapsedRootLineLength : 0);
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
