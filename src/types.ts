export type FontAxisState = {
  wght: number; // 200 - 900
  wdth: number; // 70 - 125
};

export type DominantContributor = 'interaction' | 'residue' | 'idle' | 'none';

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
  // Physical residue memory
  residue: number; // 0..1
  dominantContributor?: DominantContributor;
  lastDrawnWght: number;
  lastDrawnWdth: number;
};

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
  gestures: boolean;        // 1. Physical Gestures (Open Palm, Fist, 2-Hand Stretch)
  speedRipple: boolean;     // 2. Hand Speed Ripple
  headTracking: boolean;    // 3. Head / Visitor Influence
  semanticMass: boolean;    // 4. Semantic Mass Dictionary
  residue: boolean;         // 5. Typographic Residue Memory
  attractMode: boolean;     // 6. Attract Mode Wave
  sound: boolean;           // 7. Architectural Drone & Settle Audio
  hands: boolean;           // 8. Hand Tracking Active
}

export interface WallVisualizations {
  sourceTint: boolean;      // Tint glyphs by interaction source
  residueHeatmap: boolean;  // Purple ghost imprints of past presence
  influenceDots: boolean;   // Heads-up circles and projected tracking dots
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
}
