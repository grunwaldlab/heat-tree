# Installation

## NPM

Install `heat-tree` via npm:

```bash
npm install heat-tree
```

## Importing

### ES Modules (Recommended)

```javascript
import { heatTree } from 'heat-tree';
```

### CommonJS

```javascript
const { heatTree } = require('heat-tree');
```

### CDN (Browser)

```html
<script src="https://unpkg.com/heat-tree/dist/heat-tree.iife.min.js"></script>
<script>
  const { heatTree } = window.HeatTree;
</script>
```

## Dependencies

`heat-tree` has minimal dependencies:

- [D3.js](https://d3js.org/) - For visualization
- [vanilla-picker](https://www.npmjs.com/package/vanilla-picker) - For color picking

These are automatically installed when you install `heat-tree` via npm.

## Development Setup

If you want to contribute or modify the library:

```bash
# Clone the repository
git clone https://github.com/grunwaldlab/heat-tree.git
cd heat-tree

# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Start development server with hot reload
npm run dev
```
