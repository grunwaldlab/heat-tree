import { max } from "d3";

/**
 * Placeholder scale for contant output when a mapping variable is not used
 */
export class NullScale {
  constructor(options = {}) {
    this.state = { ...options };
    if (this.state.default === undefined) {
      console.error('A default value for a NullScale is needed.');
    }
  }

  getValue() {
    return this.state.default;
  }
}

/**
 * Identity scale that passes through filtered text values
 * Can optionally apply a custom transformation function and validate against a list of valid values
 */
export class IdentityScale {
  constructor(options = {}) {
    this.state = {
      default: null,
      outputValues: null,
      transformFn: null,
      ...options
    };

    this.validValues = this.state.outputValues ? new Set(this.state.outputValues) : null;
  }

  /**
   * Get the value, optionally transformed and validated
   * @param {*} value - The input value
   * @returns {*} The output value, or null if invalid
   */
  getValue(value) {
    // Apply transformation if provided
    let result = this.state.transformFn ? this.state.transformFn(value) : value;

    // Validate against valid values if provided
    if (this.validValues !== null && !this.validValues.has(result)) {
      result = null;
    }

    // Handle null/undefined/empty values
    if (result === null || result === undefined || result === '') {
      result = this.state.default;
    }

    return result;
  }
}

/**
 * Scale for mapping categorical data to text outputs
 */
export class CategoricalTextScale {
  constructor(values, options = {}) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('values must be a non-empty array');
    }

    this.state = {
      outputValues: null,
      default: null,
      ...options
    };

    // Sort categories by frequency (descending)
    const frequencyMap = new Map();
    for (const category of values) {
      if (category === null || category === undefined || category === '') {
        continue;
      }
      if (frequencyMap.has(category)) {
        frequencyMap.set(category, frequencyMap.get(category) + 1);
      } else {
        frequencyMap.set(category, 1);
      }
    }
    const sortedCategories = new Map(
      [...frequencyMap.entries()].sort((a, b) => a[0] - b[0])
    );

    if (sortedCategories.length > this.state.outputValues.length) {
      this.otheredCategories = sortedCategories.keys().slice(this.state.outputValues.length - 2, sortedCategories.length);
    } else {
      this.otheredCategories = [];
    }

    // Map input categories to output categories
    this.categoryMap = new Map();
    const sortedCategoriesKeys = [...sortedCategories.keys()];
    for (let i = 0; i < sortedCategoriesKeys.length; i++) {
      if (i < this.state.outputValues.length) {
        this.categoryMap.set(sortedCategoriesKeys[i], this.state.outputValues[i]);
      } else {
        this.categoryMap.set(sortedCategoriesKeys[i], this.state.outputValues[this.state.outputValues.length - 1]);
      }
    }
  }

  /**
   * Get the text corresponding to the given category
   * @param {*} category - The category value to map
   * @returns {string} The corresponding text category
   */
  getValue(category) {
    // Handle null/undefined/empty values
    if (category === null || category === undefined || category === '') {
      return this.state.default;
    }
    return this.categoryMap.get(category);
  }
}

/**
 * Scale for mapping continuous numeric values to sizes
 */
export class ContinuousSizeScale {
  constructor(dataMin, dataMax, options = {}) {
    this.state = {
      outputRange: [0.5, 2],
      ...options
    };

    this.dataMin = dataMin;
    this.dataMax = dataMax;
  }

  /**
   * Get the size corresponding to the given value
   * @param {number} value - The data value to map
   * @returns {number} The corresponding size, clamped to min/max
   */
  getValue(value) {
    // Clamp value to data range
    const clampedValue = Math.max(this.dataMin, Math.min(this.dataMax, value));

    // Handle edge case where dataMin === dataMax
    if (this.dataMin === this.dataMax) {
      if (value === this.dataMax) {
        return (this.state.outputRange[0] + this.state.outputRange[1]) / 2;
      } else if (value < this.dataMin) {
        return this.state.outputRange[0];
      } else {
        return this.state.outputRange[1];
      }
    }

    // Linear interpolation
    const t = (clampedValue - this.dataMin) / (this.dataMax - this.dataMin);
    return this.state.outputRange[0] + t * (this.state.outputRange[1] - this.state.outputRange[0]);
  }
}

/**
 * Scale for mapping continuous numeric values to colors
 */
export class ContinuousColorScale {
  constructor(dataMin, dataMax, options = {}) {
    this.state = {
      transformMin: 0,
      transformMax: 1,
      colorPalette: null,
      colorPositions: null,
      nullColor: '#808080',
      ...options
    };

    this.dataMin = dataMin;
    this.dataMax = dataMax;

    // Default to viridis-like color scheme if not provided
    if (this.state.colorPalette === null) {
      this.state.colorPalette = ['#440154', '#31688e', '#35b779', '#fde724'];
    }

    if (this.state.colorPalette.length < 1) {
      throw new Error('At least 1 color is required');
    }

    this.colors = this.state.colorPalette.map(c => this._hexToRgb(c));

    // Handle single color case
    if (this.colors.length === 1) {
      this.colorPositions = [0];
      return;
    }

    // Default to equally spaced positions if not provided
    if (this.state.colorPositions === null) {
      this.colorPositions = this.colors.map((_, i) => i / (this.colors.length - 1));
    } else {
      if (this.state.colorPositions.length !== this.colors.length) {
        throw new Error('colorPositions must have the same length as colors');
      }

      // Sort colorPositions and reorder colors to match
      const paired = this.state.colorPositions.map((pos, i) => ({ pos, color: this.colors[i] }));
      paired.sort((a, b) => a.pos - b.pos);

      this.colorPositions = paired.map(p => p.pos);
      this.colors = paired.map(p => p.color);

      // Normalize positions to [0, 1] range
      const minPos = this.colorPositions[0];
      const maxPos = this.colorPositions[this.colorPositions.length - 1];

      if (minPos === maxPos) {
        // All positions are the same, normalize to 0
        this.colorPositions = this.colorPositions.map(() => 0);
      } else {
        this.colorPositions = this.colorPositions.map(pos => (pos - minPos) / (maxPos - minPos));
      }
    }
  }

  /**
   * Get the color corresponding to the given value
   * @param {number} value - The data value to map
   * @returns {string} The corresponding color as a hex string
   */
  getValue(value) {
    // Handle null/undefined/empty values
    if (value === null || value === undefined || value === '') {
      return this.state.nullColor;
    }

    // Handle single color case
    if (this.colors.length === 1) {
      return this._rgbToHex(this.colors[0].r, this.colors[0].g, this.colors[0].b);
    }

    // Handle edge case where dataMin === dataMax
    if (this.dataMin === this.dataMax) {
      if (value < this.dataMin) {
        return this._rgbToHex(this.colors[0].r, this.colors[0].g, this.colors[0].b);
      } else if (value > this.dataMax) {
        const lastColor = this.colors[this.colors.length - 1];
        return this._rgbToHex(lastColor.r, lastColor.g, lastColor.b);
      } else {
        // value === dataMin === dataMax, return middle color
        const midIdx = Math.floor(this.colors.length / 2);
        const midColor = this.colors[midIdx];
        return this._rgbToHex(midColor.r, midColor.g, midColor.b);
      }
    }

    // Clamp value to data range
    const clampedValue = Math.max(this.dataMin, Math.min(this.dataMax, value));

    // Map to [0, 1] range
    const dataT = (clampedValue - this.dataMin) / (this.dataMax - this.dataMin);

    // Transform to [transformMin, transformMax] range
    const transformedT = this.state.transformMin + dataT * (this.state.transformMax - this.state.transformMin);

    // Clamp to [0, 1] and handle values outside colorPositions range
    const clampedT = Math.max(0, Math.min(1, transformedT));

    // If transformedT is below the first position, return first color
    if (clampedT <= this.colorPositions[0]) {
      return this._rgbToHex(this.colors[0].r, this.colors[0].g, this.colors[0].b);
    }

    // If transformedT is above the last position, return last color
    if (clampedT >= this.colorPositions[this.colorPositions.length - 1]) {
      const lastColor = this.colors[this.colors.length - 1];
      return this._rgbToHex(lastColor.r, lastColor.g, lastColor.b);
    }

    // Find the two colors to interpolate between
    let lowerIdx = 0;
    for (let i = 0; i < this.colorPositions.length - 1; i++) {
      if (clampedT >= this.colorPositions[i]) {
        lowerIdx = i;
      }
    }

    const upperIdx = Math.min(lowerIdx + 1, this.colors.length - 1);

    // Handle edge case where we're exactly at a color position
    if (clampedT === this.colorPositions[lowerIdx]) {
      const color = this.colors[lowerIdx];
      return this._rgbToHex(color.r, color.g, color.b);
    }
    if (clampedT === this.colorPositions[upperIdx]) {
      const color = this.colors[upperIdx];
      return this._rgbToHex(color.r, color.g, color.b);
    }

    // Interpolate between the two colors
    const segmentT = (clampedT - this.colorPositions[lowerIdx]) /
      (this.colorPositions[upperIdx] - this.colorPositions[lowerIdx]);

    return this._interpolateColor(this.colors[lowerIdx], this.colors[upperIdx], segmentT);
  }

  /**
   * Interpolate between two RGB colors
   * @private
   */
  _interpolateColor(color1, color2, t) {
    const r = Math.round(color1.r + (color2.r - color1.r) * t);
    const g = Math.round(color1.g + (color2.g - color1.g) * t);
    const b = Math.round(color1.b + (color2.b - color1.b) * t);

    return this._rgbToHex(r, g, b);
  }

  /**
   * Convert hex color to RGB
   * @private
   */
  _hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Convert RGB to hex color
   * @private
   */
  _rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
}

/**
 * Scale for mapping categorical values to colors
 */
export class CategoricalColorScale {

  defaultPalette = ['#440154', '#31688e', '#35b779', '#fde724'];

  constructor(categoryData, options = {}) {
    if (!Array.isArray(categoryData) || categoryData.length === 0) {
      throw new Error('categoryData must be a non-empty array');
    }

    this.state = {
      transformMin: 0,
      transformMax: 1,
      colorPalette: null,
      colorPositions: null,
      maxCategories: 10,
      nullColor: '#808080',
      ...options
    };

    // Calculate unique categories and their frequencies
    this.frequencyMap = new Map();
    for (const category of categoryData) {
      if (this.frequencyMap.has(category)) {
        this.frequencyMap.set(category, this.frequencyMap.get(category) + 1);
      } else {
        this.frequencyMap.set(category, 1);
      }
    }

    // Store categories in order of descending frequency
    this.categories = [...this.frequencyMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);

    // Default to viridis-like color scheme if not provided
    if (this.state.colorPalette === null) {
      this.state.colorPalette = this.defaultPalette;
    }

    if (this.state.colorPalette.length < 1) {
      throw new Error('At least 1 color is required');
    }

    this.colors = this.state.colorPalette.map(c => this._hexToRgb(c));

    // Handle single color case
    if (this.colors.length === 1) {
      this.colorPositions = [0];
      this._assignColors();
      return;
    }

    // Default to equally spaced positions if not provided
    if (this.state.colorPositions === null) {
      this.colorPositions = this.colors.map((_, i) => i / (this.colors.length - 1));
    } else {
      if (this.state.colorPositions.length !== this.colors.length) {
        throw new Error('colorPositions must have the same length as colors');
      }

      // Sort colorPositions and reorder colors to match
      const paired = this.state.colorPositions.map((pos, i) => ({ pos, color: this.colors[i] }));
      paired.sort((a, b) => a.pos - b.pos);

      this.colorPositions = paired.map(p => p.pos);
      this.colors = paired.map(p => p.color);

      // Normalize positions to [0, 1] range
      const minPos = this.colorPositions[0];
      const maxPos = this.colorPositions[this.colorPositions.length - 1];

      if (minPos === maxPos) {
        // All positions are the same, normalize to 0
        this.colorPositions = this.colorPositions.map(() => 0);
      } else {
        this.colorPositions = this.colorPositions.map(pos => (pos - minPos) / (maxPos - minPos));
      }
    }

    // Assign colors to categories
    this._assignColors();
  }

  /**
   * Assign colors to categories based on frequency
   * @private
   */
  _assignColors() {
    this.categoryColorMap = new Map();

    // Handle single color case
    if (this.colors.length === 1) {
      const hexColor = this._rgbToHex(this.colors[0].r, this.colors[0].g, this.colors[0].b);
      for (const category of this.categories) {
        this.categoryColorMap.set(category, hexColor);
      }
      return;
    }

    if (this.categories.length === 1) {
      // Single category gets the first color
      const color = this._getColorAtPosition(this.state.transformMin);
      this.categoryColorMap.set(this.categories[0], color);
    } else {
      const nCategories = this.categories.length > this.state.maxCategories ? this.state.maxCategories : this.categories.length;

      // Multiple categories spread across the transform range
      for (let i = 0; i < this.categories.length; i++) {
        const t = i >= nCategories ? 1 : i / (nCategories - 1);
        const transformedT = this.state.transformMin + t * (this.state.transformMax - this.state.transformMin);
        const color = this._getColorAtPosition(transformedT);
        this.categoryColorMap.set(this.categories[i], color);
      }
    }
  }

  /**
   * Get color at a specific position in the color scale
   * @private
   */
  _getColorAtPosition(t) {
    // Clamp t to [0, 1]
    t = Math.max(0, Math.min(1, t));

    // Handle single color case
    if (this.colors.length === 1) {
      return this._rgbToHex(this.colors[0].r, this.colors[0].g, this.colors[0].b);
    }

    // If t is below the first position, return first color
    if (t <= this.colorPositions[0]) {
      return this._rgbToHex(this.colors[0].r, this.colors[0].g, this.colors[0].b);
    }

    // If t is above the last position, return last color
    if (t >= this.colorPositions[this.colorPositions.length - 1]) {
      const lastColor = this.colors[this.colors.length - 1];
      return this._rgbToHex(lastColor.r, lastColor.g, lastColor.b);
    }

    // Find the two colors to interpolate between
    let lowerIdx = 0;
    for (let i = 0; i < this.colorPositions.length - 1; i++) {
      if (t >= this.colorPositions[i]) {
        lowerIdx = i;
      }
    }

    const upperIdx = Math.min(lowerIdx + 1, this.colors.length - 1);

    // Handle edge cases
    if (t === this.colorPositions[lowerIdx]) {
      const color = this.colors[lowerIdx];
      return this._rgbToHex(color.r, color.g, color.b);
    }
    if (t === this.colorPositions[upperIdx]) {
      const color = this.colors[upperIdx];
      return this._rgbToHex(color.r, color.g, color.b);
    }

    // Interpolate between the two colors
    const segmentT = (t - this.colorPositions[lowerIdx]) /
      (this.colorPositions[upperIdx] - this.colorPositions[lowerIdx]);

    return this._interpolateColor(this.colors[lowerIdx], this.colors[upperIdx], segmentT);
  }

  /**
   * Get the color corresponding to the given category
   * @param {*} category - The category value to map
   * @returns {string} The corresponding color as a hex string
   */
  getValue(category) {
    // Handle null/undefined/empty values
    if (category === null || category === undefined || category === '') {
      return this.state.nullColor;
    }

    if (this.categoryColorMap.has(category)) {
      return this.categoryColorMap.get(category);
    }

    // Error for unknown categories
    throw new Error(`Unknown category: ${category}`);
  }

  /**
   * Interpolate between two RGB colors
   * @private
   */
  _interpolateColor(color1, color2, t) {
    const r = Math.round(color1.r + (color2.r - color1.r) * t);
    const g = Math.round(color1.g + (color2.g - color1.g) * t);
    const b = Math.round(color1.b + (color2.b - color1.b) * t);

    return this._rgbToHex(r, g, b);
  }

  /**
   * Convert hex color to RGB
   * @private
   */
  _hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Convert RGB to hex color
   * @private
   */
  _rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
}
