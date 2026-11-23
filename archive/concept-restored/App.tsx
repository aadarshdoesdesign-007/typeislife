import { useState, useEffect, useRef } from 'react';
import { TypographyCanvas } from './components/TypographyCanvas';
import { ManualControls } from './components/ManualControls';
import { DebugOverlay } from './components/DebugOverlay';
import { useVisionTracking } from './hooks/usePoseTracking';
import { audioEngine } from './services/audioEngine';
import type { FontAxisState, InstallationConfig, TrackedPerson, TrackedHand, PoseLandmark } from './types';
import { DEFAULT_CONFIG } from './constants/text';
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
  const [manualAxes, setManualAxes] = useState<FontAxisState>({
    wght: INSTALLATION_CONFIG.baseWght,
    wdth: INSTALLATION_CONFIG.baseWdth
  });

  const [config, setConfig] = useState<InstallationConfig>(DEFAULT_CONFIG);
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

  const [isDebugOpen, setIsDebugOpen] = useState<boolean>(true);
  const [isControlsOpen, setIsControlsOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showInfluencePoints, setShowInfluencePoints] = useState<boolean>(true);
  const [showResidueHeatmap, setShowResidueHeatmap] = useState<boolean>(false);

  // Concept test modes: 'live' | 'fist' | 'two_hands' | 'wave_residue' | 'idle'
  // Always starts in 'live' mode on page load and reload. Never persists test mode.
  const [testMode, setTestMode] = useState<'live' | 'fist' | 'two_hands' | 'wave_residue' | 'idle'>('live');
  const [testCountdown, setTestCountdown] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );

  const revertTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

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

  useEffect(() => {
    let animId: number;
    const syncRef = () => {
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
        // Two hands moving apart: stretches width axis between them!
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
            palmX: 0.20, // Left hand
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
            palmX: 0.80, // Right hand (stretched apart)
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

  // Auto-hide cursor logic
  const cursorTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const handleMouseMove = () => {
      document.body.classList.remove('hide-cursor');
      if (cursorTimerRef.current) window.clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = window.setTimeout(() => {
        if (!isDebugOpen) document.body.classList.add('hide-cursor');
      }, 2000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (cursorTimerRef.current) window.clearTimeout(cursorTimerRef.current);
    };
  }, [isDebugOpen]);

  // Global key bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === 'd' || e.key === 'D') {
        setIsDebugOpen((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      } else if (e.key === 'm' || e.key === 'M') {
        const muted = audioEngine.toggleMute();
        setIsMuted(muted);
      } else if (e.key === 'r' || e.key === 'R') {
        setShowResidueHeatmap((prev) => !prev);
      } else if (e.key === 'i' || e.key === 'I') {
        setShowInfluencePoints((prev) => !prev);
      } else if (e.key === 'c' || e.key === 'C') {
        setIsControlsOpen((prev) => !prev);
      } else if (e.key === '0') {
        setTestMode('live');
      } else if (!isFullscreen) {
        if (e.key === '1') {
          setTestMode('fist');
        } else if (e.key === '2') {
          setTestMode('two_hands');
        } else if (e.key === '3') {
          setTestMode('wave_residue');
        } else if (e.key === '4') {
          setTestMode('idle');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  return (
    <main
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#080808',
        overflow: 'hidden'
      }}
    >
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
        manualAxes={manualAxes}
        trackedPeopleRef={effectiveTrackedPeopleRef}
        trackedHandsRef={effectiveTrackedHandsRef}
        isDebugActive={isDebugOpen}
        showInfluencePoints={showInfluencePoints}
        showResidueHeatmap={showResidueHeatmap}
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
      />

      {isDebugOpen && (
        <ManualControls
          axes={manualAxes}
          setAxes={setManualAxes}
          config={config}
          setConfig={setConfig}
          isOpen={isControlsOpen}
          setIsOpen={setIsControlsOpen}
        />
      )}

      <DebugOverlay
        isVisible={isDebugOpen}
        fps={fps}
        poseFps={poseFps}
        timings={timings}
        activeDelegate={activeDelegate}
        currentAxes={manualAxes}
        avgAxes={avgAxes}
        trackedPeople={effectiveTrackedPeopleRef.current}
        trackedHands={effectiveTrackedHandsRef.current}
        cameraStatus={cameraStatus}
        videoElement={videoElement || videoRef.current}
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
    </main>
  );
}

export default App;
