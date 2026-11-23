import React from 'react';
import type { MechanicsSwitches, WallVisualizations, MechanicsLiveTelemetry } from '../types';
import { INSTALLATION_CONFIG } from '../config';

interface MechanicsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  mechanicsSwitches: MechanicsSwitches;
  onToggleMechanic: (key: keyof MechanicsSwitches) => void;
  wallVisualizations: WallVisualizations;
  onToggleVisualization: (key: keyof WallVisualizations) => void;
  telemetry: MechanicsLiveTelemetry;
  fps: number;
  renderMs: number;
  testMode: 'live' | 'fist' | 'two_hands' | 'wave_residue' | 'idle';
  testCountdown: number;
  onSetTestMode: (mode: 'live' | 'fist' | 'two_hands' | 'wave_residue' | 'idle') => void;
  onClearResidue: () => void;
}

export const MechanicsPanel: React.FC<MechanicsPanelProps> = ({
  isOpen,
  onClose,
  mechanicsSwitches,
  onToggleMechanic,
  wallVisualizations,
  onToggleVisualization,
  telemetry,
  fps,
  renderMs,
  testMode,
  testCountdown,
  onSetTestMode,
  onClearResidue
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        left: 20,
        zIndex: 999,
        width: 390,
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
        background: 'rgba(8, 8, 8, 0.94)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        borderRadius: 8,
        padding: 14,
        color: '#e5e5e0',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 10.5,
        lineHeight: 1.45,
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.9)'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          paddingBottom: 7,
          marginBottom: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: '#fff', fontSize: 11 }}>
            MECHANICS ISOLATION PANEL
          </span>
          <span style={{ fontSize: 9, color: '#888' }}>[Ctrl+Shift+H]</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 9,
              padding: '2px 5px',
              borderRadius: 3,
              background: renderMs < 8 ? 'rgba(74, 222, 128, 0.18)' : 'rgba(239, 68, 68, 0.18)',
              color: renderMs < 8 ? '#4ade80' : '#ef4444',
              fontWeight: 700
            }}
          >
            {renderMs}ms | {fps} FPS
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#aaa',
              cursor: 'pointer',
              fontSize: 12,
              padding: '0 4px'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Simulated Mode High-Visibility Alert Banner */}
      {testMode !== 'live' && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.22)',
            border: '1px solid #f59e0b',
            borderRadius: 4,
            padding: '6px 8px',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#fef3c7',
            fontSize: 9.5,
            fontWeight: 700
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: '#f59e0b' }}>⚠️</span>
            <span>SIMULATED: {testMode.toUpperCase()}</span>
          </div>
          <span
            style={{
              background: '#f59e0b',
              color: '#080808',
              padding: '1px 5px',
              borderRadius: 3,
              fontSize: 8.5,
              fontWeight: 800
            }}
          >
            {testCountdown}s REVERT
          </span>
        </div>
      )}

      {/* SECTION 1: EIGHT RESTORED INTERACTIVE MECHANICS WITH ISOLATION SWITCHES */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#888', marginBottom: 6, fontWeight: 700 }}>
          CORE INSTALLATION MECHANICS (LIVE ON/OFF)
        </div>

        {/* 1. Physical Gestures */}
        <MechanicRow
          title="1. Physical Gestures"
          description="Open palm = wide; Fist = max density (wght 900); 2 Hands = stretch"
          liveValue={`Gesture: ${telemetry.gestureStateText}`}
          isActive={mechanicsSwitches.gestures}
          onToggle={() => onToggleMechanic('gestures')}
          activeColor="#4ade80"
        />

        {/* 2. Hand Speed Ripple */}
        <MechanicRow
          title="2. Hand Speed Ripple"
          description="Fast movement briefly releases weight behind the hand (wake ripple)"
          liveValue={`Speed: ${telemetry.handSpeedText} m/s`}
          isActive={mechanicsSwitches.speedRipple}
          onToggle={() => onToggleMechanic('speedRipple')}
          activeColor="#38bdf8"
        />

        {/* 3. Head Tracking */}
        <MechanicRow
          title="3. Head Tracking"
          description="Mirrored head position provides subtle gravitational anchor"
          liveValue={`Nose: ${telemetry.headPosText}`}
          isActive={mechanicsSwitches.headTracking}
          onToggle={() => onToggleMechanic('headTracking')}
          activeColor="#60a5fa"
        />

        {/* 4. Semantic Mass */}
        <MechanicRow
          title="4. Semantic Mass"
          description="16 bound words: heavy words settle slow; light words snap back fast"
          liveValue="Active (16 words bound)"
          isActive={mechanicsSwitches.semanticMass}
          onToggle={() => onToggleMechanic('semanticMass')}
          activeColor="#f59e0b"
        />

        {/* 5. Residue Memory */}
        <MechanicRow
          title="5. Residue Memory"
          description="Lingering trace where visitors interacted (~45s half-life, cap 500w)"
          liveValue={`Mean: ${(telemetry.meanResidue * 100).toFixed(1)}% | T½: ${INSTALLATION_CONFIG.residueHalfLifeSeconds}s`}
          isActive={mechanicsSwitches.residue}
          onToggle={() => onToggleMechanic('residue')}
          activeColor="#c084fc"
        />

        {/* 6. Attract Mode / Idle Life */}
        <MechanicRow
          title="6. Attract Mode (Empty Room)"
          description="After 60s idle, sweeps a single gravitational wave across text every 25s"
          liveValue={telemetry.idleStatus}
          isActive={mechanicsSwitches.attractMode}
          onToggle={() => onToggleMechanic('attractMode')}
          activeColor="#34d399"
        />

        {/* 7. Sound Architecture */}
        <MechanicRow
          title="7. Sound Architecture"
          description="Subtle architectural drone follows canvas mean weight; settling thumps"
          liveValue={`Drone: ${telemetry.droneActive ? 'ACTIVE' : 'SILENT'} | Mean: ${telemetry.meanWeight}w`}
          isActive={mechanicsSwitches.sound}
          onToggle={() => onToggleMechanic('sound')}
          activeColor="#eab308"
        />

        {/* 8. Hand Tracking (Hands Active) */}
        <MechanicRow
          title="8. Hands (Hand Landmarker)"
          description="Enabled by default: tracks up to 4 hands with palm centers"
          liveValue={mechanicsSwitches.hands ? `Hands active (${telemetry.trackedHandsCount} tracked)` : 'OFF (Disabled)'}
          isActive={mechanicsSwitches.hands}
          onToggle={() => onToggleMechanic('hands')}
          activeColor="#ec4899"
        />
      </div>

      {/* SECTION 2: WALL VISUALIZATION OVERLAYS (ONLY WHILE PANEL OPEN) */}
      <div style={{ marginBottom: 12, background: 'rgba(255, 255, 255, 0.03)', padding: 8, borderRadius: 5 }}>
        <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#aaa', marginBottom: 6, fontWeight: 700 }}>
          WALL VISUALIZATION OVERLAYS (ONLY WHILE PANEL OPEN)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 9.5 }}>
            <input
              type="checkbox"
              checked={wallVisualizations.sourceTint}
              onChange={() => onToggleVisualization('sourceTint')}
              style={{ cursor: 'pointer', accentColor: '#38bdf8' }}
            />
            <span style={{ color: wallVisualizations.sourceTint ? '#38bdf8' : '#bbb', fontWeight: 600 }}>
              Source Tint
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 9.5 }}>
            <input
              type="checkbox"
              checked={wallVisualizations.residueHeatmap}
              onChange={() => onToggleVisualization('residueHeatmap')}
              style={{ cursor: 'pointer', accentColor: '#c084fc' }}
            />
            <span style={{ color: wallVisualizations.residueHeatmap ? '#c084fc' : '#bbb' }}>
              Residue Heatmap
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 9.5 }}>
            <input
              type="checkbox"
              checked={wallVisualizations.influenceDots}
              onChange={() => onToggleVisualization('influenceDots')}
              style={{ cursor: 'pointer', accentColor: '#4ade80' }}
            />
            <span style={{ color: wallVisualizations.influenceDots ? '#4ade80' : '#bbb' }}>
              Influence Dots
            </span>
          </label>
        </div>
      </div>

      {/* SECTION 3: SIMULATED MODES & CLEAR RESIDUE CONTROLS */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#888', marginBottom: 4, fontWeight: 700 }}>
          SIMULATED TEST MODES & CONTROLS
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          <button
            onClick={() => onSetTestMode('live')}
            style={{
              flex: 1,
              minWidth: 50,
              padding: '4px 6px',
              borderRadius: 3,
              fontSize: 9,
              fontFamily: 'inherit',
              cursor: 'pointer',
              border: testMode === 'live' ? '1px solid #4ade80' : '1px solid rgba(255,255,255,0.1)',
              background: testMode === 'live' ? 'rgba(74, 222, 128, 0.25)' : 'rgba(255,255,255,0.04)',
              color: testMode === 'live' ? '#4ade80' : '#aaa',
              fontWeight: 700
            }}
          >
            [0] Live
          </button>
          <button
            onClick={() => onSetTestMode('fist')}
            style={{
              flex: 1,
              minWidth: 50,
              padding: '4px 6px',
              borderRadius: 3,
              fontSize: 9,
              fontFamily: 'inherit',
              cursor: 'pointer',
              border: testMode === 'fist' ? '1px solid #f43f5e' : '1px solid rgba(255,255,255,0.1)',
              background: testMode === 'fist' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255,255,255,0.04)',
              color: testMode === 'fist' ? '#f43f5e' : '#aaa',
              fontWeight: 700
            }}
          >
            [1] Fist
          </button>
          <button
            onClick={() => onSetTestMode('two_hands')}
            style={{
              flex: 1,
              minWidth: 60,
              padding: '4px 6px',
              borderRadius: 3,
              fontSize: 9,
              fontFamily: 'inherit',
              cursor: 'pointer',
              border: testMode === 'two_hands' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
              background: testMode === 'two_hands' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.04)',
              color: testMode === 'two_hands' ? '#38bdf8' : '#aaa',
              fontWeight: 700
            }}
          >
            [2] Stretch
          </button>
          <button
            onClick={() => onSetTestMode('wave_residue')}
            style={{
              flex: 1,
              minWidth: 60,
              padding: '4px 6px',
              borderRadius: 3,
              fontSize: 9,
              fontFamily: 'inherit',
              cursor: 'pointer',
              border: testMode === 'wave_residue' ? '1px solid #c084fc' : '1px solid rgba(255,255,255,0.1)',
              background: testMode === 'wave_residue' ? 'rgba(192, 132, 252, 0.25)' : 'rgba(255,255,255,0.04)',
              color: testMode === 'wave_residue' ? '#c084fc' : '#aaa',
              fontWeight: 700
            }}
          >
            [3] Residue Wave
          </button>
          <button
            onClick={() => onSetTestMode('idle')}
            style={{
              flex: 1,
              minWidth: 45,
              padding: '4px 6px',
              borderRadius: 3,
              fontSize: 9,
              fontFamily: 'inherit',
              cursor: 'pointer',
              border: testMode === 'idle' ? '1px solid #94a3b8' : '1px solid rgba(255,255,255,0.1)',
              background: testMode === 'idle' ? 'rgba(148, 163, 184, 0.25)' : 'rgba(255,255,255,0.04)',
              color: testMode === 'idle' ? '#94a3b8' : '#aaa',
              fontWeight: 700
            }}
          >
            [4] Idle
          </button>
        </div>

        <button
          onClick={onClearResidue}
          style={{
            width: '100%',
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            color: '#f43f5e',
            borderRadius: 4,
            padding: '6px 10px',
            fontSize: 9.5,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          🧹 Clear All Residue Memory [R]
        </button>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6, fontSize: 8.5, color: '#666', textAlign: 'center' }}>
        Ctrl+Shift+H to close • Ctrl+Shift+D for Profiler • R to clear residue • F fullscreen kiosk
      </div>
    </div>
  );
};

interface MechanicRowProps {
  title: string;
  description: string;
  liveValue: string;
  isActive: boolean;
  onToggle: () => void;
  activeColor: string;
}

const MechanicRow: React.FC<MechanicRowProps> = ({
  title,
  description,
  liveValue,
  isActive,
  onToggle,
  activeColor
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 8px',
        marginBottom: 4,
        background: isActive ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.01)',
        border: `1px solid ${isActive ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)'}`,
        borderRadius: 4,
        opacity: isActive ? 1.0 : 0.6
      }}
    >
      <div style={{ flex: 1, marginRight: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, color: isActive ? activeColor : '#888', fontSize: 10 }}>
            {title}
          </span>
        </div>
        <div style={{ fontSize: 8.5, color: '#888', margin: '1px 0' }}>{description}</div>
        <div style={{ fontSize: 9, color: isActive ? '#eee' : '#555', fontStyle: 'italic' }}>
          {liveValue}
        </div>
      </div>
      <button
        onClick={onToggle}
        style={{
          background: isActive ? activeColor : 'rgba(255, 255, 255, 0.08)',
          color: isActive ? '#0a0a0a' : '#888',
          border: 'none',
          borderRadius: 3,
          padding: '2px 7px',
          fontWeight: 800,
          fontSize: 9,
          cursor: 'pointer',
          letterSpacing: 0.5
        }}
      >
        {isActive ? 'ON' : 'OFF'}
      </button>
    </div>
  );
};
