import { TreeData } from './treeData.js';
import { TreeState } from './treeState.js';
import { TreeView } from './treeView.js';
import { TextSizeEstimator } from './textAspectRatioPrediction.js';

/**
 * Create a heat tree visualization
 * @param {string} newickStr - Newick formatted tree string
 * @param {string} containerSelector - CSS selector for container element
 * @param {Object} options - Configuration options
 * @returns {Object} Object containing references to tree components
 */
export function heatTree(newickStr, containerSelector, options = {}) {
  // Set default options
  options = {
    buttonSize: 25,
    controlsMargin: 3,
    buttonPadding: 2,
    legendElementHeight: 25,
    transitionDuration: 500,
    manualZoomAndPanEnabled: true,
    autoZoomEnabled: true,
    autoPanEnabled: true,
    metadata: null,
    ...options
  };

  // Initialize text size estimator
  const textSizeEstimator = new TextSizeEstimator();

  // Parse metadata if provided
  let metadataTables = [];
  if (options.metadata) {
    if (Array.isArray(options.metadata)) {
      metadataTables = options.metadata;
    } else {
      metadataTables = [options.metadata];
    }
  }

  // Create TreeData instance
  const treeData = new TreeData(newickStr, metadataTables);

  // Create TreeState instance
  const treeState = new TreeState({
    treeData: treeData
  }, textSizeEstimator);

  // Get container element
  const container = document.querySelector(containerSelector);
  if (!container) {
    throw new Error(`Container element not found: ${containerSelector}`);
  }

  // Create main widget structure
  const widgetDiv = document.createElement('div');
  widgetDiv.className = 'ht-widget';
  widgetDiv.style.cssText = `
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  `;

  // Create toolbar div
  const toolbarDiv = document.createElement('div');
  toolbarDiv.className = 'ht-toolbar';
  toolbarDiv.style.cssText = `
    flex: 0 0 auto;
    margin-bottom: 4px;
    display: flex;
    gap: ${options.controlsMargin}px;
    align-items: flex-start;
  `;

  // Create tree div
  const treeDiv = document.createElement('div');
  treeDiv.className = 'ht-tree';
  treeDiv.style.cssText = `
    flex: 1 1 auto;
    min-height: 0;
    position: relative;
  `;

  // Create SVG for tree
  const treeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  treeSvg.setAttribute('width', '100%');
  treeSvg.setAttribute('height', '100%');
  treeSvg.style.cssText = `
    display: block;
  `;

  // Create legend div
  const legendDiv = document.createElement('div');
  legendDiv.className = 'ht-legend';
  legendDiv.style.cssText = `
    flex: 0 0 auto;
    margin-top: 4px;
    display: flex;
    gap: ${options.controlsMargin}px;
    align-items: center;
  `;

  // Assemble widget structure
  treeDiv.appendChild(treeSvg);
  widgetDiv.appendChild(toolbarDiv);
  widgetDiv.appendChild(treeDiv);
  widgetDiv.appendChild(legendDiv);
  container.appendChild(widgetDiv);

  // Create TreeView instance
  const treeView = new TreeView(treeState, treeSvg, {
    buttonSize: options.buttonSize,
    controlsMargin: options.controlsMargin,
    buttonPadding: options.buttonPadding,
    transitionDuration: options.transitionDuration,
    manualZoomAndPanEnabled: options.manualZoomAndPanEnabled,
    autoZoomEnabled: options.autoZoomEnabled,
    autoPanEnabled: options.autoPanEnabled
  });

  console.log(treeState);

  // Return references to components
  return {
    treeData,
    treeState,
    treeView,
    container: widgetDiv
  };
}
