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
    this.enabledTables = new Set();
    this._nextTableId = 0;
    this.tree = null; // Hierarchy with metadata attached
    this.columnType = new Map(); // e.g. 'continuous' or 'categorical', keyed by unique column ID
    this.columnName = new Map(); // Original column name, keyed by unique column ID
    this.columnDisplayName = new Map(); // Display-friendly column name, keyed by unique column ID

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

    // Generate unique column IDs for this table
    const columnIdMap = new Map(); // Maps original column name to unique column ID
    const uniqueColumnTypes = new Map(); // Maps unique column ID to column type

    for (const [originalName, columnType] of columnTypes) {
      const uniqueId = `${id}_${originalName}`;
      columnIdMap.set(originalName, uniqueId);
      uniqueColumnTypes.set(uniqueId, columnType);
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

    this.metadataTables.set(id, {
      data: transformedMetadata,
      columnTypes: uniqueColumnTypes,
      columnIdMap: columnIdMap
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

    // Remove column mappings for this table
    const table = this.metadataTables.get(tableId);
    for (const uniqueId of table.columnTypes.keys()) {
      this.columnName.delete(uniqueId);
      this.columnDisplayName.delete(uniqueId);
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
   * Each column gets a unique ID, so columns with the same name from different tables
   * are stored separately
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
          // Merge metadata using unique column IDs
          d.metadata = { ...d.metadata, ...tableMetadata };
        }
      });
    }
  }

  /**
   * Infer column types from all enabled metadata tables
   * Uses unique column IDs, so columns with the same name from different tables
   * are tracked separately
   */
  inferTypes() {
    this.columnType.clear();

    // Collect column types from each enabled table
    for (const tableId of this.enabledTables) {
      const table = this.metadataTables.get(tableId);
      if (!table) continue;

      for (const [uniqueColumnId, columnType] of table.columnTypes) {
        this.columnType.set(uniqueColumnId, columnType);
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
    this.notify('update', this);
  }

  /**
   * Get all unique column IDs from enabled tables
   * @returns {Array<string>} Array of unique column IDs
   */
  getColumnNames() {
    return Array.from(this.columnType.keys());
  }
}
