import { defineConfig } from 'vite';
import type { Rollup } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { devvit } from '@devvit/start/vite';

/**
 * Bundler warnings that are safe to hide:
 * - lucide-react marks its files "use client" for React Server Components.
 *   This app has no server components, so the directive means nothing here.
 * - protobufjs uses eval; Devvit's plugin hides this one by default, and our
 *   handler below replaces the plugin's, so it's repeated here.
 */
const isHarmlessWarning = (warning: Rollup.RollupLog): boolean =>
  (warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
    warning.message.includes('"use client"')) ||
  (warning.code === 'EVAL' &&
    (warning.id ?? '').includes('node_modules/@protobufjs/inquire'));

export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    devvit({
      // The client build's own warning handler (set by Devvit's plugin)
      // takes precedence over a top-level one, so override it here.
      client: {
        build: {
          rollupOptions: {
            onwarn(warning, warn) {
              if (isHarmlessWarning(warning)) return;
              warn(warning);
            },
          },
        },
      },
    }),
  ],
});
