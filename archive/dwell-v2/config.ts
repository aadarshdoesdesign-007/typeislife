/**
 * =========================================================================
 * "WORDS HAVE WEIGHT" — EXHIBITION CONFIGURATION
 * Monumental Typography Installation: Dwell Mechanic, Semantic Mass, Residue.
 * =========================================================================
 */

export interface SemanticWordConfig {
  responsiveness: number; // Multiplier on target weight response
  inertia: number;        // Multiplier on letter mass (higher = settles slower)
}

// 1. EXHIBITION TEXT LINES
export const INSTALLATION_TEXT_LINES: string[] = [
  "NOTHING",
  "HERE IS",
  "HEAVY",
  "UNTIL",
  "SOMEONE",
  "STAYS"
];

// Deliberate ragged left indents per line (percentage of canvas width)
export const LINE_INDENT_PERCENTAGES: number[] = [
  0.00,  // NOTHING (anchors to left base)
  0.18,  // HERE IS (ragged step)
  0.08,  // HEAVY (subtle indent)
  0.26,  // UNTIL (deep ragged step)
  0.12,  // SOMEONE (staggered)
  0.34   // STAYS (monumental anchor)
];

// 2. RESTING STATE TYPOGRAPHIC HIERARCHY
// No two words rest at the same weight/width. Each has its distinct presence.
export const WORD_RESTING_AXES: Record<string, { wght: number; wdth: number }> = {
  NOTHING: { wght: 200, wdth: 70 },
  HERE:    { wght: 290, wdth: 82 },
  IS:      { wght: 310, wdth: 86 },
  HEAVY:   { wght: 450, wdth: 100 },
  UNTIL:   { wght: 220, wdth: 72 },
  SOMEONE: { wght: 360, wdth: 90 },
  STAYS:   { wght: 500, wdth: 105 }
};

// 3. SECOND TIER BACKGROUND TEXTURE FRAGMENTS
// 6-8 very light, small lines of fragments around the big words as quiet background texture.
// They ripple softly at 0.3x when nearby words build or settle.
export interface TextureFragment {
  text: string;
  relX: number; // 0..1 horizontal screen position
  relY: number; // 0..1 vertical screen position
  baseWght: number;
  baseWdth: number;
  opacity: number;
}

export const BACKGROUND_TEXTURE_FRAGMENTS: TextureFragment[] = [
  { text: "WEIGHT", relX: 0.84, relY: 0.16, baseWght: 140, baseWdth: 75, opacity: 0.38 },
  { text: "ATTENTION", relX: 0.76, relY: 0.40, baseWght: 160, baseWdth: 75, opacity: 0.34 },
  { text: "STILL", relX: 0.08, relY: 0.56, baseWght: 120, baseWdth: 70, opacity: 0.36 },
  { text: "MASS", relX: 0.88, relY: 0.60, baseWght: 180, baseWdth: 80, opacity: 0.40 },
  { text: "REMAINS", relX: 0.12, relY: 0.74, baseWght: 150, baseWdth: 75, opacity: 0.35 },
  { text: "RESIDUE", relX: 0.82, relY: 0.86, baseWght: 170, baseWdth: 80, opacity: 0.42 },
  { text: "GRAVITATIONAL", relX: 0.50, relY: 0.94, baseWght: 130, baseWdth: 75, opacity: 0.28 },
  { text: "PRESENCE", relX: 0.06, relY: 0.10, baseWght: 130, baseWdth: 70, opacity: 0.30 }
];

// 4. SEMANTIC MASS TABLE
export const SEMANTIC_MASS_TABLE: Record<string, SemanticWordConfig> = {
  HEAVY:   { responsiveness: 1.4, inertia: 2.5 },
  STAYS:   { responsiveness: 1.4, inertia: 2.6 },
  NOTHING: { responsiveness: 0.5, inertia: 0.5 },
  HERE:    { responsiveness: 0.6, inertia: 0.55 },
  IS:      { responsiveness: 0.5, inertia: 0.5 },
  UNTIL:   { responsiveness: 0.6, inertia: 0.55 },
  SOMEONE: { responsiveness: 0.8, inertia: 0.8 }
};

export const DEFAULT_SEMANTIC_CONFIG: SemanticWordConfig = {
  responsiveness: 1.0,
  inertia: 1.0
};

// Configurable Dwell Seconds (default 20, set to 8 for testing as requested)
export const DWELL_SECONDS = 8;

// 5. MASTER INSTALLATION PARAMETERS
export const INSTALLATION_CONFIG = {
  // --- Font Axis Dynamic Ranges ---
  baseWght: 200,          // Raised floor
  maxWght: 900,           // Settle max weight
  baseWdth: 70,           // Floor width
  maxWdth: 125,           // Settle dramatic width

  // --- Resting Breathing & Texture ---
  breathingWghtDelta: 28, // ±28 wght per-letter harmonic breathing
  breathingSpeed: 0.45,   // Slow architectural breathing frequency
  textureRippleFactor: 0.30, // Texture fragments respond at 0.3x
  textureFontRatio: 0.22, // Size ratio of background fragments to main type

  // --- Dwell & Instant Feedback ---
  dwellBuildDurationSec: DWELL_SECONDS, // Set to 8s for testing (default 20)
  dwellReleaseDurationSec: 10.0,
  stillnessVelocityThreshold: 35.0,     // Head velocity (px/s)
  instantSwellWght: 130,                // Instant soft swell on visitor appearance (~0.5s)
  instantSwellRadiusPx: 420.0,
  dwellSpreadRadiusPx: 240.0,
  dwellTargetCaptureRadiusPx: 480.0,
  settledScaleFactor: 1.08,             // Slight dramatic scale-up inside slot when settled

  // --- Settle & Residue Memory ---
  settleToneCooldownMs: 2500,     // Rate-limit between settle chime sounds
  residueHalfLifeSeconds: 180.0,  // ~3 min half-life for lingering residue traces
  residueAccumulationRate: 0.50,  // Rate at which dwelling builds residue
  maxResidueWght: 550,            // Cap on weight contributed by residue alone

  // --- Life When Empty (Attract Mode) ---
  emptyRoomTriggerSec: 60.0,      // Seconds of zero visitors before empty life starts
  emptyRoomWaveDurationSec: 20.0, // Duration per word swell in empty room
  emptyRoomPeakWght: 620,         // Peak weight reached during empty life swell

  // --- Hand Tracking Flag ---
  enableHandTracking: false,      // Disabled by default; interaction is driven by head dwell

  // --- Physical Mass & Inertia ---
  baseMass: 1.0,
  maxMass: 3.5,
  springStiffness: 0.16,
  dampingRatio: 0.76,

  // --- Layout & Scaling ---
  blockHeightRatio: 0.86,         // Text block fills wall height and width with tighter leading
  lineSpacing: 1.30,              // Tighter leading for monumental architectural presence
  leftBaseMarginRatio: 0.08,      // Left base margin (8% of screen width)

  // --- Aesthetic Palette ---
  backgroundColor: '#000000',     // Pure black
  textColor: '#EDEAE2',           // Gallery off-white

  // --- Source Tint Palette (Mechanics Visualization) ---
  dwellTintColor: '#38bdf8',      // Cyan (Dwell build)
  residueTintColor: '#c084fc',    // Purple (Residue memory)
  idleTintColor: '#34d399',       // Emerald (Empty room life)

  // --- Web Audio Architecture ---
  masterVolume: 0.75,
  droneBaseFreq: 46,
  droneMaxFreq: 72,
  filterMinCutoff: 70,
  filterMaxCutoff: 260
};

export type InstallationConfigType = typeof INSTALLATION_CONFIG;
