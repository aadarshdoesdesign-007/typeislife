export type FontAxisState = {
  wght: number; // 200 - 900
  wdth: number; // 70 - 125
};

export type DominantContributor = 'interaction' | 'silhouette' | 'residue' | 'idle' | 'none';

export type CharacterItem = {
  char: string;
  charIndex: number;
  lineIndex: number;
  x: number;
  y: number;
  slotWidth: number;
  currentWght: number;
  targetWght: number;
  velocityWght: number;
  currentWdth: number;
  targetWdth: number;
  velocityWdth: number;
  // Semantic mass properties
  word: string;
  wordResponsiveness: number;
  wordInertia: number;
  isHeavyWord?: boolean;
  isLightWord?: boolean;
  // Physical residue memory
  residue: number; // 0..1
  dominantContributor?: DominantContributor;
  lastDrawnWght: number;
  lastDrawnWdth: number;
  // Phase 1 Gravity & Offset physics (draw position only, no reflow)
  offsetX: number;
  targetOffsetX: number;
  velocityX: number;
  offsetY: number;
  targetOffsetY: number;
  velocityY: number;
  // Phase 3 Drop gesture state
  dropOffset: number;
  dropVelocity: number;
};

export type PoseLandmark = {
  x: number;
  y: number;
  z: number;
  visibility?: number;
};

export type InfluencePointType = 'palm' | 'fist' | 'nose' | 'shoulders' | 'wrist' | 'silhouette';

export type InfluencePoint = {
  id: string;
  type: InfluencePointType;
  x: number;
  y: number;
  depth: number;
  radiusPx: number;
  isFist?: boolean;
  label: string;
};

export type TrackedHand = {
  id: number;
  palmX: number;
  palmY: number;
  handSpan: number;
  depth: number;
  isFist: boolean;
  isOpen: boolean;
  rawIsFist: boolean;
  gestureChangedAt: number;
  fistHeldDurationMs: number; // Timestamp or ms fist has been held
  speed: number;
  velocityX: number;
  velocityY: number;
  landmarks: PoseLandmark[];
  active: boolean;
  lastSeen: number;
};

export type TrackedPerson = {
  id: number;
  nosePos: { x: number; y: number; visible: boolean };
  shoulderWidth: number;
  depth: number;
  influencePoints: InfluencePoint[];
  landmarks: PoseLandmark[];
  active: boolean;
  lastSeen: number;
};

export type CameraStatus = 'initializing' | 'active' | 'reconnecting' | 'denied' | 'not-found';

export type InstallationConfig = {
  minWght: number;
  maxWght: number;
  minWdth: number;
  maxWdth: number;
  fontSize: number;
  lineSpacing: number;
  letterSpacing: number;
  smoothingFactor: number;
  ambientBreathing: boolean;
  mouseTestMode: boolean;
};

export interface MechanicsSwitches {
  // Phase 0: Contrast Guard
  contrastGuard: boolean;
  // Phase 1: Gravity & Drift
  gravity: boolean;
  // Phase 2: Body Silhouette Segmentation
  bodySilhouette: boolean;
  // Phase 3: Drop Gesture
  dropGesture: boolean;
  // Core Baseline Mechanics
  gestures: boolean;
  speedRipple: boolean;
  headTracking: boolean;
  semanticMass: boolean;
  residue: boolean;
  attractMode: boolean;
  sound: boolean;
  hands: boolean;
}

export interface WallVisualizations {
  sourceTint: boolean;       // Tint glyphs by interaction source
  residueHeatmap: boolean;   // Purple ghost imprints of past presence
  influenceDots: boolean;    // Heads-up circles and projected tracking dots
  maskOutline: boolean;      // Phase 2 Body silhouette mask outline
}

export interface MechanicsLiveTelemetry {
  gestureStateText: string;
  handSpeedText: string;
  headPosText: string;
  trackedHandsCount: number;
  meanResidue: number;
  idleStatus: string;
  meanWeight: number;
  droneActive: boolean;
  silhouetteFps: number;
  silhouetteCoverage: number;
  lastDropInfo: string;
}
