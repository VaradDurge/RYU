import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const macDiff = resolve('diff/mac')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@mac': macDiff
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('electron/main.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('electron/preload.ts')
        }
      }
    }
  },
  renderer: {
    root: 'src',
    resolve: {
      alias: {
        '@mac': macDiff
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/index.html')
        }
      }
    },
    plugins: [react()],
    server: {
      // Allow importing Mac island from ../diff/mac while root is src/
      fs: {
        allow: [resolve('.'), macDiff]
      }
    }
  }
})

