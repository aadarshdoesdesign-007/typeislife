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
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showInfluencePoints, setShowInfluencePoints] = useState<boolean>(true);
  const [showResidueHeatmap, setShowResidueHeatmap] = useState<boolean>(false);

  // Mechanics isolation switches
  const [mechanicsSwitches, setMechanicsSwitches] = useState<MechanicsSwitches>({
    gestures: true,
    speedRipple: true,
    headTracking: true,
    semanticMass: true,
    residue: true,
    attractMode: true,
    sound: true,
    hands: true
  });

  // Wall visualizations (active only while panel open)
  const [wallVisualizations, setWallVisualizations] = useState<WallVisualizations>({
    sourceTint: false,
    residueHeatmap: false,
    influenceDots: false
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
    droneActive: false
  });

  // Concept test modes: 'live' | 'fist' | 'two_hands' | 'wave_residue' | 'idle'
  // Always starts in 'live' mode on page load and reload. Never persists test mode.
  const [testMode, setTestMode] = useState<'live' | 'fist' | 'two_hands' | 'wave_residue' | 'idle'>('live');
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

  // Screen Wake Lock API (prevents installation screen sleep)
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

  // Track fullscreen changes and lock out test mode in kiosk/fullscreen mode
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

  // Vision tracking hook (GPU Delegate, Camera error handling & auto-retry)
  const {
    videoRef,
    videoElement,
    cameraStatus,
    latestPeopleRef,
    latestHandsRef,
    poseFps,
    detectionMs,
    activeDelegate
  } = useVisionTracking();

  const effectiveTrackedPeopleRef = useRef<TrackedPerson[]>([]);
  const effectiveTrackedHandsRef = useRef<TrackedHand[]>([]);

  const handleSetTestMode = (mode: 'live' | 'fist' | 'two_hands' | 'wave_residue' | 'idle') => {
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
    const syncRef = () => {
      lastWatchdogBeatRef.current = Date.now();
      const now = performance.now();
      if (testMode === 'idle') {
        effectiveTrackedPeopleRef.current = [];
        effectiveTrackedHandsRef.current = [];
      } else if (testMode === 'fist') {
        // Fist gesture: small concentrated radius, peak wght 900
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
          speed: 0.02,
          velocityX: 0,
          velocityY: 0,
          landmarks: createDummyLandmarks(0.38, 0.44),
          active: true,
          lastSeen: now
        }];
      } else if (testMode === 'two_hands') {
        // Two hands moving apart: stretches width axis between them
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
            speed: 0.02,
            velocityX: 0,
            velocityY: 0,
            landmarks: createDummyLandmarks(0.80, 0.45),
            active: true,
            lastSeen: now
          }
        ];
      } else if (testMode === 'wave_residue') {
        // Simulates hand waving across and moving away, leaving residue
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
      } else {
        effectiveTrackedPeopleRef.current = latestPeopleRef.current;
        effectiveTrackedHandsRef.current = latestHandsRef.current;
      }
      animId = requestAnimationFrame(syncRef);
    };
    animId = requestAnimationFrame(syncRef);
    return () => cancelAnimationFrame(animId);
  }, [testMode, latestPeopleRef, latestHandsRef]);

  useEffect(() => {
    setTimings((prev) => ({ ...prev, detectionMs }));
  }, [detectionMs]);

  // Global key bindings:
  // - Ctrl+Shift+D or D: Toggle Debug Overlay
  // - Ctrl+Shift+H: Toggle Mechanics Isolation Panel
  // - R: Clear residue memory
  // - F: Toggle fullscreen
  // - M: Toggle mute
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
        trackedPeopleRef={effectiveTrackedPeopleRef}
        trackedHandsRef={effectiveTrackedHandsRef}
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

