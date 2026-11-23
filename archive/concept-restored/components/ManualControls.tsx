import React from 'react';
import type { FontAxisState, InstallationConfig } from '../types';
import { Sliders, Sparkles } from 'lucide-react';

interface ManualControlsProps {
  axes: FontAxisState;
  setAxes: React.Dispatch<React.SetStateAction<FontAxisState>>;
  config: InstallationConfig;
  setConfig: React.Dispatch<React.SetStateAction<InstallationConfig>>;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
}

export const ManualControls: React.FC<ManualControlsProps> = ({
  axes,
  setAxes,
  config,
  setConfig,
  isOpen,
  setIsOpen
}) => {
  const applyPreset = (wght: number, wdth: number) => {
    setAxes({ wght, wdth });
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: 24,
        zIndex: 50,
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(20, 20, 20, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          color: '#e2e2dd',
          padding: '8px 14px',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: 0.8,
          cursor: 'pointer',
          textTransform: 'uppercase',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          transition: 'all 0.2s ease'
        }}
      >
        <Sliders size={14} />
        {isOpen ? 'Close Sliders' : 'Manual Tuning Sliders'}
      </button>

      {/* Control panel */}
      {isOpen && (
        <div
          style={{
            marginTop: 12,
            width: 320,
            background: 'rgba(15, 15, 15, 0.92)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 8,
            padding: 18,
            color: '#f0f0ed',
            boxShadow: '0 20px 40px rgba(0,0,0,0.7)'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: 10
            }}
          >
            <span style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: '#999' }}>
              Base Font Axes
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => applyPreset(100, 25)}
                title="Whisper preset"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#bbb',
                  fontSize: 10,
                  padding: '3px 7px',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Light
              </button>
              <button
                onClick={() => applyPreset(400, 100)}
                title="Regular preset"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#bbb',
                  fontSize: 10,
                  padding: '3px 7px',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Regular
              </button>
              <button
                onClick={() => applyPreset(1000, 151)}
                title="Monumental preset"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#bbb',
                  fontSize: 10,
                  padding: '3px 7px',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Heavy
              </button>
            </div>
          </div>

          {/* Weight Axis Slider */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: '#ccc' }}>Weight (wght)</span>
              <span style={{ fontFamily: 'monospace', color: '#fff' }}>{axes.wght}</span>
            </div>
            <input
              type="range"
              min="100"
              max="1000"
              step="10"
              value={axes.wght}
              onChange={(e) => setAxes((prev: FontAxisState) => ({ ...prev, wght: Number(e.target.value) }))}
              style={{
                width: '100%',
                accentColor: '#f4f3ee',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* Width Axis Slider */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: '#ccc' }}>Width (wdth)</span>
              <span style={{ fontFamily: 'monospace', color: '#fff' }}>{axes.wdth}%</span>
            </div>
            <input
              type="range"
              min="25"
              max="151"
              step="1"
              value={axes.wdth}
              onChange={(e) => setAxes((prev: FontAxisState) => ({ ...prev, wdth: Number(e.target.value) }))}
              style={{
                width: '100%',
                accentColor: '#f4f3ee',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* Typography Geometry */}
          <div
            style={{
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: '#999',
              marginBottom: 10,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: 12
            }}
          >
            Layout Geometry
          </div>

          {/* Font Size Slider */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: '#ccc' }}>Size</span>
              <span style={{ fontFamily: 'monospace', color: '#aaa' }}>{config.fontSize}px</span>
            </div>
            <input
              type="range"
              min="20"
              max="60"
              value={config.fontSize}
              onChange={(e) => setConfig((prev: InstallationConfig) => ({ ...prev, fontSize: Number(e.target.value) }))}
              style={{ width: '100%', accentColor: '#888' }}
            />
          </div>

          {/* Line Spacing Slider */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: '#ccc' }}>Leading</span>
              <span style={{ fontFamily: 'monospace', color: '#aaa' }}>{config.lineSpacing.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="1.1"
              max="2.2"
              step="0.05"
              value={config.lineSpacing}
              onChange={(e) => setConfig((prev: InstallationConfig) => ({ ...prev, lineSpacing: Number(e.target.value) }))}
              style={{ width: '100%', accentColor: '#888' }}
            />
          </div>

          {/* Interactive Simulation Modes */}
          <div
            style={{
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: '#999',
              marginBottom: 10,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: 12
            }}
          >
            Interactions
          </div>

          {/* Ambient Breathing */}
          <div
            onClick={() => setConfig((p: InstallationConfig) => ({ ...p, ambientBreathing: !p.ambientBreathing }))}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 0',
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: config.ambientBreathing ? '#fff' : '#aaa' }}>
              <Sparkles size={14} color={config.ambientBreathing ? '#fff' : '#666'} />
              Idle Harmonic Breath
            </span>
            <span
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                background: config.ambientBreathing ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                color: config.ambientBreathing ? '#fff' : '#666'
              }}
            >
              {config.ambientBreathing ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
