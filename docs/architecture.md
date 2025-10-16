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
- Allow viewing different trees by choosing which is currently shown
- Scale branch lengths to make the tree uniformly wider or narrower
- Scale tree vertically to make the tree taller or shorter
- Scale label size
- Color the following aspects by categorical and continuous variables:
  - labels
  - node shapes
  - branches
- Scale the following aspects by categorical and continuous variables:
  - labels
  - node shapes
  - branch thickness

## Controls

### Top toolbar

- **Reset tree to default view**: Button that resets current tree to default settings.
- **Expand subtrees**: Button that expands all collapsed subtrees. It is disabled if there are no collapsed subtrees.
- **Expand root**: Button that expands the collapsed root. It is disabled if the root is not collapsed.
- **Toggle automatic subtree collapsing**: Toggle that if enabled, subtrees of indistinguishable leaves (in terms of branch length, color, and size) are automatically collapsed in order of indistinguishablility until all leaves fit on the screen.
- **Toggle manual zooming/panning**: Toggle that enables or disables zooming/panning.
- **Toggle automatic zooming**: Toggle that if enabled, the view zoom will be adjusted to be the smallest needed to see the root to tip and labels automatically when a change is made to the tree
- **Toggle automating panning**: Toggle that if enabled, the view will be panned to minimize empty space

- **Scale branch length**: A slider to scale branch length
- **Scale tree height**: A slider to scale tree height (or proportion of the circle used for circular layouts)

- **Export to SVG**: A button that exports the tree to a SVG file that the user can download

#### Label coloring dropdown

A dropdown that controls which metadata column is used to color labels.
Present if a metadata file is supplied.
The currently selected column is used to infer the color of labels.
Numeric data is plotted on a continuous palette using the viridis color scale.
Categorical data (i.e. strings that cannot be converted to numbers), is plotted on a categorical color palette using colors sampled from the viridis palette.
Wether a column is continuous or categorical is determined when the metadata is parsed.
In both cases a legend is placed in the legend section at the bottom of the widget.

## Label/tree sizing rules

Variables used in equations below:

- X_i = The x-axis position (for rectangular layouts) or the radius (for circular layouts) of leaf node i in units of branch length. Always >= 0
- B_i = The branch length between node i and its parent. Always >= 0
- N_i = The number of characters in the label of leaf node i. Always > 0
- S_i = A unitless factor for scaling font size for the label of leaf node i. Always > 0
- W = The mean width of a character for the given font, expressed as a proportion of its height. Always > 0. Default: 0.65
- `minFontPx` = The minimum height in pixels of characters in labels. Always > 0. Default: 10
- `idealFontPx` = The ideal height in pixels of characters in labels. Always > 0. Default: 18
- `maxFontPx` = The maximum height in pixels of characters in labels. Always > 0. Default: 32
- `branchLenToPxFactor` = The factor used to convert branch lengths to pixels. Always > 0
- `labelSizeToPxFactor` = The factor used to convert leaf annotations to pixels. Always > 0
- `treeWidthPx` = The width of the plotted tree, including any annotations, in pixels. Always > 0
- `treeHeightPx` = The height of the plotted tree, including any annotations, in pixels. Always > 0
- `viewWidthPx` = The width in pixels of area available to display the tree. Always > 0
- `viewHeightPx` = The height in pixels of area available to display the tree. Always > 0
- `minBranchThicknessPx` = The minimum thickness of branches in pixels. Always > 0
- `minBranchLenProp` = The minimum proportion of tree width taken up by the longest branch. Always > 0 and < 1. Default: 0.5

Branch lengths must be scaled to convert them into pixel coordinates for plotting such that text and geometry are correctly sized.
Branch length must be scaled large enough relative to text size in order to show phylogenetic relationships, but cant be so long relative to text size that the tree is too wide to be viewed on a screen or the text is too small.
Every tree will be different, with different, with differently sized labels appended to branches of varying length.
For example, a long label on a short branch does not effect the overall tree dimensions as much as a short label on the longest branch.
What matters is how much text (or other leaf annotations) extend past the longest branch and how that interacts with the viewing window.

The relative scaling of branch lengths (`branchLenToPxFactor`) and leaf annotations (`labelSizeToPxFactor`) will be determined by a series of constraints on their potential ranges.
These constraints should be applied in order to infer an minimum and maximum range for `branchLenToPxFactor` and `labelSizeToPxFactor`.
Many trees will not have a solution that fulfills all these constraints, in which case constraints with higher priority apply.
Constraints should be applied in order to interativly restrict the acceptable range for each factor.
If applying a constraint would cause the range to be inverted (e.g. making the maximum less than the minimum) then modified boundary is set equal to the unmodified boundary and no further constraints are calculated or applied.
If there is a range of acceptable values after all constraints have been applied (i.e. the minimum != the maximum), then the `branchLenToPxFactor` should be maximized.

### Constraints for rectangular layouts

If we assume that each leaf annotation can have a different dimensions, then the relationship between branch and annotation scaling factors and tree dimensions in pixels is:

`treeWidthPx` = max(X_i * `branchLenToPxFactor` + `leafAnnotationWidth`(i) * `labelSizeToPxFactor`)
`treeHeightPx` = sum(`leafAnnotationHeight`(i)) * `labelSizeToPxFactor`

where the dimensions of leaf annotations in units of branch length for each leaf is defined by:

`leafAnnotationWidth`(i) = W * N_i * S_i
`leafAnnotationHeight`(i) = max(S_i, `minBranchThicknessPx`)

Ideally the plotted tree would have the following constraints, in order of importance:

- The text should be readable at 100% zoom. If labels are too small to read they are only a distraction.

`minFontPx` <= min(S_i) * `labelSizeToPxFactor`
`labelSizeToPxFactor` >= `minFontPx` / min(S_i)

- Branches should take up some minimum proportion of the tree space. Phylogenetic relationships should be the focus of the tree rather than annotations and labels.

`minBranchLenProp` <= max(X_i) * `branchLenToPxFactor` / max(X_i * `branchLenToPxFactor` + `leafAnnotationWidth`(i) * `labelSizeToPxFactor`)
`labelSizeToPxFactor` <= min((`branchLenToPxFactor` * (max(X_i) - `minBranchLenProp` * X_i)) / (`minBranchLenProp` * `leafAnnotationWidth`(i)))
`branchLenToPxFactor` >= max((`leafAnnotationWidth`(i) * `labelSizeToPxFactor`) / ((max(X_i) / `minBranchLenProp`) - X_i))

- The tree width should fit into to the viewing window.

`viewWidthPx` >= max(X_i * `branchLenToPxFactor` + `leafAnnotationWidth`(i) * `labelSizeToPxFactor`)
`branchLenToPxFactor` <= min((`viewWidthPx` - `leafAnnotationWidth`(i) * `labelSizeToPxFactor`) / X_i)
`labelSizeToPxFactor` <= min((`viewWidthPx` - X_i * `branchLenToPxFactor`) / `leafAnnotationWidth`(i))

- The tree height should fit into the viewing window. This will not practical for all trees.

`viewHeightPx` >= sum(`leafAnnotationHeight`(i)) * `labelSizeToPxFactor`
`labelSizeToPxFactor` <= `viewHeightPx` / sum(`leafAnnotationHeight`(i))

- The text should be large and easy to read at 100% zoom.

`idealFontPx` <= min(S_i) * `labelSizeToPxFactor`
`labelSizeToPxFactor` >= `idealFontPx` / min(S_i)

- The shortest non-zero-length branches should be longer than the branch thickness. This will not be practical for all trees.

`minBranchThicknessPx` <= min(B_i) * `branchLenToPxFactor`    where B_i > 0
`branchLenToPxFactor` >= `minBranchThicknessPx` / min(B_i)    where B_i > 0

- The text should be less than some maximum size at 100% zoom.

`maxFontPx` >= min(S_i) * `labelSizeToPxFactor`
`labelSizeToPxFactor` <= `maxFontPx` / min(S_i)


### Constraints for circular layouts

If we assume that each leaf annotation can have a different dimensions and that the height of leaf annotations has a negligible effect on tree dimensions, then the relationship between branch and annotation scaling factors and tree dimensions in pixels is:

`A_i` = 2 * pi * i / `tipCount`
`maxX` = max(X_i * cos(`A_i`) * `branchLenToPxFactor` + max(0, -`leafAnnotationWidth`(i) * cos(`A_i`)) * `labelSizeToPxFactor`)
`minX` = min(X_i * cos(`A_i`) * `branchLenToPxFactor` + min(0, -`leafAnnotationWidth`(i) * cos(`A_i`)) * `labelSizeToPxFactor`)
`maxY` = max(X_i * sin(`A_i`) * `branchLenToPxFactor` + max(0, -`leafAnnotationWidth`(i) * sin(`A_i`)) * `labelSizeToPxFactor`)
`minY` = min(X_i * sin(`A_i`) * `branchLenToPxFactor` + min(0, -`leafAnnotationWidth`(i) * sin(`A_i`)) * `labelSizeToPxFactor`)
`treeWidthPx` = maxX - minX
`treeHeightPx` = maxY - minY

where the dimensions of leaf annotations in units of branch length for each leaf is defined by:

`leafAnnotationWidth`(i) = W * N_i * S_i
`leafAnnotationHeight`(i) = max(S_i, `minBranchThicknessPx`)

Ideally the plotted tree would have the following constraints, in order of importance:

- The text should be readable at 100% zoom. If labels are too small to read they are only a distraction.

`minFontPx` <= min(S_i) * `labelSizeToPxFactor`
`labelSizeToPxFactor` >= `minFontPx` / min(S_i)

- Leaf annotations should not overlap when used in a circular layout.

sum(`leafAnnotationHeight`(i)) * `labelSizeToPxFactor` <= max(X_i) * `branchLenToPxFactor` * 2 * pi
`labelSizeToPxFactor` <= max(X_i) * `branchLenToPxFactor` * 2 * pi / sum(`leafAnnotationHeight`(i))
`branchLenToPxFactor` >= (sum(`leafAnnotationHeight`(i)) * `labelSizeToPxFactor`) / (max(X_i) * 2 * pi)

- Branches should take up some minimum proportion of the tree space. Phylogenetic relationships should be the focus of the tree rather than annotations and labels.

`minBranchLenProp` <= max(X_i) * `branchLenToPxFactor` / max(X_i * `branchLenToPxFactor` + `leafAnnotationWidth`(i) * `labelSizeToPxFactor`)
`labelSizeToPxFactor` <= min((`branchLenToPxFactor` * (max(X_i) - `minBranchLenProp` * X_i)) / (`minBranchLenProp` * `leafAnnotationWidth`(i)))
`branchLenToPxFactor` >= max((`leafAnnotationWidth`(i) * `labelSizeToPxFactor`) / ((max(X_i) / `minBranchLenProp`) - X_i))

- The tree width should fit into to the viewing window.

`viewWidthPx` >= `maxX` - `minX`
`branchLenToPxFactor` <= min(
  `viewWidthPx` / (max(X_i * cos(A_i) where A_i >= 0) - min(X_i * cos(A_i) where A_i < 0)),
  (`viewWidthPx` - max(-`leafAnnotationWidth`(i) * cos(A_i) * `labelSizeToPxFactor` where A_i < 0)) / - min(X_i * cos(A_i) where A_i < 0)),
  (`viewWidthPx` - min(-`leafAnnotationWidth`(i) * cos(A_i) * `labelSizeToPxFactor` where A_i >= 0)) / - max(X_i * cos(A_i) where A_i >= 0))
)

- The tree height should fit into to the viewing window.

`viewHeightPx` >= `maxY` - `minY`
`branchLenToPxFactor` <= min(
  `viewWidthPx` / (max(X_i * sin(A_i) where A_i >= 0) - min(X_i * sin(A_i) where A_i < 0)),
  (`viewWidthPx` - max(-`leafAnnotationWidth`(i) * sin(A_i) * `labelSizeToPxFactor` where A_i < 0)) / - min(X_i * sin(A_i) where A_i < 0)),
  (`viewWidthPx` - min(-`leafAnnotationWidth`(i) * sin(A_i) * `labelSizeToPxFactor` where A_i >= 0)) / - max(X_i * sin(A_i) where A_i >= 0))
)

- The text should be large and easy to read at 100% zoom.

`idealFontPx` <= min(S_i) * `labelSizeToPxFactor`
`labelSizeToPxFactor` >= `idealFontPx` / min(S_i)

- The shortest non-zero-length branches should be longer than the branch thickness. This will not be practical for all trees.

`minBranchThicknessPx` <= min(B_i) * `branchLenToPxFactor`    where B_i > 0
`branchLenToPxFactor` >= `minBranchThicknessPx` / min(B_i)    where B_i > 0

- The text should be less than some maximum size at 100% zoom.

`maxFontPx` >= min(S_i) * `labelSizeToPxFactor`
`labelSizeToPxFactor` <= `maxFontPx` / min(S_i)


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

