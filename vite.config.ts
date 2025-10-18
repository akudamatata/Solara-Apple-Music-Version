import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { Buffer } from 'node:buffer'
import { brotliCompressSync, constants } from 'node:zlib'

// ✅ Performance optimized automatically by Codex
const brotliCompressionPlugin = (): PluginOption => ({
  name: 'codex-brotli-compression',
  apply: 'build',
  enforce: 'post',
  generateBundle(_, bundle) {
    for (const [fileName, chunk] of Object.entries(bundle)) {
      if (chunk.type !== 'asset') {
        continue
      }
      const source =
        typeof chunk.source === 'string'
          ? Buffer.from(chunk.source)
          : chunk.source instanceof Uint8Array
            ? Buffer.from(chunk.source)
            : null
      if (!source || source.length < 1024) {
        continue
      }
      if (!/\.(?:js|css|html|svg|json)$/i.test(fileName)) {
        continue
      }
      const compressed = brotliCompressSync(source, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
        },
      })
      this.emitFile({
        type: 'asset',
        fileName: `${fileName}.br`,
        source: compressed,
      })
    }
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), brotliCompressionPlugin()],
  build: {
    reportCompressedSize: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }
          if (id.includes('react-dom') || id.includes('scheduler') || id.includes('react')) {
            return 'react-vendor'
          }
          if (id.includes('framer-motion')) {
            return 'motion'
          }
          if (id.includes('lucide-react')) {
            return 'icons'
          }
          if (id.includes('react-hot-toast')) {
            return 'toast'
          }
          return 'vendor'
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-hot-toast', 'lucide-react'],
  },
})
