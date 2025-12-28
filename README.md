```
╦ ╦╦ ╦╦  ╔═╗
╠═╣╚╦╝║  ║╣
╩ ╩ ╩ ╩═╝╚═╝
```
# **HYLE: World Given Form**
### *An Arcane Battlemat for the Discerning Dungeon Master*

---

> **Hyle** (noun, from ancient Greek *ὕλη*): *Matter; the fundamental substance of which everything is composed. The raw material from which worlds are forged.*

Greetings, Master of Dungeons! You hold in your hands the chronicle of **Hyle**, a lightweight, local-first desktop grimoire designed to replace your physical battlemap with the power of digital sorcery. Project your campaign map onto a second monitor or screen share, maintaining total control over what your players see while you orchestrate the chaos from your Architect's throne.

**The Sacred Philosophy:** Hyle is a **generic digital battlemat**—no more, no less. It cares not whether you run D&D 5e, Pathfinder, or a homebrew system powered by coin flips and interpretive dance. It handles **maps, tokens, and dynamic fog of war** without demanding tribute to corporate overlords. Your data remains **yours**, stored locally in sacred `.hyle` tomes that no cloud wizard can touch.

![Hyle Screenshot](https://via.placeholder.com/800x450?text=Hyle+Application+Preview)

---

## ⚔️ **Arcane Capabilities**
### *The Powers at Your Command*

- **🏰 Dual-Window Enchantment**:
  - **Architect View**: Your command center. Files, tools, hidden knowledge—this is your war room.
  - **World View**: A pristine, borderless window for your players. Drag it to a projector or second display and watch their faces light up as the map materializes before them.

- **🌗 Accessible Theme Sorcery**:
  - **Light/Dark Mode**: Automatically detects your system preference, but you can override it with a flick of the View menu.
  - **WCAG AA Compliant**: Every piece of text meets accessibility standards—because even evil wizards need good contrast ratios.
  - **Persistent Preferences**: Your theme choice is etched into local storage and restored when you next summon the app.
  - **No Flash**: FOUC prevention ensures your theme loads smoothly, like a well-cast *Prestidigitation*.

- **🎨 Local-First Asset Conjuration**:
  - **Drag & Drop Magic**: Hurl any image (JPG, PNG) onto the canvas and watch it materialize.
  - **Auto-Optimization**: Large maps are automatically transmuted into high-performance WebP formats, compressed and optimized like a *Reduce* spell.
  - **Cropping Ritual**: Built-in UI to crop and zoom tokens before they join your campaign.

- **✏️ Drawing Tools of Power**:
  - **Marker & Eraser**: Sketch annotations and tactical notes. Hold Shift to lock your strokes to horizontal or vertical axes—perfect for drawing dungeon corridors.
  - **Wall Tool**: Draw vision-blocking barriers invisible to players but shown as dashed red lines in your DM view. They'll never see that ambush coming.

- **🌫️ Fog of War Manipulation**:
  - **Dynamic Vision**: PC tokens reveal areas based on configurable vision radius. Darkvision? Torchlight? You control it all.
  - **Blurred Aesthetic**: Instead of solid black occlusion, unseen areas are blurred and darkened—preserving context while obscuring details.
  - **Wall Occlusion**: Walls block line of sight using a real-time raycasting algorithm. It's geometry, but cooler.
  - **Token Inspector**: Edit token properties (name, type, vision radius) directly in the DM view.

- **💾 Persistence Enchantment**:
  - Save your entire session to a **`.hyle` file** (a compressed ZIP archive containing your scene and assets). Load it back instantly during your next session. No spell slots required.

- **📐 Advanced Grid Matrix**:
  - **Dynamic Snapping**: Tokens snap to grid intersections (for Large 2×2 creatures) or cell centers (for Medium 1×1 heroes).
  - **Infinite Grid**: The grid stretches to the horizon and only renders what's visible—because rendering infinity is bad for frame rates.
  - **Visual Modes**: Toggle between Lines, Dots, or Hidden grid styles.
  - **Theme-Aware**: Grid colors automatically adapt to light/dark mode.

- **🗺️ Smart Map Manipulation**:
  - **Auto-Center**: Camera automatically focuses on newly loaded maps.
  - **Center on Party**: One-click button to frame all PC tokens in view. Never lose your party again (at least not on the map).
  - **Calibration Rite**: Interactive "Draw to Calibrate" tool to align your map's grid with pixel-perfect precision.
  - **Viewport Constraints**: Prevents the camera from drifting into the Astral Plane (the void outside your map).

- **⌨️ Incantations (Keyboard Shortcuts)**:
  - `V`: Select Tool
  - `M`: Marker Tool
  - `E`: Eraser Tool
  - `W`: Wall Tool (vision blocking)
  - `I`: Color Picker
  - `Shift` (while drawing): Lock axis (horizontal/vertical only)

---

## 🔮 **The Summoning Ritual**
### *Installation and Invocation*

### **Prerequisites (Reagents Required)**
Before you begin the ritual, ensure you have gathered:
- **Node.js** (version 18 or higher)—the primordial runtime
- **npm**—the package manager of the ancients

### **Step 1: Cloning the Grimoire**

Open your terminal (also known as your "scrying window") and speak these words:

```bash
# Clone the repository from the astral archives
git clone https://github.com/your-username/hyle.git

# Enter the sacred directory
cd hyle

# Invoke the dependency installation incantation
npm install
```

### **Step 2: Awakening the Application (Development Mode)**

To summon Hyle in its raw, untamed form:

```bash
npm run dev
```

This launches the Electron application in **development mode**. The app will manifest before you, ready to serve.

### **Step 3: Forging the Final Artifact (Production Build)**

When you're ready to create a standalone executable for distribution to your fellow DMs:

```bash
npm run build
```

This ritual will generate an installer or executable for your operating system, deposited into the `dist/` or `release/` folder. Distribute it to your party members and let them marvel at your generosity.

---

## 🧪 **Trial by Combat (Testing)**
### *Proving Your Code's Mettle*

Hyle doesn't just *work*—it has been **battle-tested** with comprehensive end-to-end coverage using **Playwright**. We're talking **172 test cases** spanning **4,600+ lines** of tactical assertions.

### **Quick Start: Running the Trials**

```bash
# First time only: Install Playwright's chromium browser
npx playwright install --with-deps chromium

# Run all tests (full campaign)
npm run test:e2e

# Run specific test suites (pick your battleground)
npm run test:e2e:web          # Web tests only
npm run test:e2e:electron     # Electron tests only
npm run test:e2e:functional   # Functional tests only

# Interactive UI mode (recommended for debugging)
npm run test:e2e:ui

# Debug mode (step through tests like a careful rogue)
npm run test:e2e:debug
```

### **Coverage Report (Kill Count)**

| Area | Test Cases | Coverage |
|------|------------|----------|
| Campaign Management | 15 | 💯 100% |
| State Persistence | 13 | 💯 100% |
| Token Management | 26 | 💯 100% |
| Data Integrity | 20 | 💯 100% |
| Map Management | 22 | 💯 100% |
| Token Library | 24 | 💯 100% |
| Error Handling | 18 | 💯 100% |
| Electron (Startup/IPC) | 34 | 💯 100% |

**Total Test Cases**: 172
**Total Coverage**: 💯 **Critical Hit!**

### **CI/CD Garrison (Continuous Defense)**

**Current Configuration:** Hybrid (Local + CI Safety Net)
- ✅ Tests run locally via **pre-push hook** (fast feedback before you commit to the charge)
- ✅ CI runs on `main` branch after merge (safety net for catastrophic failures)
- ✅ **Low cost**: ~180-900 GitHub Actions minutes/month (cheaper than hiring a familiar)

**Want a different battle strategy?**
- **Full CI with PR blocking**: See [`docs/ENABLE_CI_TESTING.md`](docs/ENABLE_CI_TESTING.md)
- **Local-only (zero CI cost)**: See [`docs/LOCAL_TESTING_WORKFLOW.md`](docs/LOCAL_TESTING_WORKFLOW.md)
- **Current hybrid approach**: See [`docs/HYBRID_TESTING_WORKFLOW.md`](docs/HYBRID_TESTING_WORKFLOW.md)

### **For Contributors (Joining the Party)**

**Before pushing code:**
```bash
# Tests run automatically via pre-push hook
git push
# → Tests execute → If they pass, your push succeeds
```

**To skip tests (emergency extraction only):**
```bash
git push --no-verify  # Use sparingly—like a Wish spell
```

### **Test Scrolls (Documentation)**

- **[Testing Strategy](TESTING_STRATEGY.md)** - Comprehensive testing philosophy and patterns
- **[Tests README](tests/README.md)** - Detailed guide for writing and debugging tests

---

## 🛠 **Arcane Components**
### *Materials & Reagents (Tech Stack)*

Hyle is forged from the following mystical technologies:

- **⚙️ Runtime**: Electron (Dual-process architecture—main and renderer)
- **⚛️ Frontend**: React, Vite, TypeScript
- **📦 State Management**: Zustand (simple, elegant, powerful)
- **🎨 Rendering Engine**: HTML5 Canvas powered by **Konva** / **React-Konva**
- **🎭 Styling**: Tailwind CSS + Radix Colors (theme system)
- **💾 Persistence Layer**: electron-store (theme preferences)
- **♿ Accessibility**: Playwright + axe-core (WCAG AA testing)
- **📜 File Format**: Custom `.hyle` files (ZIP archives containing JSON manifests)

---

## 🗡️ **Wielding the Map of Worlds**
### *Basic Usage Guide*

### **1. Launch the Application**
Speak the incantation:
```bash
npm run dev
```

### **2. Project the World View**
Click the **"World View"** button to summon the second window. Drag it to your projector or second monitor. This is what your players will see—keep it clean, keep it mysterious.

### **3. Build Your Battlefield**
- **Add Maps**: Drag map images (JPG, PNG) directly onto the canvas. Watch them snap into place.
- **Add Tokens**: Drag token images onto the canvas. A cropping UI will appear—adjust the frame, then confirm.
- **Draw Annotations**: Select the **Marker** tool (press `M`) to sketch terrain features, tactical notes, or rude drawings of the BBEG.
- **Set Up Walls**: Use the **Wall** tool (press `W`) to draw vision-blocking barriers. Players won't see them, but their tokens' vision will respect them.

### **4. Save Your Session**
Click **"Save"** to export your entire campaign state to a `.hyle` file. Load it back anytime with **"Load"**. Your campaign is now portable—back it up, share it, or archive it for future adventures.

---

## 📚 **The Sacred Scrolls**
### *Documentation Archive*

Comprehensive documentation awaits you in the [`docs/`](docs/) directory:

- **[📖 Documentation Index](docs/index.md)** - Start here for AI-optimized navigation (yes, even AI agents need guidance)
- **[🏛️ Architecture](docs/architecture/ARCHITECTURE.md)** - System design and technical deep dives
- **[🎲 Domain Context](docs/context/CONTEXT.md)** - Business rules and D&D mechanical concepts
- **[🧙 Tutorials](docs/guides/TUTORIALS.md)** - Step-by-step guides for developers
- **[🔧 Troubleshooting](docs/guides/TROUBLESHOOTING.md)** - Common issues and their resolutions
- **[🤝 Contributing](CONTRIBUTING.md)** - Guidelines for joining the adventuring party

---

## ☕ **Support the Guild**
### *Patronage & Donations*

If Hyle has enhanced your campaigns and brought joy to your table, consider buying me a coffee! Every contribution helps fuel late-night coding sessions and keeps the project alive.

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/kocheck)

[⚔️ Support on Buy Me a Coffee →](https://buymeacoffee.com/kocheck)

Your generosity is appreciated, though never required. This software is and always will be **free** (as in freedom, and as in beer).

---

## 🎭 **The Adventuring Party**
### *Credits & Contributors*

Hyle is maintained by a fellowship of developers who believe in open-source sorcery and local-first data sovereignty. Special thanks to:

- **All contributors** who have submitted pull requests, bug reports, and feature ideas
- **The testing champions** who helped achieve 100% coverage across all modules
- **The community** for feedback, encouragement, and creative use cases

> *"The true treasure was the pull requests we merged along the way."*
> — Ancient Developer Proverb

Want to join the party? Check out the [Contributing Guide](CONTRIBUTING.md) and make your mark on the codebase!

---

## 📜 **License (The Fine Print)**

**MIT License**

This software is licensed under the MIT License. You are free to use, modify, and distribute it as you see fit. See the LICENSE file for full details.

> *In short: Do what you want, just don't blame me if your dragon TPKs the party.*

---

## 🧭 **Final Words from the DM**

Thank you for choosing **Hyle** as your digital battlemat. May your rolls be high, your fog of war be dramatic, and your players forever surprised by what lurks in the shadows.

Now go forth and run epic sessions. 🎲

*— The Architects of Hyle*
