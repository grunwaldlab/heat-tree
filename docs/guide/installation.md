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

## Browser Support

`heat-tree` supports all modern browsers:

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## TypeScript Support

TypeScript definitions are included in the package.

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

## R Package

For R users, there is an R package that wraps this JavaScript library:

```r
# Install from CRAN (when available)
install.packages("heattree")

# Or install from GitHub
remotes::install_github("grunwaldlab/heattree")
```

See the [R package documentation](https://grunwaldlab.github.io/heattree/) for more details.
