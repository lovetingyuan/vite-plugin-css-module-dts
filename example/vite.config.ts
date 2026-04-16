import { defineConfig } from 'vite'
import cssModuleDTS from '../src/index'

export default defineConfig({
  plugins: [cssModuleDTS()],
  css: {
    devSourcemap: true,
  },
})
