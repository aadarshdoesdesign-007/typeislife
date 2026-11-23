export type FontAxisState = {
  wght: number; // 200 - 900
  wdth: number; // 75 - 120
};

export type DominantContributor = 'none' | 'dwell' | 'residue' | 'idle';

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
  // Word associations
  word: string;
  wordId: string;
  wordResponsiveness: number;
  wordInertia: number;
  restingWght: number;
  restingWdth: number;
  // Physical residue memory
  residue: number; // 0..1
  lastDrawnWght: number;
  lastDrawnWdth: number;
  dominantContributor: DominantContributor;
};

export interface WordItem {
  id: string;
  word: string;
  lineIndex: number;
  charIndices: { lineIdx: number; charIdx: number }[];
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  dwellBuild: number;         // 0..1
  isSettled: boolean;
  settledAt: number;
  settledTimeLeft: number;
  activeVisitorIds: number[];
  responsiveness: number;
  inertia: number;
  restingWght: number;
  restingWdth: number;
}

export interface TextureFragmentItem {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  currentWght: number;
  targetWght: number;
  velocityWght: number;
  baseWght: number;
  baseWdth: number;
  opacity: number;
}

export interface MechanicsSwitches {
  dwellBuild: boolean;     // 1. Dwell build: stillness -> weight on nearest word
  settle: boolean;         // 2. Settle: word locks heavy + tone
  residue: boolean;        // 3. Residue: lingering weight after visitors leave
  semanticMass: boolean;   // 4. Semantic mass: per-word responsiveness/inertia
  headTracking: boolean;   // 5. Head tracking: nearest-word targeting
  idleLife: boolean;       // 6. Idle life: empty-room single-word wave
  sound: boolean;          // 7. Sound: drone + settle tones + pan
  hands: boolean;          // 8. Hands (disabled flag, off by default)
}

export interface WallVisualizations {
  sourceTint: boolean;     // Tint each glyph by dominant contributor
  dwellRings: boolean;     // Thin progress ring on target word per visitor
  residueHeatmap: boolean; // Faint overlay of residue per glyph
  wordLabels: boolean;     // Small tag above each word showing semantic multiplier
}

export interface MechanicsLiveTelemetry {
  dwellStatus: string;
  settledWordsCount: number;
  settledList: string;
  meanResidue: number;
  semanticMultiplierText: string;
  headScreenPosText: string;
  trackedVisitorsCount: number;
  idleLifeStatus: string;
  droneLevel: number;
  lastToneText: string;
  currentPan: number;
}

export type PoseLandmark = {
  x: number;
  y: number;
  z: number;
  visibility?: number;
};

export type InfluencePointType = 'palm' | 'fist' | 'nose' | 'shoulders' | 'wrist';

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
  stillTime: number;          // Continuous seconds spent still
  isStill: boolean;
  velocity: number;           // Head movement speed (px/s)
  targetWordId: string | null;
  targetWordText: string | null;
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

