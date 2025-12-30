# IBM Plex Font Setup Guide

This guide will help you complete the IBM Plex Sans font installation for the Hyle application.

## ✅ What's Already Done

The font system has been fully configured:
- ✓ Directory structure created (`src/assets/fonts/`)
- ✓ CSS `@font-face` declarations written (`src/styles/fonts.css`)
- ✓ Global font application configured
- ✓ Font imports added to `src/index.css`
- ✓ Download scripts created

## 📦 What You Need to Do

Download the font files using one of the methods below.

---

## Method 1: Automatic Download (Recommended)

Run the download script:

```bash
npm run fonts:download
```

This will automatically download all required font files from the official IBM Plex npm package.

---

## Method 2: Manual Download Links

If the automatic download doesn't work, download each file manually:

### IBM Plex Sans (Primary UI Font)

Download these 4 files and place them in `src/assets/fonts/ibm-plex-sans/`:

1. **Regular (400)**
   - [IBMPlexSans-Regular.woff2](https://unpkg.com/@ibm/plex@6.4.1/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-Regular.woff2)

2. **Medium (500)**
   - [IBMPlexSans-Medium.woff2](https://unpkg.com/@ibm/plex@6.4.1/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-Medium.woff2)

3. **SemiBold (600)**
   - [IBMPlexSans-SemiBold.woff2](https://unpkg.com/@ibm/plex@6.4.1/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-SemiBold.woff2)

4. **Bold (700)**
   - [IBMPlexSans-Bold.woff2](https://unpkg.com/@ibm/plex@6.4.1/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-Bold.woff2)

### IBM Plex Mono (Code & Data Font)

Download these 4 files and place them in `src/assets/fonts/ibm-plex-mono/`:

1. **Regular (400)**
   - [IBMPlexMono-Regular.woff2](https://unpkg.com/@ibm/plex@6.4.1/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-Regular.woff2)

2. **Medium (500)**
   - [IBMPlexMono-Medium.woff2](https://unpkg.com/@ibm/plex@6.4.1/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-Medium.woff2)

3. **SemiBold (600)**
   - [IBMPlexMono-SemiBold.woff2](https://unpkg.com/@ibm/plex@6.4.1/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-SemiBold.woff2)

4. **Bold (700)**
   - [IBMPlexMono-Bold.woff2](https://unpkg.com/@ibm/plex@6.4.1/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-Bold.woff2)

---

## Method 3: Using curl/wget

If you prefer command line:

```bash
# IBM Plex Sans
cd src/assets/fonts/ibm-plex-sans
curl -O https://unpkg.com/@ibm/plex@6.4.1/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-Regular.woff2
curl -O https://unpkg.com/@ibm/plex@6.4.1/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-Medium.woff2
curl -O https://unpkg.com/@ibm/plex@6.4.1/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-SemiBold.woff2
curl -O https://unpkg.com/@ibm/plex@6.4.1/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-Bold.woff2

# IBM Plex Mono
cd ../ibm-plex-mono
curl -O https://unpkg.com/@ibm/plex@6.4.1/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-Regular.woff2
curl -O https://unpkg.com/@ibm/plex@6.4.1/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-Medium.woff2
curl -O https://unpkg.com/@ibm/plex@6.4.1/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-SemiBold.woff2
curl -O https://unpkg.com/@ibm/plex@6.4.1/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-Bold.woff2
```

---

## Method 4: GitHub Release

Download the complete font package from the official IBM Plex repository:

1. Go to: https://github.com/IBM/plex/releases
2. Download the latest release ZIP
3. Extract `IBM-Plex-Sans/fonts/complete/woff2/` files to `src/assets/fonts/ibm-plex-sans/`
4. Extract `IBM-Plex-Mono/fonts/complete/woff2/` files to `src/assets/fonts/ibm-plex-mono/`

---

## 🔍 Verify Installation

After downloading, verify the files are in place:

```bash
ls -lh src/assets/fonts/ibm-plex-sans/
ls -lh src/assets/fonts/ibm-plex-mono/
```

You should see 8 `.woff2` files total (4 per directory).

Expected file sizes:
- IBM Plex Sans files: ~40-60 KB each
- IBM Plex Mono files: ~30-50 KB each

---

## 🎨 Font Stack Details

Once installed, your app will use:

**Primary Font (UI):**
```
'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI',
'Helvetica Neue', Arial, sans-serif
```

**Monospace Font (Code):**
```
'IBM Plex Mono', 'SF Mono', Monaco, 'Cascadia Code',
'Roboto Mono', Consolas, 'Courier New', monospace
```

---

## 🚀 Testing

After downloading the fonts, start the dev server:

```bash
npm run dev
```

The app will now use IBM Plex Sans for all UI elements and IBM Plex Mono for code blocks.

---

## ⚙️ Technical Details

- **Font Format:** WOFF2 (modern, compressed, excellent browser support)
- **Font Location:** `src/assets/fonts/`
- **Font Declarations:** `src/styles/fonts.css`
- **Import Location:** `src/index.css:2`
- **Offline Capable:** ✓ Yes (no CDN dependencies)
- **Privacy:** ✓ No external requests
- **License:** SIL Open Font License 1.1

---

## 🔧 Troubleshooting

**Fonts not loading?**
1. Check browser DevTools Network tab for 404 errors
2. Verify file paths match exactly (case-sensitive)
3. Clear browser cache and hard reload (Cmd+Shift+R / Ctrl+Shift+F5)
4. Check file sizes aren't 0 bytes

**Want to use only IBM Plex Sans (skip Mono)?**
- Just download the IBM Plex Sans fonts
- IBM Plex Mono is optional for code blocks

**Need italic styles?**
- The current setup uses Regular/Medium/SemiBold/Bold
- Add italic styles by downloading additional `.woff2` files and adding `@font-face` declarations to `fonts.css`

---

## 📚 Resources

- **IBM Plex GitHub:** https://github.com/IBM/plex
- **IBM Plex Specimen:** https://www.ibm.com/plex/
- **npm Package:** https://www.npmjs.com/package/@ibm/plex
- **License:** https://github.com/IBM/plex/blob/master/LICENSE.txt

---

**Need help?** Check `src/assets/fonts/README.md` for additional information.
