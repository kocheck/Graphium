# Hyle: World given form

> **Hyle** (noun): *Matter; the fundamental substance of which everything is composed.*

Hyle is a lightweight, local-first desktop application for Dungeon Masters. It replaces the physical battlemap with a digital projector or screen share, allowing you to manage your campaign map on one screen while projecting a player-facing view on another.

**Philosophy:** Hyle is a generic "digital battlemat." It doesn't know about D&D 5e, Pathfinder, or HP. It just handles maps, tokens, and fog of war (eventually). It respects your data ownership (local files) and privacy.

![Hyle Screenshot](https://via.placeholder.com/800x450?text=Hyle+Application+Preview)

## ✨ Key Features

- **Dual-Window Architecture**:
  - **Architect View**: The DM's control center with files, tools, and hidden info.
  - **World View**: A clean, borderless window to drag onto a second monitor/projector. Updates instantly.
- **Local-First Asset Pipeline**:
  - Drag and drop any image (JPG, PNG) directly onto the canvas.
  - **Auto-Optimization**: Large maps are automatically resized and converted to high-performance WebP formats.
  - **Cropping UI**: Built-in tool to crop and zoom tokens before importing.
- **Drawing Tools**: Simple marker and eraser tools for quick sketches and fog of war.
- **Persistence**: Save your entire session to a `.hyle` file (a compressed ZIP archive of your scene and assets) and load it back instantly.
- **Advanced Grid System**:
  - **Dynamic Snapping**: Tokens snap to grid intersections (2x2) or cell centers (1x1) automatically.
  - **Infinite Grid**: The grid extends infinitely and only renders what is visible.
  - **Visual Modes**: Toggle between Lines, Dots, or Hidden grid.
- **Smart Map Tools**:
  - **Auto-Center**: Camera automatically focuses on new maps.
  - **Calibration**: Interactive "Draw to Calibrate" tool to perfectly align your map's grid.
  - **Viewport Constraints**: Prevents getting lost in the void by keeping the map in view.
- **Keyboard Shortcuts**:
  - `V`: Select Tool
  - `M`: Marker Tool
  - `E`: Eraser Tool
  - `I`: Color Picker

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
- **Styling**: Tailwind CSS
- **Formats**: Custom `.hyle` (ZIP + JSON Manifest)

## 🎮 Basic Usage

1.  **Launch**: Run `npm run dev`.
2.  **Project**: Click the "World View" button to open the second window. Drag it to your projector.
3.  **Build**:
    *   Drag map images onto the canvas.
    *   Drag token images onto the canvas (crop them in the popup).
    *   Use the "Marker" tool to draw boundaries.
4.  **Save/Load**: Use the "Save" and "Load" buttons to persist your campaign.

## 📄 License

MIT
