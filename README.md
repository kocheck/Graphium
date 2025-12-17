# Hyle: World given form

> **Hyle** (noun): *Matter; the fundamental substance of which everything is composed.*

Hyle is a lightweight, local-first desktop application for Dungeon Masters. It replaces the physical battlemap with a digital projector or screen share, allowing you to manage your campaign map on one screen while projecting a player-facing view on another.

**Philosophy:** Hyle is a generic "digital battlemat." It doesn't know about D&D 5e, Pathfinder, or HP. It just handles maps, tokens, and dynamic fog of war. It respects your data ownership (local files) and privacy.

![Hyle Screenshot](https://via.placeholder.com/800x450?text=Hyle+Application+Preview)

## ✨ Key Features

- **Dual-Window Architecture**:
  - **Architect View**: The DM's control center with files, tools, and hidden info.
  - **World View**: A clean, borderless window to drag onto a second monitor/projector. Updates instantly.
- **Accessible Theme System**:
  - **Light/Dark Mode**: System-aware with manual override (View → Theme menu).
  - **WCAG AA Compliant**: All text and UI meets accessibility contrast standards.
  - **Persistent Preferences**: Theme choice saved locally and restored on launch.
  - **No Flash**: FOUC prevention ensures smooth theme loading.
- **Local-First Asset Pipeline**:
  - Drag and drop any image (JPG, PNG) directly onto the canvas.
  - **Auto-Optimization**: Large maps are automatically resized and converted to high-performance WebP formats.
  - **Cropping UI**: Built-in tool to crop and zoom tokens before importing.
- **Drawing Tools**:
  - **Marker & Eraser**: Quick sketches and annotations with Shift-key axis locking for straight lines.
  - **Wall Tool**: Draw vision-blocking walls (invisible to players, dashed red in DM view).
- **Fog of War System**:
  - **Dynamic Vision**: PC tokens reveal areas based on configurable vision radius (darkvision support).
  - **Blurred Aesthetic**: Unseen areas are blurred and darkened rather than hidden by a solid black overlay, preserving context while obscuring details.
  - **Wall Occlusion**: Walls block line of sight using real-time raycasting algorithm.
  - **Token Inspector**: Edit token properties (name, type, vision radius) in DM view.
- **Persistence**: Save your entire session to a `.hyle` file (a compressed ZIP archive of your scene and assets) and load it back instantly.
- **Advanced Grid System**:
  - **Dynamic Snapping**: Tokens snap to grid intersections (2x2) or cell centers (1x1) automatically.
  - **Infinite Grid**: The grid extends infinitely and only renders what is visible.
  - **Visual Modes**: Toggle between Lines, Dots, or Hidden grid.
  - **Theme-Aware**: Grid colors adapt to light/dark mode automatically.
- **Smart Map Tools**:
  - **Auto-Center**: Camera automatically focuses on new maps.
  - **Center on Party**: One-click button to instantly frame all PC tokens in the view.
  - **Calibration**: Interactive "Draw to Calibrate" tool to perfectly align your map's grid.
  - **Viewport Constraints**: Prevents getting lost in the void by keeping the map in view.
- **Keyboard Shortcuts**:
  - `V`: Select Tool
  - `M`: Marker Tool
  - `E`: Eraser Tool
  - `W`: Wall Tool (vision blocking)
  - `I`: Color Picker
  - `Shift` (while drawing): Lock to horizontal/vertical axis

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/hyle.git

# Install dependencies
cd hyle
npm install
```

### Running Locally

```bash
npm run dev
```
This will launch the Electron application in development mode.

### Building for Production

```bash
npm run build
```
This will generate an installer/executable for your operating system in the `dist/` or `release/` folder.

## 🛠 Tech Stack

- **Runtime**: Electron (Dual-process)
- **Frontend**: React, Vite, TypeScript
- **State**: Zustand
- **Rendering**: HTML5 Canvas (Konva / React-Konva)
- **Styling**: Tailwind CSS + Radix Colors (theme system)
- **Persistence**: electron-store (theme preferences)
- **Accessibility**: Playwright + axe-core (WCAG AA testing)
- **Formats**: Custom `.hyle` (ZIP + JSON Manifest)

## 🎮 Basic Usage

1.  **Launch**: Run `npm run dev`.
2.  **Project**: Click the "World View" button to open the second window. Drag it to your projector.
3.  **Build**:
    *   Drag map images onto the canvas.
    *   Drag token images onto the canvas (crop them in the popup).
    *   Use the "Marker" tool to draw boundaries.
4.  **Save/Load**: Use the "Save" and "Load" buttons to persist your campaign.

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

- **[Documentation Index](docs/index.md)** - Start here for AI-optimized navigation
- **[Architecture](docs/architecture/ARCHITECTURE.md)** - System design and technical details
- **[Domain Context](docs/context/CONTEXT.md)** - Business rules and D&D concepts
- **[Tutorials](docs/guides/TUTORIALS.md)** - Step-by-step development guides
- **[Troubleshooting](docs/guides/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Contributing](CONTRIBUTING.md)** - Guidelines for contributors

## 📄 License

MIT
