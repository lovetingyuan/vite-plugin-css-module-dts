# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run build       # Build with tsdown, outputs to dist/ with .d.ts declarations
npm publish         # Runs build first via prepublishOnly, then publishes to npm
```

No test suite is configured (`npm test` exits with error).

## Architecture

This is a two-file Vite plugin (`src/index.ts` + `src/sourcemap.ts`) that runs only during `serve` (dev mode, `apply: 'serve'`).

### How it works

1. **`transform` hook** intercepts `*.module.css` files after Vite processes them into JS modules.
2. The transformed JS code is dynamically imported via a `data:` URI to extract the CSS module's class-name-to-hash mapping (`style.default`).
3. If `css.devSourcemap` is enabled in the Vite config, `getInlineLineMappings()` (in `sourcemap.ts`) decodes the inline base64 sourcemap embedded in the compiled CSS to map each hashed class back to its original source line number.
4. `extractCssComments()` parses `/**` JSDoc-style comments from the raw CSS source, indexed by their ending line number, so they can be associated with the class selector on the next line.
5. A `.d.ts` file is written to `<dtsOutputDir>/<relative-path>.module.css.d.ts` with `readonly` properties, inline JSDoc comments containing the comment text and a `file://` link to the source line.

### Key design details

- The plugin only activates on `*.module.css` files; other CSS files are ignored.
- Source line links use `file:///` absolute paths so IDEs can navigate directly to the CSS source.
- The `dtsOutputDir` (default: `css-module-types`) must be added to `.gitignore` and configured as a `rootDirs` entry in `tsconfig.json` alongside `src` for TypeScript to resolve the generated types.
- `source-map` is a peer dependency (not bundled); consumers must install it alongside `vite`.
- Build tool: `tsdown` (not `tsc` or `vite build`). Output is ESM only (`"type": "module"`).
