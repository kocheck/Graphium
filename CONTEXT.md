# Hyle Project Context

This document provides domain knowledge, business rules, and contextual information about the Hyle project to help AI assistants and developers understand the "why" behind design decisions and functionality.

## Table of Contents
- [Project Background](#project-background)
- [Target Users](#target-users)
- [Domain Glossary](#domain-glossary)
- [Business Rules](#business-rules)
- [User Workflows](#user-workflows)
- [Design Philosophy](#design-philosophy)
- [Feature Priorities](#feature-priorities)
- [Integration Points](#integration-points)

---

## Project Background

### What is Hyle?

**Hyle** (from Greek ὕλη, meaning "matter" or "substance") is a local-first desktop application that provides a digital battlemap system for tabletop role-playing game Dungeon Masters (DMs).

### The Problem

Traditional tabletop RPGs use physical battlemaps (grid mats, tiles, or printed maps) with miniatures or tokens to represent characters and creatures during combat encounters. This approach has limitations:

1. **Physical Space** - Requires table space, storage for miniatures/maps
2. **Preparation Time** - Setting up complex encounters takes significant time
3. **Flexibility** - Difficult to modify terrain or add environmental effects mid-session
4. **Remote Play** - Physical maps don't work for online/hybrid sessions
5. **Asset Management** - Physical miniatures are expensive and limited
6. **Fog of War** - Difficult to hide unexplored areas without physical covers

### The Solution

Hyle replaces the physical battlemap with a **dual-window digital system**:

- **Architect View** (DM Control Panel) - Full control interface on DM's screen/laptop
- **World View** (Player Display) - Clean, borderless canvas projected for players to see

This allows DMs to:
- Prepare maps in advance or improvise on the fly
- Use unlimited digital tokens (no physical storage needed)
- Implement fog of war (planned feature)
- Support hybrid sessions (in-person players see projector, remote players see shared screen)
- Save and reuse campaign setups

### Why "Local-First"?

Hyle is built on the **local-first** philosophy:

1. **Data Ownership** - Users own their campaign files (`.hyle` archives)
2. **Privacy** - No cloud uploads, no analytics, no tracking
3. **Offline-First** - Works without internet connection
4. **Portability** - Campaign files are self-contained (all assets embedded)
5. **No Vendor Lock-in** - `.hyle` files are ZIP archives with JSON manifest (open format)

This is intentional. Many VTT (Virtual Tabletop) solutions require subscriptions, cloud accounts, or internet connections. Hyle respects user autonomy and data sovereignty.

---

## Target Users

### Primary: Dungeon Masters (Game Masters)

**Characteristics:**
- Runs tabletop RPG sessions (D&D 5e, Pathfinder, OSR games, etc.)
- Needs to manage maps, tokens, and hidden information
- Often uses second monitor or projector for player-facing display
- May run hybrid sessions (some players in-person, some remote)
- Values simplicity over complex rule automation

**Technical proficiency:**
- Comfortable with desktop applications
- May not be developers (but some are)
- Familiar with drag-and-drop interfaces
- Expects "it just works" reliability

**Pain points Hyle solves:**
- Physical map setup time
- Limited miniature collections
- Difficulty managing fog of war
- Remote play limitations
- Asset organization

### Secondary: AI Assistants

Hyle's documentation is optimized for AI-assisted development:
- Comprehensive architecture docs
- Detailed code conventions
- Business logic explanations
- Tutorial-style guides

This allows rapid feature development with AI pair programming.

### Non-Target Users

**Not designed for:**
- Players (read-only World View only)
- Highly technical users wanting API access (no plugin system planned)
- Users wanting automated rule enforcement (Hyle is system-agnostic)
- Groups wanting built-in voice/video chat (use Discord/Zoom separately)

---

## Domain Glossary

### General Tabletop RPG Terms

**Dungeon Master (DM) / Game Master (GM)**
- The person who runs the game, controls NPCs, describes the world
- Has access to hidden information (monster stats, map layouts, etc.)
- Hyle is built for the DM, not the players

**Player / Player Character (PC)**
- Participants in the game who control characters
- View the World Window during combat encounters
- Do not interact with Hyle directly (DM controls everything)

**Non-Player Character (NPC)**
- Characters controlled by the DM (monsters, allies, civilians)
- Represented as tokens on the battlemap

**Encounter**
- A scene requiring tactical positioning (usually combat)
- When the battlemap is actively used

**Session**
- A single game meeting (typically 2-4 hours)
- May include multiple encounters

**Campaign**
- An ongoing story spanning multiple sessions
- May use recurring maps (e.g., a home base, dungeon levels)

### Hyle-Specific Terms

**Architect View**
- The DM's control window
- Contains toolbar, sidebar, Save/Load buttons, and "World View" button
- Source of truth for state (Main Window in architecture docs)

**World View**
- The player-facing display window
- Shows only the canvas (no UI controls)
- Read-only (receives state updates from Architect View)
- Typically dragged to second monitor/projector

**Token**
- A draggable image representing a character or creature
- Snaps to grid on placement
- Default scale: 1 (one grid cell), can be larger (e.g., scale=2 for Large creatures)
- File format: WebP (optimized from uploaded image)

**Drawing**
- A freehand stroke drawn with marker or eraser tools
- Stored as array of point coordinates `[x1, y1, x2, y2, ...]`
- Used for temporary markings (zones, paths, effects)

**Grid**
- The square grid overlay on the canvas
- Default size: 50px per cell
- Used for token snapping and movement reference
- Visual guide only (no mechanical rules enforced)

**Campaign File**
- File extension: `.hyle`
- Format: ZIP archive containing:
  - `manifest.json` - Serialized game state (tokens, drawings, grid settings)
  - `assets/` folder - All token/map images (embedded WebP files)
- Self-contained (can share with other DMs or archive for later use)

**Asset**
- Any image file used in Hyle (map backgrounds or token images)
- Automatically optimized:
  - Maps: max 4096px (4K resolution support)
  - Tokens: max 512px (performance optimization)
  - All converted to WebP (85% quality, lossy compression)

**Fog of War** (Planned Feature)
- Black overlay obscuring unexplored areas
- DMs can "reveal" areas as players explore
- World View always shows fog, Architect View can toggle visibility

**Library** (Partially Implemented)
- Collection of pre-imported tokens in sidebar
- Currently: 2 hardcoded example tokens
- Planned: Persistent library with categories, search, bulk import

### Technical Terms

**IPC (Inter-Process Communication)**
- Electron's message-passing system between Main Process and Renderer Process
- Used to sync state from Architect View to World View
- Channels: `SYNC_WORLD_STATE`, `SAVE_CAMPAIGN`, `LOAD_CAMPAIGN`, etc.

**Main Process**
- Electron's Node.js process (electron/main.ts)
- Handles file I/O, window management, IPC routing

**Renderer Process**
- Chromium browser process running React app
- Two instances: Architect View and World View

**Preload Script**
- Bridge between Main and Renderer processes (electron/preload.ts)
- Exposes safe IPC methods via `contextBridge`

**Zustand Store**
- State management library
- Single store: `gameStore.ts` (tokens, drawings, gridSize)

**Konva**
- HTML5 Canvas rendering library
- Used for all canvas drawing (grid, tokens, strokes)

**Grid Snapping**
- Automatic alignment of tokens to grid intersections
- Formula: `Math.round(x / gridSize) * gridSize`

---

## Business Rules

### Asset Processing Rules

1. **All uploaded images are optimized**
   - Tokens: Resized to max 512px (maintaining aspect ratio)
   - Maps: Resized to max 4096px
   - All converted to WebP (quality: 0.85)
   - Original files are NOT preserved (destructive compression)

   **Rationale:** Performance and file size. Large images cause lag and bloat campaign files.

2. **Token cropping is required**
   - All dropped image files trigger cropping UI
   - User must crop to 1:1 aspect ratio
   - Library tokens skip cropping (pre-processed)

   **Rationale:** Tokens need to fit grid cells (square). Allowing arbitrary aspect ratios would break grid alignment.

3. **Assets are stored as temp files during session**
   - Uploaded assets saved to `{userData}/temp_assets/`
   - File naming: `{timestamp}-{filename}.webp`
   - Referenced via `file://` URLs in state

   **Rationale:** Avoids keeping large blobs in memory. Allows reload without re-upload.

4. **Campaign files embed all assets**
   - Saving converts `file://` URLs to relative `assets/` paths
   - Assets copied into ZIP archive
   - Loading extracts assets to `{userData}/sessions/{timestamp}/assets/`

   **Rationale:** Self-contained campaign files. Share with others or archive without broken references.

### State Synchronization Rules

1. **Main Window (Architect View) is source of truth**
   - All user input happens in Main Window
   - State changes trigger IPC broadcast to World Window
   - World Window NEVER modifies state (read-only)

   **Rationale:** Prevents sync conflicts. One-way data flow is simpler and more reliable.

2. **Drawings sync on mouseUp, not mousemove**
   - While dragging, drawing preview stored in local state only
   - On release, drawing committed to store (triggers sync)

   **Rationale:** Performance. 60 IPC messages/sec would overwhelm World Window and cause lag.

3. **Entire state is broadcast (not diffs)**
   - Every sync sends full `{ tokens, drawings, gridSize }` object
   - No partial updates or deltas

   **Rationale:** Simpler implementation. State size is small (< 1KB typically). If this becomes a bottleneck, implement diffing.

### Grid and Positioning Rules

1. **Tokens ALWAYS snap to grid on placement**
   - Drag-and-drop calculates grid-aligned coordinates
   - No sub-grid positioning allowed

   **Rationale:** Tactical grid games require precise alignment. Free positioning would break grid-based movement rules.

2. **Grid size is configurable but uniform**
   - Single `gridSize` property (default: 50px)
   - Applies to entire canvas (no multi-resolution grids)

   **Rationale:** Simplicity. Supporting multiple grid sizes adds UI complexity without clear benefit.

3. **Token scale property supports multi-cell tokens**
   - `scale: 1` = 1x1 grid cells (Medium creature in D&D)
   - `scale: 2` = 2x2 grid cells (Large creature)
   - `scale: 3` = 3x3 grid cells (Huge creature)

   **Rationale:** D&D 5e and Pathfinder have creature sizes. Supporting this is essential for tactical combat.

### File Format Rules

1. **Campaign files use `.hyle` extension**
   - File is a standard ZIP archive
   - Contains `manifest.json` + `assets/` folder
   - Can be opened with any ZIP tool (for inspection/recovery)

   **Rationale:** Open format. Users aren't locked into proprietary binary format. Debugging is easier.

2. **manifest.json is the single source of truth**
   - Serialized GameState object
   - No versioning (yet)
   - Schema: `{ tokens: Token[], drawings: Drawing[], gridSize: number }`

   **Rationale:** Simple JSON format. When schema changes (future), implement migration logic.

3. **Asset paths are relative in saved files, absolute in memory**
   - In memory: `file:///Users/.../temp_assets/token.webp`
   - In .hyle file: `assets/token.webp`
   - After load: `file:///Users/.../sessions/{timestamp}/assets/token.webp`

   **Rationale:** Portability. Relative paths work on any machine. Absolute paths needed for file system access.

### Window Behavior Rules

1. **Only one World Window allowed**
   - Clicking "World View" button checks if window exists
   - If exists, focus it (don't create duplicate)

   **Rationale:** Multiple World Windows would receive duplicate state updates (confusing and wasteful).

2. **World Window can be closed without affecting Architect View**
   - Closing World Window doesn't quit app
   - Architect View continues functioning
   - Can re-open World Window anytime

   **Rationale:** DMs may not always use projector. Allow single-window mode for prep work.

3. **Both windows run the same React app**
   - Window type detected via URL parameter: `?type=world`
   - Architect View shows full UI, World View hides toolbars

   **Rationale:** Code reuse. Single codebase for both views simplifies development.

---

## User Workflows

### Workflow 1: Starting a New Session

```
1. DM launches Hyle (npm run dev or double-click app)
2. Architect View opens (blank canvas with grid)
3. DM clicks "World View" button
4. World View opens (DM drags to projector/second monitor)
5. DM maximizes or fullscreens World View window
6. Setup complete - ready to add maps and tokens
```

**Common variations:**
- DM may prepare session in advance (skip step 3-5 until players arrive)
- DM may use single monitor (skip step 3-5 entirely)

### Workflow 2: Adding a Map

```
1. DM has map image file (PNG, JPG, downloaded from internet or created)
2. DM drags file onto Architect View canvas
3. (Cropping UI appears - DM can adjust or skip for maps)
4. Image optimized (resized to max 4096px, converted to WebP)
5. Map appears on canvas in both windows (background layer)
6. DM can drag map to reposition if needed
```

**Notes:**
- Maps are not snapped to grid (free positioning)
- Multiple maps can be layered (e.g., base map + overlay effects)

### Workflow 3: Adding Tokens

**Option A: Upload Custom Token**
```
1. DM has token image file (e.g., goblin portrait)
2. DM drags file onto canvas
3. Cropping UI appears
4. DM adjusts crop area and zoom to frame character
5. DM clicks "Crop & Import"
6. Token optimized (max 512px, WebP)
7. Token appears on canvas at drop location (grid-snapped)
8. DM can drag token to reposition
```

**Option B: Use Library Token**
```
1. DM clicks and drags token from Sidebar library
2. DM drops onto canvas
3. Token appears at drop location (grid-snapped)
4. No cropping needed (library tokens pre-processed)
```

### Workflow 4: Drawing on the Map

```
1. DM selects "Marker" tool from toolbar
2. DM clicks and drags on canvas
3. Red stroke appears as DM drags (real-time preview)
4. DM releases mouse
5. Stroke committed to state, synced to World View
6. Players see the marking on projector
```

**Use cases:**
- Mark hazardous terrain (lava, pit traps)
- Draw spell effect areas (fireball radius, wall of fire)
- Indicate NPC patrol paths
- Temporary notes (erase later)

### Workflow 5: Erasing Drawings

```
1. DM selects "Eraser" tool from toolbar
2. DM clicks and drags over existing drawings
3. Eraser "cuts through" marker strokes (destination-out composite)
4. Erased areas disappear in real-time
5. On release, changes synced to World View
```

**Note:** Eraser only affects drawings (marker strokes), not tokens or maps.

### Workflow 6: Saving a Campaign

```
1. DM finishes setting up encounter (maps, tokens, drawings in place)
2. DM clicks "Save" button
3. File dialog appears (.hyle extension filter)
4. DM chooses location and filename (e.g., "dragon-lair-encounter.hyle")
5. Hyle creates ZIP archive:
   - Copies all token/map images to assets/ folder
   - Writes manifest.json with state
6. Success alert appears
7. DM can now quit app or continue working
```

**Use cases:**
- Save prepared encounters for future sessions
- Archive completed sessions
- Share encounters with other DMs
- Create backup before making major changes

### Workflow 7: Loading a Campaign

```
1. DM wants to resume previous encounter or use prepared setup
2. DM clicks "Load" button
3. File dialog appears (.hyle extension filter)
4. DM selects campaign file
5. Hyle extracts ZIP:
   - Reads manifest.json
   - Extracts assets to sessions/{timestamp}/ folder
   - Updates file paths to point to extracted files
6. Canvas updates with loaded state (tokens, drawings, grid appear)
7. Success alert appears
8. Changes synced to World View (if open)
```

**Important:** Loading overwrites current state (no merge). DM should save first if current state matters.

### Workflow 8: Running a Combat Encounter

```
1. DM has loaded encounter (map + monster tokens placed)
2. Players roll initiative (outside Hyle - using dice or D&D Beyond)
3. DM moves tokens on Architect View as combat progresses
4. Players see updated positions on World View (projector)
5. DM uses marker tool to indicate:
   - Spell effect areas (e.g., circle for fireball)
   - Difficult terrain
   - Hazards created during combat
6. As encounter progresses, DM drags defeated monsters off-screen
7. Encounter ends, DM can:
   - Save state for continuation next session
   - Clear canvas for next encounter
   - Close app
```

**Note:** Hyle does NOT track HP, conditions, or rules. DMs use separate tools (pen & paper, D&D Beyond) for that.

---

## Design Philosophy

### Principle 1: Generic Tool, Not Game System

Hyle is **system-agnostic**:
- No built-in rules for D&D 5e, Pathfinder, etc.
- No HP tracking, initiative order, or condition management
- No dice rolling
- No character sheets

**Rationale:**
- Different groups use different systems (D&D, Pathfinder, OSR, homebrew)
- Rules change (D&D 5e → D&D 5.5e → D&D 6e)
- DMs have preferred tools for rules (D&D Beyond, Roll20, pen & paper)
- Hyle focuses on ONE thing: visual battlemap display

**What Hyle IS:**
- A digital whiteboard with grid and tokens
- A projector display manager
- A campaign file organizer

**What Hyle IS NOT:**
- A full VTT (Virtual Tabletop) like Roll20 or Foundry
- A rules engine
- A character manager

### Principle 2: Local-First, Privacy-Respecting

No cloud. No tracking. No subscriptions.

**Why:**
- Users own their data (campaign files are theirs forever)
- No internet required (run games in basements, cabins, anywhere)
- No vendor lock-in (if Hyle development stops, files still work)
- No privacy concerns (no telemetry, no analytics)

**Trade-offs:**
- No built-in multiplayer (use separate screen sharing tools)
- No cloud backup (users manage their own backups)
- No cross-device sync (manually transfer .hyle files)

**Future considerations:**
- Optional peer-to-peer sync (via local network, no central server)
- Optional cloud backup integration (user-controlled, via Dropbox/Google Drive APIs)
- But NEVER required cloud services

### Principle 3: Simplicity Over Features

Hyle prioritizes:
- Intuitive drag-and-drop interactions
- Minimal UI clutter (especially in World View)
- Fast setup time (< 5 minutes to prepare encounter)
- Reliable performance (60fps with 100+ tokens)

**Features explicitly NOT planned:**
- Scripting/automation (use macros in other tools if needed)
- Plugin system (keeps codebase simple)
- 3D rendering (2D grid only)
- Animation/effects (static tokens only)
- Chat/voice (use Discord/Zoom separately)

**When in doubt:**
- Ask: "Does this help DMs display battlemaps?"
- If no, it's out of scope
- If yes but complex, look for simpler alternative

### Principle 4: Offline-First Performance

Hyle must work smoothly even on older hardware:
- Optimize images aggressively (WebP, size limits)
- Render efficiently (Konva layer system)
- Minimize IPC overhead (batch updates, throttle sync)
- Avoid memory leaks (clean up assets, dispose canvases)

**Target performance:**
- 60fps with 50 tokens on screen
- < 3 second load time for campaign files
- < 1 second response to user input (drag, draw)

### Principle 5: Data Portability

Campaign files must be:
- **Open format** - ZIP + JSON (no proprietary binary)
- **Human-readable** - Unzip and inspect with any tool
- **Forward-compatible** - Future versions can read old files (with migration)
- **Shareable** - Send to other DMs without special export process

**Anti-pattern:** Proprietary database formats (SQLite, custom binary)

---

## Feature Priorities

### Currently Implemented ✅

1. Dual-window system (Architect + World View)
2. Real-time state synchronization via IPC
3. Token upload, cropping, and placement
4. Grid overlay with snapping
5. Marker and eraser drawing tools
6. Campaign save/load (.hyle files)
7. Drag-and-drop asset upload
8. Library tokens (hardcoded examples)

### High Priority (Next to Implement) 🔥

1. **Fog of War System**
   - Black overlay layer obscuring unexplored areas
   - "Reveal Fog" tool (draws transparent areas)
   - Toggle fog visibility in Architect View (always visible in World View)
   - Save/load fog state in campaign files

2. **Token Deletion**
   - Right-click context menu → Delete
   - Keyboard shortcut: Delete/Backspace
   - Remove from state + clean up temp file

3. **Clear Canvas**
   - Button to remove all tokens and drawings (keep grid)
   - Confirmation dialog to prevent accidents

4. **Grid Size Configuration**
   - UI control to adjust gridSize (default 50px)
   - Presets: 25px, 50px, 75px, 100px
   - Save grid size in campaign files (already done, just need UI)

### Medium Priority 🟡

5. **Additional Drawing Tools**
   - Shape tools: Rectangle, Circle, Line
   - Color picker for marker (currently hardcoded red)
   - Stroke width control
   - Text labels (Konva.Text)

6. **Ruler Tool**
   - Click-and-drag to measure distances
   - Display in grid cells (e.g., "6 cells = 30 feet in D&D")
   - Non-persistent (doesn't save to state)

7. **Token Scaling UI**
   - Controls to change token.scale (1x1, 2x2, 3x3, 4x4)
   - Visual indicators for large tokens (border or grid overlay)

8. **Asset Library Management**
   - Persistent library (separate from campaigns)
   - Categories: Monsters, Heroes, Terrain, Items
   - Search/filter by name or tags
   - Bulk import (drag folder of tokens)

9. **Undo/Redo**
   - History stack (last 50 actions)
   - Keyboard shortcuts: Cmd+Z, Cmd+Shift+Z
   - Affects tokens, drawings, and fog (not grid size or settings)

### Low Priority (Nice to Have) 🔵

10. **Token Context Menu**
    - Right-click token → Rotate, Flip, Duplicate, Send to Back/Front
    - Aura/radius indicators (show range around token)

11. **Layer Management**
    - Background layer (maps), Token layer, Effects layer (drawings)
    - Reorder layers (e.g., show drawing ABOVE tokens)

12. **Grid Customization**
    - Toggle grid visibility (hide for gridless games)
    - Grid color/opacity controls
    - Hex grid support (for Traveller, some wargames)

13. **Export to Image**
    - Save current canvas as PNG (for sharing online)
    - Option to include or exclude fog

14. **Settings Panel**
    - Configure default grid size, marker color, eraser size
    - Keyboard shortcut customization
    - Auto-save interval

### Not Planned ❌

- Multiplayer networking (use screen share instead)
- Rules automation (D&D attack rolls, saving throws)
- Character sheets
- Inventory management
- Dice rolling
- Chat/voice communication
- 3D rendering
- Animated tokens or spell effects

---

## Integration Points

### File System

**Where Hyle stores data:**
```
macOS:    ~/Library/Application Support/Hyle/
Windows:  C:\Users\{user}\AppData\Roaming\Hyle\
Linux:    ~/.config/Hyle/

Subdirectories:
  temp_assets/           # Uploaded assets during session (should be cleared on quit)
  sessions/{timestamp}/  # Extracted assets from loaded campaigns
  library/               # Persistent token library (planned feature)
  library.json           # Library metadata (planned feature)
  settings.json          # User preferences (planned feature)
```

**External dependencies:**
- User's Downloads folder (where .hyle files typically saved)
- User's Documents/Pictures (common token upload sources)

### Screen Sharing Tools (Recommended for Remote Play)

Hyle is designed to work WITH screen sharing, not replace it:

- **Discord** - DMs can share World Window in a call
- **Zoom** - Share specific window (World View)
- **OBS** - Stream World View to Twitch/YouTube for asynchronous play
- **Roll20/Foundry** - Some DMs use Hyle for maps, other tools for rules (via separate windows)

**How it works:**
1. DM opens World View on second monitor/virtual display
2. DM shares that specific window in Discord/Zoom
3. Remote players see World View (no controls, just canvas)
4. DM controls everything from Architect View (not shared)

### Companion Tools (Common DM Stack)

**Hyle does NOT replace:**
- **D&D Beyond** - Character sheets, rules reference, dice rolling
- **Roll20** - Battlemaps, token art, marketplace content
- **Foundry VTT** - Full-featured VTT (Hyle is simpler, local-first alternative)
- **Discord/Slack** - Communication during sessions
- **OneNote/Obsidian** - Campaign notes, worldbuilding

**How Hyle fits:**
- Handles ONLY the visual battlemap display
- DMs use other tools for rules, communication, and notes
- Hyle's strength: Local-first, simple, fast, no subscription

---

## Future Considerations

### Potential Features (Under Consideration)

1. **Peer-to-Peer Sync** (Local Network)
   - Players run Hyle on their devices
   - DM broadcasts state to local network (no internet)
   - Players see synchronized view on tablets/laptops
   - Benefit: No screen sharing lag, players can zoom/pan independently
   - Challenge: Complexity, NAT traversal, firewall issues

2. **Web Export** (Static HTML)
   - Export campaign as self-contained HTML file
   - Open in browser for read-only viewing
   - Benefit: Share campaigns without requiring Hyle app
   - Challenge: Konva in browser, file size of embedded assets

3. **Community Asset Library**
   - Optional online repository of free tokens/maps
   - Download packs directly in Hyle
   - User-contributed (like Thingiverse for miniatures)
   - Benefit: Lowers barrier to entry for new DMs
   - Challenge: Moderation, hosting costs, copyright issues

4. **Migration from Other VTTs**
   - Import campaigns from Roll20, Foundry, etc.
   - Convert map/token data to .hyle format
   - Benefit: Lower switching cost for DMs
   - Challenge: Different data models, API limitations

### Scalability Limits

**Current limitations to address before scaling:**

1. **Grid rendering** - O(n*m) Line components
   - Solution: Use single Path or memoize grid

2. **IPC frequency** - Every state change triggers sync
   - Solution: Throttle to 10 updates/sec max

3. **Temp asset cleanup** - Files accumulate forever
   - Solution: Clear on app quit or implement LRU cache

4. **Session directories** - Each load creates new folder
   - Solution: Implement expiry (delete sessions older than 30 days)

**Long-term scalability concerns:**

1. **Large campaigns** (1000+ tokens)
   - Viewport culling (only render visible tokens)
   - Lazy loading (load tokens in chunks)

2. **High-resolution maps** (8K+)
   - Tile-based rendering (divide map into chunks)
   - Progressive loading (low-res first, then high-res)

3. **Network sync** (future multiplayer)
   - Operational transform for conflict resolution
   - Delta updates (not full state broadcasts)

---

## Summary

Hyle is a **focused, local-first tool** for DMs who want:
- Simple digital battlemap display
- Dual-window support (DM screen + projector)
- Data ownership (no cloud lock-in)
- Fast, reliable performance

It is NOT a full VTT. It does not replace Discord, D&D Beyond, or physical dice. It does ONE thing well: display battlemaps.

When developing features, always ask:
- Does this help DMs display battlemaps?
- Can this be implemented simply (without bloat)?
- Does this respect local-first principles?
- Will this work offline?

If yes to all, it's a good fit for Hyle.
