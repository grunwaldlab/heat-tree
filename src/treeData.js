import { hierarchy, ascending } from "d3";
import { parseNewick, parseTable } from "./parsers.js";
import { Subscribable, columnToHeader } from "./utils.js";

/**
 * Manages tree data and metadata tables
 * Handles parsing, storage, and attachment of metadata to tree nodes
 */
export class TreeData extends Subscribable {

  constructor(newickStr, metadataTables = []) {
    super();

    this.metadataTables = new Map();
    this._nextTableId = 0;
    this.columnType = new Map(); // e.g. 'continuous' or 'categorical', keyed by unique column ID
    this.columnName = new Map(); // Original column name, keyed by unique column ID
    this.columnDisplayName = new Map(); // Display-friendly column name, keyed by unique column ID
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
    this.metadataTables.keys().forEach(this.attachTable);
    this.notify('treeUpdate', this);
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
    const id = `table_${this._nextTableId++}`;
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

    this.metadataTables.set(id, transformedMetadata);
    this.attachTable(id);
    this.notify('metadataUpdate', this);

    return id;
  }

  /**
   * Remove a metadata table
   * @param {string} tableId - ID of the table to remove
   */
  deleteTable(tableId) {
    const table = this.metadataTables.get(tableId);
    if (!table) {
      console.warn(`Table ${tableId} does not exist`);
      return;
    }
    const keys = Object.keys(table.values().next().value);
    for (const uniqueId of keys) {
      this.columnType.delete(uniqueId);
      this.columnName.delete(uniqueId);
      this.columnDisplayName.delete(uniqueId);
    }
    this.detachTable(tableId);
    this.metadataTables.delete(tableId);
    this.notify('metadataUpdate', this);
  }

  /**
   * Add metadata to tree nodes
   */
  attachTable(tableId) {
    const table = this.metadataTables.get(tableId);
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
  detachTable(tableId) {
    const table = this.metadataTables.get(tableId);
    const keys = Object.keys(table.values().next().value);
    this.tree.each(d => {
      keys.forEach(key => {
        delete d[key];
      });
    });
  }

}
