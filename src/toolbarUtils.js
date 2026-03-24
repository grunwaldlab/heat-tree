/**
 * Helper function to create a control group container
 */
export function createControlGroup() {
  const group = document.createElement('div');
  group.className = 'ht-control-group';
  return group;
}

/**
 * Helper function to create a label
 */
export function createLabel(text, height) {
  const label = document.createElement('label');
  label.className = 'ht-control-label';
  label.textContent = text;
  label.style.height = `${height}px`;
  return label;
}

/**
 * Helper function to create a button
 */
export function createButton(text, title = '', height) {
  const button = document.createElement('button');
  button.className = 'ht-button';
  button.textContent = text;
  button.title = title;
  button.style.height = `${height}px`;
  return button;
}

/**
 * Helper function to create an icon button
 */
export function createIconButton(iconSvg, title = '', height) {
  const button = document.createElement('button');
  button.className = 'ht-icon-button';
  button.innerHTML = iconSvg;
  button.title = title;
  button.style.height = `${height}px`;
  button.style.width = `${height}px`;
  return button;
}

/**
 * Helper function to create a slider
 */
export function createSlider(min, max, value, step, height) {
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'ht-slider';
  slider.min = min;
  slider.max = max;
  slider.value = value;
  slider.step = step;
  slider.style.height = `${height}px`;
  return slider;
}

/**
 * Helper function to create a toggle switch
 */
export function createToggle(initialState, height) {
  const toggleHeight = Math.min(24, height - 4);
  const knobSize = toggleHeight - 4;

  const toggle = document.createElement('div');
  toggle.className = initialState ? 'ht-toggle active' : 'ht-toggle';
  toggle.style.height = `${toggleHeight}px`;

  const knob = document.createElement('div');
  knob.className = 'ht-toggle-knob';
  knob.style.width = `${knobSize}px`;
  knob.style.height = `${knobSize}px`;

  toggle.appendChild(knob);

  // Note: Click handler should be added by the caller, not here
  // This allows the caller to control the toggle state explicitly

  return toggle;
}

/**
 * Helper function to create a number input
 */
export function createNumberInput(value, min, max, step, height) {
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'ht-number-input';
  input.value = value;
  input.min = min;
  input.max = max;
  input.step = step;
  input.style.height = `${height}px`;
  return input;
}
