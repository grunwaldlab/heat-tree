import {
  NullScale,
  IdentityScale,
  CategoricalTextScale,
  ContinuousSizeScale,
  ContinuousColorScale,
  CategoricalColorScale
} from "./scales.js";
import { Subscribable } from "./utils.js";

/**
 * Manages the configuration and scale for a single aesthetic mapping
 * (e.g., tip label color mapped to a metadata column)
 */
export class Aesthetic extends Subscribable {
  state; // Object containing all configuration used to infer the scale
  scale; // the actual scale instance
  values; // Store the original values for scale recreation

  constructor(values, options = {}) {
    super();

    // Required options
    if (!options.scaleType) {
      throw new Error('scaleType is required');
    }
    if (options.default === undefined) {
      throw new Error('default is required');
    }

    // Store values for later use
    this.values = values;

    // Initialize state with all configuration variables
    this.state = {
      scaleType: undefined,
      default: undefined,
      isCategorical: undefined,
      outputValues: null,
      outputRegex: null,
      colorPalette: null,
      outputRange: null,
      inputUnits: null,
      title: null,
      maxCategories: 7,
      otherCategory: "#888888",
      otherLabel: "Other",
      transformMin: 0,
      transformMax: 1,
      transformFn: null,
      colorPositions: null,
      nullColor: '#808080',
      ...options
    };

    // Initialize the scale
    this.updateScale(values);
  }

  /**
   * Set the scale instance for this aesthetic
   * @param {object} scale - The scale instance
   */
  setScale(scale) {
    this.scale = scale;
  }

  /**
   * Get the output value for a given input value
   * Wraps the scale's getValue() function
   * @param {*} value - The input value
   * @returns {*} The output value
   */
  getValue(value) {
    return this.scale.getValue(value);
  }

  /**
   * Update the scale based on current state
   * Uses the stored state to create an appropriate scale
   */
  updateScale(values) {
    const { scaleType, isCategorical } = this.state;
    let scale;

    // Handle null scale
    if (scaleType === 'null') {
      scale = new NullScale(this.state.default);
      this.setScale(scale);
      return;
    }

    // Handle identity scales and data already in the output format
    let isAlreadyOutputFormat = true;
    if (isCategorical && (this.state.outputValues || this.state.outputRegex)) {
      if (this.state.outputValues) {
        for (let i = 0; i < values.length; i++) {
          if (values[i] && !this.state.outputValues.includes(values[i])) {
            isAlreadyOutputFormat = false;
            break;
          }
        }
      }
      if (this.state.outputRegex) {
        for (let i = 0; i < values.length; i++) {
          if (values[i] && !this.state.outputRegex.test(values[i])) {
            isAlreadyOutputFormat = false;
            break;
          }
        }
      }
    } else {
      isAlreadyOutputFormat = false;
    }
    if (scaleType === 'identity' || isAlreadyOutputFormat) {
      scale = new IdentityScale(
        this.state.default,
        this.state.outputValues,
        this.state.transformFn
      );
      this.setScale(scale);
      return;
    }

    // Handle text scales (only for categorical data)
    if (scaleType === 'text') {
      if (!isCategorical) {
        throw new Error('Text scales can only be used with categorical data');
      }
      scale = new CategoricalTextScale(values, this.state.outputValues, this.state.default);
      this.setScale(scale);
      return;
    }

    // Handle size scales (only for continuous data)
    if (scaleType === 'size') {
      if (isCategorical) {
        throw new Error('Size scales can only be used with continuous data');
      }

      const numericValues = values.map(v => Number(v)).filter(v => !isNaN(v));
      if (numericValues.length === 0) {
        console.warn('No numeric values found for size scale, using NullScale');
        scale = new NullScale(this.state.default);
      } else {
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);
        const range = this.state.outputRange || [0.5, 2];
        scale = new ContinuousSizeScale(min, max, range[0], range[1]);
      }
      this.setScale(scale);
      return;
    }

    // Handle color scales
    if (scaleType === 'color') {
      if (isCategorical) {
        scale = new CategoricalColorScale(
          values,
          this.state.transformMin,
          this.state.transformMax,
          this.state.colorPalette,
          this.state.colorPositions,
          this.state.maxCategories
        );
      } else {
        const numericValues = values.map(v => Number(v)).filter(v => !isNaN(v));
        if (numericValues.length === 0) {
          console.warn('No numeric values found for color scale, using NullScale');
          scale = new NullScale(this.state.default);
        } else {
          const min = Math.min(...numericValues);
          const max = Math.max(...numericValues);
          scale = new ContinuousColorScale(
            min,
            max,
            this.state.transformMin,
            this.state.transformMax,
            this.state.colorPalette,
            this.state.colorPositions
          );
        }
      }
      this.setScale(scale);
      return;
    }

    throw new Error(`Unknown scale type: ${scaleType}`);
  }

  /**
   * Update aesthetic state properties
   * @param {Object} updates - Object with properties to update
   */
  updateState(updates) {
    Object.assign(this.state, updates);
  }

  /**
   * Create settings widget(s) for this aesthetic
   * @param {Object} options - Configuration options
   * @param {number} options.controlHeight - Height of controls
   * @returns {HTMLElement|null} The settings widget container, or null if no settings available
   */
  createSettingsWidget(options = {}) {
    const {
      controlHeight = 24
    } = options;

    // For color scales, create color palette editor
    if (this.state.scaleType === 'color') {
      return this.createColorPaletteEditor(controlHeight);
    }

    // For other scale types, return null (no settings widget yet)
    return null;
  }

  /**
   * Create a color palette editor widget
   * @param {number} controlHeight - Height of controls
   * @returns {HTMLElement} The palette editor container
   */
  createColorPaletteEditor(controlHeight) {
    if (!this.scale) {
      return null;
    }

    const container = document.createElement('div');
    container.className = 'ht-color-palette-editor';

    // Get colors from the scale
    let colors = [];
    if (this.scale.colors) {
      colors = this.scale.colors.map(c => this.scale._rgbToHex(c.r, c.g, c.b));
    }

    // Calculate actual color positions if not provided
    const positions = this.scale.colorPositions || colors.map((_, i) => i / (colors.length - 1));

    // State for the editor - initialize from current scale/aesthetic state
    const editorState = {
      colors: [...colors],
      positions: [...positions],
      transformMin: this.state.transformMin,
      transformMax: this.state.transformMax,
      nullColor: this.scale.nullColor || this.state.nullColor
    };

    // Helper function to apply palette changes
    const applyPaletteChanges = () => {
      // Update aesthetic state directly
      this.state.colorPalette = editorState.colors;
      this.state.colorPositions = editorState.positions;
      this.state.transformMin = editorState.transformMin;
      this.state.transformMax = editorState.transformMax;
      this.state.nullColor = editorState.nullColor;

      // Recreate the scale with new settings
      this.updateScale(this.values);

      // Notify subscribers of the change
      this.notify('paletteChange', {
        colors: editorState.colors,
        colorPositions: editorState.positions,
        transformMin: editorState.transformMin,
        transformMax: editorState.transformMax,
        nullColor: editorState.nullColor
      });
    };

    // Create gradient container (holds both gradient and null color controls)
    const gradientContainer = document.createElement('div');
    gradientContainer.className = 'ht-gradient-container';

    // Create gradient column
    const gradientColumn = document.createElement('div');
    gradientColumn.className = 'ht-gradient-column';

    // Create color squares above gradient
    const colorSquaresContainer = document.createElement('div');
    colorSquaresContainer.className = 'ht-color-squares-container';

    // Create gradient box
    const gradientBox = document.createElement('div');
    gradientBox.className = 'ht-gradient-box';

    // Function to update gradient display
    const updateGradientDisplay = () => {
      const gradientStops = editorState.colors.map((color, i) => {
        const pos = editorState.positions[i] * 100;
        return `${color} ${pos}%`;
      }).join(', ');
      gradientBox.style.background = `linear-gradient(to right, ${gradientStops})`;
    };

    // Initial gradient display
    updateGradientDisplay();

    // Create color squares with ticks
    const colorSquares = [];
    editorState.colors.forEach((color, i) => {
      const squareContainer = createColorSquareWithTick(colorSquaresContainer, color, () => {
        console.log(`Edit color ${i}: ${color}`);
        // Will implement color picker later
      });
      squareContainer.style.left = `${editorState.positions[i] * 100}%`;
      colorSquares.push(squareContainer);
    });

    // Create range slider below gradient
    const rangeSliderContainer = document.createElement('div');
    rangeSliderContainer.className = 'ht-range-slider-container';

    // Create min handle
    const minHandle = document.createElement('div');
    minHandle.className = 'ht-range-handle';
    minHandle.style.left = `${editorState.transformMin * 100}%`;
    minHandle.title = 'Drag to adjust minimum';

    // Set handle color based on gradient
    let minColor = interpolateGradient(editorState.colors, editorState.positions, editorState.transformMin);
    minHandle.style.backgroundColor = minColor;

    // Create upward triangle indicator for min handle
    const minIndicator = document.createElement('div');
    minIndicator.className = 'ht-range-handle-indicator';
    minHandle.appendChild(minIndicator);

    // Create max handle
    const maxHandle = document.createElement('div');
    maxHandle.className = 'ht-range-handle';
    maxHandle.style.left = `${editorState.transformMax * 100}%`;
    maxHandle.title = 'Drag to adjust maximum';

    // Set handle color based on gradient
    let maxColor = interpolateGradient(editorState.colors, editorState.positions, editorState.transformMax);
    maxHandle.style.backgroundColor = maxColor;

    // Create upward triangle indicator for max handle
    const maxIndicator = document.createElement('div');
    maxIndicator.className = 'ht-range-handle-indicator';
    maxHandle.appendChild(maxIndicator);

    // Add drag functionality for min handle
    let isDraggingMin = false;
    minHandle.addEventListener('mousedown', (e) => {
      isDraggingMin = true;
      e.preventDefault();
    });

    // Add drag functionality for max handle
    let isDraggingMax = false;
    maxHandle.addEventListener('mousedown', (e) => {
      isDraggingMax = true;
      e.preventDefault();
    });

    // Handle mouse move for dragging
    const handleMouseMove = (e) => {
      if (!isDraggingMin && !isDraggingMax) return;

      const rect = rangeSliderContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      let newValue = Math.max(0, Math.min(1, x / width));

      if (isDraggingMin) {
        // Ensure min doesn't go past max
        newValue = Math.min(newValue, editorState.transformMax - 0.01);
        editorState.transformMin = newValue;
        minHandle.style.left = `${newValue * 100}%`;
        minColor = interpolateGradient(editorState.colors, editorState.positions, newValue);
        minHandle.style.backgroundColor = minColor;

        // Apply changes
        applyPaletteChanges();
      } else if (isDraggingMax) {
        // Ensure max doesn't go before min
        newValue = Math.max(newValue, editorState.transformMin + 0.01);
        editorState.transformMax = newValue;
        maxHandle.style.left = `${newValue * 100}%`;
        maxColor = interpolateGradient(editorState.colors, editorState.positions, newValue);
        maxHandle.style.backgroundColor = maxColor;

        // Apply changes
        applyPaletteChanges();
      }
    };

    const handleMouseUp = () => {
      isDraggingMin = false;
      isDraggingMax = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    rangeSliderContainer.appendChild(minHandle);
    rangeSliderContainer.appendChild(maxHandle);

    // Assemble gradient column
    gradientColumn.appendChild(colorSquaresContainer);
    gradientColumn.appendChild(gradientBox);
    gradientColumn.appendChild(rangeSliderContainer);

    // Create null color column (structured same as gradient column)
    const nullColorColumn = document.createElement('div');
    nullColorColumn.className = 'ht-null-color-column';

    // Create color square container (aligned with gradient color squares)
    const nullColorSquareContainer = document.createElement('div');
    nullColorSquareContainer.className = 'ht-null-color-square-container';

    // Color square with tick
    const nullSquareWrapper = document.createElement('div');
    nullSquareWrapper.style.display = 'flex';
    nullSquareWrapper.style.flexDirection = 'column';
    nullSquareWrapper.style.alignItems = 'center';

    const nullSquare = document.createElement('div');
    nullSquare.className = 'ht-null-color-square';
    nullSquare.style.backgroundColor = editorState.nullColor;
    nullSquare.title = 'Click to edit missing data color';

    // Make only the square clickable
    nullSquare.addEventListener('click', () => {
      console.log(`Edit null color: ${editorState.nullColor}`);
      // Will implement color picker later
    });

    const nullTick = document.createElement('div');
    nullTick.className = 'ht-null-color-square-tick';

    nullSquareWrapper.appendChild(nullSquare);
    nullSquareWrapper.appendChild(nullTick);
    nullColorSquareContainer.appendChild(nullSquareWrapper);

    // Create null color box (aligned with gradient box)
    const nullColorBox = document.createElement('div');
    nullColorBox.className = 'ht-null-color-box';
    nullColorBox.style.backgroundColor = editorState.nullColor;

    // Create reset container (aligned with range slider)
    const resetContainer = document.createElement('div');
    resetContainer.className = 'ht-null-color-reset-container';
    resetContainer.title = 'Reset to default missing data color';

    // Create upward triangle indicator
    const resetIndicator = document.createElement('div');
    resetIndicator.className = 'ht-null-color-reset-indicator';

    const resetX = document.createElement('div');
    resetX.className = 'ht-null-color-reset';
    resetX.textContent = '✕';

    resetX.addEventListener('click', () => {
      const defaultNullColor = '#808080';
      editorState.nullColor = defaultNullColor;
      nullSquare.style.backgroundColor = defaultNullColor;
      nullColorBox.style.backgroundColor = defaultNullColor;

      // Apply changes
      applyPaletteChanges();
    });

    resetContainer.appendChild(resetIndicator);
    resetContainer.appendChild(resetX);

    // Assemble null color column
    nullColorColumn.appendChild(nullColorSquareContainer);
    nullColorColumn.appendChild(nullColorBox);
    nullColorColumn.appendChild(resetContainer);

    // Assemble gradient container with both columns
    gradientContainer.appendChild(gradientColumn);
    gradientContainer.appendChild(nullColorColumn);

    // Create left buttons (plus and minus)
    const leftButtonsContainer = document.createElement('div');
    leftButtonsContainer.className = 'ht-palette-buttons-container';

    const leftPlusBtn = createPaletteButton('+', 'Add color to left');
    leftPlusBtn.addEventListener('click', () => {
      // Add a new color at the beginning
      const newColor = editorState.colors[0]; // Duplicate the first color
      editorState.colors.unshift(newColor);

      // Recalculate positions to evenly space colors
      editorState.positions = editorState.colors.map((_, i) => i / (editorState.colors.length - 1));

      // Update display
      updateGradientDisplay();

      // Recreate color squares
      colorSquaresContainer.innerHTML = '';
      colorSquares.length = 0;
      editorState.colors.forEach((color, i) => {
        const squareContainer = createColorSquareWithTick(colorSquaresContainer, color, () => {
          console.log(`Edit color ${i}: ${color}`);
        });
        squareContainer.style.left = `${editorState.positions[i] * 100}%`;
        colorSquares.push(squareContainer);
      });

      // Update handle colors
      minColor = interpolateGradient(editorState.colors, editorState.positions, editorState.transformMin);
      minHandle.style.backgroundColor = minColor;
      maxColor = interpolateGradient(editorState.colors, editorState.positions, editorState.transformMax);
      maxHandle.style.backgroundColor = maxColor;

      // Apply changes
      applyPaletteChanges();
    });

    const leftMinusBtn = createPaletteButton('-', 'Remove color from left');
    leftMinusBtn.addEventListener('click', () => {
      if (editorState.colors.length <= 2) {
        console.warn('Cannot remove color: minimum 2 colors required');
        return;
      }

      // Remove the first color
      editorState.colors.shift();

      // Recalculate positions
      editorState.positions = editorState.colors.map((_, i) => i / (editorState.colors.length - 1));

      // Update display
      updateGradientDisplay();

      // Recreate color squares
      colorSquaresContainer.innerHTML = '';
      colorSquares.length = 0;
      editorState.colors.forEach((color, i) => {
        const squareContainer = createColorSquareWithTick(colorSquaresContainer, color, () => {
          console.log(`Edit color ${i}: ${color}`);
        });
        squareContainer.style.left = `${editorState.positions[i] * 100}%`;
        colorSquares.push(squareContainer);
      });

      // Update handle colors
      minColor = interpolateGradient(editorState.colors, editorState.positions, editorState.transformMin);
      minHandle.style.backgroundColor = minColor;
      maxColor = interpolateGradient(editorState.colors, editorState.positions, editorState.transformMax);
      maxHandle.style.backgroundColor = maxColor;

      // Apply changes
      applyPaletteChanges();
    });

    leftButtonsContainer.appendChild(leftPlusBtn);
    leftButtonsContainer.appendChild(leftMinusBtn);

    // Create right buttons (plus and minus)
    const rightButtonsContainer = document.createElement('div');
    rightButtonsContainer.className = 'ht-palette-buttons-container';

    const rightPlusBtn = createPaletteButton('+', 'Add color to right');
    rightPlusBtn.addEventListener('click', () => {
      // Add a new color at the end
      const newColor = editorState.colors[editorState.colors.length - 1]; // Duplicate the last color
      editorState.colors.push(newColor);

      // Recalculate positions
      editorState.positions = editorState.colors.map((_, i) => i / (editorState.colors.length - 1));

      // Update display
      updateGradientDisplay();

      // Recreate color squares
      colorSquaresContainer.innerHTML = '';
      colorSquares.length = 0;
      editorState.colors.forEach((color, i) => {
        const squareContainer = createColorSquareWithTick(colorSquaresContainer, color, () => {
          console.log(`Edit color ${i}: ${color}`);
        });
        squareContainer.style.left = `${editorState.positions[i] * 100}%`;
        colorSquares.push(squareContainer);
      });

      // Update handle colors
      minColor = interpolateGradient(editorState.colors, editorState.positions, editorState.transformMin);
      minHandle.style.backgroundColor = minColor;
      maxColor = interpolateGradient(editorState.colors, editorState.positions, editorState.transformMax);
      maxHandle.style.backgroundColor = maxColor;

      // Apply changes
      applyPaletteChanges();
    });

    const rightMinusBtn = createPaletteButton('-', 'Remove color from right');
    rightMinusBtn.addEventListener('click', () => {
      if (editorState.colors.length <= 2) {
        console.warn('Cannot remove color: minimum 2 colors required');
        return;
      }

      // Remove the last color
      editorState.colors.pop();

      // Recalculate positions
      editorState.positions = editorState.colors.map((_, i) => i / (editorState.colors.length - 1));

      // Update display
      updateGradientDisplay();

      // Recreate color squares
      colorSquaresContainer.innerHTML = '';
      colorSquares.length = 0;
      editorState.colors.forEach((color, i) => {
        const squareContainer = createColorSquareWithTick(colorSquaresContainer, color, () => {
          console.log(`Edit color ${i}: ${color}`);
        });
        squareContainer.style.left = `${editorState.positions[i] * 100}%`;
        colorSquares.push(squareContainer);
      });

      // Update handle colors
      minColor = interpolateGradient(editorState.colors, editorState.positions, editorState.transformMin);
      minHandle.style.backgroundColor = minColor;
      maxColor = interpolateGradient(editorState.colors, editorState.positions, editorState.transformMax);
      maxHandle.style.backgroundColor = maxColor;

      // Apply changes
      applyPaletteChanges();
    });

    rightButtonsContainer.appendChild(rightPlusBtn);
    rightButtonsContainer.appendChild(rightMinusBtn);

    // Assemble the editor
    container.appendChild(leftButtonsContainer);
    container.appendChild(gradientContainer);
    container.appendChild(rightButtonsContainer);

    return container;
  }
}

/**
 * Helper functions for color palette editor
 */

/**
 * Create a small button for palette controls
 */
function createPaletteButton(text, title) {
  const button = document.createElement('button');
  button.className = 'ht-palette-button';
  button.textContent = text;
  button.title = title;
  return button;
}

/**
 * Interpolate color from gradient at position t (0-1)
 */
function interpolateGradient(colors, positions, t) {
  // Clamp t to [0, 1]
  t = Math.max(0, Math.min(1, t));

  // Handle single color case
  if (colors.length === 1) {
    return colors[0];
  }

  // Find the two colors to interpolate between
  let i = 0;
  while (i < positions.length - 1 && t > positions[i + 1]) {
    i++;
  }

  // If t is exactly at a position, return that color
  if (t === positions[i]) {
    return colors[i];
  }

  // If we're at the last position, return the last color
  if (i === positions.length - 1) {
    return colors[i];
  }

  // Interpolate between colors[i] and colors[i+1]
  const t1 = positions[i];
  const t2 = positions[i + 1];
  const localT = (t - t1) / (t2 - t1);

  const color1 = hexToRgb(colors[i]);
  const color2 = hexToRgb(colors[i + 1]);

  const r = Math.round(color1.r + (color2.r - color1.r) * localT);
  const g = Math.round(color1.g + (color2.g - color1.g) * localT);
  const b = Math.round(color1.b + (color2.b - color1.b) * localT);

  return rgbToHex(r, g, b);
}

/**
 * Convert hex color to RGB object
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

/**
 * Convert RGB values to hex color
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Create a color square with tick mark
 */
function createColorSquareWithTick(parent, color, event) {
  const squareContainer = document.createElement('div');
  squareContainer.className = 'ht-color-square-wrapper';

  // Color square
  const square = document.createElement('div');
  square.className = 'ht-color-square';
  square.style.backgroundColor = color;
  square.title = 'Click to edit color';

  // TODO: Add color picker functionality
  square.addEventListener('click', event);

  // Tick mark
  const tick = document.createElement('div');
  tick.className = 'ht-color-square-tick';

  squareContainer.appendChild(square);
  squareContainer.appendChild(tick);
  parent.appendChild(squareContainer);
  return squareContainer;
}
