/**
 * =========================================================================
 * "WORDS HAVE WEIGHT" — INSTALLATION TUNING CONFIGURATION
 * Master exhibition tuning: semantic mass, residue, gestures, attract mode,
 * Phase 0 Contrast Guard, Phase 1 Gravity, Phase 2 Silhouette, Phase 3 Drop.
 * =========================================================================
 */

export interface SemanticWordConfig {
  responsiveness: number; // Multiplier on target weight response
  inertia: number;        // Multiplier on letter mass (higher = settles slower)
  isHeavy?: boolean;
  isLight?: boolean;
}

// 1. SEMANTIC MASS TABLE (Editable per-word dictionary)
export const SEMANTIC_MASS_TABLE: Record<string, SemanticWordConfig> = {
  // Heavy monumental words: sag up to 8px below baseline, high responsiveness & sluggish settling
  MASS: { responsiveness: 1.3, inertia: 2.4, isHeavy: true },
  WEIGHT: { responsiveness: 1.3, inertia: 2.5, isHeavy: true },
  MONUMENTAL: { responsiveness: 1.3, inertia: 2.8, isHeavy: true },
  BURDEN: { responsiveness: 1.3, inertia: 2.6, isHeavy: true },
  GRAVITATIONAL: { responsiveness: 1.3, inertia: 2.5, isHeavy: true },
  ARCHITECTURE: { responsiveness: 1.3, inertia: 2.4, isHeavy: true },
  BODIES: { responsiveness: 1.3, inertia: 2.2, isHeavy: true },
  RESIDUE: { responsiveness: 1.3, inertia: 2.3, isHeavy: true },

  // Light ethereal words: lift up to 6px & drift 2-3px, low responsiveness & fast snap-back
  AIRY: { responsiveness: 0.4, inertia: 0.45, isLight: true },
  FRAGILITY: { responsiveness: 0.4, inertia: 0.40, isLight: true },
  SILENCE: { responsiveness: 0.4, inertia: 0.50, isLight: true },
  FLEETING: { responsiveness: 0.4, inertia: 0.45, isLight: true },
  TRANSPARENT: { responsiveness: 0.4, inertia: 0.40, isLight: true },
  RECEDING: { responsiveness: 0.4, inertia: 0.50, isLight: true },
  RELEASES: { responsiveness: 0.4, inertia: 0.45, isLight: true },
  UNSAID: { responsiveness: 0.4, inertia: 0.40, isLight: true },
};

export const DEFAULT_SEMANTIC_CONFIG: SemanticWordConfig = {
  responsiveness: 1.0,
  inertia: 1.0
};

export const INSTALLATION_CONFIG = {
  // --- Font Axis Dynamic Ranges ---
  baseWght: 200,       // Raised light floor so resting text stays legible
  maxWght: 900,        // Capped maximum reachable weight envelope
  baseWdth: 70,        // Raised width floor for natural resting typography
  maxWdth: 125,        // Capped maximum reachable width envelope

  // --- Phase 0: Contrast Guard & Residue Memory ---
  residueHalfLifeSeconds: 30,    // Global half-life ~30s
  residueAccumulationRate: 0.25, // How fast residue builds up per second under influence
  maxResidueWghtOffset: 150,     // Cap residue at wght +150 above resting weight (cap at 350w max)
  maxResidueWght: 500,           // Legacy unconstrained max residue floor
  targetIdleMean: 230,           // Slow pull of resting mean toward ~230-250
  idleMeanPullRate: 0.06,        // Gentle decay restoring pull when room is quiet

  // --- Phase 1: Physical Gravity Offsets ---
  heavyMaxSagPx: 8.0,            // Heavy words sag up to 8px below baseline
  lightMaxLiftPx: 6.0,           // Light words lift up to 6px above baseline
  lightMaxDriftPx: 2.8,          // Light words drift sideways 2-3px
  gravitySpringStiffness: 0.12,  // Spring settle stiffness
  gravityDampingRatio: 0.75,     // Damping ratio for offset settles

  // --- Phase 2: Body Silhouette Segmentation ---
  maskWidth: 128,                // Downscaled mask ~128x72
  maskHeight: 72,
  silhouetteTargetFps: 18,       // Staggered 15-20 FPS
  silhouetteCoverageScale: 1.25, // Multiplier for soft-edge mask sampling
  fpsFallbackThreshold: 40,      // Fallback to head/hands only if FPS drops below 40

  // --- Phase 3: Drop Gesture ---
  fistHoldTriggerMs: 300,        // Fist held for 300ms before release
  minDropDistPx: 12,             // Light/medium letters drop 12px
  maxDropDistPx: 20,             // Heavy letters drop 20px
  dropCooldownMs: 1500,          // Rate-limited to one drop per hand every 1.5s
  dropRadiusPx: 450,             // Letters within hand's radius
  dropRecoveryDurationSec: 1.2,  // Spring back over ~1.2s

  // --- Gestural Fields ---
  openPalmRadius: 650,        // Wide, moderate influence
  openPalmDepthMult: 0.82,
  fistRadius: 260,            // Small, maximum density
  fistDepthMult: 1.0,         // Forces peak wght 900
  twoHandStretchMaxDist: 850, // Screen distance over which width reaches maxWdth 125%
  gestureDebounceMs: 150,     // 150ms gesture classification debounce
  falloffExponent: 2.0,       // Smooth cosine quadratic falloff

  // --- Attract Mode ---
  attractModeIdleTriggerSec: 60, // Seconds of zero visitors before attract wave starts
  attractWavePeriodSec: 25,      // Wave triggers once every 25s
  attractWaveDurationSec: 4.5,   // Duration of a single sweeping wave
  attractWavePeakWght: 650,      // Peak weight of attract wave

  // --- Physical Inertia & Mass Physics ---
  baseMass: 1.0,
  maxMass: 3.4,
  springStiffness: 0.14,
  dampingRatio: 0.76,
  settleThumpThreshold: 26,

  // --- Transition & Cross-fading ---
  presenceFadeDurationMs: 800,
  ambientWaveSpeed: 0.65,
  ambientWaveAmplitude: 24,

  // --- Architectural Web Audio ---
  masterVolume: 0.75,
  droneBaseFreq: 46,
  droneMaxFreq: 74,
  filterMinCutoff: 75,
  filterMaxCutoff: 280,
  thumpCooldownMs: 600,

  // --- Exhibition Kiosk & Layout ---
  targetFps: 60,
  lineSpacing: 1.50,
  slotPadding: 0.8,

  // --- Aesthetic Exhibition Palette ---
  backgroundColor: '#000000',
  textColor: '#EDEAE2',
  interactionTintColor: '#38bdf8',
  residueTintColor: '#c084fc',
  idleTintColor: '#34d399',
  silhouetteTintColor: '#3b82f6',
};

export type InstallationConfigType = typeof INSTALLATION_CONFIG;
