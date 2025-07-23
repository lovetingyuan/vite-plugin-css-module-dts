## vite-plugin-css-module-dts

A Vite plugin that automatically generates TypeScript type declaration files for CSS Modules.

### Install

```sh
npm install vite-plugin-css-module-dts -D
```

## Usage

#### vite.config.ts

```ts
import { defineConfig } from 'vite'
import cssModuleDtsPlugin from 'vite-plugin-css-module-dts'

const config = defineConfig({
  css: {
    devSourcemap: true, // enable css sourcemap to generate source file comment with line number
  },
  plugins: [
    cssModuleDtsPlugin({
      dtsOutputDir: 'css-module-types', // this is default value
    }),
  ],
})

export default config
```

#### tsconfig.json

```json
{
  "compilerOptions": {
    // specify rootDirs to help TypeScript automatically perform path mapping for type files.
    "rootDirs": ["src", "css-module-types/src"]
    // ... other options
  },
  "include": ["src"]
}
```

## Example

css module:

```css
/** style.module.css */
.foo {
  color: red;
}

.fooBar {
  font-size: 14px;
}
```

generated dts:

```ts
declare const styles: {
  /** [style.module.css]/project-root/style.module.css#L2 */
  readonly foo: string
  /** [style.module.css]/project-root/style.module.css#L6 */
  readonly fooBar: string
}
```

```ts
import styles from './style.module.css'
/**
 * styles type: {
 *   readonly foo: string
 *   readonly fooBar: string
 * }
 */
```

![hover tooltip](./example.png)
