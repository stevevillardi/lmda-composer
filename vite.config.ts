/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import manifest from './src/manifest.json';

// Exclude Monaco language workers we don't need (saves ~9MB)
// We only use Groovy and PowerShell - no need for TS/JS/JSON/CSS/HTML language services
function excludeMonacoWorkersPlugin(): Plugin {
  const workersToExclude = ['ts.worker', 'json.worker', 'css.worker', 'html.worker'];
  // Match: createWorker: () => new Worker(new URL('xxx.worker.js', import.meta.url), { type: "module" })
  const createWorkerPattern =
    /createWorker:\s*\(\)\s*=>\s*new Worker\(new URL\(['"]([^'"]+\.worker\.js)['"],\s*import\.meta\.url\)[^)]*\)/g;

  return {
    name: 'exclude-monaco-workers',
    enforce: 'pre',
    transform(code, id) {
      // Only transform Monaco workerManager files
      if (!id.includes('monaco-editor') || !id.includes('workerManager')) {
        return null;
      }

      let hasChanges = false;
      const transformed = code.replace(createWorkerPattern, (match, workerFile) => {
        const shouldExclude = workersToExclude.some((w) => workerFile.includes(w));
        if (shouldExclude) {
          hasChanges = true;
          // Replace with a no-op inline worker using a blob URL
          return `createWorker: () => new Worker(URL.createObjectURL(new Blob(['self.onmessage=function(){}'], {type:'text/javascript'})))`;
        }
        return match;
      });

      return hasChanges ? { code: transformed, map: null } : null;
    },
  };
}

export default defineConfig(({ command }) => {
  const shouldAnalyze = process.env.ANALYZE === 'true';

  return {
    plugins: [
      excludeMonacoWorkersPlugin(),
      react(),
      tailwindcss(),
      crx({ manifest }),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        plugins: [
          ...(shouldAnalyze
            ? [
                visualizer({
                  filename: 'stats.html',
                  open: true,
                  gzipSize: true,
                  brotliSize: true,
                }) as never,
              ]
            : []),
        ],
        output: command === 'build' ? {
          manualChunks: {
            monaco: ['monaco-editor', '@monaco-editor/react'],
          },
        } : {},
        input: {
          editor: resolve(__dirname, 'src/editor/index.html'),
          onboarding: resolve(__dirname, 'src/onboarding/index.html'),
        },
      },
    },
    server: {
      port: 5173,
      strictPort: false,
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      hmr: {
        protocol: 'ws',
        host: 'localhost',
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
    test: {
      // Use jsdom for React component tests, node for pure logic
      environment: 'jsdom',
      globals: true,
      include: ['tests/**/*.test.{ts,tsx}'],
      setupFiles: ['./tests/setup.ts'],
      // Coverage configuration
      coverage: {
        provider: 'v8',
        reporter: ['text', 'text-summary', 'html'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.d.ts',
          'src/**/index.ts',
          'src/**/index.tsx',
          'src/vite-env.d.ts',
          'src/manifest.json',
        ],
      },
    },
  };
});
