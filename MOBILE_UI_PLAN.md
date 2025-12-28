# Mobile UI Refactor Plan for DM View (Architect View)

## Executive Summary

The Hyle VTT DM View is currently designed exclusively for desktop use with mouse/keyboard interaction and large screens. This plan outlines a comprehensive refactoring strategy to make the interface fully functional on mobile devices (phones and tablets) without compromising the desktop experience.

---

## Phase 1 Audit Results

### ✅ Good News: Touch Support Already Exists

The **CanvasManager** component (`src/components/Canvas/CanvasManager.tsx`) already implements:
- ✅ Pinch-to-zoom gestures (lines 385-436)
- ✅ Two-finger pan support
- ✅ Touch event handlers (`onTouchStart`, `onTouchMove`, `onTouchEnd`)
- ✅ Proper touch distance and center calculations
- ✅ Viewport clamping and bounds checking

**This is excellent!** The core map interaction is already mobile-ready.

---

## Critical Mobile Issues Found

### 1. **Fixed-Width Sidebar: 256px (w-64)**
**Location:** `src/components/Sidebar.tsx:225`
```tsx
<div className="sidebar w-64 flex flex-col p-4 z-10 shrink-0 overflow-y-auto">
```

**Problem:**
- On a 375px wide phone screen (iPhone SE), the sidebar consumes **68% of the screen width**
- On a 360px wide phone (Samsung Galaxy), it consumes **71% of the screen width**
- This leaves only 115-120px for the actual map canvas
- The sidebar is not collapsible, creating a permanently cramped layout

**Impact:** 🔴 CRITICAL - Makes the app nearly unusable on mobile

---

### 2. **Fixed-Width Token Inspector: 320px (w-80)**
**Location:** `src/components/TokenInspector.tsx:88`
```tsx
className="token-inspector fixed bottom-4 right-4 w-80 p-4 rounded shadow-lg z-50"
```

**Problem:**
- Inspector panel is 320px wide with `fixed` positioning at `bottom-4 right-4`
- On a 375px screen, this leaves only 55px of visible canvas when inspector is open
- The inspector overlaps with the sidebar (256px from left + 320px from right = 576px > 375px screen)
- Panel has scrollable content but no way to dismiss or minimize on mobile

**Impact:** 🔴 CRITICAL - Completely blocks the map when tokens are selected

---

### 3. **Floating Toolbar: Top-Right Fixed Positioning**
**Location:** `src/App.tsx:283`
```tsx
<div className="toolbar fixed top-4 right-4 p-2 rounded shadow flex gap-2 z-50">
```

**Problems:**
- Contains 10+ buttons arranged horizontally in a flex row
- Each button has padding and text labels ("Select (V)", "Marker (M)", etc.)
- On mobile, this creates a ~600-800px wide toolbar that overflows the screen
- No text wrapping or vertical stacking on small screens
- Buttons are too small for touch targets (should be minimum 44x44px)

**Impact:** 🔴 HIGH - Toolbar is partially off-screen, tools are inaccessible

---

### 4. **Mouse-Only Hover Interactions**
**Locations Found:**
- `src/components/TokenInspector.tsx:110-111, 134-135, 180-183, 196-199, 226-229`
- `src/components/Sidebar.tsx:367` (token library hover overlay)
- `src/components/AssetProcessingErrorBoundary.tsx:136-137`

**Example:**
```tsx
onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--app-accent-solid-hover)'}
onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--app-accent-solid)'}
```

**Problems:**
- Hover states don't work on touch devices
- The token library delete button appears only on hover (line 367-381 in Sidebar.tsx)
- Token inspector uses hover for button state feedback
- Users cannot access hover-only UI elements on mobile

**Impact:** 🟡 MEDIUM - Features are hidden/inaccessible on touch devices

---

### 5. **No Responsive Breakpoints**
**Finding:** Only 1 media query exists in the entire codebase
```css
/* src/App.css:30 */
@media (prefers-reduced-motion: no-preference) { ... }
```

**Problem:**
- No mobile-specific layouts or breakpoints
- No tablet-optimized layouts
- Components use fixed pixel widths instead of responsive percentages
- No `@media (max-width: 768px)` or similar responsive design patterns

**Impact:** 🔴 HIGH - Layout doesn't adapt to screen size at all

---

### 6. **Touch Target Sizes Below 44px Minimum**
**Locations:**
- Sidebar token library grid items (unclear exact size due to `aspect-square` on `grid-cols-2`)
- Toolbar buttons (estimated 32-36px height based on `py-2` and `text-sm`)
- Token inspector vision preset buttons (estimated 36-40px)
- Map navigator edit/delete icons (small icon buttons)

**Problem:**
- Apple Human Interface Guidelines require 44x44px minimum
- Android Material Design requires 48x48dp minimum
- Small touch targets lead to mis-clicks and frustration

**Impact:** 🟡 MEDIUM - Poor user experience, accessibility issues

---

### 7. **Modal Dialogs Not Optimized for Mobile**
**Components:**
- `LibraryManager.tsx` - Uses `max-w-4xl` (896px), too wide for mobile
- `ImageCropper.tsx` - Modal positioning unclear
- `AddToLibraryDialog.tsx` - Modal sizing unclear
- `CommandPalette.tsx` - Keyboard-centric, needs touch optimization

**Problem:**
- Modals may overflow small screens
- No touch gestures for dismissal (swipe down, etc.)
- Form inputs may trigger viewport zoom on iOS if `font-size < 16px`

**Impact:** 🟡 MEDIUM - Modals may be hard to use or require horizontal scrolling

---

## Refactor Strategy

### **The "Drawer" Approach: Collapsible Sidebars on Mobile**

#### Desktop (≥ 1024px):
```
┌────────────┬──────────────────────────────────────┐
│  Sidebar   │          Canvas Area                 │
│  (256px)   │  ┌────────────────────────────────┐  │
│            │  │                                │  │
│  - Maps    │  │         Map Canvas             │  │
│  - Upload  │  │      (with touch zoom/pan)     │  │
│  - Grid    │  │                                │  │
│  - Tokens  │  │                                │  │
│            │  └────────────────────────────────┘  │
│            │          [Toolbar - Top Right]       │
└────────────┴──────────────────────────────────────┘
```

#### Mobile (< 768px):
```
┌──────────────────────────────────────┐
│  [☰ Menu]        [Toolbar Collapsed] │  ← Header bar
├──────────────────────────────────────┤
│                                      │
│                                      │
│          Full-Screen Canvas          │
│        (touch zoom/pan enabled)      │
│                                      │
│                                      │
├──────────────────────────────────────┤
│  [Token] [Tools] [Settings]          │  ← Bottom nav
└──────────────────────────────────────┘

[Sidebar opens as slide-over drawer from left]
[Inspector opens as bottom sheet when token selected]
```

---

## Detailed Implementation Plan

### **1. Sidebar: Convert to Slide-Over Drawer on Mobile**

**File:** `src/components/Sidebar.tsx`

**Changes:**
1. Add responsive wrapper with conditional rendering:
   ```tsx
   const [isDrawerOpen, setDrawerOpen] = useState(false);
   const isMobile = useMediaQuery('(max-width: 768px)');

   return isMobile ? (
     <MobileSidebarDrawer isOpen={isDrawerOpen} onClose={() => setDrawerOpen(false)}>
       {/* Existing sidebar content */}
     </MobileSidebarDrawer>
   ) : (
     <div className="sidebar w-64 ...">
       {/* Existing sidebar content */}
     </div>
   );
   ```

2. Create `MobileSidebarDrawer` component:
   - Slide-in from left edge
   - Overlay with semi-transparent backdrop
   - Swipe-to-dismiss gesture
   - Close on backdrop click
   - 80-90% width on mobile (leaving edge visible)

3. Add hamburger menu button to mobile header:
   - Fixed position at top-left
   - 48x48px touch target
   - Triggers drawer open

**Breakpoint:** `< 768px`

---

### **2. Token Inspector: Convert to Bottom Sheet on Mobile**

**File:** `src/components/TokenInspector.tsx`

**Changes:**
1. Replace fixed positioning with responsive logic:
   ```tsx
   const isMobile = useMediaQuery('(max-width: 768px)');

   // Desktop: Fixed bottom-right panel (current behavior)
   // Mobile: Bottom sheet that slides up from bottom

   const mobileClasses = "fixed inset-x-0 bottom-0 rounded-t-xl max-h-[70vh]";
   const desktopClasses = "fixed bottom-4 right-4 w-80";

   className={isMobile ? mobileClasses : desktopClasses}
   ```

2. Add mobile-specific features:
   - Drag handle at top center (horizontal pill indicator)
   - Swipe-down-to-dismiss gesture
   - Snap positions: Collapsed (showing header only) vs Expanded (showing form)
   - Backdrop overlay that closes sheet on tap

3. Increase touch targets:
   - Vision preset buttons: `py-3` (instead of `py-1`)
   - PC/NPC toggle buttons: `py-3` (instead of `py-2`)
   - All buttons minimum 44px height

**Breakpoint:** `< 768px`

---

### **3. Toolbar: Redesign for Mobile**

**File:** `src/App.tsx:283`

**Desktop (≥ 1024px):** Keep current horizontal toolbar at top-right

**Tablet (768px - 1023px):**
- Compact toolbar with icon-only buttons
- Tooltips on press-and-hold

**Mobile (< 768px):**
- **Option A: Bottom Navigation Bar**
  ```
  ┌────────┬────────┬────────┬────────┬────────┐
  │ Select │ Marker │ Eraser │  Wall  │  More  │
  │   ✋   │   ✏️   │   🧹   │   🧱   │   ⋯   │
  └────────┴────────┴────────┴────────┴────────┘
  ```
  - Fixed bottom position
  - 5 primary tools visible
  - "More" button opens overflow menu
  - Each button 20% width, minimum 44px height

- **Option B: Floating Action Button (FAB)**
  - Single FAB at bottom-right
  - Expands to show tool radial menu on tap
  - Less obtrusive than bottom bar

**Recommendation:** Bottom Navigation Bar (more discoverable for users)

**Implementation:**
```tsx
{isArchitectView && (
  isMobile ? (
    <MobileToolbar
      tool={tool}
      setTool={setTool}
      color={color}
      setColor={setColor}
    />
  ) : (
    <div className="toolbar fixed top-4 right-4 ...">
      {/* Existing desktop toolbar */}
    </div>
  )
)}
```

---

### **4. Fix Hover-Only Interactions**

**Strategy:** Replace all `onMouseEnter`/`onMouseLeave` with touch-compatible alternatives

**Option 1: Use CSS `:active` pseudo-class**
```tsx
// Remove inline onMouseEnter/onMouseLeave
// Add class-based styling
className="btn-interactive"

// In CSS:
.btn-interactive:hover { background: var(--app-bg-hover); }
.btn-interactive:active { background: var(--app-bg-active); }
```

**Option 2: Toggle State on Click (for visibility toggles)**
```tsx
// For token library delete button (Sidebar.tsx:367-381)
const [showActions, setShowActions] = useState(false);

// Replace hover overlay with click-to-toggle
onClick={(e) => {
  e.stopPropagation();
  setShowActions(!showActions);
}}

// Show actions persistently on mobile, on hover on desktop
{(isMobile ? showActions : true) && (
  <div className="action-overlay">
    <button>Delete</button>
  </div>
)}
```

**Option 3: Long-Press for Secondary Actions**
- Use `react-use-gesture` library
- Long-press token to show delete button
- Better UX than click-to-toggle

**Recommendation:** Combination of Option 1 (CSS) for button hover states + Option 3 (long-press) for action overlays

---

### **5. Implement Responsive Breakpoints**

**File:** Create `src/hooks/useMediaQuery.ts`
```tsx
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// Convenience hooks
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
```

**Breakpoint Strategy:**
```
Mobile:   0px - 767px   (phones)
Tablet:   768px - 1023px (tablets, small laptops)
Desktop:  1024px+        (laptops, desktops)
```

**Rationale:**
- 768px is a common tablet breakpoint (iPad portrait = 768px)
- 1024px accommodates 256px sidebar + minimum viable canvas (~750px)

---

### **6. Increase Touch Target Sizes**

**Minimum Touch Target Matrix:**

| Component | Current Size (est.) | Target Size | Change Required |
|-----------|-------------------|-------------|----------------|
| Toolbar buttons | ~36px | 44px | `py-2.5` → `py-3` |
| Token library items | ~80px | ✅ OK | Already adequate |
| Inspector buttons | ~40px | 44px | `py-1` → `py-3` |
| Map navigator icons | ~24px | 44px | Increase icon size + padding |
| Vision preset buttons | ~36px | 44px | `py-1` → `py-3` |

**Implementation:**
1. Add `min-h-[44px] min-w-[44px]` to all interactive elements on mobile
2. Use responsive classes:
   ```tsx
   className="py-1 md:py-3"  // Smaller on desktop, larger on mobile
   ```
3. Increase icon sizes from 16px/20px to 24px on mobile

---

### **7. Optimize Modal Dialogs for Mobile**

**Changes for ALL modal dialogs:**

1. **Responsive width:**
   ```tsx
   className="max-w-4xl md:max-w-md w-full"
   // Desktop: 896px max
   // Mobile: Full width minus padding
   ```

2. **Prevent iOS font-size zoom:**
   ```css
   /* Add to all input fields */
   input, select, textarea {
     font-size: 16px; /* Minimum to prevent auto-zoom on iOS */
   }
   ```

3. **Full-screen modals on mobile:**
   ```tsx
   const isMobile = useIsMobile();

   <div className={
     isMobile
       ? "fixed inset-0 bg-surface"
       : "fixed inset-0 flex items-center justify-center"
   }>
   ```

4. **Add swipe-to-dismiss:**
   - Implement for bottom sheets and full-screen modals
   - Use `react-use-gesture` or similar library

**Specific Changes:**

- **LibraryManager:** Full-screen on mobile, centered modal on desktop
- **ImageCropper:** Full-screen on mobile, use touch gestures for pan/zoom
- **CommandPalette:** Keep fixed position at top, reduce width on mobile
- **DungeonGeneratorDialog:** Full-screen on mobile

---

### **8. Map Gestures: Already Implemented!**

**Good News:** The CanvasManager already supports:
- ✅ Pinch-to-zoom (two-finger pinch)
- ✅ Two-finger pan
- ✅ Touch event handlers
- ✅ Proper distance and center calculations
- ✅ Viewport clamping

**Additional Enhancements (Optional):**
1. Add visual feedback for touch interactions:
   - Show zoom level indicator during pinch
   - Show "touch helper" overlay on first load (tutorial)

2. Optimize performance for mobile:
   - Already has viewport culling ✅
   - Consider reducing grid density on low-end devices

3. Add one-finger pan option:
   - Currently requires space key + drag on desktop
   - On mobile, allow one-finger pan when tool is 'select' and not dragging a token

**Implementation (Optional One-Finger Pan):**
```tsx
const handleTouchMove = (e: KonvaEventObject<TouchEvent>) => {
  const touches = e.evt.touches;

  // Two-finger pinch (existing)
  if (touches.length === 2) {
    // ... existing pinch code ...
  }

  // One-finger pan (NEW)
  if (touches.length === 1 && tool === 'select' && !isDraggingToken) {
    e.evt.preventDefault();
    const touch = touches[0];

    if (lastTouchPos.current) {
      const dx = touch.clientX - lastTouchPos.current.x;
      const dy = touch.clientY - lastTouchPos.current.y;

      setPosition({
        x: position.x + dx,
        y: position.y + dy
      });
    }

    lastTouchPos.current = { x: touch.clientX, y: touch.clientY };
  }
};
```

---

## Media Query Plan

### **Recommended Breakpoints:**

```css
/* Mobile First Approach */

/* Mobile: Base styles (0-767px) */
.sidebar {
  /* Slide-over drawer */
  position: fixed;
  left: -100%;
  transition: left 0.3s ease;
  width: 85vw;
  max-width: 320px;
}

.sidebar.open {
  left: 0;
}

/* Tablet: 768px - 1023px */
@media (min-width: 768px) {
  .sidebar {
    /* Collapsible sidebar, narrower */
    position: relative;
    width: 200px;
    left: 0;
  }

  .token-inspector {
    /* Smaller fixed panel */
    width: 280px;
  }
}

/* Desktop: 1024px+ */
@media (min-width: 1024px) {
  .sidebar {
    /* Full-width sidebar */
    width: 256px;
  }

  .token-inspector {
    /* Full-width inspector */
    width: 320px;
  }

  .toolbar {
    /* Horizontal toolbar */
    flex-direction: row;
  }
}
```

### **Layout Shifts by Breakpoint:**

| Element | Mobile (< 768px) | Tablet (768-1023px) | Desktop (≥ 1024px) |
|---------|------------------|---------------------|-------------------|
| **Sidebar** | Slide-over drawer (85vw) | Collapsible panel (200px) | Fixed panel (256px) |
| **Toolbar** | Bottom nav bar | Icon-only top bar | Full top bar with labels |
| **Token Inspector** | Bottom sheet (full width) | Fixed bottom-right (280px) | Fixed bottom-right (320px) |
| **Modals** | Full-screen | Centered, max 600px | Centered, max 896px |
| **Canvas** | Full viewport | Viewport - sidebar | Viewport - sidebar |
| **Minimap** | Hidden or bottom-left | Bottom-left 120px | Bottom-left 150px |

---

## Component Refactoring Checklist

### **Priority 1: Critical (Blocking Mobile Use)**
- [ ] `Sidebar.tsx` - Convert to responsive drawer
  - [ ] Create `MobileSidebarDrawer` component
  - [ ] Add `useMediaQuery` hook integration
  - [ ] Implement slide-in animation
  - [ ] Add backdrop overlay
  - [ ] Add hamburger menu button

- [ ] `TokenInspector.tsx` - Convert to bottom sheet on mobile
  - [ ] Create responsive layout logic
  - [ ] Implement bottom sheet UI
  - [ ] Add drag handle and swipe gestures
  - [ ] Increase touch target sizes
  - [ ] Fix hover-only interactions

- [ ] `App.tsx` - Redesign toolbar for mobile
  - [ ] Create `MobileToolbar` component
  - [ ] Implement bottom navigation bar
  - [ ] Add overflow menu for secondary actions
  - [ ] Ensure 44px minimum touch targets

### **Priority 2: High (UX Improvements)**
- [ ] Fix all `onMouseEnter/onMouseLeave` interactions
  - [ ] `TokenInspector.tsx` - Replace with CSS or touch alternatives
  - [ ] `Sidebar.tsx` - Implement long-press for token actions
  - [ ] `AssetProcessingErrorBoundary.tsx` - Use CSS hover

- [ ] Implement responsive breakpoints
  - [ ] Create `src/hooks/useMediaQuery.ts`
  - [ ] Add breakpoint utilities
  - [ ] Update Tailwind config if needed

- [ ] Optimize modal dialogs
  - [ ] `LibraryManager.tsx` - Full-screen on mobile
  - [ ] `ImageCropper.tsx` - Touch gesture support
  - [ ] `AddToLibraryDialog.tsx` - Responsive width
  - [ ] `DungeonGeneratorDialog.tsx` - Full-screen on mobile
  - [ ] Prevent iOS input zoom (16px font-size)

### **Priority 3: Medium (Polish & Accessibility)**
- [ ] Increase touch target sizes across all components
  - [ ] Toolbar buttons: 44px height
  - [ ] Vision preset buttons: 44px height
  - [ ] Map navigator icons: 44px size
  - [ ] All interactive elements: 44x44px minimum

- [ ] Add one-finger pan to CanvasManager (optional)
  - [ ] Implement touch position tracking
  - [ ] Add pan gesture for single touch
  - [ ] Add visual feedback

- [ ] Mobile-specific optimizations
  - [ ] Add zoom level indicator
  - [ ] Add first-time tutorial overlay
  - [ ] Test performance on low-end devices
  - [ ] Optimize grid rendering on mobile

### **Priority 4: Low (Nice-to-Have)**
- [ ] Add landscape mode optimizations
- [ ] Implement tablet-specific layouts
- [ ] Add haptic feedback for touch interactions
- [ ] Test on various device sizes
- [ ] Add mobile-specific keyboard handling (virtual keyboard)

---

## Testing Strategy

### **Devices to Test:**

**Mobile (Portrait):**
- iPhone SE (375x667) - Smallest modern iPhone
- iPhone 14 Pro (393x852) - Standard iPhone
- Samsung Galaxy S21 (360x800) - Standard Android
- Google Pixel 5 (393x851) - Standard Android

**Mobile (Landscape):**
- iPhone SE (667x375)
- Samsung Galaxy S21 (800x360)

**Tablet (Portrait):**
- iPad (768x1024) - Minimum tablet size
- iPad Pro 11" (834x1194)

**Tablet (Landscape):**
- iPad (1024x768)
- iPad Pro 11" (1194x834)

### **Test Cases:**

1. **Sidebar Functionality:**
   - [ ] Opens/closes smoothly with hamburger menu
   - [ ] Swipe-to-close works correctly
   - [ ] Backdrop dismisses drawer
   - [ ] Token library items are draggable on mobile
   - [ ] Map upload works on mobile
   - [ ] Calibration mode works with touch

2. **Canvas Interaction:**
   - [ ] Pinch-to-zoom is smooth and responsive
   - [ ] Two-finger pan works correctly
   - [ ] Token drag-and-drop works with touch
   - [ ] Token selection works with tap
   - [ ] Drawing tools work with touch (marker, wall, eraser)

3. **Token Inspector:**
   - [ ] Opens as bottom sheet when token selected
   - [ ] Swipe-down-to-dismiss works
   - [ ] All buttons are touchable (44px minimum)
   - [ ] Form inputs work correctly on mobile
   - [ ] Vision radius presets work with tap

4. **Toolbar:**
   - [ ] All tools are accessible on mobile
   - [ ] Tool selection works correctly
   - [ ] Color picker works on mobile
   - [ ] Overflow menu shows secondary actions

5. **Modals:**
   - [ ] All modals fit on screen without horizontal scroll
   - [ ] Inputs don't trigger iOS zoom
   - [ ] Modals are dismissible on mobile
   - [ ] Full-screen modals have close button in top corner

6. **Performance:**
   - [ ] No lag when panning/zooming
   - [ ] Smooth 60fps animations
   - [ ] No memory leaks during extended use
   - [ ] Fast load times on 3G/4G

---

## Estimated Complexity

| Task | Estimated Hours | Complexity |
|------|----------------|------------|
| Sidebar → Drawer | 6-8 hours | Medium |
| Token Inspector → Bottom Sheet | 4-6 hours | Medium |
| Toolbar Redesign | 6-8 hours | High |
| Fix Hover Interactions | 3-4 hours | Low |
| Implement Media Queries | 2-3 hours | Low |
| Increase Touch Targets | 2-3 hours | Low |
| Optimize Modals | 4-5 hours | Medium |
| Testing & Bug Fixes | 8-10 hours | High |
| **Total** | **35-47 hours** | **~1 week** |

---

## Phase 2 Implementation Order

**Week 1:**
1. ✅ Implement `useMediaQuery` hook
2. ✅ Convert Sidebar to responsive drawer
3. ✅ Convert Token Inspector to bottom sheet
4. ✅ Redesign Toolbar for mobile

**Week 2:**
5. ✅ Fix all hover-only interactions
6. ✅ Increase touch target sizes
7. ✅ Optimize modal dialogs
8. ✅ Comprehensive testing on real devices

**Week 3 (Optional Enhancements):**
9. Add one-finger pan to canvas
10. Add tutorial overlay for first-time mobile users
11. Performance optimizations
12. Tablet-specific layout tweaks

---

## Success Criteria

The mobile refactor will be considered successful when:

1. ✅ **All UI elements are accessible on a 375px wide screen** (iPhone SE)
2. ✅ **No horizontal scrolling required** at any breakpoint
3. ✅ **All touch targets meet 44x44px minimum** (Apple HIG compliance)
4. ✅ **Canvas interactions work smoothly** (pinch zoom, two-finger pan, token drag)
5. ✅ **No hover-only features remain** (all interactions work on touch)
6. ✅ **Modals fit on screen** without overflow or horizontal scroll
7. ✅ **Performance is smooth** (60fps animations, no lag)
8. ✅ **App is usable in both portrait and landscape** orientations
9. ✅ **DM can run a full game session** using only a mobile device

---

## Risk Mitigation

### **Risk 1: Breaking Desktop UX**
**Mitigation:**
- Use feature detection, not device detection
- Test desktop layout at every step
- Keep desktop CSS separate from mobile CSS
- Use progressive enhancement (mobile-first approach)

### **Risk 2: Performance Degradation on Mobile**
**Mitigation:**
- Leverage existing viewport culling
- Test on low-end devices early
- Profile rendering performance
- Consider reduced grid density on mobile

### **Risk 3: Touch Conflicts with Konva**
**Mitigation:**
- Konva already has good touch support
- Carefully manage `e.preventDefault()` to avoid breaking native scroll
- Test extensively on real devices (not just Chrome DevTools)

### **Risk 4: Scope Creep**
**Mitigation:**
- Stick to Priority 1 and 2 items first
- Don't add new features during refactor
- Focus on "making it work" before "making it perfect"

---

## Appendix: Worst Mobile Offenders Summary

### 🔴 **Critical Blockers:**
1. **Sidebar is fixed at 256px (68% of phone screen width)**
   - File: `src/components/Sidebar.tsx:225`
   - Fix: Convert to slide-over drawer on mobile

2. **Token Inspector is fixed at 320px (85% of phone screen width)**
   - File: `src/components/TokenInspector.tsx:88`
   - Fix: Convert to bottom sheet on mobile

3. **Toolbar overflows horizontally (~800px toolbar on 375px screen)**
   - File: `src/App.tsx:283`
   - Fix: Redesign as bottom navigation bar on mobile

### 🟡 **High Priority:**
4. **No responsive breakpoints or media queries**
   - Impact: Layout never adapts to screen size
   - Fix: Implement mobile-first responsive design

5. **Hover-only interactions (delete buttons, hover states)**
   - Impact: Features are completely hidden on touch devices
   - Fix: Replace with touch-compatible interactions (long-press, CSS active states)

6. **Touch targets below 44px minimum**
   - Impact: Buttons are hard to tap accurately
   - Fix: Increase padding and min-height on all interactive elements

---

## Next Steps

1. **Get approval from team/stakeholder** on this plan
2. **Set up mobile testing environment** (real devices or BrowserStack)
3. **Create feature branch:** `feature/mobile-responsive-ui`
4. **Start with Priority 1 items** (Sidebar, Inspector, Toolbar)
5. **Test incrementally** after each component refactor
6. **Iterate based on user feedback**

---

**Plan Version:** 1.0
**Last Updated:** 2025-12-28
**Author:** Claude (AI Assistant)
**Status:** Awaiting Approval
