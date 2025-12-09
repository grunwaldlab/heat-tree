import { hierarchy, ascending } from "d3";
import { parseNewick, parseTable } from "./parsers.js";
import { Subscribable, columnToHeader } from "./utils.js";
import {
  NullScale,
  TextScale,
  ContinuousSizeScale,
  ContinuousColorScale,
  CategoricalColorScale
} from "./scales.js";

/**
 * Manages tree data and metadata tables
 * Handles parsing, storage, and attachment of metadata to tree nodes
 */
export class TreeData extends Subscribable {

  tree;
  metadata = new Map();
  columnType = new Map(); // e.g. 'continuous' or 'categorical', keyed by unique column ID
  columnName = new Map(); // Original column name, keyed by unique column ID
  columnDisplayName = new Map(); // Display-friendly column name, keyed by unique column ID
  columnScale = {
    color: new Map(),
    size: new Map(),
    text: new Map()
  }
  #nextTableId = 0;

  constructor(newickStr, metadataTables = []) {
    super();

    this.tree = this.parseTree(newickStr);

    if (Array.isArray(metadataTables)) {
      metadataTables.forEach(tableStr => this.addTable(tableStr));
    }
  }

  /**
   * Parse a Newick string and create a hierarchy
   * @param {string} newickStr - Newick formatted string
   * @returns {object} D3 hierarchy object
   */
  parseTree(newickStr) {
    const treeData = parseNewick(newickStr);

    // Create a D3 hierarchy from the tree data and sort by size of subtree and branch length
    const root = hierarchy(treeData, d => d.children)
      .sum(d => d.children ? 0 : 1)
      .each(function(d) {
        d.leafCount = d.value;
        delete d.value;
        delete d.data.children;
      })
      .sort((a, b) => (a.leafCount - b.leafCount) || ascending(a.data.length, b.data.length));

    // Assign a stable, unique id to every node so D3 can track elements across updates
    let nodeId = 0;
    root.each(d => { d.id = ++nodeId; });

    return root;
  }

  /**
   * Parse and set the tree data
   * @param {string} newickStr - Newick formatted string or path
   */
  setTree(newickStr) {
    this.tree = this.parseTree(newickStr);
    this.metadata.keys().forEach(this.#attachTable);
    this.notify('treeUpdated', this);
  }

  /**
   * Add a metadata table
   * @param {string} tableStr - TSV formatted string or path
   * @param {string|null} id - Optional table ID (auto-generated if null)
   * @param {boolean} enable - Whether to enable the table immediately (default: true)
   * @param {string} sep - Column separator (default: '\t')
   * @returns {string} The table ID
   */
  addTable(tableStr, sep = '\t') {
    // Parse table string
    const { metadataMap, columnTypes } = parseTable(tableStr, sep);

    // Generate unique column IDs for this table
    const id = `table_${this.#nextTableId++}`;
    const columnIdMap = new Map();
    for (const [originalName, columnType] of columnTypes) {
      const uniqueId = `${id}_${originalName}`;
      columnIdMap.set(originalName, uniqueId);
      this.columnType.set(uniqueId, columnType);
      this.columnName.set(uniqueId, originalName);
      this.columnDisplayName.set(uniqueId, columnToHeader(originalName));
    }

    // Transform metadata to use unique column IDs
    const transformedMetadata = new Map();
    for (const [nodeName, nodeData] of metadataMap) {
      const transformedNodeData = {};
      for (const [originalColumnName, value] of Object.entries(nodeData)) {
        const uniqueId = columnIdMap.get(originalColumnName);
        if (uniqueId) {
          transformedNodeData[uniqueId] = value;
        }
      }
      transformedMetadata.set(nodeName, transformedNodeData);
    }

    this.metadata.set(id, transformedMetadata);
    this.#attachTable(id);
    this.notify('metadataAdded', {
      tableId: id,
      columnIds: columnIdMap.values()
    });

    return id;
  }

  /**
   * Remove a metadata table
   * @param {string} tableId - ID of the table to remove
   */
  deleteTable(tableId) {
    const table = this.metadata.get(tableId);
    if (!table) {
      console.warn(`Table ${tableId} does not exist`);
      return;
    }
    const keys = Object.keys(table.values().next().value);

    // Remove data associated with columns in the table
    for (const uniqueId of keys) {
      this.columnType.delete(uniqueId);
      this.columnName.delete(uniqueId);
      this.columnDisplayName.delete(uniqueId);
      this.columnScale.color.delete(uniqueId);
      this.columnScale.size.delete(uniqueId);
      this.columnScale.text.delete(uniqueId);
    }

    this.#detachTable(tableId);
    this.metadata.delete(tableId);
    this.notify('metadataRemoved', {
      tableId,
      columnIds: keys
    });
  }

  /**
   * Get the color scale for a column, creating it if needed
   * @param {string} columnId - The unique column ID
   * @param {string} scaleType - The type of scale to create ('color', 'size', or 'text')
   * @returns {object} The color scale instance
   */
  getScale(columnId, scaleType) {
    // Return existing scale if available
    if (this.columnScale[scaleType].has(columnId)) {
      return this.columnScale[scaleType].get(columnId);
    }

    // Create new scale based on column type
    const scale = this.#createScale(columnId, scaleType);
    this.columnScale[scaleType].set(columnId, scale);
    return scale;
  }

  /**
   * Set the scale for a column
   * @param {string} columnId - The unique column ID
   * @param {string} scaleType - The type of scale to create ('color', 'size', or 'text')
   * @param {object} scale - The scale instance to set
   */
  setScale(columnId, scaleType, scale) {
    console.log(this.columnScale);
    this.columnScale[scaleType].set(columnId, scale);
  }

  /**
   * Create a scale for a column based on its type and the scale type requested
   * @private
   * @param {string} columnId - The unique column ID
   * @param {string} scaleType - The type of scale to create ('color', 'size', or 'text')
   * @returns {object} The created scale instance
   */
  #createScale(columnId, scaleType) {
    const columnType = this.columnType.get(columnId);

    if (!columnType) {
      console.error(`Column ${columnId} not found`);
    }

    // Collect all values for this column from the tree
    let values = [];
    this.tree.each(node => {
      if (node.metadata && node.metadata[columnId] !== undefined) {
        values.push(node.metadata[columnId]);
      }
    });

    if (values.length === 0) {
      console.error(`No values found for column ${columnId}`);
    }

    // Handle text scales
    if (scaleType === 'text') {
      return new TextScale();
    }

    // Convert to numeric values
    if (columnType === 'continuous') {
      values = values.map(v => Number(v)).filter(v => !isNaN(v));

      if (values.length === 0) {
        console.warn(`No numeric values found for continuous column ${columnId}, returning NullScale`);
        return new NullScale(1);
      }
    }

    // Handle size scales (only for continuous data)
    if (scaleType === 'size') {
      if (columnType !== 'continuous') {
        console.error(`Column ${columnId} is not continuous and cant be used for a size scale`);
      }
      return new ContinuousSizeScale(Math.min(...values), Math.max(...values), 0.5, 2);
    }

    // Handle color scales
    if (scaleType === 'color') {
      if (columnType === 'continuous') {
        return new ContinuousColorScale(Math.min(...values), Math.max(...values));
      } else if (columnType === 'categorical') {
        return new CategoricalColorScale(values);
      } else {
        console.error(`Unknown column type ${columnType} for column ${columnId}`);
      }
    }

    console.error(`Unknown scale type ${scaleType}`);
  }

  /**
   * Add metadata to tree nodes
   */
  #attachTable(tableId) {
    const table = this.metadata.get(tableId);
    this.tree.each(d => {
      const nodeName = d.data.name;
      if (nodeName && table.has(nodeName)) {
        const tableMetadata = table.get(nodeName);
        d.metadata = { ...d.metadata, ...tableMetadata };
      }
    });
  }

  /**
   * Remove metadata from tree nodes
   */
  #detachTable(tableId) {
    const table = this.metadata.get(tableId);
    const keys = Object.keys(table.values().next().value);
    this.tree.each(d => {
      keys.forEach(key => {
        delete d[key];
      });
    });
  }

}
