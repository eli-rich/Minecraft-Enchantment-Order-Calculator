import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';

export default defineConfig({
  base: '/',
  plugins: [
    {
      name: 'copy-legacy-scripts',
      generateBundle() {
        for (const fileName of ['search.js', 'parse.js']) {
          this.emitFile({
            type: 'asset',
            fileName,
            source: readFileSync(new URL(fileName, import.meta.url)),
          });
        }
      },
    },
  ],
  test: {
    environment: 'jsdom',
  },
});
