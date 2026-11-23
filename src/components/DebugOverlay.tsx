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
  isFullscreen?: boolean;
  showInfluencePoints?: boolean;
  onToggleShowInfluencePoints?: () => void;
  showResidueHeatmap?: boolean;
  onToggleShowResidueHeatmap?: () => void;
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

export const DebugOverlay: React.FC<DebugOverlayProps> = ({
  isVisible,
  fps,
  poseFps,
  timings,
  activeDelegate,
  currentAxes,
  avgAxes,
  trackedPeople,
  cameraStatus,
  videoElement
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPreviewDrawTimeRef = useRef<number>(0);

  // Draw webcam preview at low resolution (180x80) and capped at 15 FPS
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
          ctx.strokeStyle = person.isStill ? '#4ade80' : 'rgba(96, 165, 250, 0.8)';

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
              ctx.fillStyle = idx === 0 ? (person.isStill ? '#4ade80' : '#f59e0b') : '#60a5fa';
              ctx.fill();
            }
          });
        });
      }

      animId = requestAnimationFrame(drawPreview);
    };

    animId = requestAnimationFrame(drawPreview);
    return () => cancelAnimationFrame(animId);
  }, [isVisible, trackedPeople, videoElement, cameraStatus]);

  if (!isVisible) return null;

  const totalFrameMs = Number((timings.updateMs + timings.renderMs).toFixed(1));
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
        zIndex: 998,
        width: 320,
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
          PROFILER [Ctrl+Shift+D]
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

      {/* Frame Timing Breakdown (Target: < 8ms) */}
      <div style={{ marginBottom: 8, background: 'rgba(255,255,255,0.03)', padding: 6, borderRadius: 4 }}>
        <div style={{ color: '#888', marginBottom: 3, textTransform: 'uppercase', fontSize: 8.5, display: 'flex', justifyContent: 'space-between' }}>
          <span>PER-FRAME TIMINGS</span>
          <span style={{ color: timings.renderMs < 8 ? '#4ade80' : '#f59e0b', fontWeight: 600 }}>
            Render: {timings.renderMs}ms | Total: {totalFrameMs}ms
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#aaa' }}>1. Detection (CV, decoupled):</span>
          <span style={{ color: '#60a5fa', fontWeight: 600 }}>{timings.detectionMs} ms</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#aaa' }}>2. Update (Dwell/Physics/Residue):</span>
          <span style={{ color: '#fff' }}>{timings.updateMs} ms</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#aaa' }}>3. Render (Pre-rendered Atlas):</span>
          <span style={{ color: '#4ade80', fontWeight: 700 }}>{timings.renderMs} ms</span>
        </div>
      </div>

      {/* Hardware Status */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ color: '#aaa' }}>CV Delegate:</span>
          <span style={{ color: activeDelegate.includes('GPU') ? '#4ade80' : '#f59e0b', fontWeight: 600 }}>
            {activeDelegate}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ color: '#aaa' }}>Camera:</span>
          <span style={{ color: cameraStatus === 'active' ? '#4ade80' : '#ef4444' }}>
            ● {cameraStatus.toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ color: '#aaa' }}>Tracked Poses:</span>
          <span>{trackedPeople.length} (Max 4)</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ color: '#aaa' }}>Primary Nose Pos:</span>
          <span style={{ color: noseScreenX !== null ? '#aaa' : '#666' }}>
            {noseScreenX !== null ? `(${noseScreenX}px, ${noseScreenY}px)` : 'None'}
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

      {/* Typography Mass Telemetry */}
      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 6, marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ color: '#aaa' }}>Base Axis:</span>
          <span>{currentAxes.wght}w / {currentAxes.wdth}%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#aaa' }}>Canvas Mean Weight:</span>
          <span style={{ color: '#fff', fontWeight: 600 }}>{avgAxes.wght}</span>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: 6,
          fontSize: 8.5,
          color: '#777',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Mechanics Isolation:</span>
          <span style={{ color: '#aaa' }}>Ctrl+Shift+H</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Kiosk Fullscreen:</span>
          <span style={{ color: '#aaa' }}>F</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Instant Clear Residue:</span>
          <span style={{ color: '#aaa' }}>R</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Mute Audio:</span>
          <span style={{ color: '#aaa' }}>M</span>
        </div>
      </div>
    </div>
  );
};
