import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `base: './'` emits relative asset URLs, so the build works when served from any
// sub-path (e.g. https://<user>.github.io/<any-repo-name>/) without hard-coding the repo name.
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        // Split rarely-changing libraries into their own cacheable chunks.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            {
              name: 'codemirror',
              test: /node_modules[\\/](@codemirror|@lezer|style-mod|w3c-keyname|crelt)[\\/]/,
            },
            {
              name: 'mui',
              test: /node_modules[\\/](@mui|@emotion|@popperjs|react-transition-group|stylis)[\\/]/,
            },
            {
              name: 'motion',
              test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/,
            },
          ],
        },
      },
    },
  },
});
