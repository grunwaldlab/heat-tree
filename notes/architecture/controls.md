# Controls

Controls not associated with particular tree elements appear at the top of the tree widget and are designed to be as space-efficient and language-agnostic as possible.
Controls are grouped into left-aligned tabs that reveal the controls associated with each group when clicked.
On the top right of the control panel, aligned with the tabs, there is a button that minimizes the control panel when clicked, after which it is still present as an overlaied button that can expand them again when clicked.
If the currently selected tab is clicked, it is unselected and no controls are shown other than the tabs.
The tree is resized to fill the current space not used by controls when controls are expanded/collapsed.

The state of the controls are entirely dependent on the state of the `treeState`/`treeView`/`treeData` instance currently active.

## Metadata column properties

Each metadata column has properties assocaited with it, such as:

- the display name
- whether it is continuous or categorical data
- how to convert values to labels (text), size, or color

These settings can be changed by a popup control panel.
This popup panel can be accessed by clicking on a "edit" button (shaped like a pencil) that occurs to the right of metadata column names in aesthetic selector dropdowns like those used to style tip labels.
This popup can also be accessed by clicking on an edit button that appears when a legend is selected.

## Tab groups

Controls are grouped into tabs like so:

### Data tab:

- **Select tree**: A dropdown selection box to select which tree is currently shown with a button to the right with a plus sign that allows uploading a tree from a newick file when clicked. An uploaded tree derives its name from the file name minus the extension. An unnamed tree is named "Tree with # tips". To the right of each item in the dropdown is a button with a trash symbol that deletes the tree and associated metadata when clicked
- **Select metadata**: A dropdown menu that lists metadata tables associated with the currently selected tree with a button to the right with a plus sign that allows uploading a new metadata table. An uploaded metadata table derives its name from the file name minus the extension. An unnamed table is named "table with # columns". To the right of each item is a button with a trash symbol that deletes the associated metadata table. 

### Controls tab

- **Fit to view**: Button that fits the tree in the window settings.
- **Toggle manual zooming/panning**: Toggle that enables or disables zooming/panning. When a `TreeState` instance is made or the tree is changed and the setting for this is `undefined`/`null`, it is set to `true` if the tree is too big to fit in the current view window.

The following controls are dropdowns with the options "Both", "X", "Y", "None":

- **Toggle automatic zooming**: the view zoom will be adjusted to be the smallest needed to see the root to tip and labels automatically when a change is made to the tree
- **Toggle automating panning**: the view will be panned to minimize empty space, panning in what ever direction minimizes the amount panned

### Tree manipulation tab

- **Expand subtrees**: Button that expands all collapsed subtrees. It is disabled if there are no collapsed subtrees.
- **Expand root**: Button that expands the collapsed root. It is disabled if the root is not collapsed.
- **Scale branch length**: A slider to scale branch length
- **Scale tree height**: A slider to scale tree height (or proportion of the circle used for circular layouts)
- **Radial layout**: toggle button to activate radial layout

### Tip Label settings tab

Each dropdown element in the controls in this section have a button to the right of the option that modifies the associated scale settings.

- **Tip label text**: Dropdown to select metadata column to derive tip label text from. Includes a "none" option to disable tip labels. Defaults to node IDs.
- **Tip label color**: Dropdown to select metadata column to derive tip label color from
- **Tip label size**: Dropdown to select metadata column to derive tip label size from
- **Tip label style**: Dropdown to select metadata column to derive tip label style (bold, italic, etc) from
- **Tip label font**: Dropdown to select font

### Node Label settings tab

Each dropdown element in the controls in this section have a button to the right of the option that modifies the associated scale settings.

- **Enable node labels**: Toggle button to enable node labels
- **node label text**: Dropdown to select metadata column to derive node label text from. Defaults to node IDs.
- **node label color**: Dropdown to select metadata column to derive node label color from
- **node label size**: Dropdown to select metadata column to derive node label size from
- **node label style**: Dropdown to select metadata column to derive node label style (bold, italic, etc) from
- **node label font**: Dropdown to select font

### Branch settings tab

Each dropdown element in the controls in this section have a button to the right of the option that modifies the associated scale settings.

- **branch thickness**: Dropdown to select metadata column to derive branch thickness from
- **branch color**: Dropdown to select metadata column to derive branch color from

### Export settings tab

In units of the "Height", "Width", and "Margin" setting are in pixels for PNG and cm for vector formats. The units are automatically converted assuming a 300 ppi for conversion between the two.
Changes to the "Height" or "Width" will result the other dimension automatically changing to maintain the current aspect ratio.
The "Height" and "Width" only affect the scaling of the elements in the exported file.
Regardless of the current view, the entire tree and all legends should be included in the exported file and the boundary of the exported figure should be based on the tree and legends.

- **Export**: A button that exports the tree to a SVG file that the user can download
- **Output format**: A dropdown with options SVG, PDF, and PNG. Default: SVG.
- **Height**: The height of the exported file. Defaults to the current tree height in pixels
- **Width**: The width of the exported file. Defaults to the current tree width in pixels
- **Margin**: The size of empty space around the tree in the exported output file. Default: 0.
- **Fixed aspect ratio**: A toggle that when activated locks the current aspect ratio. When locked, changes to the "Height" or "Width" will result the other dimension automatically changing to maintain the aspect ratio. Default: on.
- **Show border**: A toggle button to show/hide the boundary rectangle representing the bounds of the exported figure. Default: on.
