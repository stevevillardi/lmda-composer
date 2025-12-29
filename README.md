# LMDA Composer

LogicModule Composer for LogicMonitor - Enhanced script development and debugging experience for LogicMonitor power users.

## Development

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Google Chrome browser

### Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

### Hot Reload Setup

The extension uses `@crxjs/vite-plugin` which provides automatic hot reload during development.

**Initial Setup:**

1. Run `npm run dev` - This starts the Vite dev server and watches for file changes
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top right)
4. Click "Load unpacked"
5. Select the `dist` folder from this project directory
6. The extension is now loaded and ready for development

**How Hot Reload Works:**

- When you make changes to any file in `src/`, Vite automatically:
  - Rebuilds the extension
  - Reloads the extension in Chrome
  - Preserves your extension state when possible

- React components in the editor UI support Hot Module Replacement (HMR), so changes appear instantly without full page reloads

**Development Workflow:**

1. Keep `npm run dev` running in your terminal
2. Make changes to files in `src/`
3. Watch the terminal for build output
4. The extension automatically reloads in Chrome
5. Test your changes in the browser

**Troubleshooting:**

- **Extension not reloading:** Check that the dev server is running and watch the terminal for errors
- **Changes not appearing:** Try manually reloading the extension in `chrome://extensions/` (click the reload icon)
- **Build errors:** Check the terminal output for TypeScript or build errors
- **Service worker issues:** If the service worker seems stuck, go to `chrome://extensions/` and click "Service worker" to inspect it, or reload the extension

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `dist` folder.

### Linting

```bash
npm run lint
```

Runs TypeScript type checking.

## Project Structure

- `src/` - Source code
  - `background/` - Service worker and background scripts
  - `content/` - Content scripts injected into LogicMonitor pages
  - `editor/` - Monaco-based editor UI
  - `components/` - React UI components
- `dist/` - Build output (generated)
- `docs/` - Documentation

## License

ISC

