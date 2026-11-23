import { useState, useEffect, useRef, useCallback } from 'react';
import { TypographyCanvas, type TypographyCanvasRef } from './components/TypographyCanvas';
import { DebugOverlay } from './components/DebugOverlay';
import { MechanicsPanel } from './components/MechanicsPanel';
import { useVisionTracking } from './hooks/usePoseTracking';
import { audioEngine } from './services/audioEngine';
import type {
  FontAxisState,
  TrackedPerson,
  TrackedHand,
  PoseLandmark,
  MechanicsSwitches,
  WallVisualizations,
  MechanicsLiveTelemetry
} from './types';
import { INSTALLATION_CONFIG } from './config';
import { soakLogger } from './utils/soakLogger';

function createDummyLandmarks(x: number, y: number): PoseLandmark[] {
  const lms: PoseLandmark[] = [];
  for (let i = 0; i < 21; i++) {
    lms.push({ x, y, z: 0 });
  }
  return lms;
}

// Generate a realistic synthetic body silhouette mask (128x72) for Phase 2 simulation
function createSimulatedSilhouetteMask(centerXNorm: number = 0.5): Uint8Array {
  const mask = new Uint8Array(128 * 72);
  const cx = Math.floor(centerXNorm * 128);
  for (let y = 0; y < 72; y++) {
    let halfWidth = 0;
    // Head (y = 8 to 20)
    if (y >= 8 && y <= 20) {
      const r = 6;
      const dy = y - 14;
      if (dy * dy <= r * r) {
        halfWidth = Math.sqrt(r * r - dy * dy);
      }
    }
    // Neck & Shoulders (y = 21 to 32)
    else if (y > 20 && y <= 32) {
      halfWidth = 4 + (y - 20) * 1.5; // expands to ~22px
    }
    // Torso (y = 33 to 55)
    else if (y > 32 && y <= 55) {
      halfWidth = 20 - (y - 33) * 0.25; // ~15-20px
    }
    // Legs (y = 56 to 71)
    else if (y > 55) {
      halfWidth = 14;
    }

    if (halfWidth > 0) {
      const minX = Math.max(0, Math.floor(cx - halfWidth));
      const maxX = Math.min(127, Math.ceil(cx + halfWidth));
      for (let x = minX; x <= maxX; x++) {
        mask[y * 128 + x] = 255;
      }
    }
  }
  return mask;
}

export function App() {
  const [fps, setFps] = useState<number>(60);
  const [avgAxes, setAvgAxes] = useState<FontAxisState>({
    wght: INSTALLATION_CONFIG.baseWght,
    wdth: INSTALLATION_CONFIG.baseWdth
  });

  const [timings, setTimings] = useState({
    detectionMs: 0,
    updateMs: 0.5,
    renderMs: 1.2
  });

  // Tooling visibility: hidden by default in normal exhibition mode
  const [isDebugOpen, setIsDebugOpen] = useState<boolean>(false);
  const [isMechanicsPanelOpen, setIsMechanicsPanelOpen] = useState<boolean>(false);
  const [fillScale, setFillScale] = useState<number>(INSTALLATION_CONFIG.fillScale);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showInfluencePoints, setShowInfluencePoints] = useState<boolean>(true);
  const [showResidueHeatmap, setShowResidueHeatmap] = useState<boolean>(false);

  // Mechanics isolation switches
  const [mechanicsSwitches, setMechanicsSwitches] = useState<MechanicsSwitches>({
    contrastGuard: true,
    gravity: true,
    bodySilhouette: true,
    dropGesture: true,
    gestures: true,
    speedRipple: true,
    headTracking: true,
    semanticMass: true,
    residue: true,
    attractMode: true,
    sound: true,
    hands: true,
    handRhythm: true
  });

  // Wall visualizations
  const [wallVisualizations, setWallVisualizations] = useState<WallVisualizations>({
    sourceTint: false,
    residueHeatmap: false,
    influenceDots: false,
    maskOutline: false
  });

  // Live telemetry for Mechanics panel
  const [telemetry, setTelemetry] = useState<MechanicsLiveTelemetry>({
    gestureStateText: 'None',
    handSpeedText: '0.00',
    headPosText: 'None',
    trackedHandsCount: 0,
    meanResidue: 0,
    idleStatus: 'Idle (0s)',
    meanWeight: 200,
    droneActive: false,
    silhouetteFps: 18,
    silhouetteCoverage: 0,
    lastDropInfo: 'None',
    rhythmBpm: 84,
    rhythmVoices: 0,
    lastRhythmHit: 'None'
  });

  // Concept test modes
  const [testMode, setTestMode] = useState<string>('live');
  const [testCountdown, setTestCountdown] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );

  const canvasRef = useRef<TypographyCanvasRef | null>(null);
  const revertTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // Watchdog: Restarts the page if the render loop stalls for 5s
  const lastWatchdogBeatRef = useRef<number>(Date.now());
  useEffect(() => {
    const watchdogInterval = window.setInterval(() => {
      const now = Date.now();
      if (now - lastWatchdogBeatRef.current > 5000) {
        console.warn('[WATCHDOG] Render loop stalled > 5000ms. Auto-reloading page for kiosk recovery.');
        window.location.reload();
      }
    }, 1000);

    return () => clearInterval(watchdogInterval);
  }, []);

  // Screen Wake Lock API
  useEffect(() => {
    let wakeLockSentinel: any = null;
    async function requestWakeLock() {
      if ('wakeLock' in navigator) {
        try {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        } catch {}
      }
    }
    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockSentinel) wakeLockSentinel.release().catch(() => {});
    };
  }, []);

  // Auto-revert simulated test mode to Live after 10 seconds
  useEffect(() => {
    if (revertTimerRef.current) window.clearTimeout(revertTimerRef.current);
    if (countdownIntervalRef.current) window.clearInterval(countdownIntervalRef.current);

    if (testMode !== 'live') {
      setTestCountdown(10);
      const startTime = performance.now();

      countdownIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((performance.now() - startTime) / 1000);
        const rem = Math.max(0, 10 - elapsed);
        setTestCountdown(rem);
        if (rem <= 0) {
          if (countdownIntervalRef.current) window.clearInterval(countdownIntervalRef.current);
        }
      }, 250);

      revertTimerRef.current = window.setTimeout(() => {
        setTestMode('live');
      }, 10000);
    } else {
      setTestCountdown(0);
    }

    return () => {
      if (revertTimerRef.current) window.clearTimeout(revertTimerRef.current);
      if (countdownIntervalRef.current) window.clearInterval(countdownIntervalRef.current);
    };
  }, [testMode]);

  // Track fullscreen changes
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      setIsFullscreen(isFs);
      if (isFs) {
        setTestMode('live');
        setIsDebugOpen(false);
        setIsMechanicsPanelOpen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Vision tracking hook
  const {
    videoRef,
    videoElement,
    cameraStatus,
    latestPeopleRef,
    latestHandsRef,
    latestMaskRef,
    poseFps,
    detectionMs,
    activeDelegate
  } = useVisionTracking();

  const effectiveTrackedPeopleRef = useRef<TrackedPerson[]>([]);
  const effectiveTrackedHandsRef = useRef<TrackedHand[]>([]);
  const effectiveMaskRef = useRef<Uint8Array | null>(null);

  const handleSetTestMode = (mode: string) => {
    if (isFullscreen && mode !== 'live') return;
    setTestMode(mode);
  };

  const handleClearResidue = useCallback(() => {
    canvasRef.current?.clearAllResidue();
  }, []);

  const handleToggleMechanic = useCallback((key: keyof MechanicsSwitches) => {
    setMechanicsSwitches((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleToggleVisualization = useCallback((key: keyof WallVisualizations) => {
    setWallVisualizations((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  useEffect(() => {
    let animId: number;
    let simFistStartTime = 0;
    let dropFired = false;

    const syncRef = () => {
      lastWatchdogBeatRef.current = Date.now();
      const now = performance.now();

      if (testMode === 'idle') {
        // Phase 0: Idle Room
        effectiveTrackedPeopleRef.current = [];
        effectiveTrackedHandsRef.current = [];
        effectiveMaskRef.current = null;
      } else if (testMode === 'palm_sweep') {
        // Phase 1: Open Palm Sweep across text (demonstrating heavy sag & light lift/drift)
        const sweepX = 0.5 + Math.sin(now * 0.0018) * 0.32;
        effectiveTrackedHandsRef.current = [{
          id: 1,
          palmX: sweepX,
          palmY: 0.45,
          handSpan: 0.22,
          depth: 0.95,
          isFist: false,
          isOpen: true,
          rawIsFist: false,
          gestureChangedAt: now,
          fistHeldDurationMs: 0,
          speed: 0.25,
          velocityX: 0.2,
          velocityY: 0,
          landmarks: createDummyLandmarks(sweepX, 0.45),
          active: true,
          lastSeen: now
        }];
        effectiveTrackedPeopleRef.current = [{
          id: 1,
          nosePos: { x: sweepX, y: 0.30, visible: true },
          shoulderWidth: 0.22,
          depth: 0.75,
          influencePoints: [],
          landmarks: [],
          active: true,
          lastSeen: now
        }];
        effectiveMaskRef.current = null;
      } else if (testMode === 'silhouette') {
        // Phase 2: One person standing with body silhouette mask coverage
        effectiveTrackedPeopleRef.current = [{
          id: 1,
          nosePos: { x: 0.48, y: 0.24, visible: true },
          shoulderWidth: 0.24,
          depth: 0.85,
          influencePoints: [],
          landmarks: [],
          active: true,
          lastSeen: now
        }];
        effectiveTrackedHandsRef.current = [];
        effectiveMaskRef.current = createSimulatedSilhouetteMask(0.48);
      } else if (testMode === 'fist_release') {
        // Phase 3: Fist held for > 300ms, then released to open palm (triggers drop)
        const cycle = (now % 3000); // 3-second cycle
        const isFistPhase = cycle < 1200; // Hold fist for 1.2s, then release to open palm

        if (isFistPhase) {
          dropFired = false;
          if (simFistStartTime === 0) simFistStartTime = now;
        } else {
          if (!dropFired && (now - simFistStartTime >= 300)) {
            dropFired = true;
            canvasRef.current?.triggerSimulatedDrop(window.innerWidth * 0.42, window.innerHeight * 0.45);
          }
          simFistStartTime = 0;
        }

        effectiveTrackedPeopleRef.current = [{
          id: 1,
          nosePos: { x: 0.42, y: 0.30, visible: true },
          shoulderWidth: 0.22,
          depth: 0.8,
          influencePoints: [],
          landmarks: [],
          active: true,
          lastSeen: now
        }];
        effectiveTrackedHandsRef.current = [{
          id: 1,
          palmX: 0.42,
          palmY: 0.45,
          handSpan: 0.22,
          depth: 0.95,
          isFist: isFistPhase,
          isOpen: !isFistPhase,
          rawIsFist: isFistPhase,
          gestureChangedAt: now,
          fistHeldDurationMs: isFistPhase ? (now - simFistStartTime) : 0,
          speed: 0.05,
          velocityX: 0,
          velocityY: 0,
          landmarks: createDummyLandmarks(0.42, 0.45),
          active: true,
          lastSeen: now
        }];
        effectiveMaskRef.current = null;
      } else if (testMode === 'fist') {
        effectiveTrackedPeopleRef.current = [{
          id: 1,
          nosePos: { x: 0.5, y: 0.35, visible: true },
          shoulderWidth: 0.22,
          depth: 0.75,
          influencePoints: [],
          landmarks: [],
          active: true,
          lastSeen: now
        }];
        effectiveTrackedHandsRef.current = [{
          id: 1,
          palmX: 0.38,
          palmY: 0.44,
          handSpan: 0.22,
          depth: 1.0,
          isFist: true,
          isOpen: false,
          rawIsFist: true,
          gestureChangedAt: now,
          fistHeldDurationMs: 800,
          speed: 0.02,
          velocityX: 0,
          velocityY: 0,
          landmarks: createDummyLandmarks(0.38, 0.44),
          active: true,
          lastSeen: now
        }];
        effectiveMaskRef.current = null;
      } else if (testMode === 'two_hands') {
        effectiveTrackedPeopleRef.current = [{
          id: 1,
          nosePos: { x: 0.5, y: 0.35, visible: true },
          shoulderWidth: 0.24,
          depth: 0.75,
          influencePoints: [],
          landmarks: [],
          active: true,
          lastSeen: now
        }];
        effectiveTrackedHandsRef.current = [
          {
            id: 1,
            palmX: 0.20,
            palmY: 0.45,
            handSpan: 0.20,
            depth: 0.85,
            isFist: false,
            isOpen: true,
            rawIsFist: false,
            gestureChangedAt: now,
            fistHeldDurationMs: 0,
            speed: 0.02,
            velocityX: 0,
            velocityY: 0,
            landmarks: createDummyLandmarks(0.20, 0.45),
            active: true,
            lastSeen: now
          },
          {
            id: 2,
            palmX: 0.80,
            palmY: 0.45,
            handSpan: 0.20,
            depth: 0.85,
            isFist: false,
            isOpen: true,
            rawIsFist: false,
            gestureChangedAt: now,
            fistHeldDurationMs: 0,
            speed: 0.02,
            velocityX: 0,
            velocityY: 0,
            landmarks: createDummyLandmarks(0.80, 0.45),
            active: true,
            lastSeen: now
          }
        ];
        effectiveMaskRef.current = null;
      } else if (testMode === 'wave_residue') {
        const waveX = 0.5 + Math.sin(now * 0.002) * 0.35;
        effectiveTrackedHandsRef.current = [{
          id: 1,
          palmX: waveX,
          palmY: 0.45,
          handSpan: 0.24,
          depth: 0.95,
          isFist: false,
          isOpen: true,
          rawIsFist: false,
          gestureChangedAt: now,
          fistHeldDurationMs: 0,
          speed: 0.4,
          velocityX: 0.3,
          velocityY: 0,
          landmarks: createDummyLandmarks(waveX, 0.45),
          active: true,
          lastSeen: now
        }];
        effectiveTrackedPeopleRef.current = [{
          id: 1,
          nosePos: { x: 0.5, y: 0.35, visible: true },
          shoulderWidth: 0.22,
          depth: 0.75,
          influencePoints: [],
          landmarks: [],
          active: true,
          lastSeen: now
        }];
        effectiveMaskRef.current = null;
      } else {
        effectiveTrackedPeopleRef.current = latestPeopleRef.current;
        effectiveTrackedHandsRef.current = latestHandsRef.current;
        effectiveMaskRef.current = latestMaskRef.current;
      }
      animId = requestAnimationFrame(syncRef);
    };
    animId = requestAnimationFrame(syncRef);
    return () => cancelAnimationFrame(animId);
  }, [testMode, latestPeopleRef, latestHandsRef, latestMaskRef]);

  useEffect(() => {
    setTimings((prev) => ({ ...prev, detectionMs }));
  }, [detectionMs]);

  // Global key bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (isCtrlOrMeta && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        if (!isFullscreen) setIsDebugOpen((prev) => !prev);
      } else if (isCtrlOrMeta && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
        e.preventDefault();
        if (!isFullscreen) setIsMechanicsPanelOpen((prev) => !prev);
      } else if (e.key === 'd' || e.key === 'D') {
        if (!isCtrlOrMeta && !e.altKey) {
          if (!isFullscreen) setIsDebugOpen((prev) => !prev);
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (!isCtrlOrMeta && !e.altKey) {
          handleClearResidue();
        }
      } else if (e.key === 'f' || e.key === 'F') {
        if (!isCtrlOrMeta && !e.altKey) {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        }
      } else if (e.key === 'm' || e.key === 'M') {
        if (!isCtrlOrMeta && !e.altKey) {
          audioEngine.initContext();
          const muted = audioEngine.toggleMute();
          setIsMuted(muted);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, handleClearResidue]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000000', overflow: 'hidden' }}>
      {/* Hidden webcam element for MediaPipe input */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          width: 640,
          height: 480,
          top: -9999,
          left: -9999
        }}
      />

      {/* Main Exhibition Typography Canvas */}
      <TypographyCanvas
        ref={canvasRef}
        fillScale={fillScale}
        trackedPeopleRef={effectiveTrackedPeopleRef}
        trackedHandsRef={effectiveTrackedHandsRef}
        silhouetteMaskRef={effectiveMaskRef}
        fps={fps}
        isDebugActive={isDebugOpen}
        showInfluencePoints={showInfluencePoints}
        showResidueHeatmap={showResidueHeatmap}
        isMechanicsPanelOpen={isMechanicsPanelOpen}
        mechanicsSwitches={mechanicsSwitches}
        wallVisualizations={wallVisualizations}
        onFpsUpdate={setFps}
        onMetricsUpdate={(wght, wdth) => {
          setAvgAxes({ wght, wdth });
          soakLogger.update(fps, wght, effectiveTrackedPeopleRef.current.length);
        }}
        onTimingUpdate={(updateMs, renderMs) => setTimings((prev) => ({ ...prev, updateMs, renderMs }))}
        onTelemetryUpdate={setTelemetry}
      />

      {/* Concept & Profiler Debug Overlay (Toggle via Ctrl+Shift+D or D) */}
      <DebugOverlay
        isVisible={isDebugOpen}
        fps={fps}
        poseFps={poseFps}
        timings={timings}
        activeDelegate={activeDelegate}
        currentAxes={avgAxes}
        avgAxes={avgAxes}
        trackedPeople={effectiveTrackedPeopleRef.current}
        trackedHands={effectiveTrackedHandsRef.current}
        silhouetteMask={effectiveMaskRef.current}
        cameraStatus={cameraStatus}
        videoElement={videoElement}
        testMode={testMode}
        testCountdown={testCountdown}
        isFullscreen={isFullscreen}
        onSetTestMode={handleSetTestMode}
        showInfluencePoints={showInfluencePoints}
        onToggleShowInfluencePoints={() => setShowInfluencePoints((prev) => !prev)}
        showResidueHeatmap={showResidueHeatmap}
        onToggleShowResidueHeatmap={() => setShowResidueHeatmap((prev) => !prev)}
        isMuted={isMuted}
      />

      {/* Mechanics Isolation Panel (Toggle via Ctrl+Shift+H) */}
      <MechanicsPanel
        isOpen={isMechanicsPanelOpen}
        onClose={() => setIsMechanicsPanelOpen(false)}
        fillScale={fillScale}
        onFillScaleChange={setFillScale}
        mechanicsSwitches={mechanicsSwitches}
        onToggleMechanic={handleToggleMechanic}
        wallVisualizations={wallVisualizations}
        onToggleVisualization={handleToggleVisualization}
        telemetry={telemetry}
        fps={fps}
        renderMs={timings.renderMs}
        testMode={testMode}
        testCountdown={testCountdown}
        onSetTestMode={handleSetTestMode}
        onClearResidue={handleClearResidue}
      />
    </div>
  );
}

export default App;
