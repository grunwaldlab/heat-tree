import { TreeData } from './treeData.js';
import { TreeState } from './treeState.js';
import { TreeView } from './treeView.js';
import { TextSizeEstimator } from './textAspectRatioPrediction.js';
import { createToolbar } from './toolbar.js';
import styles from './styles.css?inline';

/**
 * Inject styles into the document if not already present
 */
function injectStyles() {
  const styleId = 'heat-tree-styles';
  if (!document.getElementById(styleId)) {
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }
}

/**
 * Create a heat tree visualization
 * @param {Object|string} treesConfig - Configuration object with trees array, or container selector string
 * @param {Array} treesConfig.trees - Array of tree objects, each with newick, name, and metadata (optional)
 * @param {string} containerSelector - CSS selector for container element (required if first arg is config object)
 * @param {Object} options - Configuration options
 * @returns {Object} Object containing references to tree components
 */
export function heatTree(treesConfig, containerSelector, options = {}) {
  // Handle different argument patterns
  if (typeof treesConfig === 'string') {
    // Pattern: heatTree('#container') or heatTree('#container', options)
    // First argument is the container selector
    options = containerSelector || {};
    containerSelector = treesConfig;
    treesConfig = { trees: [] };
  } else if (treesConfig && typeof treesConfig === 'object') {
    // Pattern: heatTree({ trees: [...] }, '#container', options)
    // First argument is config object
    if (!containerSelector || typeof containerSelector !== 'string') {
      throw new Error('heatTree requires a container selector as the second argument when first argument is a config object');
    }
    // Ensure trees array exists
    if (!treesConfig.trees) {
      treesConfig.trees = [];
    }
  } else {
    // Invalid first argument
    throw new Error('heatTree requires either a container selector string or a configuration object as the first argument');
  }

  // Ensure trees is an array
  if (!Array.isArray(treesConfig.trees)) {
    throw new Error('treesConfig.trees must be an array');
  }

  injectStyles();

  // Set default options
  options = {
    buttonSize: 25,
    transitionDuration: 500,
    manualZoomAndPanEnabled: true,
    autoZoom: 'Default',
    autoPan: 'Default',
    ...options
  };

  // Initialize text size estimator (shared across all trees)
  const textSizeEstimator = new TextSizeEstimator();

  // Create TreeData instances for each tree
  const treeDataInstances = new Map();
  const treeConfigAesthetics = new Map();

  treesConfig.trees.forEach((treeConfig, index) => {
    if (!treeConfig.newick) {
      throw new Error(`Tree at index ${index} is missing newick string`);
    }

    const treeName = treeConfig.name || `Tree ${index + 1}`;

    // Process metadata tables - can be array of objects with name and data, or just data objects
    let metadataTables = [];
    let metadataNames = [];

    if (treeConfig.metadata) {
      const metadataArray = Array.isArray(treeConfig.metadata) ? treeConfig.metadata : [treeConfig.metadata];

      metadataArray.forEach((metadataItem, metaIndex) => {
        if (metadataItem.name && metadataItem.data) {
          // Named metadata table
          metadataTables.push(metadataItem.data);
          metadataNames.push(metadataItem.name);
        } else {
          // Unnamed metadata table - use as-is
          metadataTables.push(metadataItem);
          metadataNames.push(`Metadata ${metaIndex + 1}`);
        }
      });
    }

    const treeData = new TreeData(treeConfig.newick, metadataTables, metadataNames);
    let treeAesthetics;
    if (treeConfig.aesthetics) {
      treeAesthetics = Object.fromEntries(
        Object.entries(treeConfig.aesthetics).map(([aes, col]) => {
          for (const [assignedColId, originalName] of treeData.columnName.entries()) {
            if (originalName === col) {
              return [aes, assignedColId];
            }
          }
          return undefined;
        })
      )
    } else {
      treeAesthetics = undefined;
    }
    treeDataInstances.set(treeName, treeData);
    treeConfigAesthetics.set(treeName, treeAesthetics);
  });

  // Cache for TreeState and TreeView instances
  const treeStateCache = new Map();
  const treeViewCache = new Map();

  // Get container element
  const container = document.querySelector(containerSelector);
  if (!container) {
    throw new Error(`Container element not found: ${containerSelector}`);
  }

  // Create main widget structure
  const widgetDiv = document.createElement('div');
  widgetDiv.className = 'ht-widget';
  const toolbarDiv = document.createElement('div');
  toolbarDiv.className = 'ht-toolbar';
  const treeDiv = document.createElement('div');
  treeDiv.className = 'ht-tree';
  const treeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  treeSvg.setAttribute('width', '100%');
  treeSvg.setAttribute('height', '100%');

  // Assemble widget structure
  treeDiv.appendChild(treeSvg);
  widgetDiv.appendChild(toolbarDiv);
  widgetDiv.appendChild(treeDiv);
  container.appendChild(widgetDiv);

  // Track current tree
  let currentTreeName = null;
  let currentTreeState = null;
  let currentTreeView = null;

  // Store toolbar refresh function
  let refreshToolbar = null;

  /**
   * Callback for when toolbar dimensions change
   */
  function onToolbarDimensionsChange() {
    if (currentTreeView) {
      currentTreeView.fitToView();
    }
  }

  /**
   * Add a new tree to the visualization
   * @param {string} treeName - Name for the new tree
   * @param {string} newickStr - Newick string for the tree
   * @param {Array} metadataTables - Optional array of metadata table strings
   * @param {Array} metadataNames - Optional array of metadata table names
   */
  function addNewTree(treeName, newickStr, metadataTables = [], metadataNames = []) {
    // Ensure unique name
    let uniqueName = treeName;
    let counter = 1;
    while (treeDataInstances.has(uniqueName)) {
      uniqueName = `${treeName} (${counter})`;
      counter++;
    }

    // Create new TreeData instance
    const treeData = new TreeData(newickStr, metadataTables, metadataNames);
    treeDataInstances.set(uniqueName, treeData);

    return uniqueName;
  }

  /**
   * Switch to a different tree
   * @param {string} treeName - Name of the tree to switch to
   */
  function switchToTree(treeName) {
    if (!treeDataInstances.has(treeName)) {
      console.error(`Tree not found: ${treeName}`);
      return;
    }

    // If switching to the same tree, do nothing
    if (currentTreeName === treeName && currentTreeView) {
      return;
    }

    // Clear the SVG before switching trees
    while (treeSvg.firstChild) {
      treeSvg.removeChild(treeSvg.firstChild);
    }

    // Get or create TreeState for this tree
    if (!treeStateCache.has(treeName)) {
      const treeState = new TreeState({
        treeData: treeDataInstances.get(treeName),
        aesthetics: treeConfigAesthetics.get(treeName),
        ...options
      }, textSizeEstimator);
      treeStateCache.set(treeName, treeState);
    }

    // Get or create TreeView for this tree
    if (!treeViewCache.has(treeName)) {
      const treeState = treeStateCache.get(treeName);
      const treeView = new TreeView(treeState, treeSvg, options);
      treeViewCache.set(treeName, treeView);
    } else {
      // Reattach existing TreeView to the SVG
      const treeView = treeViewCache.get(treeName);
      treeView.reattach(treeSvg);
    }

    // Update current references
    currentTreeName = treeName;
    currentTreeState = treeStateCache.get(treeName);
    currentTreeView = treeViewCache.get(treeName);

    // Refresh toolbar if the refresh function is available
    if (refreshToolbar) {
      refreshToolbar();
    }
  }

  // Create toolbar with tree switching capability
  refreshToolbar = createToolbar(
    toolbarDiv,
    treeDataInstances,
    () => currentTreeState,
    () => currentTreeView,
    switchToTree,
    addNewTree,
    options,
    onToolbarDimensionsChange
  );

  // Display the first tree initially (if any trees exist)
  if (treeDataInstances.size > 0) {
    const firstTreeName = Array.from(treeDataInstances.keys())[0];
    switchToTree(firstTreeName);
  }

  // Return references to components
  return {
    treeDataInstances,
    treeStateCache,
    treeViewCache,
    getCurrentTreeState: () => currentTreeState,
    getCurrentTreeView: () => currentTreeView,
    getCurrentTreeName: () => currentTreeName,
    switchToTree,
    addNewTree,
    container: widgetDiv
  };
}
