import { defineConfig } from 'vite';
import path from 'node:path';
import electron from 'vite-plugin-electron/simple';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Detect build target: 'web' mode skips Electron plugin
  const isWeb = mode === 'web';

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      react(),
      // Only load Electron plugin for Electron builds
      !isWeb &&
        electron({
          main: {
            // Shortcut of `build.lib.entry`.
            entry: 'electron/main.ts',
          },
          preload: {
            // Shortcut of `build.rollupOptions.input`.
            // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
            input: path.join(__dirname, 'electron/preload.ts'),
          },
          // Polyfill the Electron and Node.js API for Renderer process.
          // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
          // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
          renderer:
            process.env.NODE_ENV === 'test'
              ? // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
                undefined
              : {},
        }),
    ].filter(Boolean), // Remove falsy values (when isWeb = true)

    // Web-specific build configuration
    ...(isWeb && {
      base: './', // Use relative paths for GitHub Pages
      build: {
        outDir: 'dist-web',
        emptyOutDir: true,
      },
    }),
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      coverage: {
        reporter: ['text', 'json', 'html'],
        exclude: [
          'coverage/**',
          'dist/**',
          '**/[.]**',
          'packages/*/test?(s)/**',
          '**/*.d.ts',
          '**/virtual:*',
          '**/__x00__*',
          '**/*{.,-}{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
          '**/init.ts',
          '**/vite.config.ts',
          '**/tailwind.config.js',
          '**/postcss.config.js',
        ],
      },
    },
  };
});
