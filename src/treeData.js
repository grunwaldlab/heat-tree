import { hierarchy, ascending } from "d3";
import { parseNewick, parseTable } from "./parsers.js";
import { Subscribable } from "./utils.js";

/**
 * Manages tree data and metadata tables
 * Handles parsing, storage, and attachment of metadata to tree nodes
 */
export class TreeData extends Subscribable {

  constructor(newickStr, metadataTables = []) {
    super();

    this.metadataTables = new Map();
    this.enabledTables = new Set();
    this._nextTableId = 0;
    this.tree = null; // Hierarchy with metadata attached
    this.columnTypes = new Map(); // e.g. 'continuous' or 'categorical'

    this.setTree(newickStr);
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
    this.update();
  }

  /**
   * Add a metadata table
   * @param {string} tableStr - TSV formatted string or path
   * @param {string|null} id - Optional table ID (auto-generated if null)
   * @param {boolean} enable - Whether to enable the table immediately (default: true)
   * @param {string} sep - Column separator (default: '\t')
   * @returns {string} The table ID
   */
  addTable(tableStr, id = null, enable = true, sep = '\t') {
    if (id === null) {
      id = `table_${this._nextTableId++}`;
    }

    const { metadataMap, columnTypes } = parseTable(tableStr, sep);
    this.metadataTables.set(id, {
      data: metadataMap,
      columnTypes: columnTypes
    });

    if (enable) {
      this.enableTable(id);
    }

    return id;
  }

  /**
   * Remove a metadata table
   * @param {string} tableId - ID of the table to remove
   */
  deleteTable(tableId) {
    if (!this.metadataTables.has(tableId)) {
      console.warn(`Table ${tableId} does not exist`);
      return;
    }
    this.disableTable(tableId);
    this.metadataTables.delete(tableId);
  }

  /**
   * Enable a metadata table (attach to tree)
   * @param {string} tableId - ID of the table to enable
   */
  enableTable(tableId) {
    if (!this.metadataTables.has(tableId)) {
      console.warn(`Table ${tableId} does not exist`);
      return;
    }

    if (!this.enabledTables.has(tableId)) {
      this.enabledTables.add(tableId);
      this.update();
    }
  }

  /**
   * Disable a metadata table (detach from tree)
   * @param {string} tableId - ID of the table to disable
   */
  disableTable(tableId) {
    if (!this.metadataTables.has(tableId)) {
      console.warn(`Table ${tableId} does not exist`);
      return;
    }

    if (this.enabledTables.has(tableId)) {
      this.enabledTables.delete(tableId);
      this.update();
    }
  }

  /**
   * Attach all enabled metadata tables to tree nodes
   * Later tables overwrite earlier tables for columns with the same name
   */
  attachTables() {
    // Clear existing metadata from all nodes
    this.tree.each(d => {
      d.metadata = {};
    });

    // Attach metadata from each enabled table in order
    for (const tableId of this.enabledTables) {
      const table = this.metadataTables.get(tableId);
      if (!table) continue;

      this.tree.each(d => {
        const nodeName = d.data.name;
        if (nodeName && table.data.has(nodeName)) {
          const tableMetadata = table.data.get(nodeName);
          d.metadata = { ...d.metadata, ...tableMetadata };
        }
      });
    }
  }

  /**
   * Infer column types from all enabled metadata tables
   * Later tables overwrite type information for columns with the same name
   */
  inferTypes() {
    this.columnTypes.clear();

    // Collect column types from each enabled table in order
    for (const tableId of this.enabledTables) {
      const table = this.metadataTables.get(tableId);
      if (!table) continue;

      for (const [columnName, columnType] of table.columnTypes) {
        this.columnTypes.set(columnName, columnType);
      }
    }
  }

  /**
   * Update the tree with current metadata
   * This creates a fresh copy of the tree with metadata attached
   */
  update() {
    this.attachTables();
    this.inferTypes();
    this.notify('update', {
      tree: this.tree,
      columnTypes: this.columnTypes
    });
  }

  /**
   * Get all column names from enabled tables
   * @returns {Array<string>} Array of column names
   */
  getColumnNames() {
    return Array.from(this.columnTypes.keys());
  }
}
