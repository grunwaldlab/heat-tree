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
 * @param {Object} treesConfig - Configuration object with trees array
 * @param {Array} treesConfig.trees - Array of tree objects, each with newick, name, and metadata
 * @param {string} containerSelector - CSS selector for container element
 * @param {Object} options - Configuration options
 * @returns {Object} Object containing references to tree components
 */
export function heatTree(treesConfig, containerSelector, options = {}) {
  // Validate input
  if (!treesConfig || !treesConfig.trees || !Array.isArray(treesConfig.trees) || treesConfig.trees.length === 0) {
    throw new Error('treesConfig must have a non-empty trees array');
  }

  // Inject styles
  injectStyles();

  // Set default options
  options = {
    buttonSize: 25,
    controlsMargin: 3,
    buttonPadding: 2,
    transitionDuration: 500,
    manualZoomAndPanEnabled: true,
    autoZoomEnabled: true,
    autoPanEnabled: true,
    ...options
  };

  // Initialize text size estimator (shared across all trees)
  const textSizeEstimator = new TextSizeEstimator();

  // Create TreeData instances for each tree
  const treeDataInstances = new Map();
  treesConfig.trees.forEach((treeConfig, index) => {
    if (!treeConfig.newick) {
      throw new Error(`Tree at index ${index} is missing newick string`);
    }

    const treeName = treeConfig.name || `Tree ${index + 1}`;
    const metadataTables = treeConfig.metadata ?
      (Array.isArray(treeConfig.metadata) ? treeConfig.metadata : [treeConfig.metadata]) :
      [];

    const treeData = new TreeData(treeConfig.newick, metadataTables);
    treeDataInstances.set(treeName, treeData);
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

  // Create toolbar div
  const toolbarDiv = document.createElement('div');
  toolbarDiv.className = 'ht-toolbar';
  toolbarDiv.style.gap = `${options.controlsMargin}px`;

  // Create tree div
  const treeDiv = document.createElement('div');
  treeDiv.className = 'ht-tree';

  // Create SVG for tree
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
      const treeData = treeDataInstances.get(treeName);
      const treeState = new TreeState({
        treeData: treeData
      }, textSizeEstimator);
      treeStateCache.set(treeName, treeState);
    }

    // Get or create TreeView for this tree
    if (!treeViewCache.has(treeName)) {
      const treeState = treeStateCache.get(treeName);
      const treeView = new TreeView(treeState, treeSvg, {
        buttonSize: options.buttonSize,
        controlsMargin: options.controlsMargin,
        buttonPadding: options.buttonPadding,
        transitionDuration: options.transitionDuration,
        manualZoomAndPanEnabled: options.manualZoomAndPanEnabled,
        autoZoomEnabled: options.autoZoomEnabled,
        autoPanEnabled: options.autoPanEnabled
      });
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
  }

  // Create toolbar with tree switching capability
  createToolbar(toolbarDiv, treeDataInstances, () => currentTreeState, switchToTree, options);

  // Display the first tree initially
  const firstTreeName = Array.from(treeDataInstances.keys())[0];
  switchToTree(firstTreeName);

  // Return references to components
  return {
    treeDataInstances,
    treeStateCache,
    treeViewCache,
    getCurrentTreeState: () => currentTreeState,
    getCurrentTreeView: () => currentTreeView,
    getCurrentTreeName: () => currentTreeName,
    switchToTree,
    container: widgetDiv
  };
}
