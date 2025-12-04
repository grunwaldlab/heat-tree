# Architecture

## Design philosophy

* Minimal dependencies
* Light weight, fast, and scalable
* Self contained widget easily embedded in offline documents
* All functionality works the same in mobile devices (e.g., no mouse hover or right click effects)

## Tools used

- D3
- `vite`: packaging distributions
- `vitest`: unit testing
- `http-server`: serving test pages using the widget in `./demo`

## Planned functionality

- Panning and zooming
- Collapse/Expand subtrees
- Export current view to SVG, PNG, or Newick
- Uploading, removing, and viewing different trees
- Uploading, removing, and selecting which metadata associated with tree nodes is used for color, size, etc.
- Scale branch lengths to make the tree uniformly wider or narrower
- Scale tree vertically to make the tree taller or shorter
- Scale label size
- Color the following aspects by categorical and continuous variables:
  - labels
  - node shapes
  - branches
- Scale the following aspects by continuous variables:
  - labels
  - branch thickness
- Scale the following aspects by categorical and continuous variables:
  - node shapes



## Zooming and panning

For small trees, scaling of branches and annotations is used to make them fit into the viewing window, but for larger trees this will not be possible and zooming will be required to look at subsets of the tree at a time.

### Current zoom indicator

There should be a widget on the legend panel that indicates the current zoom level as a percentage of 1-1 pixel size.
This should change from grey to black when not 100%.

### Manual zooming and panning

Since this widget is designed to be part of reports, the panning functionality can be accidentally triggered when scrolling down a page.
Therefore, manual zooming and panning can be toggled off/on using a button in the control panel.
The initial state of the toggle is controlled by the option `manualZoomAndPanEnabled` and can have the following settings:

- `true`: Zooming and panning are initially enabled
- `false`: Zooming and panning are initially disabled
- `null` (default): Zooming and panning are enabled if the tree cannot fit into the view area without zooming. This adapts to the current state of the tree.

### Automatic zooming

When a change to the tree is made or the tree is initially printed and the tree cannot fit into the viewing window, then the view should automatically zoom to fit the tree.
The behavior should be controlled by a toggle button in the control panel.
The initial state of the toggle is controlled by the option `autoZoomEnabled` and can have the following settings:

- `true`: Automatic zoom is initially on
- `false`: Automatic zoom is initially off
- `null` (default): Automatic zoom is on when manual zooming and panning is disabled

### Automatic panning

When a change to the tree is made or the tree is initially printed the view should automatically panned.
If the tree can fit in the viewing window in a given dimension, then the view should be panned to center the tree in that dimension.
If the tree cannot fit in the viewing window in a given dimension, the view should be panned to eliminate any unused plotting space in that dimension by panning in the direction that minimizes the distance panned.
The behavior should be controlled by a toggle button in the control panel.
The initial state of the toggle is controlled by the option `autoPanEnabled` and can have the following settings:

- `true` (default): Automatic panning is initially on
- `false`: Automatic panning is initially off
- `null`: Automatic panning is on when manual zooming and panning is disabled

