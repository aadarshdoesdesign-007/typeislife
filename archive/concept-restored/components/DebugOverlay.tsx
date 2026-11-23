import React, { useEffect, useRef } from 'react';
import type { FontAxisState, TrackedPerson, TrackedHand, CameraStatus } from '../types';

interface FrameTimings {
  detectionMs: number;
  updateMs: number;
  renderMs: number;
}

interface DebugOverlayProps {
  isVisible: boolean;
  fps: number;
  poseFps: number;
  timings: FrameTimings;
  activeDelegate: string;
  currentAxes: FontAxisState;
  avgAxes: FontAxisState;
  trackedPeople: TrackedPerson[];
  trackedHands: TrackedHand[];
  cameraStatus: CameraStatus;
  videoElement: HTMLVideoElement | null;
  testMode?: 'live' | 'fist' | 'two_hands' | 'wave_residue' | 'idle';
  testCountdown?: number;
  isFullscreen?: boolean;
  onSetTestMode?: (mode: 'live' | 'fist' | 'two_hands' | 'wave_residue' | 'idle') => void;
  showInfluencePoints: boolean;
  onToggleShowInfluencePoints: () => void;
  showResidueHeatmap: boolean;
  onToggleShowResidueHeatmap: () => void;
  isMuted?: boolean;
}

const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 23], [12, 24], // torso
  [23, 24], // hips
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
  [11, 0], [12, 0] // neck/nose
];

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

export const DebugOverlay: React.FC<DebugOverlayProps> = ({
  isVisible,
  fps,
  poseFps,
  timings,
  activeDelegate,
  currentAxes,
  avgAxes,
  trackedPeople,
  trackedHands,
  cameraStatus,
  videoElement,
  testMode = 'live',
  testCountdown = 0,
  isFullscreen = false,
  onSetTestMode,
  showInfluencePoints,
  onToggleShowInfluencePoints,
  showResidueHeatmap,
  onToggleShowResidueHeatmap,
  isMuted = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPreviewDrawTimeRef = useRef<number>(0);

  // Draw webcam preview at low resolution (180x95) and capped at 15 FPS
  useEffect(() => {
    if (!isVisible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const drawPreview = (now: number) => {
      if (now - lastPreviewDrawTimeRef.current >= 66) {
        lastPreviewDrawTimeRef.current = now;

        const width = canvas.width;
        const height = canvas.height;

        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, width, height);

        // Draw live webcam feed if available (mirrored orientation)
        if (videoElement && videoElement.readyState >= 2 && !videoElement.paused) {
          ctx.save();
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
          ctx.globalAlpha = 0.45;
          ctx.drawImage(videoElement, 0, 0, width, height);
          ctx.restore();
        } else {
          ctx.fillStyle = '#161616';
          ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = '#777';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`Camera: ${cameraStatus.toUpperCase()}`, width / 2, height / 2);
        }

        // Draw Pose Skeletons (tracked visitors)
        trackedPeople.forEach((person) => {
          const lms = person.landmarks;
          if (!lms || lms.length === 0) return;
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = 'rgba(96, 165, 250, 0.8)';

          POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
            const p1 = lms[startIdx];
            const p2 = lms[endIdx];
            if (p1 && p2 && (p1.visibility ?? 1) > 0.4 && (p2.visibility ?? 1) > 0.4) {
              ctx.beginPath();
              ctx.moveTo(p1.x * width, p1.y * height);
              ctx.lineTo(p2.x * width, p2.y * height);
              ctx.stroke();
            }
          });

          [0, 11, 12, 13, 14, 15, 16, 23, 24].forEach((idx) => {
            const pt = lms[idx];
            if (pt && (pt.visibility ?? 1) > 0.4) {
              ctx.beginPath();
              ctx.arc(pt.x * width, pt.y * height, 2.5, 0, Math.PI * 2);
              ctx.fillStyle = idx === 0 ? '#4ade80' : '#60a5fa';
              ctx.fill();
            }
          });
        });

        // Draw Hands
        trackedHands.forEach((hand) => {
          const lms = hand.landmarks;
          if (!lms || lms.length === 0) return;
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = hand.isFist ? '#f43f5e' : '#4ade80';

          HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
            const p1 = lms[startIdx];
            const p2 = lms[endIdx];
            if (p1 && p2) {
              ctx.beginPath();
              ctx.moveTo(p1.x * width, p1.y * height);
              ctx.lineTo(p2.x * width, p2.y * height);
              ctx.stroke();
            }
          });

          const px = hand.palmX * width;
          const py = hand.palmY * height;
          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = hand.isFist ? '#f43f5e' : '#4ade80';
          ctx.fill();
        });

        // Prominent SIMULATED banner across the preview canvas when in simulated test mode
        if (testMode !== 'live') {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
          ctx.fillRect(0, 0, width, 18);
          ctx.fillStyle = '#0a0a0a';
          ctx.font = 'bold 8.5px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`SIMULATED: ${testMode.toUpperCase()} (${testCountdown}s)`, width / 2, 9);
        }
      }

      animId = requestAnimationFrame(drawPreview);
    };

    animId = requestAnimationFrame(drawPreview);
    return () => cancelAnimationFrame(animId);
  }, [isVisible, trackedPeople, trackedHands, videoElement, cameraStatus, testMode, testCountdown]);

  if (!isVisible) return null;

  const totalFrameMs = Number((timings.updateMs + timings.renderMs).toFixed(1));
  const primaryHand = trackedHands[0];
  const primaryPerson = trackedPeople[0];
  const screenW = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const screenH = typeof window !== 'undefined' ? window.innerHeight : 1080;

  const nosePos = primaryPerson?.nosePos;
  const noseScreenX = nosePos?.visible ? Math.round(nosePos.x * screenW) : null;
  const noseScreenY = nosePos?.visible ? Math.round(nosePos.y * screenH) : null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 100,
        width: 326,
        background: 'rgba(10, 10, 10, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 8,
        padding: 14,
        color: '#e5e5e0',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 10.5,
        lineHeight: 1.45,
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.85)'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: 6,
          marginBottom: 8
        }}
      >
        <span style={{ fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: '#fff', fontSize: 11 }}>
          CONCEPT & PROFILER [D]
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <span
            style={{
              fontSize: 9,
              padding: '2px 5px',
              borderRadius: 3,
              background: fps >= 55 ? 'rgba(74, 222, 128, 0.18)' : 'rgba(239, 68, 68, 0.18)',
              color: fps >= 55 ? '#4ade80' : '#ef4444',
              fontWeight: 700
            }}
          >
            {fps} RENDER FPS
          </span>
          <span
            style={{
              fontSize: 9,
              padding: '2px 5px',
              borderRadius: 3,
              background: 'rgba(96, 165, 250, 0.18)',
              color: '#60a5fa',
              fontWeight: 700
            }}
          >
            {poseFps} CV FPS
          </span>
        </div>
      </div>

      {/* SIMULATED MODE BANNER (Auto-reverts to Live after 10s) */}
      {testMode !== 'live' && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.22)',
            border: '1px solid #f59e0b',
            borderRadius: 4,
            padding: '5px 8px',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#fef3c7',
            fontSize: 9.5
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
            <span style={{ color: '#f59e0b' }}>⚠️</span>
            <span>SIMULATED: {testMode.toUpperCase()}</span>
          </div>
          <div
            style={{
              background: '#f59e0b',
              color: '#0a0a0a',
              padding: '1px 5px',
              borderRadius: 3,
              fontSize: 8.5,
              fontWeight: 800
            }}
          >
            {testCountdown}s AUTO-REVERT
          </div>
        </div>
      )}

      {/* Frame Timing Breakdown (Target: < 8ms) */}
      <div style={{ marginBottom: 8, background: 'rgba(255,255,255,0.03)', padding: 6, borderRadius: 4 }}>
        <div style={{ color: '#888', marginBottom: 3, textTransform: 'uppercase', fontSize: 8.5, display: 'flex', justifyContent: 'space-between' }}>
          <span>PER-FRAME TIMINGS</span>
          <span style={{ color: timings.renderMs < 8 ? '#4ade80' : '#f59e0b', fontWeight: 600 }}>
            Render: {timings.renderMs}ms | Total: {totalFrameMs}ms
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#aaa' }}>1. Detection (CV, staggered):</span>
          <span style={{ color: '#60a5fa', fontWeight: 600 }}>{timings.detectionMs} ms</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#aaa' }}>2. Update (Spatial/Residue/Mass):</span>
          <span style={{ color: '#fff' }}>{timings.updateMs} ms</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#aaa' }}>3. Render (Pre-rendered Atlas):</span>
          <span style={{ color: '#4ade80', fontWeight: 700 }}>{timings.renderMs} ms</span>
        </div>
      </div>

      {/* Concept Layer Status */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ color: '#aaa' }}>Semantic Mass:</span>
          <span style={{ color: '#4ade80', fontWeight: 600 }}>Active (16 words bound)</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ color: '#aaa' }}>Residue Memory:</span>
          <span>45s half-life (cap 500w)</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ color: '#aaa' }}>Gesture State:</span>
          <span style={{ color: primaryHand?.isFist ? '#f43f5e' : primaryHand?.isOpen ? '#4ade80' : '#aaa', fontWeight: 700 }}>
            {primaryHand ? (primaryHand.isFist ? 'FIST (MAX WEIGHT)' : 'OPEN PALM') : 'None'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ color: '#aaa' }}>Nose Pos:</span>
          <span style={{ color: noseScreenX !== null ? '#aaa' : '#666' }}>
            {noseScreenX !== null ? `(${noseScreenX}px, ${noseScreenY}px)` : 'None'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ color: '#aaa' }}>Delegate:</span>
          <span style={{ color: activeDelegate.includes('GPU') ? '#4ade80' : '#fbbf24', fontWeight: 700 }}>
            {activeDelegate}
          </span>
        </div>
      </div>

      {/* Concept Toggles */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <div
          onClick={onToggleShowInfluencePoints}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 6px',
            background: showInfluencePoints ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${showInfluencePoints ? 'rgba(74, 222, 128, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          <span style={{ color: showInfluencePoints ? '#4ade80' : '#aaa', fontSize: 9 }}>
            Influence Dots
          </span>
          <span style={{ color: showInfluencePoints ? '#4ade80' : '#666', fontWeight: 700, fontSize: 8.5 }}>
            {showInfluencePoints ? 'ON' : 'OFF'}
          </span>
        </div>

        <div
          onClick={onToggleShowResidueHeatmap}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 6px',
            background: showResidueHeatmap ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${showResidueHeatmap ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          <span style={{ color: showResidueHeatmap ? '#c084fc' : '#aaa', fontSize: 9 }}>
            Residue Ghost
          </span>
          <span style={{ color: showResidueHeatmap ? '#c084fc' : '#666', fontWeight: 700, fontSize: 8.5 }}>
            {showResidueHeatmap ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      {/* Mirrored Camera Preview */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 8.5, color: '#888' }}>
          <span>CAMERA PREVIEW (15FPS)</span>
          <span style={{ color: '#4ade80' }}>● {cameraStatus.toUpperCase()}</span>
        </div>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 80,
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <canvas
            ref={canvasRef}
            width={180}
            height={80}
            style={{
              display: 'block',
              width: '100%',
              height: '100%'
            }}
          />
        </div>
      </div>

      {/* Concept Verification Test Buttons */}
      <div style={{ marginBottom: 8 }}>
        {isFullscreen ? (
          <div
            style={{
              padding: '6px 8px',
              borderRadius: 4,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#888',
              fontSize: 8.5,
              textAlign: 'center',
              letterSpacing: 0.3
            }}
          >
            🔒 TEST BUTTONS DISABLED IN FULLSCREEN KIOSK
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <button
              onClick={() => onSetTestMode?.('live')}
              style={{
                flex: 1,
                minWidth: 45,
                padding: '3px 2px',
                fontSize: 8.5,
                borderRadius: 3,
                background: testMode === 'live' ? 'rgba(74, 222, 128, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: testMode === 'live' ? '#4ade80' : '#888',
                border: `1px solid ${testMode === 'live' ? 'rgba(74, 222, 128, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                cursor: 'pointer'
              }}
            >
              [0] Live
            </button>
            <button
              onClick={() => onSetTestMode?.('fist')}
              style={{
                flex: 1.2,
                minWidth: 60,
                padding: '3px 2px',
                fontSize: 8.5,
                borderRadius: 3,
                background: testMode === 'fist' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: testMode === 'fist' ? '#f43f5e' : '#888',
                border: `1px solid ${testMode === 'fist' ? 'rgba(244, 63, 94, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                cursor: 'pointer'
              }}
            >
              [1] Fist
            </button>
            <button
              onClick={() => onSetTestMode?.('two_hands')}
              style={{
                flex: 1.4,
                minWidth: 80,
                padding: '3px 2px',
                fontSize: 8.5,
                borderRadius: 3,
                background: testMode === 'two_hands' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: testMode === 'two_hands' ? '#38bdf8' : '#888',
                border: `1px solid ${testMode === 'two_hands' ? 'rgba(56, 189, 248, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                cursor: 'pointer'
              }}
            >
              [2] 2-Hand Stretch
            </button>
            <button
              onClick={() => onSetTestMode?.('wave_residue')}
              style={{
                flex: 1.4,
                minWidth: 80,
                padding: '3px 2px',
                fontSize: 8.5,
                borderRadius: 3,
                background: testMode === 'wave_residue' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: testMode === 'wave_residue' ? '#c084fc' : '#888',
                border: `1px solid ${testMode === 'wave_residue' ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                cursor: 'pointer'
              }}
            >
              [3] Wave Residue
            </button>
            <button
              onClick={() => onSetTestMode?.('idle')}
              style={{
                flex: 1,
                minWidth: 45,
                padding: '3px 2px',
                fontSize: 8.5,
                borderRadius: 3,
                background: testMode === 'idle' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: testMode === 'idle' ? '#fff' : '#888',
                border: `1px solid ${testMode === 'idle' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                cursor: 'pointer'
              }}
            >
              [4] Idle
            </button>
          </div>
        )}
      </div>

      {/* Typography Mass Telemetry */}
      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 6, marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ color: '#aaa' }}>Base Axis:</span>
          <span>{currentAxes.wght}w / {currentAxes.wdth}%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#aaa' }}>Canvas Mean Weight:</span>
          <span style={{ color: avgAxes.wght > 300 ? '#4ade80' : '#f4f3ee', fontWeight: 700 }}>
            {avgAxes.wght}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#aaa' }}>Web Audio:</span>
          <span style={{ color: isMuted ? '#ef4444' : '#4ade80', fontWeight: 600 }}>
            {isMuted ? 'MUTED [M]' : avgAxes.wght > 230 ? 'DRONE ACTIVE' : 'SILENT (IDLE)'}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: 4,
          fontSize: 8.5,
          color: '#666',
          display: 'flex',
          justifyContent: 'space-between'
        }}
      >
        <span>[D] Debug</span>
        <span>[F] Fullscreen</span>
        <span>[M] Mute</span>
      </div>
    </div>
  );
};
