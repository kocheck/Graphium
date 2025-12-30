# IBM Plex Fonts

This directory contains the IBM Plex font family files for the Hyle application.

## Font Families

### IBM Plex Sans (Primary UI Font)
- **Location:** `ibm-plex-sans/`
- **Usage:** All UI elements, buttons, paragraphs, headers
- **Weights Available:**
  - Regular (400)
  - Medium (500)
  - SemiBold (600)
  - Bold (700)

### IBM Plex Mono (Code & Data Font)
- **Location:** `ibm-plex-mono/`
- **Usage:** Code blocks, data tables, numeric data
- **Weights Available:**
  - Regular (400)
  - Medium (500)
  - SemiBold (600)
  - Bold (700)

## Installation

Run the download script from the project root:

```bash
./scripts/download-fonts.sh
```

This will download all required WOFF2 font files from the official IBM Plex npm package.

## Font Stack

The application uses the following font stacks:

**Primary (Sans-serif):**
```css
'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI',
'Helvetica Neue', Arial, sans-serif
```

**Monospace (Code):**
```css
'IBM Plex Mono', 'SF Mono', Monaco, 'Cascadia Code',
'Roboto Mono', Consolas, 'Courier New', monospace
```

## Benefits

- **Privacy:** No external CDN calls, all fonts served locally
- **Offline Capable:** Fonts work without internet connection
- **Performance:** WOFF2 format provides excellent compression
- **Consistency:** Technical, engineered aesthetic across the app

## Font Configuration

Font definitions are in `src/styles/fonts.css` and automatically imported via `src/index.css`.

## License

IBM Plex is licensed under the SIL Open Font License 1.1
https://github.com/IBM/plex
