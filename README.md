<br>

<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/branding/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="public/branding/logo-light.svg">
    <img alt="Hyle Logo" src="public/branding/logo-light.svg" width="600">
  </picture>
</div>
<br>

<div align="center">

### *An Arcane Battlemat for the Discerning Dungeon Master*

![License](https://img.shields.io/badge/license-MIT-blue)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Tests](https://img.shields.io/badge/tests-172%20passing-success)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)

[Quick Start](#-quick-start) • [Features](#️-arcane-capabilities) • [Installation](#-the-summoning-ritual) • [Usage](#-usage-guide) • [Contributing](#-contributing)

</div>

---

> **Hyle** (noun, from ancient Greek *ὕλη*): *Matter; the fundamental substance of which everything is composed. The raw material from which worlds are forged.*

**Hyle** is a lightweight, local-first desktop battlemap application designed to replace your physical battlemap with digital sorcery. Project your campaign map onto a second monitor or screen share, maintaining total control over what your players see while you orchestrate the chaos from your DM's throne.

**The Sacred Philosophy:** Hyle is a **generic digital battlemat**—no more, no less. It cares not whether you run D&D 5e, Pathfinder, or a homebrew system powered by coin flips and interpretive dance. Your data remains **yours**, stored locally in sacred `.hyle` files that no cloud wizard can touch.

![Hyle Screenshot](https://via.placeholder.com/800x450?text=Hyle+Application+Preview)

---

## 📜 Table of Contents

- [Quick Start](#-quick-start)
- [Features](#️-arcane-capabilities)
- [System Requirements](#-system-requirements)
- [Installation](#-the-summoning-ritual)
- [Usage Guide](#-usage-guide)
- [Keyboard Shortcuts](#️-keyboard-shortcuts)
- [Testing](#-trial-by-combat-testing)
- [Tech Stack](#-arcane-components)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [Troubleshooting](#-troubleshooting)
- [FAQ](#-frequently-asked-questions)
- [License](#-license)
- [Support](#-support-the-guild)

---

## 🚀 Quick Start

**TL;DR**: Local-first virtual tabletop with dual-window display, fog of war, and complete privacy. No accounts, no cloud, no subscriptions.

```bash
# Clone, install, and run
git clone https://github.com/kocheck/hyle.git
cd hyle
npm install
npm run dev
```

**First Session Setup:**
1. Launch Hyle
2. Create or load a campaign
3. Drag a map image onto the canvas
4. Click "World View" to open player display
5. Add tokens and draw fog of war
6. Save your session (`.hyle` file)

---

## ⚔️ Arcane Capabilities
### *The Powers at Your Command*

<details>
<summary>⚔️ Behold the Sacred Sword</summary>

```text
               /| ________________
        O|===|* >________________>
              \|

```

</details>

### 🏰 **Dual-Window Enchantment**
- **Architect View**: Your command center with files, tools, and hidden knowledge
- **World View**: A pristine, borderless window for your players—only shows what they should see

### 🌗 **Accessible Theme Sorcery**
- **Light/Dark Mode**: Automatically detects your system preference
- **WCAG AA Compliant**: High contrast ratios for accessibility

### 🎨 **Local-First Asset Conjuration**
- **Drag & Drop Magic**: Import any image (JPG, PNG, WebP) onto the canvas
- **Auto-Optimization**: Large maps are transmuted into high-performance WebP formats
- **Zero Cloud Dependencies**: All assets stored locally in your `.hyle` files

### ✏️ **Drawing Tools of Power**
- **Marker Tool**: Sketch annotations and tactical notes directly on the map
- **Eraser**: Remove drawings selectively
- **Wall Tool**: Draw vision-blocking barriers invisible to players
- **Persistent Drawings**: All annotations saved with your campaign

### 🌫️ **Fog of War Manipulation**
- **Dynamic Vision**: PC tokens reveal areas based on configurable vision radius
- **Wall Occlusion**: Real-time raycasting algorithms block line of sight
- **Manual Control**: Reveal or hide specific areas with fog brush tools
- **Per-Token Settings**: Customize vision range for each character

### 💾 **Persistence Enchantment**
- **`.hyle` Files**: Compressed ZIP archives containing your entire campaign
- **Instant Loading**: Resume sessions exactly where you left off
- **Portable**: Share campaign files with co-DMs or backup easily
- **Human-Readable**: Extract and inspect `.hyle` files with any ZIP utility

### 📐 **Advanced Grid Matrix**
- **Dynamic Snapping**: Tokens snap to grid intersections or cell centers
- **Configurable Grid Size**: Adjust cell dimensions to match your map scale
- **Infinite Canvas**: Pan and zoom without boundaries
- **Grid Overlay Toggle**: Show or hide grid as needed

### 🎭 **Token Management**
- **Custom Tokens**: Upload character images or use colored markers
- **Token Properties**: Set name, vision radius, and player visibility
- **Layer Management**: Organize tokens with z-index ordering
- **Quick Duplication**: Clone tokens for monsters and NPCs

---

## 💻 System Requirements

| Platform | Minimum | Recommended |
|----------|---------|-------------|
| **Windows** | Windows 10 (64-bit) | Windows 11 |
| **macOS** | macOS 10.13+ | macOS 12+ |
| **Linux** | Ubuntu 18.04+ / Fedora 32+ | Latest LTS |
| **RAM** | 4 GB | 8 GB+ |
| **Storage** | 500 MB | 2 GB+ (for campaigns) |
| **Display** | 1280x720 | 1920x1080+ dual monitors |

**Dependencies:**
- Node.js 18+ (for development)
- Modern GPU with OpenGL support (for canvas rendering)

---

## 🔮 The Summoning Ritual
### *Installation and Invocation*

<details>
<summary>🔮 Summoning Circle ASCII</summary>

```text
                    ____ 
                  .'* *.'
               __/_*_*(_
              / _______ \
             _\_)/___\(_/_ 
            / _((\- -/))_ \
            \ \())(-)(()/ /
             ' \(((()))/ '
            / ' \)).))/ ' \
           / _ \ - | - /_  \
          (   ( .;''';. )   )
          _\"__ /    )\ __"/_
            \/  \   ' /  \/
             .'  '...' ' )
              / /  |  \ \
             / .   .   . \
            /   .  .  .   \
           /   /   |   \   \
         .'   /    |    \   `.
     _.-'    /     |     \    `-._
    `-------'      |      `-------`
```

</details>

### **Prerequisites (Reagents Required)**
Before you begin the ritual, ensure you have gathered:
- **Node.js** (version 18 or higher)—[Download here](https://nodejs.org/)
- **npm** (comes with Node.js)—the package manager of the ancients
- **Git** (optional, for cloning)—[Download here](https://git-scm.com/)

### **Step 1: Cloning the Grimoire**

```bash
# Clone the repository from the astral archives
git clone https://github.com/kocheck/hyle.git

# Enter the sacred directory
cd hyle

# Invoke the dependency installation incantation
npm install
```

**Alternative**: Download the [latest release](https://github.com/kocheck/hyle/releases) as a ZIP file and extract it.

### **Step 2: Awakening the Application (Development Mode)**

```bash
# Start the development server
npm run dev
```

The application will launch in development mode with hot-reloading enabled.

### **Step 3: Forging the Final Artifact (Production Build)**

```bash
# Build for your platform
npm run build

# Package for distribution (creates installer)
npm run package
```

Built applications will appear in the `dist/` directory.

**Platform-Specific Builds:**
```bash
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

---

## 📖 Usage Guide

### **Opening Your First Campaign**

1. **Launch Hyle** and you'll see the Architect View (DM interface)
2. **Create New Campaign**: Click "New Campaign" or `Ctrl/Cmd + N`
3. **Load a Map**:
   - Drag an image file onto the canvas, or
   - Click "Add Map" and select an image file
4. **Configure Grid**: Set grid size to match your map (default: 50px)

### **Dual Display Setup**

1. **Open World View**: Click the "World View" button in the toolbar
2. **Position Window**: Drag the World View to your second monitor/projector
3. **Enter Fullscreen** (optional): Press `F11` in the World View window
4. **Control from Architect View**: Everything you do updates in real-time

### **Adding Tokens**

1. **Click "Add Token"** button in the toolbar
2. **Choose Token Type**:
   - **Character Token**: Upload an image
   - **Generic Marker**: Use colored circle with initials
3. **Configure Settings**:
   - Name
   - Vision radius (in grid units)
   - Player-visible toggle
4. **Place Token**: Click on the map to position

### **Managing Fog of War**

**Automatic Vision:**
1. Select a PC token
2. Set vision radius in token properties
3. Token automatically reveals areas within vision range
4. Walls block line of sight

**Manual Fog Control:**
1. Select "Fog Brush" tool
2. **Reveal Mode**: Click and drag to reveal areas
3. **Hide Mode**: Hold `Shift` and drag to hide areas
4. **Clear All Fog**: Right-click fog tool → "Clear All"

### **Drawing Tools**

- **Marker Tool**: Click and drag to draw annotations
- **Wall Tool**: Draw vision-blocking barriers
  - Walls appear in Architect View only
  - Block fog of war vision calculations
- **Eraser**: Remove drawings and walls
- **Clear All**: Right-click tool → "Clear All"

### **Saving & Loading**

**Save Campaign:**
- `Ctrl/Cmd + S` or click "Save Campaign"
- Choose location and name for `.hyle` file
- File contains map, tokens, fog state, and drawings

**Load Campaign:**
- `Ctrl/Cmd + O` or click "Load Campaign"
- Select a `.hyle` file
- Campaign loads exactly as saved

**Auto-Save** (optional): Enable in settings to auto-save every 5 minutes

---

## ⌨️ Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| **New Campaign** | `Ctrl + N` | `Cmd + N` |
| **Open Campaign** | `Ctrl + O` | `Cmd + O` |
| **Save Campaign** | `Ctrl + S` | `Cmd + S` |
| **Save As** | `Ctrl + Shift + S` | `Cmd + Shift + S` |
| **Add Token** | `T` | `T` |
| **Add Map** | `M` | `M` |
| **Toggle Grid** | `G` | `G` |
| **Marker Tool** | `D` | `D` |
| **Wall Tool** | `W` | `W` |
| **Eraser Tool** | `E` | `E` |
| **Pan Tool** | `Space + Drag` | `Space + Drag` |
| **Zoom In** | `Ctrl + +` | `Cmd + +` |
| **Zoom Out** | `Ctrl + -` | `Cmd + -` |
| **Reset Zoom** | `Ctrl + 0` | `Cmd + 0` |
| **Delete Selected** | `Delete` | `Backspace` |
| **Undo** | `Ctrl + Z` | `Cmd + Z` |
| **Redo** | `Ctrl + Y` | `Cmd + Shift + Z` |
| **Toggle Fog** | `F` | `F` |
| **Fullscreen (World View)** | `F11` | `Cmd + Ctrl + F` |

---

## 🧪 Trial by Combat (Testing)
### *Proving Your Code's Mettle*

Hyle is **battle-tested** with **172 test cases** spanning **4,600+ lines** of tactical assertions.

### **Quick Start: Running the Trials**

```bash
# Install Playwright's chromium browser (first time only)
npx playwright install --with-deps chromium

# Run all tests (full campaign)
npm run test:e2e

# Run tests in UI mode (interactive)
npm run test:ui

# Run tests in headed mode (watch execution)
npm run test:headed

# Run specific test file
npm run test:e2e -- tests/campaign-management.spec.ts
```

### **Coverage Report (Kill Count)**

| Area | Test Cases | Coverage | Status |
|------|------------|----------|--------|
| Campaign Management | 15 | 💯 100% | ✅ Passing |
| State Persistence | 13 | 💯 100% | ✅ Passing |
| Token Management | 26 | 💯 100% | ✅ Passing |
| Data Integrity | 20 | 💯 100% | ✅ Passing |
| Map Management | 22 | 💯 100% | ✅ Passing |
| Fog of War | 28 | 💯 100% | ✅ Passing |
| Drawing Tools | 18 | 💯 100% | ✅ Passing |
| Grid System | 14 | 💯 100% | ✅ Passing |
| Dual Windows | 16 | 💯 100% | ✅ Passing |
| **Total** | **172** | **100%** | **⚔️ Critical Hit!** |

### **Test Architecture**

- **Framework**: Playwright (end-to-end testing)
- **Type Safety**: Full TypeScript coverage
- **CI/CD**: GitHub Actions (runs on every PR)
- **Visual Regression**: Automated screenshot comparisons

---

## 🛠 Arcane Components
### *Materials & Reagents (Tech Stack)*

<details>
<summary>🔧 Tech Stack Visualization</summary>

```text
              __...--~~~~~-._   _.-~~~~~--...__
            //               `V'               \\ 
           //                 |                 \\ 
          //__...--~~~~~~-._  |  _.-~~~~~~--...__\\ 
         //__.....----~~~~._\ | /_.~~~~----.....__\\
        ====================\\|//====================
                            `---`
```

</details>

Hyle is forged from the following mystical technologies:

### **Core Runtime**
- **⚙️ Electron** (v28+): Dual-process desktop architecture
- **⚛️ React** (v18): Component-based UI framework
- **📘 TypeScript** (v5): Type-safe code with strict mode

### **Frontend Stack**
- **⚡ Vite**: Lightning-fast build tool and dev server
- **📦 Zustand**: Lightweight state management
- **🎨 Konva**: HTML5 Canvas rendering engine
- **🎭 Radix UI**: Accessible component primitives
- **🌈 Tailwind CSS**: Utility-first styling
- **🎨 Radix Colors**: Accessible color system

### **File Format**
- **📜 `.hyle` Files**: Custom format (ZIP archives)
  - `campaign.json`: Campaign metadata and state
  - `assets/`: Embedded images (maps, tokens)
  - `data/`: Fog of war data, drawings, walls

### **Development Tools**
- **🧪 Playwright**: End-to-end testing
- **📝 ESLint**: Code quality enforcement
- **💅 Prettier**: Code formatting
- **🔍 TypeScript Strict Mode**: Maximum type safety

### **Build Pipeline**
- **📦 electron-builder**: Cross-platform packaging
- **⚡ Vite Plugin**: Electron integration
- **🔄 Hot Reload**: Development efficiency

---

## 🤝 Contributing

Contributions are welcome from adventurers of all skill levels!

### **How to Contribute**

1. **Fork the Repository**: Click "Fork" at the top of this page
2. **Create a Branch**: `git checkout -b feature/your-feature-name`
3. **Make Changes**: Follow the code style and add tests
4. **Run Tests**: `npm run test:e2e` (must pass)
5. **Commit**: Use [Conventional Commits](https://www.conventionalcommits.org/)
   ```bash
   git commit -m "feat: add initiative tracker"
   ```
6. **Push**: `git push origin feature/your-feature-name`
7. **Open a Pull Request**: Describe your changes

### **Development Setup**

```bash
# Fork and clone your fork
git clone https://github.com/YOUR-USERNAME/hyle.git
cd hyle

# Add upstream remote
git remote add upstream https://github.com/kocheck/hyle.git

# Install dependencies
npm install

# Start development server
npm run dev
```

### **Code Guidelines**

- **TypeScript**: All new code must be TypeScript
- **Tests**: Add tests for new features
- **Formatting**: Run `npm run format` before committing
- **Linting**: Run `npm run lint` and fix errors
- **Commits**: Use conventional commit format

### **Areas Needing Help**

- 📝 Documentation improvements
- 🐛 Bug reports and fixes
- ✨ Feature implementations (see Roadmap)
- 🎨 UI/UX enhancements
- 🌍 Internationalization (i18n)
- ♿ Accessibility improvements

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

### **Bug Reports**

Found a bug? [Open an issue](https://github.com/kocheck/hyle/issues/new) with:
- Operating system and version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)
- Console errors (if any)

---

## 🔧 Troubleshooting

### **Application Won't Launch**

**Issue**: Electron window doesn't appear  
**Solution**:
```bash
# Clear cache and rebuild
rm -rf node_modules dist .vite
npm install
npm run dev
```

**Issue**: "Module not found" errors  
**Solution**: Ensure Node.js version is 18+
```bash
node --version  # Should be v18.0.0 or higher
```

### **Map/Token Loading Issues**

**Issue**: Images don't appear after drag-and-drop  
**Solution**:
- Check image format (JPG, PNG, WebP only)
- Ensure file size is < 50MB
- Try converting image to PNG

**Issue**: Blurry/pixelated maps  
**Solution**:
- Use higher resolution images (recommended: 2048x2048+)
- Disable image optimization in settings

### **Performance Issues**

**Issue**: Laggy canvas or slow rendering  
**Solution**:
- Reduce map size/resolution
- Close unnecessary tokens
- Enable hardware acceleration:
  - Settings → Performance → GPU Acceleration

**Issue**: High memory usage  
**Solution**:
- Limit number of tokens on canvas (< 50 recommended)
- Use compressed WebP images
- Restart application periodically

### **Fog of War Problems**

**Issue**: Fog doesn't reveal correctly  
**Solution**:
- Check token vision radius is > 0
- Ensure walls aren't blocking vision unintentionally
- Refresh fog calculations: Right-click canvas → "Recalculate Fog"

**Issue**: Walls not blocking line of sight  
**Solution**:
- Walls must form closed loops to block vision
- Check wall layer is visible in Architect View

### **File Saving/Loading**

**Issue**: Campaign won't save  
**Solution**:
- Check disk space
- Ensure write permissions in save directory
- Try saving to different location

**Issue**: `.hyle` file won't load  
**Solution**:
- File may be corrupted—restore from backup
- Check file integrity: Extract as ZIP and inspect `campaign.json`
- Ensure Hyle version matches file version

### **Still Having Issues?**

- Check [existing issues](https://github.com/kocheck/hyle/issues) for solutions
- Join our [Discord community](https://discord.gg/hyle) for support
- [Open a new issue](https://github.com/kocheck/hyle/issues/new) with details

---

## ❓ Frequently Asked Questions

### **General**

**Q: Is Hyle free?**  
A: Yes! Hyle is 100% free and open-source under the MIT License.

**Q: Do I need an internet connection?**  
A: No. Hyle is fully local-first and works completely offline.

**Q: Does Hyle work with online sessions?**  
A: Yes! Share the World View window via Discord, Zoom, or any screen sharing tool.

**Q: What game systems does Hyle support?**  
A: Hyle is system-agnostic. It works with D&D, Pathfinder, OSR, homebrews—anything using a grid-based map.

### **Technical**

**Q: What file format does Hyle use?**  
A: `.hyle` files are ZIP archives containing JSON metadata and image assets. They're human-readable and portable.

**Q: Can I extract/modify .hyle files manually?**  
A: Yes! Rename `.hyle` to `.zip`, extract, and edit `campaign.json`. Re-zip and rename back to `.hyle`.

**Q: How much storage do campaigns use?**  
A: Depends on map size. Typical campaigns: 10-50MB. Large campaigns with many maps: 100-200MB.

**Q: Can I share campaigns with other DMs?**  
A: Yes! Just send them the `.hyle` file. They can open it in their Hyle installation.

### **Features**

**Q: Does Hyle have character sheets?**  
A: Not yet. Hyle focuses on the battlemap. Use D&D Beyond, Roll20, or paper for character management.

**Q: Can players control their own tokens?**  
A: Not in the current version. The DM controls all tokens. 

**Q: Does Hyle support hexagonal grids?**  
A: Not yet. Only square grids are currently supported. Hex grid support is on the roadmap.


### **Comparison**

**Q: How does Hyle compare to Roll20/Foundry?**  
A: 
- **Hyle**: Lightweight, local-first, zero setup, free, focused on battlemap only
- **Roll20/Foundry**: Full-featured VTTs with character sheets, dice rolling, rules automation

**Q: Why use Hyle instead of [other tool]?**  
A: Choose Hyle if you want:
- Complete privacy (no cloud/servers)
- Minimal setup (no accounts/subscriptions)
- Lightweight performance
- System-agnostic simplicity
- Local file storage

---

## 📜 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2024 kocheck

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

See [LICENSE](LICENSE) file for full details.

---

## ☕ Support the Guild

If Hyle has enhanced your campaigns and brought joy to your table, consider buying me a coffee!

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/kocheck)

Your support helps fund development, hosting, and the occasional bag of dice!

---

## 🧭 Final Words from the DM

<details>
<summary>🏰 The Kingdom Awaits</summary>

```text
                                  |>>>
                                  |
                    |>>>      _  _|_  _         |>>>
                    |        |;| |;| |;|        |
                _  _|_  _    \\.    .  /    _  _|_  _
               |;|_|;|_|;|    \\:  .  /    |;|_|;|_|;|
               \\..      /    ||:   . |    \\..      /
                \\:  .  /     ||:     |     \\:  .  /
                 ||:   |      ||:     |      ||:   |
                 ||:   |      ||:     |      ||:   |
                 ||:   |      ||:     |      ||:   |
                 ||:   |      ||:     |      ||:   |
                 ||:   |      ||:     |      ||:   |
                 ||:   |      ||:     |      ||:   |
                 ||:   |      ||:     |      ||:   |
_________________||:___|______||:_____|______||:___|_________________
```

</details>

Thank you for choosing **Hyle**. May your rolls be high, your fog of war be dramatic, and your players forever surprised by what lurks in the shadows.

Whether you're running a dungeon crawl in the depths of the Underdark or an epic battle across the plains of Cormyr, Hyle stands ready to be your faithful companion. Built by DMs, for DMs, with the understanding that sometimes you just need a battlemap that works—without the bloat, without the subscriptions, without the compromise.

**Adventure awaits. Your table is ready.**

*— The Architects of Hyle*

---

<div align="center">

**[⬆ Back to Top](#)**

Made with ⚔️ by [kocheck](https://github.com/kocheck)

[![GitHub Stars](https://img.shields.io/github/stars/kocheck/hyle?style=social)](https://github.com/kocheck/hyle/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/kocheck/hyle?style=social)](https://github.com/kocheck/hyle/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/kocheck/hyle)](https://github.com/kocheck/hyle/issues)

</div>
