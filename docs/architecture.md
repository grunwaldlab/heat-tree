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
- **Toggle manual zooming**: Toggle that enables or disables zooming with scroll wheel or two fingers
- **Toggle manual panning**: Toggle that enables or disables panning with click and drag
- **Toggle automatic zooming**: Toggle that if enabled, the view zoom will be adjusted to be the smallest needed to see the root to tip and labels automatically when a change is made to the tree
- **Toggle automating panning**: Toggle that if enabled, the view will be panned to minimize empty space

- **Scale branch length**: A slider to scale branch length
- **Scale tree height**: A slider to scale tree height (or proportion of the circle used for circular layouts)

## Label/tree sizing rules


### Rectangular layouts

#### Lower limits

- Label font size, measured in pixels, must be large enough to be legible when viewed on screens and printed (`minLabelSize`; 12 by default)

#### Upper limits

- The proportion of total x-axis space taken up by labels extending past the longest branch on the right and the root on the left is less than some constant (maxLabelWidthProp; 0.3 by default).
- Some proportion of screen height (maxLabelHeightProp; 0.1 by default).


### Circular layouts

  - the ratio (maximum label length extending past the maximum root-to-tip radius) / (maximum root-to-tip radius) is less than some constant (maxLabelWidthProp; 0.3 by default)
  - the height of labels (font size) must be small enough such that these is minimum gap between labels defined by a constant representing proportion of label size (minLabelGapProp; 0.1 by default). The space available to plot labels is the circumference of a circle with a radius equal to the maximum root-to-tip radius.
  - Label font size must be less than some maximum. The maximum is a proportion of the height or width of the viewing window, whichever is smaller (maxLabelSizeProp; 0.05 by default).

