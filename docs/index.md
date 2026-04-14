---
layout: home
---

<HeroWithWidget />

## Features

- **Interactive Visualization** - Interactive phylogenetic and taxonomic tree visualization with support for both rectangular and circular layouts.
- **Metadata Support** - Visualize categorical and continuous variables through color, size, and text styling of tree elements.
- **Tree Manipulation** - Collapse, expand, hide, and reveal subtrees and roots interactively.
- **Export Options** - Export visualizations to SVG and PNG formats for publications and presentations.
- **Responsive Design** - Mobile-friendly responsive design that adapts to different screen sizes.
- **Minimal Dependencies** - Built on D3.js with minimal external dependencies for easy integration.

## Quick Start

Install `heat-tree`

```bash
npm install heat-tree
```

Embed a `heat-tree` widget in a `div` with an ID of `container`:

```javascript
import { heatTree } from 'heat-tree';
heatTree('#container', {name: 'My Tree', tree: "(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);"});
```

## Learn More

- [Getting Started Guide](/guide/getting-started) - Learn the basics
- [Installation](/guide/installation) - Detailed installation instructions
- [Examples](/guide/examples) - See heat-tree in action with real datasets
- [API Reference](/api/) - Complete API documentation

## For use with Python / Jupyter Notebooks

For the python package that wraps this library for use with Jupyter notebooks, see [https://github.com/grunwaldlab/heattree_py](https://github.com/grunwaldlab/heattree_py).

## For use with R / R Markdown / Quarto

For the R package that wraps this library, see [https://github.com/grunwaldlab/heattree](https://github.com/grunwaldlab/heattree).
