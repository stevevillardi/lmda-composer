import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://stevevillardi.github.io',
  base: '/lmda-composer',
  integrations: [
    starlight({
      title: 'LMDA Composer',
      description: 'A focused workspace for LogicMonitor scripting. Create, test, and ship LogicModules faster.',
      logo: {
        src: './src/assets/icon128.png',
        alt: 'LMDA Composer',
      },
      social: [],
      customCss: ['./src/styles/custom.css'],
      head: [
        {
          tag: 'meta',
          attrs: {
            property: 'og:image',
            content: 'https://stevevillardi.github.io/lmda-composer/og-image.png',
          },
        },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
            { label: 'Interface Overview', slug: 'getting-started/interface' },
          ],
        },
        {
          label: 'Core Features',
          items: [
            { label: 'Script Editor', slug: 'core-features/script-editor' },
            { label: 'Execution Modes', slug: 'core-features/execution-modes' },
            { label: 'Output Panel', slug: 'core-features/output-panel' },
            { label: 'Context Selection', slug: 'core-features/context-selection' },
          ],
        },
        {
          label: 'Portal Tools',
          items: [
            { label: 'LogicModule Browser', slug: 'portal-tools/logicmodule-browser' },
            { label: 'LogicModule Search', slug: 'portal-tools/logicmodule-search' },
            { label: 'AppliesTo Toolbox', slug: 'portal-tools/appliesto-toolbox' },
            { label: 'Debug Commands', slug: 'portal-tools/debug-commands' },
          ],
        },
        {
          label: 'API Explorer',
          items: [
            { label: 'Overview', slug: 'api-explorer/overview' },
            { label: 'Request Builder', slug: 'api-explorer/request-builder' },
            { label: 'Variables & History', slug: 'api-explorer/variables-history' },
          ],
        },
        {
          label: 'Module Management',
          items: [
            { label: 'Module Details Editor', slug: 'module-management/module-details' },
            { label: 'Module Lineage', slug: 'module-management/lineage' },
            { label: 'Committing Changes', slug: 'module-management/committing' },
          ],
        },
        {
          label: 'Workspace',
          items: [
            { label: 'File Management', slug: 'workspace/file-management' },
            { label: 'Snippets Library', slug: 'workspace/snippets' },
            { label: 'Module Snippets', slug: 'workspace/module-snippets' },
            { label: 'Execution History', slug: 'workspace/execution-history' },
            { label: 'Settings', slug: 'workspace/settings' },
          ],
        },
        {
          label: 'Utilities',
          items: [
            { label: 'Collector Sizing', slug: 'utilities/collector-sizing' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Keyboard Shortcuts', slug: 'reference/keyboard-shortcuts' },
            { label: 'Troubleshooting', slug: 'reference/troubleshooting' },
            { label: 'FAQ', slug: 'reference/faq' },
          ],
        },
        {
          label: 'Release Notes',
          items: [
            { label: 'Changelog', slug: 'release-notes/changelog' },
          ],
        },
      ],
      components: {
        Hero: './src/components/Hero.astro',
      },
    }),
  ],
});


