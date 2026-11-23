import { useState, useEffect, useRef, useCallback } from 'react';
import { TypographyCanvas, type TypographyCanvasRef } from './components/TypographyCanvas';
import { DebugOverlay } from './components/DebugOverlay';
import { MechanicsPanel } from './components/MechanicsPanel';
import { useVisionTracking } from './hooks/usePoseTracking';
import { audioEngine } from './services/audioEngine';
import { soakLogger } from './utils/soakLogger';
import { INSTALLATION_CONFIG, DWELL_SECONDS } from './config';
import type {
  MechanicsSwitches,
  WallVisualizations,
  MechanicsLiveTelemetry,
  TrackedPerson,
  TrackedHand
} from './types';

export function App() {
  const [fps, setFps] = useState<number>(60);
  const [avgAxes, setAvgAxes] = useState<{ wght: number; wdth: number }>({
    wght: INSTALLATION_CONFIG.baseWght,
    wdth: INSTALLATION_CONFIG.baseWdth
  });

  const [timings, setTimings] = useState({
    detectionMs: 0,
    updateMs: 0.4,
    renderMs: 2.1
  });

  // EXHIBITION PASS: Normal mode has zero tooling, panels, or overlays visible
  const [isDebugOpen, setIsDebugOpen] = useState<boolean>(false);
  const [isMechanicsPanelOpen, setIsMechanicsPanelOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );

  // 3-Second visual fade-in on installation boot
  const [isMounted, setIsMounted] = useState<boolean>(false);

  // 8 Core Installation Mechanics Switches (Live on/off isolation)
  const [mechanicsSwitches, setMechanicsSwitches] = useState<MechanicsSwitches>({
    dwellBuild: true,
    settle: true,
    residue: true,
    semanticMass: true,
    headTracking: true,
    idleLife: true,
    sound: true,
    hands: false // Disabled flag by default
  });

  // Wall Visualizations (Only active while Mechanics Panel is open)
  const [wallVisualizations, setWallVisualizations] = useState<WallVisualizations>({
    sourceTint: false,
    dwellRings: true,
    residueHeatmap: false,
    wordLabels: true
  });

  // Telemetry reported from canvas to mechanics panel
  const [telemetry, setTelemetry] = useState<MechanicsLiveTelemetry>({
    dwellStatus: 'Waiting for visitor',
    settledWordsCount: 0,
    settledList: 'None',
    meanResidue: 0,
    semanticMultiplierText: 'None',
    headScreenPosText: 'No visitors',
    trackedVisitorsCount: 0,
    idleLifeStatus: 'Waiting (Visitors active)',
    droneLevel: 0,
    lastToneText: 'None',
    currentPan: 0
  });

  // Scripted Visitor Simulation Mode
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulatedTargetWord, setSimulatedTargetWord] = useState<string>('HEAVY');
  const [simulationSecondsLeft, setSimulationSecondsLeft] = useState<number>(0);
  const simStartTimeRef = useRef<number>(0);
  const simCountdownTimerRef = useRef<number | null>(null);
  const simEndTimeoutRef = useRef<number | null>(null);

  const canvasRef = useRef<TypographyCanvasRef | null>(null);

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

  // Sync tracked people with simulation override if active
  useEffect(() => {
    let animId: number;
    const syncEffectivePpl = () => {
      lastWatchdogBeatRef.current = Date.now();
      const now = performance.now();

      if (isSimulating) {
        // Map chosen word to representative screen coordinate
        let targetX = 0.5;
        let targetY = 0.45;
        const wUpper = simulatedTargetWord.toUpperCase();
        if (wUpper === 'NOTHING') { targetX = 0.26; targetY = 0.20; }
        else if (wUpper === 'HERE') { targetX = 0.36; targetY = 0.32; }
        else if (wUpper === 'IS') { targetX = 0.54; targetY = 0.32; }
        else if (wUpper === 'HEAVY') { targetX = 0.32; targetY = 0.46; }
        else if (wUpper === 'UNTIL') { targetX = 0.50; targetY = 0.60; }
        else if (wUpper === 'SOMEONE') { targetX = 0.38; targetY = 0.72; }
        else if (wUpper === 'STAYS') { targetX = 0.62; targetY = 0.86; }

        const elapsedSec = (now - simStartTimeRef.current) / 1000;

        effectiveTrackedPeopleRef.current = [{
          id: 1,
          nosePos: { x: targetX, y: targetY, visible: true },
          shoulderWidth: 0.24,
          depth: 0.90,
          stillTime: elapsedSec,
          isStill: true,
          velocity: 2.1,
          targetWordId: null,
          targetWordText: simulatedTargetWord,
          influencePoints: [],
          landmarks: [],
          active: true,
          lastSeen: now
        }];
        effectiveTrackedHandsRef.current = [];
      } else {
        effectiveTrackedPeopleRef.current = latestPeopleRef.current;
        effectiveTrackedHandsRef.current = latestHandsRef.current;
      }

      animId = requestAnimationFrame(syncEffectivePpl);
    };

    animId = requestAnimationFrame(syncEffectivePpl);
    return () => cancelAnimationFrame(animId);
  }, [isSimulating, simulatedTargetWord, latestPeopleRef, latestHandsRef]);

  useEffect(() => {
    setTimings((prev) => ({ ...prev, detectionMs }));
  }, [detectionMs]);

  // 3-second visual fade-in trigger on mount
  useEffect(() => {
    const t = window.setTimeout(() => setIsMounted(true), 50);
    return () => clearTimeout(t);
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

  // Track fullscreen changes: in kiosk mode, disable all debug & mechanics panels
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      setIsFullscreen(isFs);
      if (isFs) {
        setIsDebugOpen(false);
        setIsMechanicsPanelOpen(false);
        if (isSimulating) {
          setIsSimulating(false);
          canvasRef.current?.clearAllResidue();
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [isSimulating]);

  // Scripted Visitor Simulation Handler: runs for DWELL_SECONDS so it reaches full settle
  const handleSimulateVisitor = useCallback((word: string) => {
    if (isFullscreen) return;
    if (simCountdownTimerRef.current) clearInterval(simCountdownTimerRef.current);
    if (simEndTimeoutRef.current) clearTimeout(simEndTimeoutRef.current);

    const simDuration = DWELL_SECONDS;
    setSimulatedTargetWord(word);
    setIsSimulating(true);
    setSimulationSecondsLeft(simDuration);
    simStartTimeRef.current = performance.now();

    const startTime = performance.now();
    simCountdownTimerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((performance.now() - startTime) / 1000);
      const rem = Math.max(0, simDuration - elapsed);
      setSimulationSecondsLeft(rem);
      if (rem <= 0 && simCountdownTimerRef.current) {
        clearInterval(simCountdownTimerRef.current);
      }
    }, 250);

    // Run for DWELL_SECONDS + 1.5s so it holds full settle before auto-reverting
    simEndTimeoutRef.current = window.setTimeout(() => {
      setIsSimulating(false);
      setSimulationSecondsLeft(0);
      canvasRef.current?.clearAllResidue();
    }, (simDuration + 1.5) * 1000);
  }, [isFullscreen]);

  // Global key bindings:
  // - Ctrl+Shift+D: Toggle Debug Overlay (disabled in kiosk mode)
  // - Ctrl+Shift+H: Toggle Mechanics Isolation Panel (disabled in kiosk mode)
  // - R: Clear residue instantly
  // - F: Toggle fullscreen kiosk mode
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
      } else if (e.key === 'r' || e.key === 'R') {
        // Clear residue instantly (debug key)
        canvasRef.current?.clearAllResidue();
      } else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      } else if (e.key === 'm' || e.key === 'M') {
        const muted = audioEngine.toggleMute();
        setIsMuted(muted);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleToggleMechanic = (key: keyof MechanicsSwitches) => {
    setMechanicsSwitches((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleToggleVisualization = (key: keyof WallVisualizations) => {
    setWallVisualizations((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <main
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000000',
        overflow: 'hidden',
        cursor: 'none', // Global hidden cursor
        opacity: isMounted ? 1 : 0,
        transition: 'opacity 3s ease-in-out' // 3-second fade-in on start
      }}
    >
      {/* Hidden offscreen video decoder keeping webcam frames alive at 30fps */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: 640,
          height: 480,
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1000
        }}
      />

      {/* Main Exhibition Typographic Installation */}
      <TypographyCanvas
        ref={canvasRef}
        trackedPeopleRef={effectiveTrackedPeopleRef}
        trackedHandsRef={effectiveTrackedHandsRef}
        isMechanicsPanelOpen={isMechanicsPanelOpen}
        mechanicsSwitches={mechanicsSwitches}
        wallVisualizations={wallVisualizations}
        onFpsUpdate={(newFps) => {
          setFps(newFps);
          soakLogger.update(newFps, avgAxes.wght, effectiveTrackedPeopleRef.current.length);
        }}
        onMetricsUpdate={(wght, wdth) => {
          setAvgAxes({ wght, wdth });
          soakLogger.update(fps, wght, effectiveTrackedPeopleRef.current.length);
        }}
        onTimingUpdate={(updateMs, renderMs) => {
          setTimings((prev) => ({ ...prev, updateMs, renderMs }));
        }}
        onTelemetryUpdate={setTelemetry}
      />

      {/* Mechanics Isolation & Tuning Panel [Ctrl+Shift+H] */}
      <MechanicsPanel
        isOpen={isMechanicsPanelOpen && !isFullscreen}
        onClose={() => setIsMechanicsPanelOpen(false)}
        mechanicsSwitches={mechanicsSwitches}
        onToggleMechanic={handleToggleMechanic}
        wallVisualizations={wallVisualizations}
        onToggleVisualization={handleToggleVisualization}
        telemetry={telemetry}
        fps={fps}
        renderMs={timings.renderMs}
        onSimulateVisitor={handleSimulateVisitor}
        isSimulating={isSimulating}
        simulationSecondsLeft={simulationSecondsLeft}
        simulatedTargetWord={simulatedTargetWord}
        onClearResidue={() => canvasRef.current?.clearAllResidue()}
      />

      {/* Debug Profiler & Mirrored Camera Skeleton [Ctrl+Shift+D] */}
      <DebugOverlay
        isVisible={isDebugOpen && !isFullscreen}
        fps={fps}
        poseFps={poseFps}
        timings={timings}
        activeDelegate={activeDelegate}
        currentAxes={{ wght: avgAxes.wght, wdth: avgAxes.wdth }}
        avgAxes={avgAxes}
        trackedPeople={effectiveTrackedPeopleRef.current}
        trackedHands={effectiveTrackedHandsRef.current}
        cameraStatus={cameraStatus}
        videoElement={videoElement || videoRef.current}
        isFullscreen={isFullscreen}
        showInfluencePoints={false}
        onToggleShowInfluencePoints={() => {}}
        showResidueHeatmap={false}
        onToggleShowResidueHeatmap={() => {}}
        isMuted={isMuted}
      />
    </main>
  );
}

export default App;
