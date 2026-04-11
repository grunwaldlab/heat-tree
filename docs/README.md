# heat-tree Documentation

This directory contains the VitePress-based documentation for heat-tree.

## Development

Start the development server with hot reload:

```bash
npm run docs:dev
```

This will start a local server at `http://localhost:5173` that automatically reloads when you make changes.

## Building

Build the documentation site:

```bash
npm run docs:build
```

The built site will be output to `docs/.vitepress/dist/`.

## API Documentation Generation

The API documentation is automatically generated from JSDoc comments in the source code:

```bash
npm run docs:generate-api
```

This command is run automatically as part of `npm run docs:build`.

## Structure

- `.vitepress/` - VitePress configuration and theme
- `api/` - API reference documentation (auto-generated)
- `guide/` - User guides and tutorials
- `public/` - Static assets
- `index.md` - Homepage

## Deployment

The documentation is automatically deployed to GitHub Pages via GitHub Actions when changes are pushed to the main branch.
