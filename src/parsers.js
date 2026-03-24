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


export function parseTable(tsvStr, valid_ids, sep = '\t') {

  let metadataMap = new Map();
  let columnTypes = new Map(); // Track whether each column is continuous or categorical
  let validIdCounts = []; // how many valid ids are present in each column
  let idColumns = [];

  const lines = tsvStr.trim().split('\n');
  if (lines.length == 0) {
    console.error('Empty metadata table');
  } else {
    const headers = lines[0].split(sep);

    // Initialize column type detection
    const columnValues = new Map();
    headers.forEach(col => columnValues.set(col, []));

    // Parse metadata rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(sep);
      const metadata = {};

      for (let j = 0; j < headers.length; j++) {
        const colName = headers[j];
        const value = values[j] === '' ? undefined : values[j];
        metadata[colName] = value;
        columnValues.get(colName).push(value);
      }

      // Store with row index as key
      metadataMap.set(i - 1, metadata);
    }

    headers.forEach(col => {
      const values = columnValues.get(col);

      // Determine column types (continuous vs categorical)
      const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
      const isContinuous = numericValues.length > 0 &&
        numericValues.length === values.filter(v => v !== undefined).length;
      columnTypes.set(col, isContinuous ? 'continuous' : 'categorical');

      // Count how many values in this column match tree node names
      let matchCount = 0;
      for (const value of values) {
        if (value && valid_ids.has(value)) {
          matchCount++;
        }
      }
      if (matchCount > 0) {
        validIdCounts.push({ col, matchCount });
      }
    });

    // Sort by match count descending
    validIdCounts = validIdCounts.sort((a, b) => b.matchCount - a.matchCount);
    idColumns = validIdCounts.map(x => x.col);
  }

  return { metadataMap, columnTypes, idColumns }
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
