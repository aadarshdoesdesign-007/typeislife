# Words Have Weight

An interactive typographic installation exploring semantic mass, visitor presence, physical gestures, and architectural memory.

*Words Have Weight* is designed as a large-scale wall projection in a gallery or exhibition space. As visitors approach, stand, move, and gesture in front of the wall, the typography responds physically: letters expand in weight and width, heavy words sag with gravity, light words lift and drift, and lingering presence leaves faint ghost imprints that slowly dissolve over time.

---

## The Concept

Typography is not merely ink or light on a surface; it carries physical presence and gravitational mass.

- **Semantic Mass**: High-impact words (`MASS`, `WEIGHT`, `MONUMENTAL`, `BURDEN`, `GRAVITATIONAL`, `ARCHITECTURE`, `BODIES`, `RESIDUE`) respond with sluggish, heavy inertia and settling weight. Ethereal words (`AIRY`, `FRAGILITY`, `SILENCE`, `FLEETING`, `TRANSPARENT`, `RECEDING`, `RELEASES`, `UNSAID`) respond with light sensitivity, quick recovery, and subtle vertical float.
- **Physical Gestures**:
  - **Open Palm**: Wide, moderate gravitational swell.
  - **Closed Fist ("Weight")**: Concentrates typographic density into a tight radius with peak `wght: 900`.
  - **Two-Hand Horizontal Stretch**: Dynamically widens the variable width axis (`wdth` up to 125%) between the hands.
  - **Drop Gesture**: Clenching a fist for 300ms and releasing into an open palm triggers a gravity drop where letters fall 12–20px and spring back over ~1.2s.
- **Typographic Residue**: Interactions leave persistent ghost traces on the wall that exponentially decay over a 30–45s half-life, so visitors discover the imprints of earlier presences.
- **Architectural Web Audio**: A sub-bass drone and resonant filter follow the canvas mean weight, with tactile low-frequency settling thuds when heavy letters lock into place.
- **Attract Mode & Breathing**: When unattended, the installation breathes with subtle multi-harmonic oscillations ($\pm 24\text{ wght}$), sweeping a gravitational wave across the wall every 25 seconds after 60 seconds of inactivity.

---

## Technology Stack

- **Framework**: React 19 + TypeScript + Vite
- **Typography Engine**: Variable Font Canvas (`Roboto Flex Variable` full axes: `wght` 100–1000, `wdth` 25–151%)
- **Rendering Performance**: Pre-rendered OffscreenCanvas Glyph Atlas (< 4ms per frame, RAF-locked at 60 FPS) with dirty-slot tracking and alpha-blended axis quantization
- **Computer Vision & Tracking**:
  - Google MediaPipe Tasks Vision (`PoseLandmarker`, `HandLandmarker`, `ImageSegmenter`)
  - WebGL / GPU Delegate execution
  - Decoupled detection loop running at 18–30 FPS
  - 1€ Filter (OneEuroFilter) jitter reduction
- **Audio Synthesis**: Native Web Audio API (stereo sub-bass oscillators, biquad filter modulation, transient dynamics compressor)
- **Offline Self-Containment**: Zero external CDN dependencies; all MediaPipe WASM binaries and AI task models are bundled locally in `public/`.

---

## Quick Start & Running Locally

### Prerequisites
- Node.js 18+ (tested on Node 20 / 22)
- Webcam (built-in or USB wide-angle webcam)

### Installation
```bash
# Clone the repository
git clone https://github.com/aadarshdoesdesign-007/typeislife.git
cd typeislife

# Install dependencies
npm install

# Start development server
npm run dev
```

Open your browser to `http://localhost:3000/` (or the URL shown in terminal).

### Production Build & Local Preview
```bash
# Typecheck & build
npm run build

# Preview optimized production build
npm run preview
```

---

## Exhibition Controls & Keybindings

All tooling is completely hidden in normal exhibition mode. Control the installation using the keyboard:

| Keybinding | Function | Description |
| :--- | :--- | :--- |
| **`F`** | **Toggle Fullscreen Kiosk** | Enters borderless fullscreen, hides cursor, and locks out test tooling for clean exhibition display. |
| **`M`** | **Toggle Mute** | Mutes or unmutes the Web Audio drone and settling sound effects. (Audio initializes on first user click or keypress per browser autoplay policy). |
| **`R`** | **Clear Residue** | Instantly purges all lingering typographic residue imprints from the wall. |
| **`Ctrl + Shift + D`** (or **`D`**) | **Concept & Profiler Overlay** | Shows live render FPS, CV FPS, frame timings breakdown (detection, update, render), GPU delegate status, live 15 FPS webcam skeleton feed, and simulation presets. |
| **`Ctrl + Shift + H`** | **Mechanics Isolation Panel** | Live switches to toggle individual mechanics on/off (`Contrast Guard`, `Physical Gravity`, `Body Silhouette`, `Drop Gesture`, `Semantic Mass`, `Residue`, `Attract Mode`, `Sound`), plus wall visualizers (`Source Tint`, `Mask Outline`, `Residue Ghost`, `Influence Dots`). |

---

## Exhibition & Gallery Setup

```
   [ Projector ]
        │
        ▼ (Full wall throw)
┌──────────────────────────────────────────────┐
│                                              │
│             WORDS HAVE WEIGHT...             │
│                                              │
│                                              │
└──────────────────────────────────────────────┘
       ▲
       │ [ Camera ] (Wide-angle, base of wall facing out)
       │
    ~1.5 - 2.0 m
       │
       ▼
   ─── [ Floor Marker ] ─── (Visitor sweet spot)
```

1. **Space & Lighting**:
   - Darkened room with low ambient light to maximize high-contrast projection (pure void `#000000`, warm bone `#EDEAE2`).
2. **Camera Placement**:
   - Place a wide-angle webcam (60°–90° FOV) centered at the base of the projection wall or mounted directly below the screen, angled slightly upward toward incoming visitors.
   - The vision tracking automatically mirrors coordinates horizontally so movement maps naturally (moving to the visitor's right affects the right side of the projection).
3. **Visitor Sweet Spot**:
   - Place a subtle floor marker ~1.5 to 2.0 meters out from the wall. At this distance, a visitor's head and hands command approximately one-third of the text block.
4. **Projection Calibration**:
   - The layout algorithm dynamically calculates margins so the text block stays centered within $\le 84\%$ canvas width and $\le 80\%$ canvas height on both $1920 \times 1080$ and $1280 \times 720$, ensuring zero edge clipping on any standard projector.
5. **Kiosk Stability**:
   - Screen Wake Lock API is enabled automatically to prevent OS sleep.
   - An internal watchdog monitors the RAF loop and auto-recovers the page if stalled for $> 5\text{s}$.
   - Press **`F`** to enter kiosk mode before opening the gallery doors.

---

## Tuning Configuration (`src/config.ts`)

Master installation physics, gesture thresholds, and visual constants are configured in [src/config.ts](src/config.ts):

- `baseWght` (`200`): Resting weight floor ensuring far-distance legibility.
- `maxWght` (`900`): Maximum reachable weight envelope under concentrated visitor interaction.
- `baseWdth` (`70`): Natural resting width axis percentage.
- `maxWdth` (`125`): Maximum reachable expanded width envelope under two-hand stretch.
- `residueHalfLifeSeconds` (`30`): Exponential decay half-life for visitor memory traces.
- `maxResidueWghtOffset` (`150`): Contrast guard cap preventing residue from washing out into uniform heaviness.
- `heavyMaxSagPx` (`8.0`): Maximum baseline sag for heavy semantic keywords.
- `lightMaxLiftPx` (`6.0`): Maximum upward lift for light ethereal keywords.
- `fistHoldTriggerMs` (`300`): Hold threshold before fist release triggers a drop gesture.
- `SEMANTIC_MASS_TABLE`: Editable per-word dictionary mapping exhibition keywords to custom responsiveness and physical inertia multipliers.

---

## Branches & Versions

- **`main`** (`v1-locked`): The approved reference exhibition build with full 10-line monumental paragraph, physical gestures (palm, fist, two-hand stretch), semantic mass, typographic residue, idle breathing, and Web Audio.
- **`interaction-v2`**: Advanced multi-phase physical mechanics adding Phase 0 Contrast Guard, Phase 1 Gravity Sag & Drift, Phase 2 Body Silhouette Segmentation, and Phase 3 Drop Gesture.
- **`dwell-v2`**: Experimental 6-line short text dwell-build exhibition pass archived for reference.

---

## License

Created for exhibition and installation research.
