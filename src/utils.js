
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

