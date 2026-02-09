# IBM Plex Font Setup

This project uses **IBM Plex Sans** as the primary typeface, installed via the official npm package.

## ✅ Automatic Installation

The fonts are installed automatically when you run:

```bash
npm install
```

The `@ibm/plex` package is listed in `package.json` as a dev dependency, and Vite will automatically bundle the required font files with your application.

## 📦 What's Included

### IBM Plex Sans (Primary UI Font)

Used for all user interface elements: buttons, headings, paragraphs, labels, etc.

**Font Weights:**

- Regular (400)
- Medium (500)
- SemiBold (600)
- Bold (700)

### IBM Plex Mono (Code & Data Font)

Used for code blocks, data tables, and numeric data.

**Font Weights:**

- Regular (400)
- Medium (500)
- SemiBold (600)
- Bold (700)

## 🎨 Font Stack

The application uses the following font stacks with system font fallbacks:

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

## 🚀 Usage

The fonts are automatically applied globally via `src/styles/fonts.css`:

```css
body {
  font-family:
    'IBM Plex Sans',
    -apple-system,
    BlinkMacSystemFont,
    ...;
}

code,
pre,
kbd,
samp {
  font-family: 'IBM Plex Mono', 'SF Mono', Monaco, ...;
}
```

No additional configuration needed!

## 📁 Implementation Details

- **Package:** `@ibm/plex@6.4.1` (installed via npm)
- **Font Declarations:** `src/styles/fonts.css`
- **Import Location:** `src/index.css` (line 2)
- **Format:** WOFF2 (modern, compressed, excellent browser support)
- **Bundle Size:** ~300-400KB total (all 8 font files)

## ✨ Benefits

- **License Compliant:** Uses official IBM Plex npm package under SIL OFL 1.1
- **Privacy:** No external CDN calls, fonts bundled with your app
- **Offline Capable:** Works without internet connection
- **Automatic Updates:** Update font version via `npm update @ibm/plex`
- **Build Optimization:** Vite automatically optimizes font loading

## 📚 Resources

- **Official Package:** https://www.npmjs.com/package/@ibm/plex
- **GitHub Repository:** https://github.com/IBM/plex
- **IBM Plex Specimen:** https://www.ibm.com/plex/
- **License (SIL OFL 1.1):** https://github.com/IBM/plex/blob/master/LICENSE.txt

## 🔧 Troubleshooting

**Fonts not loading?**

1. Ensure `npm install` completed successfully
2. Check that `@ibm/plex` appears in `node_modules/`
3. Clear browser cache (Cmd+Shift+R / Ctrl+Shift+F5)
4. Check browser DevTools Network tab for font file 404s

**Want to add italic styles?**

1. Add additional `@font-face` declarations in `src/styles/fonts.css`
2. Point to italic font files from `@ibm/plex` package
3. Example: `url('@ibm/plex/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-Italic.woff2')`

---

**That's it!** Just run `npm install` and the fonts work automatically. 🎉
