import fs from 'node:fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import compression from 'vite-plugin-compression';

/** Minimal valid wasm when generated/image_compress.wasm is missing (stub JS never loads it). */
function imageCompressWasmPlaceholder(): Plugin {
  const wasmAbs = path.resolve(
    __dirname,
    'src/lib/image-compress/generated/image_compress.wasm',
  );
  const virtualId = '\0image-compress-wasm-placeholder';
  const placeholderDataUrl =
    'data:application/wasm;base64,' +
    Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]).toString('base64');

  return {
    name: 'image-compress-wasm-placeholder',
    resolveId(id) {
      if (id === virtualId) {
        return id;
      }
      const base = id.replace(/\?.*$/, '');
      if (!base.endsWith('image_compress.wasm')) {
        return undefined;
      }
      if (!fs.existsSync(wasmAbs) || fs.statSync(wasmAbs).size < 64) {
        return virtualId;
      }
      return undefined;
    },
    load(id) {
      if (id === virtualId) {
        return `export default ${JSON.stringify(placeholderDataUrl)}`;
      }
      return undefined;
    },
  };
}

export default defineConfig({
  plugins: [
    imageCompressWasmPlaceholder(),
    react(),

    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      filter: /\.(js|mjs|css|html)$/i,
      threshold: 30720,
    }),

    compression({
      algorithm: 'gzip',
      ext: '.gz',
      filter: /\.(js|mjs|css|html)$/i,
      threshold: 30720,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    __BUILD_HASH__: JSON.stringify(Date.now()),
  },

  server: {
    host: '0.0.0.0',
    // host: '192.168.1.68',
    port: 5173,
    proxy: {
      '/api': {
        // target: 'http://10.192.220.182:8000',
        target: 'http://localhost:8000',
        // target: 'http://192.168.1.68:8000',
        // target: 'http://172.20.10.3:8000',
        // target: 'http://10.192.223.172:8000',
        // target: 'http://0.0.0.0:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
