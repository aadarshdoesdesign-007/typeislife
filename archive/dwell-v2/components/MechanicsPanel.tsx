import React from 'react';
import type { MechanicsSwitches, WallVisualizations, MechanicsLiveTelemetry } from '../types';
import { INSTALLATION_CONFIG, INSTALLATION_TEXT_LINES, DWELL_SECONDS } from '../config';

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
  onSimulateVisitor: (word: string) => void;
  isSimulating: boolean;
  simulationSecondsLeft: number;
  simulatedTargetWord: string;
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
  onSimulateVisitor,
  isSimulating,
  simulationSecondsLeft,
  simulatedTargetWord,
  onClearResidue
}) => {
  const [selectedWord, setSelectedWord] = React.useState<string>('HEAVY');

  if (!isOpen) return null;

  // Extract list of all unique individual words from installation lines
  const availableWords: string[] = [];
  INSTALLATION_TEXT_LINES.forEach((line) => {
    line.split(' ').forEach((w) => {
      const clean = w.trim().toUpperCase();
      if (clean && !availableWords.includes(clean)) availableWords.push(clean);
    });
  });

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
      {isSimulating && (
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
            <span>SIMULATED VISITOR ON "{simulatedTargetWord}"</span>
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
            {simulationSecondsLeft}s REVERT
          </span>
        </div>
      )}

      {/* SECTION 1: EIGHT INTERACTIVE MECHANICS WITH ISOLATION SWITCHES */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#888', marginBottom: 6, fontWeight: 700 }}>
          CORE INSTALLATION MECHANICS (LIVE ON/OFF)
        </div>

        {/* 1. Dwell Build */}
        <MechanicRow
          title="1. Dwell Build"
          description="Stillness builds weight on nearest word over 20s"
          liveValue={telemetry.dwellStatus}
          isActive={mechanicsSwitches.dwellBuild}
          onToggle={() => onToggleMechanic('dwellBuild')}
          activeColor="#38bdf8"
        />

        {/* 2. Settle */}
        <MechanicRow
          title="2. Settle"
          description="Word locks heavy at max weight + plays low tone"
          liveValue={`Settled (${telemetry.settledWordsCount}): ${telemetry.settledList}`}
          isActive={mechanicsSwitches.settle}
          onToggle={() => onToggleMechanic('settle')}
          activeColor="#4ade80"
        />

        {/* 3. Residue */}
        <MechanicRow
          title="3. Residue Memory"
          description="Lingering trace after visitors leave (~3 min half-life)"
          liveValue={`Mean Residue: ${(telemetry.meanResidue * 100).toFixed(1)}% | T½: ${INSTALLATION_CONFIG.residueHalfLifeSeconds}s`}
          isActive={mechanicsSwitches.residue}
          onToggle={() => onToggleMechanic('residue')}
          activeColor="#c084fc"
        />

        {/* 4. Semantic Mass */}
        <MechanicRow
          title="4. Semantic Mass"
          description="HEAVY/STAYS settle slow; NOTHING/UNTIL quick snap"
          liveValue={telemetry.semanticMultiplierText}
          isActive={mechanicsSwitches.semanticMass}
          onToggle={() => onToggleMechanic('semanticMass')}
          activeColor="#f59e0b"
        />

        {/* 5. Head Tracking */}
        <MechanicRow
          title="5. Head Tracking"
          description="Mirrored head pos projects to nearest word target"
          liveValue={`Head: ${telemetry.headScreenPosText} (${telemetry.trackedVisitorsCount} tracked)`}
          isActive={mechanicsSwitches.headTracking}
          onToggle={() => onToggleMechanic('headTracking')}
          activeColor="#60a5fa"
        />

        {/* 6. Idle Life */}
        <MechanicRow
          title="6. Idle Life (Empty Room)"
          description="After 60s idle, one word swells/releases over 20s"
          liveValue={telemetry.idleLifeStatus}
          isActive={mechanicsSwitches.idleLife}
          onToggle={() => onToggleMechanic('idleLife')}
          activeColor="#34d399"
        />

        {/* 7. Sound Architecture */}
        <MechanicRow
          title="7. Sound Architecture"
          description="Stereo pan tracks word X; drone follows total weight"
          liveValue={`Drone: ${(telemetry.droneLevel * 100).toFixed(0)}% | Pan: ${telemetry.currentPan} | Last: ${telemetry.lastToneText}`}
          isActive={mechanicsSwitches.sound}
          onToggle={() => onToggleMechanic('sound')}
          activeColor="#eab308"
        />

        {/* 8. Hand Tracking (Disabled flag) */}
        <MechanicRow
          title="8. Hands (Disabled Flag)"
          description="Disabled by default; interaction driven by head dwell"
          liveValue={mechanicsSwitches.hands ? 'Hands active (Flag ON)' : 'OFF (Disabled by default)'}
          isActive={mechanicsSwitches.hands}
          onToggle={() => onToggleMechanic('hands')}
          activeColor="#ec4899"
        />
      </div>

      {/* SECTION 2: WALL VISUALIZATION OVERLAYS (DISAPPEARS ON CLOSE) */}
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
              checked={wallVisualizations.dwellRings}
              onChange={() => onToggleVisualization('dwellRings')}
              style={{ cursor: 'pointer', accentColor: '#38bdf8' }}
            />
            <span style={{ color: wallVisualizations.dwellRings ? '#fff' : '#bbb' }}>
              Dwell Rings
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
              checked={wallVisualizations.wordLabels}
              onChange={() => onToggleVisualization('wordLabels')}
              style={{ cursor: 'pointer', accentColor: '#aaa' }}
            />
            <span style={{ color: wallVisualizations.wordLabels ? '#fff' : '#bbb' }}>
              Word Labels
            </span>
          </label>
        </div>
      </div>

      {/* SECTION 3: SIMULATE VISITOR & CLEAR RESIDUE CONTROLS */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <select
          value={selectedWord}
          onChange={(e) => setSelectedWord(e.target.value)}
          disabled={isSimulating}
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            borderRadius: 4,
            padding: '5px 6px',
            fontSize: 9.5,
            fontFamily: 'inherit',
            cursor: 'pointer'
          }}
        >
          {availableWords.map((w) => (
            <option key={w} value={w} style={{ background: '#111', color: '#fff' }}>
              Target: {w}
            </option>
          ))}
        </select>

        <button
          onClick={() => onSimulateVisitor(selectedWord)}
          disabled={isSimulating}
          style={{
            flex: 1.3,
            padding: '5px 8px',
            background: isSimulating ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.2)',
            border: `1px solid ${isSimulating ? '#f59e0b' : '#38bdf8'}`,
            color: isSimulating ? '#fef3c7' : '#38bdf8',
            borderRadius: 4,
            fontSize: 9.5,
            fontWeight: 700,
            cursor: isSimulating ? 'default' : 'pointer'
          }}
        >
          {isSimulating ? `Simulating (${simulationSecondsLeft}s)` : `Simulate Visitor (${DWELL_SECONDS}s)`}
        </button>

        <button
          onClick={onClearResidue}
          title="Instant clear residue [R key]"
          style={{
            padding: '5px 8px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            borderRadius: 4,
            fontSize: 9.5,
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Clear (R)
        </button>
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
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '5px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, color: isActive ? activeColor : '#666', fontSize: 10 }}>
            {title}
          </span>
          <span style={{ color: '#777', fontSize: 8.5 }}>
            {description}
          </span>
        </div>
        <button
          onClick={onToggle}
          style={{
            padding: '1px 6px',
            fontSize: 8.5,
            fontWeight: 800,
            borderRadius: 3,
            background: isActive ? `${activeColor}25` : 'rgba(255, 255, 255, 0.05)',
            color: isActive ? activeColor : '#666',
            border: `1px solid ${isActive ? `${activeColor}60` : 'rgba(255, 255, 255, 0.1)'}`,
            cursor: 'pointer'
          }}
        >
          {isActive ? 'ON' : 'OFF'}
        </button>
      </div>
      <div style={{ fontSize: 8.5, color: '#aaa', paddingLeft: 4, fontStyle: 'italic' }}>
        Live: {liveValue}
      </div>
    </div>
  );
};
