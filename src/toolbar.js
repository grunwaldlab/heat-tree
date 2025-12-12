/**
 * Create and manage the toolbar with tabs and controls
 * @param {HTMLElement} toolbarDiv - Container for the toolbar
 * @param {TreeState} treeState - Tree state instance
 * @param {TreeData} treeData - Tree data instance
 * @param {Object} options - Configuration options
 */
export function createToolbar(toolbarDiv, treeState, treeData, options) {
  const CONTROL_HEIGHT = 24; // Standard height for all controls
  let currentTab = null;

  // Create tabs container
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'ht-tabs';

  // Create controls container
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'ht-controls hidden';

  // Define tabs
  const tabs = [
    { id: 'data', label: 'Data' },
    { id: 'tree-manipulation', label: 'Tree Manipulation' },
    { id: 'export', label: 'Export' }
  ];

  // Create tab elements
  const tabElements = {};
  tabs.forEach(tab => {
    const tabDiv = document.createElement('div');
    tabDiv.className = 'ht-tab';
    tabDiv.textContent = tab.label;

    // Click handler
    tabDiv.addEventListener('click', () => {
      if (currentTab === tab.id) {
        // Clicking the same tab closes it
        closeTab();
      } else {
        // Open the new tab
        openTab(tab.id);
      }
    });

    tabElements[tab.id] = tabDiv;
    tabsContainer.appendChild(tabDiv);
  });

  // Function to open a tab
  function openTab(tabId) {
    // Update current tab
    currentTab = tabId;

    // Update tab styles
    Object.keys(tabElements).forEach(id => {
      if (id === tabId) {
        tabElements[id].classList.add('active');
      } else {
        tabElements[id].classList.remove('active');
      }
    });

    // Show controls and populate with tab content
    controlsContainer.classList.remove('hidden');
    populateControls(tabId);
  }

  // Function to close the current tab
  function closeTab() {
    currentTab = null;

    // Reset all tab styles
    Object.keys(tabElements).forEach(id => {
      tabElements[id].classList.remove('active');
    });

    // Hide controls
    controlsContainer.classList.add('hidden');
    controlsContainer.innerHTML = '';
  }

  // Function to populate controls based on selected tab
  function populateControls(tabId) {
    controlsContainer.innerHTML = '';

    switch (tabId) {
      case 'data':
        populateDataControls(controlsContainer, treeState, treeData, options, CONTROL_HEIGHT);
        break;
      case 'tree-manipulation':
        populateTreeManipulationControls(controlsContainer, treeState, options, CONTROL_HEIGHT);
        break;
      case 'export':
        populateExportControls(controlsContainer, treeState, options, CONTROL_HEIGHT);
        break;
    }
  }

  // Append tabs and controls to toolbar
  toolbarDiv.appendChild(tabsContainer);
  toolbarDiv.appendChild(controlsContainer);

  // Open the first tab by default
  openTab(tabs[0].id);
}

/**
 * Populate Data tab controls
 */
function populateDataControls(container, treeState, treeData, options, controlHeight) {
  container.innerHTML = '';

  // Select tree control
  const treeLabel = createLabel('Select tree:', controlHeight);
  container.appendChild(treeLabel);

  const treeSelect = document.createElement('select');
  treeSelect.className = 'ht-select';
  treeSelect.style.height = `${controlHeight}px`;
  const treeOption = document.createElement('option');
  treeOption.textContent = 'Current tree';
  treeSelect.appendChild(treeOption);
  container.appendChild(treeSelect);

  const addTreeBtn = createButton('+', 'Add tree from Newick file', controlHeight);
  container.appendChild(addTreeBtn);

  // Select metadata control
  const metadataLabel = createLabel('Select metadata:', controlHeight);
  container.appendChild(metadataLabel);

  const metadataSelect = document.createElement('select');
  metadataSelect.className = 'ht-select';
  metadataSelect.style.height = `${controlHeight}px`;
  const metadataOption = document.createElement('option');
  metadataOption.textContent = 'No metadata';
  metadataSelect.appendChild(metadataOption);
  container.appendChild(metadataSelect);

  const addMetadataBtn = createButton('+', 'Add metadata table', controlHeight);
  container.appendChild(addMetadataBtn);
}

/**
 * Populate Tree Manipulation tab controls
 */
function populateTreeManipulationControls(container, treeState, options, controlHeight) {
  container.innerHTML = '';

  // Expand subtrees button
  const expandSubtreesBtn = createButton('Expand subtrees', 'Expand all collapsed subtrees', controlHeight);
  container.appendChild(expandSubtreesBtn);

  // Expand root button
  const expandRootBtn = createButton('Expand root', 'Expand the collapsed root', controlHeight);
  container.appendChild(expandRootBtn);

  // Scale branch length
  const branchLengthLabel = createLabel('Scale branch length:', controlHeight);
  container.appendChild(branchLengthLabel);

  const branchLengthSlider = createSlider(0, 2, 1, 0.1, controlHeight);
  container.appendChild(branchLengthSlider);

  // Scale tree height
  const treeHeightLabel = createLabel('Scale tree height:', controlHeight);
  container.appendChild(treeHeightLabel);

  const treeHeightSlider = createSlider(0, 2, 1, 0.1, controlHeight);
  container.appendChild(treeHeightSlider);

  // Radial layout toggle
  const radialLayoutLabel = createLabel('Radial layout:', controlHeight);
  container.appendChild(radialLayoutLabel);

  const radialLayoutToggle = createToggle(treeState.state.layout === 'circular', controlHeight);
  radialLayoutToggle.addEventListener('click', () => {
    const isCircular = radialLayoutToggle.classList.contains('active');
    treeState.setLayout(isCircular ? 'circular' : 'rectangular');
  });
  container.appendChild(radialLayoutToggle);
}

/**
 * Populate Export tab controls
 */
function populateExportControls(container, treeState, options, controlHeight) {
  container.innerHTML = '';

  // Export button
  const exportBtn = createButton('Export', 'Export the tree to a file', controlHeight);
  exportBtn.classList.add('primary');
  container.appendChild(exportBtn);

  // Output format
  const formatLabel = createLabel('Output format:', controlHeight);
  container.appendChild(formatLabel);

  const formatSelect = document.createElement('select');
  formatSelect.className = 'ht-select';
  formatSelect.style.height = `${controlHeight}px`;
  ['SVG', 'PDF', 'PNG'].forEach(format => {
    const option = document.createElement('option');
    option.value = format.toLowerCase();
    option.textContent = format;
    formatSelect.appendChild(option);
  });
  container.appendChild(formatSelect);

  // Output height
  const heightLabel = createLabel('Output height (cm):', controlHeight);
  container.appendChild(heightLabel);

  const heightInput = createNumberInput(20, 1, 100, 1, controlHeight);
  container.appendChild(heightInput);

  // Output width
  const widthLabel = createLabel('Output width (cm):', controlHeight);
  container.appendChild(widthLabel);

  const widthInput = createNumberInput(20, 1, 100, 1, controlHeight);
  container.appendChild(widthInput);
}

/**
 * Helper function to create a label
 */
function createLabel(text, height) {
  const label = document.createElement('label');
  label.className = 'ht-control-label';
  label.textContent = text;
  label.style.height = `${height}px`;
  return label;
}

/**
 * Helper function to create a button
 */
function createButton(text, title = '', height) {
  const button = document.createElement('button');
  button.className = 'ht-button';
  button.textContent = text;
  button.title = title;
  button.style.height = `${height}px`;
  return button;
}

/**
 * Helper function to create a slider
 */
function createSlider(min, max, value, step, height) {
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'ht-slider';
  slider.min = min;
  slider.max = max;
  slider.value = value;
  slider.step = step;
  slider.style.height = `${height}px`;
  return slider;
}

/**
 * Helper function to create a toggle switch
 */
function createToggle(initialState, height) {
  const toggleHeight = Math.min(24, height - 4);
  const knobSize = toggleHeight - 4;

  const toggle = document.createElement('div');
  toggle.className = initialState ? 'ht-toggle active' : 'ht-toggle';
  toggle.style.height = `${toggleHeight}px`;

  const knob = document.createElement('div');
  knob.className = 'ht-toggle-knob';
  knob.style.width = `${knobSize}px`;
  knob.style.height = `${knobSize}px`;

  toggle.appendChild(knob);

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
  });

  return toggle;
}

/**
 * Helper function to create a number input
 */
function createNumberInput(value, min, max, step, height) {
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'ht-number-input';
  input.value = value;
  input.min = min;
  input.max = max;
  input.step = step;
  input.style.height = `${height}px`;
  return input;
}
