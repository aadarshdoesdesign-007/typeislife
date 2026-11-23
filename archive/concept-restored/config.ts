/**
 * =========================================================================
 * "WORDS HAVE WEIGHT" — INSTALLATION TUNING CONFIGURATION
 * Master exhibition tuning: semantic mass, residue, gestures, attract mode.
 * =========================================================================
 */

export interface SemanticWordConfig {
  responsiveness: number; // Multiplier on target weight response
  inertia: number;        // Multiplier on letter mass (higher = settles slower)
}

// 1. SEMANTIC MASS TABLE (Editable per-word dictionary)
export const SEMANTIC_MASS_TABLE: Record<string, SemanticWordConfig> = {
  // Heavy monumental words: high responsiveness & monumental sluggish settling
  MASS: { responsiveness: 1.3, inertia: 2.4 },
  WEIGHT: { responsiveness: 1.3, inertia: 2.5 },
  MONUMENTAL: { responsiveness: 1.3, inertia: 2.8 },
  BURDEN: { responsiveness: 1.3, inertia: 2.6 },
  GRAVITATIONAL: { responsiveness: 1.3, inertia: 2.5 },
  ARCHITECTURE: { responsiveness: 1.3, inertia: 2.4 },
  BODIES: { responsiveness: 1.3, inertia: 2.2 },
  RESIDUE: { responsiveness: 1.3, inertia: 2.3 },

  // Light ethereal words: low responsiveness & fast snap-back
  AIRY: { responsiveness: 0.4, inertia: 0.45 },
  FRAGILITY: { responsiveness: 0.4, inertia: 0.40 },
  SILENCE: { responsiveness: 0.4, inertia: 0.50 },
  FLEETING: { responsiveness: 0.4, inertia: 0.45 },
  TRANSPARENT: { responsiveness: 0.4, inertia: 0.40 },
  RECEDING: { responsiveness: 0.4, inertia: 0.50 },
  RELEASES: { responsiveness: 0.4, inertia: 0.45 },
  UNSAID: { responsiveness: 0.4, inertia: 0.40 },
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

  // --- Residue Memory ---
  residueHalfLifeSeconds: 45, // Time in seconds for residue to halve
  residueAccumulationRate: 0.25, // How fast residue builds up per second under influence
  maxResidueWght: 500,        // Cap weight contributed by residue alone

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
  ambientWaveAmplitude: 26,

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
};

export type InstallationConfigType = typeof INSTALLATION_CONFIG;
