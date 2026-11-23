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

  // Extended passage semantic vocabulary
  STILLNESS: { responsiveness: 0.4, inertia: 0.45, isLight: true },
  VOID: { responsiveness: 0.4, inertia: 0.40, isLight: true },
  INTENTION: { responsiveness: 1.3, inertia: 2.3, isHeavy: true },
  SHADOWS: { responsiveness: 1.2, inertia: 2.1, isHeavy: true },
  SIGNIFICANCE: { responsiveness: 1.3, inertia: 2.5, isHeavy: true },
  GRAVITY: { responsiveness: 1.3, inertia: 2.5, isHeavy: true },
  REMEMBERING: { responsiveness: 1.2, inertia: 2.3, isHeavy: true },
  LINGERED: { responsiveness: 1.2, inertia: 2.2, isHeavy: true },
  LANGUAGE: { responsiveness: 1.2, inertia: 2.0, isHeavy: true },
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
  residueHalfLifeSeconds: 25,    // Global half-life ~25-30s
  residueAccumulationRate: 0.22, // Rate of residue accumulation under deliberate influence
  residueInfluenceThreshold: 0.18,// Minimum influence threshold to prevent camera noise accumulation
  maxResidueWghtOffset: 150,     // Cap residue at wght +150 above resting weight (cap at 350w max)
  maxResidueWght: 500,           // Legacy unconstrained max residue floor
  targetIdleMean: 230,           // Target resting mean ~200-260
  idleMeanPullRate: 0.14,        // Active restorative pull restoring baseline when uninfluenced

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

  // --- Hand Rhythm Engine (Mechanic Row 9) ---
  rhythmBpm: 84,                // Global clock at 84 BPM
  rhythmQuantizeWindowSec: 0.030,// Max 30ms late quantization
  rhythmMaxVoices: 6,           // Cap at 6 simultaneous voices
  rhythmMaxHitsPerSecPerHand: 12,// Rate limit per hand: max 12 hits/sec
  rhythmDScalePentatonic: [73.42, 87.31, 98.00, 110.00, 130.81, 146.83, 174.61, 196.00, 220.00, 261.63], // D minor pentatonic (D2 to C4)
  rhythmDuckingGain: 0.707,     // Duck drone by ~3dB while hits play
  rhythmStillnessTimeoutMs: 300,// Hand still = silence within 300ms

  // --- Exhibition Kiosk & Layout ---
  targetFps: 60,
  lineSpacing: 1.48,
  minLineSpacing: 1.25,
  maxLineSpacing: 1.60,
  slotPadding: 0.8,
  targetWidthRatio: 0.92,   // Target ~92% of canvas width
  targetHeightRatio: 0.88,  // Target ~88% of canvas height
  minMarginRatio: 0.03,     // Minimum ~3% margin around block
  layoutFadeDurationMs: 300,// Short cross-fade on resize / fullscreen
  wordSpacingFactor: 0.38,  // Constant word-to-word space: 0.38 * fontSize

  // --- Aesthetic Exhibition Palette ---
  backgroundColor: '#000000',
  textColor: '#EDEAE2',
  interactionTintColor: '#38bdf8',
  residueTintColor: '#c084fc',
  idleTintColor: '#34d399',
  silhouetteTintColor: '#3b82f6',
};

export const EXHIBITION_PASSAGES = {
  paragraph1:
    "WORDS HAVE WEIGHT. THEY ARE NOT MERELY SYMBOLS ENGRAVED UPON AIR; THEY CARRY MASS, RESISTANCE, AND THE GRAVITATIONAL PULL OF STONE. WHEN YOU STEP CLOSER, MEANING BECOMES MONUMENTAL AND DENSE, BEARING DOWN UPON THE CANVAS OF THE ROOM WITH VISCERAL FORCE. RECEDING RELEASES THEIR TENSION, DISSOLVING INTO AIRY TRACES. EVERY GESTURE ALTERS THE EQUILIBRIUM BETWEEN PRESENCE AND SILENCE. PROXIMITY BREEDS WEIGHT. DISTANCE YIELDS TRANSPARENT FRAGILITY. OBSERVE HOW EACH LETTER ACCEPTS THE BURDEN OF YOUR ATTENTION. WE ARE THE BODIES THAT GIVE ARCHITECTURE TO FLEETING THOUGHTS. STAND STILL AND WEIGH THE RESIDUE OF WHAT REMAINS UNSAID.",
  paragraph2:
    "WHAT ACCUMULATES IN STILLNESS IS NOT INERTIA BUT INTENTION. THE BODY CASTS SHADOWS OF SIGNIFICANCE ACROSS THE VOID. EACH WORD WAITS TO BE FILLED WITH VISCERAL GRAVITY, REMEMBERING WHERE YOU LINGERED LONG AFTER YOU HAVE TURNED AWAY. SILENCE WEIGHS HEAVIEST WHERE LANGUAGE WAS ONCE MONUMENTAL."
};

export type InstallationConfigType = typeof INSTALLATION_CONFIG;
