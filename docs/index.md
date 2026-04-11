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

```bash
npm install heat-tree
```

```javascript
import { heatTree } from 'heat-tree';

const newickString = "(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);";
heatTree('#container', {name: 'My Tree', newick: newickString});
```

## Learn More

- [Getting Started Guide](/guide/getting-started) - Learn the basics
- [Installation](/guide/installation) - Detailed installation instructions
- [Examples](/guide/examples) - See heat-tree in action with real datasets
- [API Reference](/api/) - Complete API documentation

## For R Users

For the R package that wraps this library, see [https://github.com/grunwaldlab/heattree](https://github.com/grunwaldlab/heattree).

For a live example of the widget in use see the example in the R package documentation at [https://grunwaldlab.github.io/heattree/articles/Getting-started.html](https://grunwaldlab.github.io/heattree/articles/Getting-started.html).
