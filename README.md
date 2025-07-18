## vite-plugin-css-module-dts

A Vite plugin that automatically generates TypeScript type declaration files for CSS Modules.

### Install

```sh
npm install vite-plugin-css-module-dts -D
```

## Usage

```ts
import { defineConfig } from 'vite'
import cssModuleDtsPlugin from 'vite-plugin-css-module-dts'

const config = defineConfig({
  css: {
    devSourcemap: true, // enable css sourcemap to generate source file comment with line number
  },
  plugins: [
    cssModuleDtsPlugin({
      dtsOutputDir: 'css-modules-dts', // this is default value
    }),
  ],
})

export default config
```
