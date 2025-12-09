import { hierarchy, ascending } from "d3";
import { parseNewick, parseTable } from "./parsers.js";
import { Subscribable, columnToHeader } from "./utils.js";
import {
  NullScale,
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
  columnColorScale = new Map(); // Color scales for each column
  columnSizeScale = new Map(); // Size scales for each column
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
      this.columnColorScale.delete(uniqueId);
      this.columnSizeScale.delete(uniqueId);
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
   * @returns {object} The color scale instance
   */
  getColorScale(columnId) {
    // Return existing scale if available
    if (this.columnColorScale.has(columnId)) {
      return this.columnColorScale.get(columnId);
    }

    // Create new scale based on column type
    const scale = this.#createColorScale(columnId);
    this.columnColorScale.set(columnId, scale);
    return scale;
  }

  /**
   * Set the color scale for a column
   * @param {string} columnId - The unique column ID
   * @param {object} scale - The scale instance to set
   */
  setColorScale(columnId, scale) {
    this.columnColorScale.set(columnId, scale);
  }

  /**
   * Get the size scale for a column, creating it if needed
   * @param {string} columnId - The unique column ID
   * @returns {object} The size scale instance
   */
  getSizeScale(columnId) {
    // Return existing scale if available
    if (this.columnSizeScale.has(columnId)) {
      return this.columnSizeScale.get(columnId);
    }

    // Create new scale based on column type
    const scale = this.#createSizeScale(columnId);
    this.columnSizeScale.set(columnId, scale);
    return scale;
  }

  /**
   * Set the size scale for a column
   * @param {string} columnId - The unique column ID
   * @param {object} scale - The scale instance to set
   */
  setSizeScale(columnId, scale) {
    this.columnSizeScale.set(columnId, scale);
  }

  /**
   * Create a color scale for a column based on its type
   * @private
   * @param {string} columnId - The unique column ID
   * @returns {object} The created color scale instance
   */
  #createColorScale(columnId) {
    const columnType = this.columnType.get(columnId);

    if (!columnType) {
      console.warn(`Column ${columnId} not found, returning NullScale`);
      return new NullScale('#808080');
    }

    // Collect all values for this column from the tree
    const values = [];
    this.tree.each(node => {
      if (node.metadata && node.metadata[columnId] !== undefined) {
        values.push(Number(node.metadata[columnId]));
      }
    });

    if (values.length === 0) {
      console.warn(`No values found for column ${columnId}, returning NullScale`);
      return new NullScale('#808080');
    }

    if (columnType === 'continuous') {
      // Filter out non-numeric values
      const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));

      if (numericValues.length === 0) {
        console.warn(`No numeric values found for continuous column ${columnId}, returning NullScale`);
        return new NullScale('#808080');
      }

      const dataMin = Math.min(...numericValues);
      const dataMax = Math.max(...numericValues);

      return new ContinuousColorScale(dataMin, dataMax);
    } else if (columnType === 'categorical') {
      return new CategoricalColorScale(values);
    } else {
      console.warn(`Unknown column type ${columnType} for column ${columnId}, returning NullScale`);
      return new NullScale('#808080');
    }
  }

  /**
   * Create a size scale for a column based on its type
   * @private
   * @param {string} columnId - The unique column ID
   * @returns {object} The created size scale instance
   */
  #createSizeScale(columnId) {
    const columnType = this.columnType.get(columnId);

    if (!columnType) {
      console.error(`Column ${columnId} not found`);
    }

    // Only continuous columns can be mapped to size
    if (columnType !== 'continuous') {
      console.error(`Column ${columnId} is not continuous`);
    }

    // Collect all values for this column from the tree and convert to numeric
    const values = [];
    this.tree.each(node => {
      if (node.metadata && node.metadata[columnId] !== undefined) {
        values.push(Number(node.metadata[columnId]));
      }
    });

    if (values.length === 0) {
      console.warn(`No values found for column ${columnId}, returning NullScale`);
      return new NullScale(1);
    }

    // Filter out non-numeric values
    const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));

    if (numericValues.length === 0) {
      console.warn(`No numeric values found for continuous column ${columnId}, returning NullScale`);
      return new NullScale(1);
    }

    const dataMin = Math.min(...numericValues);
    const dataMax = Math.max(...numericValues);

    // Default size range - these could be made configurable
    const sizeMin = 0.5;
    const sizeMax = 2.0;

    return new ContinuousSizeScale(dataMin, dataMax, sizeMin, sizeMax);
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
