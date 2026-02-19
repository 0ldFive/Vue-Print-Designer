import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    Icons({ compiler: 'vue3' })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'pinia', 'vue-i18n'],
          'monaco': ['@guolao/vue-monaco-editor'],
          'pdf': ['jspdf', 'dom-to-image-more'],
          'canvg': ['canvg'],
          'utils': ['lodash', 'uuid'],
          'barcode': ['jsbarcode', 'qrcode']
        }
      }
    }
  }
})
