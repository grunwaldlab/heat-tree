// Icon library & helpers
const ICONS = {
  refresh: [
    "m 16,7 h 5 V 2",
    "M 22,12 A 10,10 0 0 1 13.58,21.9 10,10 0 0 1 2.5,15.2 10,10 0 0 1 7.4,3.14 10,10 0 0 1 20,6"
  ],
  outwardArrows: [
    "m 9,19 3,3 3,-3",
    "M 12,22 V 15",
    "m 9,5 3,-3 3,3",
    "M 12,2 V 9",
    "m 5,9 -3,3 3,3",
    "M 2,12 H 9",
    "M 19,15 22,12 19,9",
    "M 22,12 H 15"
  ],
  compress: [
    "M 5,12 H 19",
    "m 9,18 3,-3 3,3",
    "m 12,15 v 7",
    "m 9,6 3,3 3,-3",
    "M 12,9 V 2"
  ],
  expand: [
    "M 5,2 H 19",
    "M 5,22 H 19",
    "m 9,8 3,-3 3,3",
    "m 9,16 3,3 3,-3",
    "M 12,5 V 19"
  ],
  circle: [
    "M 12,2 A 10,10 0 1 1 12,22 A 10,10 0 1 1 12,2"
  ],
  trash: [
    "M 3,6 H 21",
    "M 19,6 V 20 A 2,2 0 0 1 17,22 H 7 A 2,2 0 0 1 5,20 V 6",
    "M 8,6 V 4 A 2,2 0 0 1 10,2 H 14 A 2,2 0 0 1 16,4 V 6",
    "M 10,11 V 17",
    "M 14,11 V 17"
  ]
};

// Append an icon to the given SVG button, automatically scaling and
// centring it.  Returns the appended <g>.
export function appendIcon(svgSel, name, size, padding) {
  const iconPathData = ICONS[name];
  const scale = (size - padding * 2) / 24;

  const button = svgSel.append("rect")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("rx", "5px")
    .attr("ry", "5px")
    .attr("fill", "#CCC");

  const paths = svgSel.append("g")
    .attr("transform", `translate(${padding}, ${padding}) scale(${scale})`)
    .attr("stroke", "#555")
    .attr("fill", "none")
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("stroke-width", 2);

  iconPathData.forEach(p => {
    paths.append("path").attr("d", p);
  });

  return button;
}
