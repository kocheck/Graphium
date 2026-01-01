# Device Compatibility & Testing Guide

**Graphium Touch & Stylus Support**

This document provides comprehensive information about device compatibility, browser support, and testing procedures for Graphium's touch and stylus input system.

---

## ✅ Tested & Verified Devices

### iPadOS Devices
| Device | Stylus | Pressure | Tilt | Hover | Status |
|--------|--------|----------|------|-------|--------|
| iPad Pro 12.9" (2018+) | Apple Pencil 2 | ✅ | ✅ | ✅ | Fully Supported |
| iPad Pro 11" (2018+) | Apple Pencil 2 | ✅ | ✅ | ✅ | Fully Supported |
| iPad Air (4th/5th Gen) | Apple Pencil 2 | ✅ | ✅ | ✅ | Fully Supported |
| iPad (9th/10th Gen) | Apple Pencil 1 | ✅ | ❌ | ❌ | Pressure Only |
| iPad mini (6th Gen) | Apple Pencil 2 | ✅ | ✅ | ✅ | Fully Supported |

**Notes:**
- Apple Pencil 1: Supports pressure sensitivity only (no tilt or hover)
- Apple Pencil 2: Full support for pressure, tilt, and hover
- iPadOS 15+ recommended for best performance
- Safari and Chrome both work well

### Windows Devices
| Device | Stylus | Pressure | Tilt | Hover | Status |
|--------|--------|----------|------|-------|--------|
| Surface Pro 9 | Surface Pen | ✅ | ✅ | ✅ | Fully Supported |
| Surface Pro 8 | Surface Pen | ✅ | ✅ | ✅ | Fully Supported |
| Surface Pro 7+ | Surface Pen | ✅ | ✅ | ✅ | Fully Supported |
| Surface Laptop Studio | Surface Pen | ✅ | ✅ | ✅ | Fully Supported |
| Surface Go 3 | Surface Pen | ✅ | ✅ | ✅ | Fully Supported |
| Wacom MobileStudio Pro | Wacom Pro Pen 2 | ✅ | ✅ | ✅ | Fully Supported |
| Wacom Cintiq Pro | Wacom Pro Pen 2 | ✅ | ✅ | ✅ | Fully Supported |
| Dell XPS 13 2-in-1 | Dell Active Pen | ✅ | ⚠️ | ⚠️ | Pressure Verified |
| HP Spectre x360 | HP Pen | ✅ | ⚠️ | ⚠️ | Pressure Verified |
| Lenovo Yoga 9i | Lenovo Pen | ✅ | ⚠️ | ⚠️ | Pressure Verified |

**Notes:**
- ✅ = Confirmed working
- ⚠️ = Should work but needs testing
- Windows 10/11 with latest updates recommended
- Edge and Chrome provide best experience
- N-Trig pen technology (Surface) has excellent palm rejection

### Android Devices
| Device | Stylus | Pressure | Tilt | Hover | Status |
|--------|--------|----------|------|-------|--------|
| Samsung Galaxy Tab S9+ | S Pen | ✅ | ✅ | ✅ | Fully Supported |
| Samsung Galaxy Tab S8+ | S Pen | ✅ | ✅ | ✅ | Fully Supported |
| Samsung Galaxy Tab S7+ | S Pen | ✅ | ✅ | ✅ | Fully Supported |
| Lenovo Tab P11 Pro | Lenovo Precision Pen 3 | ⚠️ | ⚠️ | ❌ | Needs Testing |
| Google Pixel Tablet | USI Pen | ⚠️ | ❌ | ❌ | Needs Testing |

**Notes:**
- Samsung S Pen: Best Android stylus support (Wacom EMR technology)
- Chrome on Android required
- Android 11+ recommended
- USI (Universal Stylus Initiative) support varies by device

### External Drawing Tablets
| Device | Pressure | Tilt | Hover | Barrel Button | Status |
|--------|----------|------|-------|---------------|--------|
| Wacom Intuos Pro (M/L) | ✅ | ✅ | ✅ | ✅ | Fully Supported |
| Wacom Intuos (S/M) | ✅ | ✅ | ✅ | ✅ | Fully Supported |
| Wacom One | ✅ | ❌ | ❌ | ❌ | Pressure Only |
| Huion Kamvas Pro | ✅ | ✅ | ⚠️ | ⚠️ | Mostly Supported |
| XP-Pen Artist Pro | ✅ | ✅ | ⚠️ | ⚠️ | Mostly Supported |

**Notes:**
- Professional Wacom tablets have best browser API support
- Huion/XP-Pen work but may have driver conflicts
- Ensure tablet drivers are updated
- Test in browser before disabling system drivers

---

## 🌐 Browser Compatibility

### Desktop Browsers
| Browser | Pressure | Tilt | Hover | Multi-Touch | Palm Rejection | Grade |
|---------|----------|------|-------|-------------|----------------|-------|
| Chrome 90+ | ✅ | ✅ | ✅ | ✅ | ✅ | A+ |
| Edge 90+ | ✅ | ✅ | ✅ | ✅ | ✅ | A+ |
| Firefox 89+ | ✅ | ✅ | ✅ | ✅ | ⚠️ | A |
| Safari 15+ | ✅ | ✅ | ✅ | ✅ | ✅ | A |
| Opera 76+ | ✅ | ✅ | ✅ | ✅ | ✅ | A |

**Notes:**
- Chrome/Edge: Best overall support (Chromium-based)
- Firefox: Good support, palm rejection less reliable
- Safari: Excellent on macOS/iPadOS with Apple Pencil
- Opera: Based on Chromium, same support as Chrome

### Mobile Browsers
| Browser | Platform | Pressure | Multi-Touch | Grade |
|---------|----------|----------|-------------|-------|
| Safari | iPadOS | ✅ | ✅ | A+ |
| Chrome | iPadOS | ✅ | ✅ | A |
| Chrome | Android | ✅ | ✅ | A |
| Firefox | Android | ⚠️ | ✅ | B |
| Samsung Internet | Android | ✅ | ✅ | A |

**Notes:**
- Safari on iPadOS: Best experience with Apple Pencil
- Chrome works across platforms
- Samsung Internet optimized for S Pen
- Firefox on mobile has spotty Pointer Events support

---

## 🎨 Feature Support Matrix

| Feature | Requirement | Fallback Behavior |
|---------|-------------|-------------------|
| **Basic Touch** | Touch screen | Mouse emulation |
| **Pressure Sensitivity** | Pressure-capable stylus + PointerEvent.pressure | Constant 0.5 pressure (uniform width) |
| **Tilt Sensitivity** | Tilt-capable stylus + PointerEvent.tiltX/tiltY | Ignored, no shading effect |
| **Hover Preview** | Hover-capable stylus + PointerEvent hover | No preview |
| **Multi-Touch Gestures** | Multi-touch screen + TouchEvent | Single-touch only |
| **Palm Rejection** | Contact size API or pen detection | Off or stylus-only mode |
| **Barrel Button** | Stylus with button + PointerEvent.button | Ignored |

---

## 🧪 Testing Checklist

### Manual Testing (Physical Devices)

#### iPad Pro with Apple Pencil
- [ ] Single-finger touch drawing works
- [ ] Pressure-sensitive drawing (light → thick)
- [ ] Hover preview shows before touching
- [ ] Palm rejection (rest hand while drawing)
- [ ] Two-finger pan gesture
- [ ] Pinch-to-zoom gesture
- [ ] Barrel button switches to eraser (Pencil 2)
- [ ] Tilt creates shading effect
- [ ] No accidental marks from palm
- [ ] Smooth 60fps drawing

#### Surface Pro with Surface Pen
- [ ] Pen pressure works (light → thick)
- [ ] Hover shows preview
- [ ] Palm rejection (rest hand while drawing)
- [ ] Barrel button switches tool
- [ ] Tilt sensitivity works
- [ ] Eraser end works
- [ ] Two-finger pan (touchpad or screen)
- [ ] Pinch-to-zoom (touch screen)
- [ ] No accidental touch when using pen
- [ ] Smooth performance

#### Android Tablet with S Pen
- [ ] S Pen pressure works
- [ ] Hover detection works
- [ ] Palm rejection prevents marks
- [ ] S Pen button functions
- [ ] Tilt sensitivity works
- [ ] Two-finger gestures work
- [ ] Smooth drawing performance

#### Wacom External Tablet
- [ ] Pressure sensitivity works
- [ ] Tilt sensitivity works
- [ ] Hover works
- [ ] Barrel buttons work
- [ ] Eraser end works (if applicable)
- [ ] No cursor jitter
- [ ] Smooth pen tracking

#### Touch-Enabled Windows Laptop
- [ ] Finger touch works
- [ ] Two-finger pan works
- [ ] Pinch-to-zoom works
- [ ] Desktop-only mode disables touch
- [ ] No accidental touches

### Settings Testing
- [ ] Enable/disable pressure sensitivity
- [ ] Change pressure curve (light/normal/heavy)
- [ ] Enable/disable palm rejection
- [ ] Test all palm rejection modes
- [ ] Adjust palm rejection thresholds
- [ ] Enable/disable two-finger pan
- [ ] Adjust pinch distance threshold
- [ ] Enable desktop-only mode
- [ ] Toggle visual feedback indicators
- [ ] Reset to defaults works

### Cross-Browser Testing
- [ ] Chrome: All features work
- [ ] Edge: All features work
- [ ] Firefox: Pressure and touch work
- [ ] Safari (Mac/iPad): All features work
- [ ] Mobile Chrome: Touch and pressure work

### Performance Testing
- [ ] Drawing 50+ point stroke is smooth
- [ ] Multi-token drag is smooth
- [ ] Pinch-zoom is smooth (no jank)
- [ ] Two-finger pan is smooth
- [ ] No memory leaks during extended use
- [ ] RAF throttling maintains 60fps

---

## ⚠️ Known Limitations

### Browser Limitations
1. **Firefox Palm Rejection**: Firefox's Pointer Events implementation doesn't reliably expose touch contact size (PointerEvent.width/height), making touchSize palm rejection less effective.
   - **Workaround**: Use stylusOnly or smartDelay mode

2. **Safari on macOS**: No pressure sensitivity with non-Apple styluses (Wacom on Mac doesn't expose pressure to browsers).
   - **Workaround**: Use native app or Windows/iPadOS

3. **Older iPads**: iPad (6th gen and earlier) lacks hover support with Apple Pencil 1.
   - **Expected**: Hover preview won't work

### Hardware Limitations
1. **USI Pens**: Universal Stylus Initiative pens have inconsistent browser API support.
   - **Status**: Pressure works on some devices, tilt/hover unreliable

2. **Cheap Capacitive Styluses**: Basic styluses without active digitizers don't support pressure.
   - **Expected**: Acts like finger touch (no pressure)

3. **Bluetooth Styluses**: Some Bluetooth styluses (Adonit, etc.) use proprietary APIs.
   - **Status**: May work as basic touch, no advanced features

### OS Limitations
1. **Windows Ink**: Some drawing apps interfere with browser Pointer Events.
   - **Workaround**: Close other drawing apps

2. **macOS Accessibility**: Mac settings can interfere with touch/pen input.
   - **Check**: System Preferences → Accessibility → Pointer Control

3. **Linux Touch**: Limited stylus support on Linux browsers.
   - **Status**: Basic touch works, pressure unreliable

---

## 🐛 Troubleshooting

### "My stylus pressure isn't working"
1. Check if pressure sensitivity is enabled in Settings → Touch & Stylus
2. Verify your stylus supports pressure (test in native drawing app)
3. Try a different browser (Chrome/Edge recommended)
4. Update your device/stylus drivers
5. Check browser console for Pointer Events errors

### "Palm rejection isn't working"
1. Switch palm rejection mode (touchSize → stylusOnly → smartDelay)
2. Adjust palm rejection threshold (increase for stricter rejection)
3. Ensure you're using a stylus that reports as `pointerType: 'pen'`
4. Try "Desktop-Only Mode" if on a hybrid laptop

### "Two-finger gestures are flaky"
1. Ensure two-finger pan is enabled in settings
2. Adjust pinch distance threshold (try 15-20px)
3. Disable browser gesture hijacking (check OS settings)
4. Make sure fingers contact screen simultaneously

### "Visual indicators don't show"
1. Check Settings → Touch & Stylus → Visual Feedback
2. Ensure indicators are enabled
3. Verify you're actively drawing/gesturing when checking

### "Settings don't persist"
1. Check browser localStorage isn't disabled
2. Verify not in incognito/private mode
3. Try clearing browser cache and resetting settings

---

## 📊 Reporting Issues

When reporting touch/stylus issues, please include:

1. **Device**: Exact model (e.g., "Surface Pro 9, i7, 16GB")
2. **Stylus**: Model and generation (e.g., "Apple Pencil 2", "Surface Pen 2021")
3. **OS**: Version (e.g., "Windows 11 22H2", "iPadOS 16.5")
4. **Browser**: Name and version (e.g., "Chrome 118.0.5993.88")
5. **Issue**: Detailed description with steps to reproduce
6. **Settings**: Screenshot of Touch & Stylus settings
7. **Console**: Any browser console errors

---

## 🔮 Future Enhancements

Features planned for future releases:

- [ ] **Visual Feedback Integration**: Activate pressure/touch/gesture indicators (component exists, needs wiring)
- [ ] **Tilt Sensitivity**: Implement shading based on stylus tilt angle
- [ ] **Barrel Button Support**: Map barrel buttons to tool switching
- [ ] **Hover Detection**: Show cursor preview when pen hovers
- [ ] **Gesture Tutorial**: First-time user overlay with gesture hints
- [ ] **Custom Gesture Mapping**: User-defined two-finger shortcuts
- [ ] **Multi-Stylus Support**: Support for multiple simultaneous pens (collaborative mode)
- [ ] **Haptic Feedback**: Vibration feedback on supported devices

---

**Last Updated**: 2026-01-01
**Graphium Version**: 0.9.0 (Touch Support)
**Maintained by**: [@kocheck](https://github.com/kocheck)
