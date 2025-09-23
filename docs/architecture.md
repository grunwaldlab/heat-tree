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
