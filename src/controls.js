import { appendIcon } from "./icons.js";
import { niceNumber } from "./utils.js";

/**
 * Initialize the reset button
 * @param {Selection} toolbarDiv - D3 selection of the toolbar container
 * @param {Object} options - Configuration options
 * @param {Function} onClick - Callback function when button is clicked
 * @returns {Object} Object containing the button element
 */
export function initResetButton(toolbarDiv, options, onClick) {
  const btnReset = toolbarDiv.append("div")
    .style("flex", "0 0 auto")
    .append("svg")
    .attr("width", options.buttonSize)
    .attr("height", options.buttonSize)
    .style("cursor", "pointer")
    .on("click", onClick);
  appendIcon(btnReset, "refresh", options.buttonSize, options.buttonPadding);

  return {
    button: btnReset
  };
}

/**
 * Initialize the expand root button
 * @param {Selection} toolbarDiv - D3 selection of the toolbar container
 * @param {Object} options - Configuration options
 * @param {Function} onClick - Callback function when button is clicked
 * @returns {Object} Object containing the button element and update function
 */
export function initExpandRootButton(toolbarDiv, options, onClick) {
  const btnExpandRoot = toolbarDiv.append("div")
    .style("flex", "0 0 auto")
    .append("svg")
    .attr("width", options.buttonSize)
    .attr("height", options.buttonSize)
    .style("cursor", "pointer")
    .on("click", onClick);
  appendIcon(btnExpandRoot, "expand", options.buttonSize, options.buttonPadding);

  return {
    button: btnExpandRoot,
    update: (hasCollapsedRoot) => updateExpandRootAppearance(btnExpandRoot, hasCollapsedRoot)
  };
}

/**
 * Update the expand root button appearance
 * @param {Selection} btnExpandRoot - D3 selection of the button
 * @param {boolean} hasCollapsedRoot - Whether the root is collapsed
 */
function updateExpandRootAppearance(btnExpandRoot, hasCollapsedRoot) {
  btnExpandRoot.select("rect").attr("fill", hasCollapsedRoot ? "#CCC" : "#EEE");
  btnExpandRoot.style("cursor", hasCollapsedRoot ? "pointer" : "not-allowed");
  btnExpandRoot.style("opacity", hasCollapsedRoot ? 1 : 0.5);
}

/**
 * Initialize the toggle zoom/pan button
 * @param {Selection} toolbarDiv - D3 selection of the toolbar container
 * @param {Object} options - Configuration options
 * @param {Function} onClick - Callback function when button is clicked
 * @returns {Object} Object containing the button element and update function
 */
export function initToggleZoomButton(toolbarDiv, options, onClick) {
  const btnToggleZoom = toolbarDiv.append("div")
    .style("flex", "0 0 auto")
    .append("svg")
    .attr("width", options.buttonSize)
    .attr("height", options.buttonSize)
    .style("cursor", "pointer")
    .on("click", onClick);
  appendIcon(btnToggleZoom, "outwardArrows", options.buttonSize, options.buttonPadding);

  return {
    button: btnToggleZoom,
    update: (enabled) => updateToggleZoomAppearance(btnToggleZoom, enabled)
  };
}

/**
 * Update the toggle zoom button appearance
 * @param {Selection} btnToggleZoom - D3 selection of the button
 * @param {boolean} enabled - Whether zoom/pan is enabled
 */
function updateToggleZoomAppearance(btnToggleZoom, enabled) {
  btnToggleZoom.select("rect").attr("fill", enabled ? "#CCC" : "#EEE");
}

/**
 * Initialize the toggle circular layout button
 * @param {Selection} toolbarDiv - D3 selection of the toolbar container
 * @param {Object} options - Configuration options
 * @param {Function} onClick - Callback function when button is clicked
 * @returns {Object} Object containing the button element and update function
 */
export function initToggleCircularButton(toolbarDiv, options, onClick) {
  const btnToggleCircular = toolbarDiv.append("div")
    .style("flex", "0 0 auto")
    .append("svg")
    .attr("width", options.buttonSize)
    .attr("height", options.buttonSize)
    .style("cursor", "pointer")
    .on("click", onClick);
  appendIcon(btnToggleCircular, "circle", options.buttonSize, options.buttonPadding);

  return {
    button: btnToggleCircular,
    update: (enabled) => updateToggleCircularAppearance(btnToggleCircular, enabled)
  };
}

/**
 * Update the toggle circular layout button appearance
 * @param {Selection} btnToggleCircular - D3 selection of the button
 * @param {boolean} enabled - Whether circular layout is enabled
 */
function updateToggleCircularAppearance(btnToggleCircular, enabled) {
  btnToggleCircular.select("rect").attr("fill", enabled ? "#CCC" : "#EEE");
}
