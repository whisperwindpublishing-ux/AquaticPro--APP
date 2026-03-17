import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Vite plugin: replace ES import statements for external packages with
 * references to WordPress global variables (window.React, window.ReactDOM).
 *
 * Works with format: 'es' output — Rollup preserves `import … from 'react'`
 * for externals, and this plugin rewrites them in the final chunks.
 */
function wpExternalGlobals(): Plugin {
  const globals: Record<string, string> = {
    'react': 'window.React',
    'react-dom': 'window.ReactDOM',
    'react-dom/client': 'window.ReactDOM',
  };

  return {
    name: 'wp-external-globals',
    enforce: 'post',
    renderChunk(code) {
      let result = code;
      for (const [pkg, globalRef] of Object.entries(globals)) {
        const e = pkg.replace(/[/]/g, '\\/');
        // import Default, { named } from 'pkg'
        result = result.replace(
          new RegExp(`import\\s+(\\w+)\\s*,\\s*\\{([^}]+)\\}\\s*from\\s*["']${e}["']\\s*;?`, 'g'),
          `const $1 = ${globalRef}; const {$2} = ${globalRef};`
        );
        // import Default from 'pkg'
        result = result.replace(
          new RegExp(`import\\s+(\\w+)\\s+from\\s*["']${e}["']\\s*;?`, 'g'),
          `const $1 = ${globalRef};`
        );
        // import { named } from 'pkg'
        result = result.replace(
          new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*["']${e}["']\\s*;?`, 'g'),
          `const {$1} = ${globalRef};`
        );
        // import * as Ns from 'pkg'
        result = result.replace(
          new RegExp(`import\\s*\\*\\s*as\\s+(\\w+)\\s+from\\s*["']${e}["']\\s*;?`, 'g'),
          `const $1 = ${globalRef};`
        );
        // import 'pkg' (bare side-effect import — just remove for externals)
        result = result.replace(
          new RegExp(`import\\s*["']${e}["']\\s*;?`, 'g'),
          ``
        );
      }
      // Fix: convert ES import `as` syntax to destructuring `:` syntax
      // e.g. const { useId as useId$1 } → const { useId: useId$1 }
      if (result !== code) {
        result = result.replace(/const\s*\{([^}]*)\}/g, (match) => {
          return match.replace(/\b(\w[$\w]*)\s+as\s+(\w[$\w]*)/g, '$1: $2');
        });
        return { code: result, map: null };
      }
      return null;
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({ jsxRuntime: 'classic' }), // Classic mode avoids react/jsx-runtime external issues
    wpExternalGlobals(),
  ],
  base: './', // Use relative paths for assets
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'build',
    assetsDir: 'assets',
    cssCodeSplit: false, // Bundle all CSS into one file for WordPress enqueue
    minify: 'esbuild', // Use esbuild for faster minification
    target: 'es2015', // Better browser compatibility
    rollupOptions: {
      // Externalize only exact react & react-dom (NOT react/jsx-runtime — let it bundle)
      external: (id) => id === 'react' || id === 'react-dom' || id === 'react-dom/client',
      output: {
        format: 'es',
        entryFileNames: 'assets/mentorship-app.js',
        chunkFileNames: 'assets/mentorship-app-[name]-[hash:8].js',
        assetFileNames: 'assets/mentorship-app.[ext]',
        manualChunks(id) {
          // Split heavy third-party libraries into separate lazy-loadable chunks
          if (id.includes('node_modules/@excalidraw')) return 'vendor-excalidraw';
          if (id.includes('node_modules/@blocknote') || id.includes('node_modules/@tiptap') || id.includes('node_modules/prosemirror')) return 'vendor-editor';
          if (id.includes('node_modules/jspdf')) return 'vendor-pdf';
          if (id.includes('node_modules/framer-motion')) return 'vendor-animation';
          if (id.includes('node_modules/@dnd-kit')) return 'vendor-dnd';
          if (id.includes('node_modules/@mantine')) return 'vendor-mantine';
          if (id.includes('node_modules/react-grid-layout')) return 'vendor-grid';
        },
      }
    },
    // Remove console.log statements in production (keep errors and warnings)
    esbuild: {
      drop: ['console'],
      pure: ['console.log', 'console.info', 'console.debug', 'console.trace'],
    }
  }
})