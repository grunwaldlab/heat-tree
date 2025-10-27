import {
  scaleLinear, scaleOrdinal
} from "d3";
import { interpolateViridisSubset } from "./utils.js"

/**
 * Parse a Newick formatted string.
 * @param {string} newickStr - The Newick formatted string.
 * @returns {object} Parsed tree object.
 */
export function parseNewick(newickStr) {
  newickStr = newickStr.trim();
  if (newickStr[newickStr.length - 1] === ';') {
    newickStr = newickStr.slice(0, -1);
  }
  let index = 0;

  function parseTree() {
    let node = {};
    if (newickStr[index] === '(') {
      index++; // skip '('
      node.children = [];
      while (true) {
        let child = parseTree();
        node.children.push(child);
        if (newickStr[index] === ',') {
          index++;
        } else if (newickStr[index] === ')') {
          index++;
          break;
        } else {
          break;
        }
      }
    }
    let label = '';
    while (index < newickStr.length && newickStr[index] !== ',' && newickStr[index] !== ')') {
      label += newickStr[index++];
    }
    label = label.trim();
    if (label) {
      let parts = label.split(":");
      node.name = parts[0] || "";
      if (parts.length > 1) {
        node.length = parseFloat(parts[1]);
      }
    }
    return node;
  }

  const result = parseTree();
  if (index !== newickStr.length) {
    throw new Error(`Unexpected character at position ${index}: '${newickStr[index]}'`);
  }
  return result;
}


export function parseTable(tsvStr, sep = '\t') {

  let metadataMap = new Map();
  let metadataColumns = [];
  let columnTypes = new Map(); // Track whether each column is continuous or categorical

  const lines = tsvStr.trim().split('\n');
  if (lines.length == 0) {
    console.error('Empty metatdata table');
  } else {
    const headers = lines[0].split(sep);
    const nodeIdIndex = headers.indexOf('node_id');

    if (nodeIdIndex === -1) {
      console.warn('Metadata table must contain a "node_id" column');
    } else {
      // Get column names (excluding node_id)
      metadataColumns = headers.filter((h, i) => i !== nodeIdIndex);

      // Initialize column type detection
      const columnValues = new Map();
      metadataColumns.forEach(col => columnValues.set(col, []));

      // Parse metadata rows
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(sep);
        const nodeId = values[nodeIdIndex];
        const metadata = {};

        for (let j = 0; j < headers.length; j++) {
          if (j !== nodeIdIndex) {
            const colName = headers[j];
            const value = values[j];
            metadata[colName] = value;
            columnValues.get(colName).push(value);
          }
        }

        metadataMap.set(nodeId, metadata);
      }

      // Determine column types (continuous vs categorical)
      metadataColumns.forEach(col => {
        const values = columnValues.get(col);
        const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));

        // If all non-empty values can be converted to numbers, treat as continuous
        const isContinuous = numericValues.length > 0 &&
          numericValues.length === values.filter(v => v !== '').length;

        columnTypes.set(col, isContinuous ? 'continuous' : 'categorical');
      });
    }
  }

  return {
    metadataMap: metadataMap,
    columnTypes: columnTypes
  }
}


export function parseMetadata(tsvStr, sep = '\t') {
  const { metadataMap, columnTypes } = parseTable(tsvStr, sep);
  let colorScales = new Map();

  for (const [columnName, columnType] of columnTypes.entries()) {

    const values = [];

    // Collect all values for this column
    metadataMap.forEach(metadata => {
      if (metadata[columnName] !== undefined && metadata[columnName] !== '') {
        values.push(metadata[columnName]);
      }
    });

    if (columnType === 'continuous') {
      // Continuous scale using viridis
      const numericValues = values.map(v => parseFloat(v));
      const minVal = Math.min(...numericValues);
      const maxVal = Math.max(...numericValues);

      // Usage with scale
      colorScales.set(columnName, scaleLinear()
        .domain([minVal, maxVal])
        .range([0, 1])
        .interpolate(() => (t) => interpolateViridisSubset(t)));
    } else {
      // Categorical scale using colors sampled from viridis
      const uniqueValues = [...new Set(values)];
      const numCategories = uniqueValues.length;

      // Sample colors evenly from viridis palette
      const colors = [];
      for (let i = 0; i < numCategories; i++) {
        const t = i / Math.max(1, numCategories - 1);
        colors.push(interpolateViridisSubset(t));
      }

      colorScales.set(columnName, scaleOrdinal()
        .domain(uniqueValues)
        .range(colors));
    }
  }

  return {
    metadataMap: metadataMap,
    columnTypes: columnTypes,
    colorScales: colorScales
  }
}



