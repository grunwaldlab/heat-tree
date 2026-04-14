import { defineConfig } from 'vitepress'
import path from 'path'
import fs from 'fs'

// Copy dist files to public directory for docs
const distSource = path.resolve(__dirname, '../../dist')
const distDest = path.resolve(__dirname, '../public/dist')
if (fs.existsSync(distSource) && !fs.existsSync(distDest)) {
  fs.mkdirSync(distDest, { recursive: true })
  fs.readdirSync(distSource).forEach(file => {
    fs.copyFileSync(path.join(distSource, file), path.join(distDest, file))
  })
}

export default defineConfig({
  title: 'heat-tree',
  description: 'A self-contained widget for phylogenetic and taxonomic tree visualization',
  base: '/heat-tree/',

  themeConfig: {
    // Navigation
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      // { text: 'API', link: '/api/' }
    ],

    // Sidebar configuration
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Examples', link: '/guide/examples' }
          ]
        }
      ]
    },

    // Social links
    socialLinks: [
      { icon: 'github', link: 'https://github.com/grunwaldlab/heat-tree' }
    ],

    // Search
    search: {
      provider: 'local'
    },

    // Footer
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present grunwaldlab'
    }
  },

  // Head tags
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/heat-tree/favicon.png' }]
  ],

  // Vite configuration
  vite: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '../')
      }
    },
    ssr: {
      noExternal: ['@grunwaldlab/heat-tree']
    }
  }
})
