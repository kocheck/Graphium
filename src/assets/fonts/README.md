# IBM Plex Fonts

This directory is **reserved for custom fonts** if needed in the future.

## Current Font Setup

IBM Plex fonts are automatically installed via the **`@ibm/plex` npm package** and loaded directly from `node_modules/`.

### No Manual Files Needed

You don't need to place any font files in this directory. The fonts are:

- Installed automatically via `npm install`
- Loaded from `node_modules/@ibm/plex/`
- Bundled automatically by Vite during build

### Implementation

Font declarations are in:

- **File:** `src/styles/fonts.css`
- **Paths:** Point to `@ibm/plex/IBM-Plex-Sans/fonts/complete/woff2/...`
- **Import:** Loaded via `src/index.css`

## Adding Custom Fonts

If you need to add custom fonts (not from npm packages):

1. Place font files in this directory
2. Add `@font-face` declarations to `src/styles/fonts.css`
3. Reference them with relative paths: `url('../assets/fonts/YourFont.woff2')`

## License

IBM Plex is licensed under the **SIL Open Font License 1.1**

- Official package: https://www.npmjs.com/package/@ibm/plex
- License: https://github.com/IBM/plex/blob/master/LICENSE.txt
