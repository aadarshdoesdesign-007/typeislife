import React from 'react';
import type { MechanicsSwitches, WallVisualizations, MechanicsLiveTelemetry } from '../types';
import { INSTALLATION_CONFIG } from '../config';

interface MechanicsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  fillScale?: number;
  onFillScaleChange?: (scale: number) => void;
  mechanicsSwitches: MechanicsSwitches;
  onToggleMechanic: (key: keyof MechanicsSwitches) => void;
  wallVisualizations: WallVisualizations;
  onToggleVisualization: (key: keyof WallVisualizations) => void;
  telemetry: MechanicsLiveTelemetry;
  fps: number;
  renderMs: number;
  testMode: string;
  testCountdown: number;
  onSetTestMode: (mode: any) => void;
  onClearResidue: () => void;
}

export const MechanicsPanel: React.FC<MechanicsPanelProps> = ({
  isOpen,
  onClose,
  fillScale,
  onFillScaleChange,
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
        width: 410,
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
        background: 'rgba(8, 8, 8, 0.95)',
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

      {/* Canvas Layout / Text Size Control */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 6,
          padding: '8px 10px',
          marginBottom: 12
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: '#fff', fontSize: 10 }}>TEXT SIZE (FILL SCALE)</span>
          <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: 10 }}>
            {((fillScale ?? INSTALLATION_CONFIG.fillScale) * 100).toFixed(0)}% ({(fillScale ?? INSTALLATION_CONFIG.fillScale).toFixed(2)})
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="range"
            min={0.5}
            max={0.95}
            step={0.01}
            value={fillScale ?? INSTALLATION_CONFIG.fillScale}
            onChange={(e) => onFillScaleChange?.(parseFloat(e.target.value))}
            style={{
              flex: 1,
              accentColor: '#38bdf8',
              cursor: 'pointer'
            }}
          />
          <button
            onClick={() => onFillScaleChange?.(0.72)}
            title="Reset to default (0.72)"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#aaa',
              borderRadius: 3,
              padding: '2px 6px',
              fontSize: 8.5,
              cursor: 'pointer'
            }}
          >
            Reset
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: 8, marginTop: 4 }}>
          <span>0.50 (compact)</span>
          <span>Default: 0.72</span>
          <span>0.95 (maximum)</span>
        </div>
      </div>

      {/* SECTION 1: INTERACTIVE MECHANICS WITH INDIVIDUAL ISOLATION SWITCHES */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#888', marginBottom: 6, fontWeight: 700 }}>
          NEW INTERACTION MECHANICS (PHASES 0 - 3)
        </div>

        {/* Phase 0: Contrast Guard */}
        <MechanicRow
          title="P0. Contrast Guard"
          description="Cap residue at +150w; T½ 30s; slow pull toward ~230-250w"
          liveValue={`Target Idle: 200-260w | Mean: ${telemetry.meanWeight}w | T½: ${INSTALLATION_CONFIG.residueHalfLifeSeconds}s`}
          isActive={mechanicsSwitches.contrastGuard}
          onToggle={() => onToggleMechanic('contrastGuard')}
          activeColor="#38bdf8"
        />

        {/* Phase 1: Gravity & Drift */}
        <MechanicRow
          title="P1. Physical Gravity"
          description="Heavy words sag up to 8px; light words lift 6px & drift 2-3px"
          liveValue="Offset draw position only; zero reflow"
          isActive={mechanicsSwitches.gravity}
          onToggle={() => onToggleMechanic('gravity')}
          activeColor="#a3e635"
        />

        {/* Phase 2: Body Silhouette Segmentation */}
        <MechanicRow
          title="P2. Body Silhouette"
          description="MediaPipe 128x72 mask at 18fps; smooth max blend; fallback < 40fps"
          liveValue={`Coverage: ${telemetry.silhouetteCoverage.toFixed(1)}% | Seg FPS: ${telemetry.silhouetteFps}`}
          isActive={mechanicsSwitches.bodySilhouette}
          onToggle={() => onToggleMechanic('bodySilhouette')}
          activeColor="#3b82f6"
        />

        {/* Phase 3: Drop Gesture */}
        <MechanicRow
          title="P3. Drop Gesture"
          description="Fist held >=300ms released to palm drops letters 12-20px + thud"
          liveValue={`Status: ${telemetry.lastDropInfo} | Rate-limit: 1.5s`}
          isActive={mechanicsSwitches.dropGesture}
          onToggle={() => onToggleMechanic('dropGesture')}
          activeColor="#f43f5e"
        />

        <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#888', marginTop: 8, marginBottom: 6, fontWeight: 700 }}>
          CORE BASELINE MECHANICS
        </div>

        {/* Physical Gestures */}
        <MechanicRow
          title="Gestures (Palm/Fist/Stretch)"
          description="Open palm = wide; Fist = peak wght 900; 2 Hands = width stretch"
          liveValue={`Gesture: ${telemetry.gestureStateText}`}
          isActive={mechanicsSwitches.gestures}
          onToggle={() => onToggleMechanic('gestures')}
          activeColor="#4ade80"
        />

        {/* Semantic Mass */}
        <MechanicRow
          title="Semantic Mass (16 Words)"
          description="Heavy words settle sluggishly (2.5x); light words snap back fast"
          liveValue="Active (16 exhibition words bound)"
          isActive={mechanicsSwitches.semanticMass}
          onToggle={() => onToggleMechanic('semanticMass')}
          activeColor="#f59e0b"
        />

        {/* Residue Memory */}
        <MechanicRow
          title="Residue Memory"
          description="Faint ghost imprints where visitors stood or gestured"
          liveValue={`Mean Residue: ${(telemetry.meanResidue * 100).toFixed(1)}%`}
          isActive={mechanicsSwitches.residue}
          onToggle={() => onToggleMechanic('residue')}
          activeColor="#c084fc"
        />

        {/* Attract Mode */}
        <MechanicRow
          title="Attract Mode Wave"
          description="After 60s idle, sweeps a single gravitational wave every 25s"
          liveValue={telemetry.idleStatus}
          isActive={mechanicsSwitches.attractMode}
          onToggle={() => onToggleMechanic('attractMode')}
          activeColor="#34d399"
        />

        {/* Sound Architecture */}
        <MechanicRow
          title="Sound Architecture"
          description="Architectural drone follows mean weight; settling & drop thuds"
          liveValue={`Drone: ${telemetry.droneActive ? 'ACTIVE' : 'SILENT'}`}
          isActive={mechanicsSwitches.sound}
          onToggle={() => onToggleMechanic('sound')}
          activeColor="#eab308"
        />

        {/* Mechanic Row 9: Hand Rhythm */}
        <MechanicRow
          title="9. Hand Rhythm Engine"
          description="Quantized hits on 16th grid (84 BPM); knocks, ticks, thuds, kicks"
          liveValue={`BPM: ${telemetry.rhythmBpm} | Voices: ${telemetry.rhythmVoices} / 6 | Hit: ${telemetry.lastRhythmHit}`}
          isActive={mechanicsSwitches.handRhythm}
          onToggle={() => onToggleMechanic('handRhythm')}
          activeColor="#ec4899"
        />
      </div>

      {/* SECTION 2: WALL VISUALIZATION OVERLAYS */}
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
              checked={wallVisualizations.maskOutline}
              onChange={() => onToggleVisualization('maskOutline')}
              style={{ cursor: 'pointer', accentColor: '#3b82f6' }}
            />
            <span style={{ color: wallVisualizations.maskOutline ? '#3b82f6' : '#bbb', fontWeight: 600 }}>
              Mask Outline
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
              Residue Ghost
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

      {/* SECTION 3: PHASE SIMULATION BUTTONS */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#888', marginBottom: 4, fontWeight: 700 }}>
          PHASE VERIFICATION SIMULATIONS
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
            onClick={() => onSetTestMode('idle')}
            style={{
              flex: 1,
              minWidth: 55,
              padding: '4px 6px',
              borderRadius: 3,
              fontSize: 9,
              fontFamily: 'inherit',
              cursor: 'pointer',
              border: testMode === 'idle' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
              background: testMode === 'idle' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.04)',
              color: testMode === 'idle' ? '#38bdf8' : '#aaa',
              fontWeight: 700
            }}
          >
            P0: Idle
          </button>
          <button
            onClick={() => onSetTestMode('palm_sweep')}
            style={{
              flex: 1,
              minWidth: 70,
              padding: '4px 6px',
              borderRadius: 3,
              fontSize: 9,
              fontFamily: 'inherit',
              cursor: 'pointer',
              border: testMode === 'palm_sweep' ? '1px solid #a3e635' : '1px solid rgba(255,255,255,0.1)',
              background: testMode === 'palm_sweep' ? 'rgba(163, 230, 53, 0.25)' : 'rgba(255,255,255,0.04)',
              color: testMode === 'palm_sweep' ? '#a3e635' : '#aaa',
              fontWeight: 700
            }}
          >
            P1: Palm Sweep
          </button>
          <button
            onClick={() => onSetTestMode('silhouette')}
            style={{
              flex: 1,
              minWidth: 70,
              padding: '4px 6px',
              borderRadius: 3,
              fontSize: 9,
              fontFamily: 'inherit',
              cursor: 'pointer',
              border: testMode === 'silhouette' ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
              background: testMode === 'silhouette' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.04)',
              color: testMode === 'silhouette' ? '#3b82f6' : '#aaa',
              fontWeight: 700
            }}
          >
            P2: Silhouette
          </button>
          <button
            onClick={() => onSetTestMode('fist_release')}
            style={{
              flex: 1,
              minWidth: 70,
              padding: '4px 6px',
              borderRadius: 3,
              fontSize: 9,
              fontFamily: 'inherit',
              cursor: 'pointer',
              border: testMode === 'fist_release' ? '1px solid #f43f5e' : '1px solid rgba(255,255,255,0.1)',
              background: testMode === 'fist_release' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255,255,255,0.04)',
              color: testMode === 'fist_release' ? '#f43f5e' : '#aaa',
              fontWeight: 700
            }}
          >
            P3: Fist Release
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
        Ctrl+Shift+H: close • Ctrl+Shift+D: Profiler • R: clear residue • F: kiosk fullscreen
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
