import { defineConfig } from 'vitest/config';

// `vite build` emits the ES module; `vite build --mode iife` emits the
// single-file browser script whose global `Geomatplot` is the plot class.
export default defineConfig(({ mode }) => {
  const iife = mode === 'iife';
  return {
    server: {
      open: '/demo/demo.html',
    },
    build: {
      emptyOutDir: !iife,
      sourcemap: true,
      lib: iife
        ? {
            entry: 'src/browser.ts',
            name: 'Geomatplot',
            formats: ['iife'],
            fileName: () => 'geomatplot.iife.js',
          }
        : {
            entry: 'src/index.ts',
            formats: ['es'],
            fileName: () => 'geomatplot.js',
          },
      // npm consumers install culori as a dependency; the script build bundles it.
      rolldownOptions: iife ? {} : { external: [/^culori(\/|$)/] },
    },
    test: {
      environment: 'node',
      include: ['test/**/*.test.ts'],
    },
  };
});
