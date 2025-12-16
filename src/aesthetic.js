import {
  NullScale,
  IdentityScale,
  CategoricalFontStyleScale,
  ContinuousSizeScale,
  ContinuousColorScale,
  CategoricalColorScale
} from "./scales.js";

/**
 * Manages the configuration and scale for a single aesthetic mapping
 * (e.g., tip label color mapped to a metadata column)
 */
export class Aesthetic {
  state; // Object containing all configuration used to infer the scale
  scale; // the actual scale instance

  constructor(options = {}) {
    // Required options
    if (!options.scaleType) {
      throw new Error('scaleType is required');
    }
    if (options.default === undefined) {
      throw new Error('default is required');
    }

    // Initialize state with all configuration variables
    this.state = {
      isCategorical: undefined,
      outputValues: null,
      colorPalette: null,
      outputRange: null,
      inputUnits: null,
      title: null,
      maxCategories: 10,
      otherCategoryColor: "#888888",
      transformMin: 0,
      transformMax: 1,
      transformFn: null,
      colorPositions: null,
      ...options
    };

    // Initialize the scale
    this.updateScale();
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
  updateScale() {
    const { scaleType, values, isCategorical } = this.state;
    let scale;

    // Handle null scale
    if (scaleType === 'null') {
      scale = new NullScale(this.state.default);
      this.setScale(scale);
      return;
    }

    // Handle text/identity scales
    if (scaleType === 'text' || scaleType === 'identity') {
      scale = new IdentityScale(
        this.state.default,
        this.state.outputValues,
        this.state.transformFn
      );
      this.setScale(scale);
      return;
    }

    // Handle font style scales (only for categorical data)
    if (scaleType === 'fontStyle') {
      if (!isCategorical) {
        throw new Error('Font style scales can only be used with categorical data');
      }

      if (values.length === 0) {
        console.warn('No values found for font style scale, using NullScale');
        scale = new NullScale(this.state.default);
      } else {
        scale = new CategoricalFontStyleScale(values);
      }
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
          this.state.colorPositions
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
}
