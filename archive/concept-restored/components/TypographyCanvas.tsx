import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { CharacterItem, FontAxisState, TrackedPerson, TrackedHand } from '../types';
import { EXHIBITION_TEXT_LINES } from '../constants/text';
import { INSTALLATION_CONFIG, SEMANTIC_MASS_TABLE, DEFAULT_SEMANTIC_CONFIG } from '../config';
import { audioEngine } from '../services/audioEngine';
import { glyphAtlas } from '../utils/glyphAtlas';

interface TypographyCanvasProps {
  manualAxes?: FontAxisState;
  trackedPeopleRef: React.MutableRefObject<TrackedPerson[]>;
  trackedHandsRef: React.MutableRefObject<TrackedHand[]>;
  isDebugActive: boolean;
  showInfluencePoints?: boolean;
  showResidueHeatmap?: boolean;
  onFpsUpdate?: (fps: number) => void;
  onMetricsUpdate?: (avgWght: number, avgWdth: number) => void;
  onTimingUpdate?: (updateMs: number, renderMs: number) => void;
}

export const TypographyCanvas: React.FC<TypographyCanvasProps> = ({
  manualAxes,
  trackedPeopleRef,
  trackedHandsRef,
  isDebugActive,
  showInfluencePoints = false,
  showResidueHeatmap = false,
  onFpsUpdate,
  onMetricsUpdate,
  onTimingUpdate
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const charactersRef = useRef<CharacterItem[][]>([]);
  const isFontLoadedRef = useRef<boolean>(false);
  const animationFrameIdRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(performance.now());
  const lastRenderTimeRef = useRef<number>(performance.now());

  const presenceFadeRef = useRef<number>(0);
  const idleDurationSecRef = useRef<number>(0);
  const currentFontSizeRef = useRef<number>(32);

  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    if ('fonts' in document) {
      document.fonts.load('900 32px "Roboto Flex Variable"')
        .then(() => {
          isFontLoadedRef.current = true;
          setFontReady(true);
        })
        .catch(() => {
          isFontLoadedRef.current = true;
          setFontReady(true);
        });
    } else {
      isFontLoadedRef.current = true;
      setFontReady(true);
    }
  }, []);

  // Compute fixed slot layout with semantic word binding
  const computeFixedSlotLayout = useCallback((width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cfg = INSTALLATION_CONFIG;
    const lines = EXHIBITION_TEXT_LINES;

    const widthFitSize = (width * 0.88) / 41.0;
    const heightFitSize = (height * 0.84) / (lines.length * cfg.lineSpacing);
    const responsiveFontSize = Math.floor(Math.max(18, Math.min(widthFitSize, heightFitSize)));
    currentFontSizeRef.current = responsiveFontSize;

    const dpr = window.devicePixelRatio || 1;
    glyphAtlas.init(responsiveFontSize, dpr);
    glyphAtlas.warmCache(lines);

    const lineHeight = responsiveFontSize * cfg.lineSpacing;
    const blockTotalHeight = lines.length * lineHeight;

    const startY = Math.max(
      responsiveFontSize * 1.4,
      (height - blockTotalHeight) / 2 + responsiveFontSize
    );

    ctx.font = `${cfg.maxWght} ${responsiveFontSize}px "Roboto Flex Variable", sans-serif`;
    if ('fontVariationSettings' in ctx) {
      (ctx as any).fontVariationSettings = `'wght' ${cfg.maxWght}, 'wdth' ${cfg.maxWdth}`;
    }

    const newGrid: CharacterItem[][] = [];

    lines.forEach((lineText, lineIdx) => {
      const lineY = startY + lineIdx * lineHeight;
      const charSlotWidths: number[] = [];
      let totalLineWidth = 0;

      for (let c = 0; c < lineText.length; c++) {
        const ch = lineText[c];
        let slotW: number;
        if (ch === ' ') {
          slotW = responsiveFontSize * 0.28;
        } else {
          const metrics = ctx.measureText(ch);
          slotW = metrics.width + cfg.slotPadding;
        }
        charSlotWidths.push(slotW);
        totalLineWidth += slotW;
      }

      const lineStartX = Math.max(20, (width - totalLineWidth) / 2);
      let currentX = lineStartX;
      const lineChars: CharacterItem[] = [];

      // Extract words for Semantic Mass binding
      // Split into words preserving character indices
      const wordsInLine: { word: string; start: number; end: number }[] = [];
      const regex = /[A-Z]+/g;
      let match;
      while ((match = regex.exec(lineText)) !== null) {
        wordsInLine.push({
          word: match[0],
          start: match.index,
          end: match.index + match[0].length
        });
      }

      for (let c = 0; c < lineText.length; c++) {
        const slotW = charSlotWidths[c];
        const slotCenterX = currentX + slotW / 2;

        // Find semantic word
        const foundWordMatch = wordsInLine.find((w) => c >= w.start && c < w.end);
        const wordKey = foundWordMatch ? foundWordMatch.word : '';
        const semanticProps = SEMANTIC_MASS_TABLE[wordKey] || DEFAULT_SEMANTIC_CONFIG;

        const prevChar = charactersRef.current[lineIdx]?.[c];
        const initialWght = prevChar ? prevChar.currentWght : cfg.baseWght;
        const initialWdth = prevChar ? prevChar.currentWdth : cfg.baseWdth;
        const initialResidue = prevChar ? prevChar.residue : 0;

        lineChars.push({
          char: lineText[c],
          charIndex: c,
          lineIndex: lineIdx,
          x: slotCenterX,
          y: lineY,
          slotWidth: slotW,
          currentWght: initialWght,
          targetWght: initialWght,
          velocityWght: 0,
          currentWdth: initialWdth,
          targetWdth: initialWdth,
          velocityWdth: 0,
          word: wordKey,
          wordResponsiveness: semanticProps.responsiveness,
          wordInertia: semanticProps.inertia,
          residue: initialResidue,
          lastDrawnWght: 0,
          lastDrawnWdth: 0
        });

        currentX += slotW;
      }

      newGrid.push(lineChars);
    });

    charactersRef.current = newGrid;
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      computeFixedSlotLayout(canvas.clientWidth, canvas.clientHeight);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [computeFixedSlotLayout, fontReady]);

  // Main 60 FPS Render Loop (< 8ms target with cached OffscreenCanvas drawImage)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let isRunning = true;

    const render = (currentTime: number) => {
      if (!isRunning) return;

      try {
        const dtMs = Math.min(currentTime - lastRenderTimeRef.current, 50);
        lastRenderTimeRef.current = currentTime;
        const dtSec = dtMs / 1000;
        const dtFactor = Math.max(0.2, dtMs / 16.667);

        frameCountRef.current++;
        if (currentTime - lastFpsTimeRef.current >= 500) {
          const fps = Math.round(
            (frameCountRef.current * 1000) / (currentTime - lastFpsTimeRef.current)
          );
          onFpsUpdate?.(fps);
          frameCountRef.current = 0;
          lastFpsTimeRef.current = currentTime;
        }

        const dpr = window.devicePixelRatio || 1;
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;

        if (
          canvas.width !== Math.floor(displayWidth * dpr) ||
          canvas.height !== Math.floor(displayHeight * dpr)
        ) {
          canvas.width = Math.floor(displayWidth * dpr);
          canvas.height = Math.floor(displayHeight * dpr);
          computeFixedSlotLayout(displayWidth, displayHeight);
        }

        ctx.save();
        ctx.scale(dpr, dpr);

        const lines = charactersRef.current;
        if (lines.length === 0) {
          ctx.restore();
          animationFrameIdRef.current = requestAnimationFrame(render);
          return;
        }

        const cfg = INSTALLATION_CONFIG;
        const timeSec = currentTime * 0.001;
        const fontSize = currentFontSizeRef.current;

        // 1. UPDATE PHASE (Spatial Field, Gestures, Semantic Mass & Attract Mode)
        const updateStart = performance.now();

        const trackedPeople = trackedPeopleRef.current;
        const trackedHands = trackedHandsRef.current;
        const hasVisitors = trackedPeople.length > 0 || trackedHands.length > 0;

        // Attract mode timing
        if (hasVisitors) {
          idleDurationSecRef.current = 0;
          presenceFadeRef.current = Math.min(
            1.0,
            presenceFadeRef.current + dtMs / cfg.presenceFadeDurationMs
          );
        } else {
          idleDurationSecRef.current += dtSec;
          presenceFadeRef.current = Math.max(
            0.0,
            presenceFadeRef.current - dtMs / cfg.presenceFadeDurationMs
          );
        }

        const presenceFactor = presenceFadeRef.current;
        const ambientFactor = 1.0 - presenceFactor;

        // Attract Mode: single wave sweeps across text every 25s after 60s idle
        let attractWaveActive = false;
        let attractWaveCenterNorm = -1;
        if (idleDurationSecRef.current >= cfg.attractModeIdleTriggerSec) {
          const attractCycle = (idleDurationSecRef.current - cfg.attractModeIdleTriggerSec) % cfg.attractWavePeriodSec;
          if (attractCycle < cfg.attractWaveDurationSec) {
            attractWaveActive = true;
            attractWaveCenterNorm = attractCycle / cfg.attractWaveDurationSec;
          }
        }

        // Two-Hands Stretch Calculation:
        let twoHandStretchActive = false;
        let stretchMinX = 0;
        let stretchMaxX = 0;
        let stretchTargetWdth = cfg.baseWdth;

        if (trackedHands.length >= 2) {
          const h1 = trackedHands[0];
          const h2 = trackedHands[1];
          if (h1.active && h2.active) {
            const h1x = h1.palmX * displayWidth;
            const h2x = h2.palmX * displayWidth;
            const handDist = Math.abs(h1x - h2x);

            if (handDist > 160) {
              twoHandStretchActive = true;
              stretchMinX = Math.min(h1x, h2x);
              stretchMaxX = Math.max(h1x, h2x);
              const ratio = Math.max(0, Math.min(1, (handDist - 160) / (cfg.twoHandStretchMaxDist - 160)));
              stretchTargetWdth = cfg.baseWdth + (cfg.maxWdth - cfg.baseWdth) * ratio;
            }
          }
        }

        // Active influence points
        const influencePoints: {
          x: number;
          y: number;
          depth: number;
          radius: number;
          label: string;
          isFist: boolean;
          wakeVx: number;
          wakeVy: number;
          wakeSpeed: number;
        }[] = [];

        // Add Hands
        trackedHands.forEach((hand) => {
          if (!hand.active) return;
          const hx = hand.palmX * displayWidth;
          const hy = hand.palmY * displayHeight;

          if (hand.isFist) {
            // Closed fist = "Weight" gesture: Small radius, peak wght 900
            influencePoints.push({
              x: hx,
              y: hy,
              depth: 1.0,
              radius: cfg.fistRadius,
              label: 'Fist (Max Weight)',
              isFist: true,
              wakeVx: hand.velocityX,
              wakeVy: hand.velocityY,
              wakeSpeed: hand.speed
            });
          } else {
            // Open palm = Wide, moderate influence
            influencePoints.push({
              x: hx,
              y: hy,
              depth: hand.depth * cfg.openPalmDepthMult,
              radius: cfg.openPalmRadius * (0.8 + 0.4 * hand.depth),
              label: 'Open Palm',
              isFist: false,
              wakeVx: hand.velocityX,
              wakeVy: hand.velocityY,
              wakeSpeed: hand.speed
            });
          }
        });

        // Add Head (Subtle anchor so hands dominate)
        trackedPeople.forEach((person) => {
          if (!person.active || !person.nosePos.visible) return;
          influencePoints.push({
            x: person.nosePos.x * displayWidth,
            y: person.nosePos.y * displayHeight,
            depth: person.depth * 0.35,
            radius: 380,
            label: 'Head',
            isFist: false,
            wakeVx: 0,
            wakeVy: 0,
            wakeSpeed: 0
          });
        });

        // Residue exponential decay lambda: half-life ~45s
        const residueDecayFactor = Math.exp((-Math.LN2 / cfg.residueHalfLifeSeconds) * dtSec);

        let totalWghtSum = 0;
        let totalWdthSum = 0;
        let totalCharCount = 0;
        let maxWeightDropVelocity = 0;

        const baseWeight = manualAxes ? manualAxes.wght : cfg.baseWght;
        const baseWidth = manualAxes ? manualAxes.wdth : cfg.baseWdth;

        lines.forEach((lineChars, lineIdx) => {
          lineChars.forEach((ch) => {
            totalCharCount++;

            // 1. Residue Update: Accumulate under influence, decay slowly
            let maxInfluence = 0;
            let rippleWakeOffset = 0;

            if (influencePoints.length > 0) {
              influencePoints.forEach((pt) => {
                const dx = ch.x - pt.x;
                const dy = ch.y - pt.y;
                const dist = Math.hypot(dx, dy);

                if (dist < pt.radius) {
                  const normDist = dist / pt.radius;
                  const falloff = Math.cos(normDist * (Math.PI / 2));
                  const inf = Math.pow(Math.max(0, falloff), cfg.falloffExponent) * pt.depth;
                  if (inf > maxInfluence) maxInfluence = inf;

                  // Hand speed ripple
                  if (pt.wakeSpeed > 0.35) {
                    const dot = (dx * pt.wakeVx + dy * pt.wakeVy) / (dist * pt.wakeSpeed);
                    if (dot < -0.3) {
                      rippleWakeOffset = Math.min(0.25, rippleWakeOffset + 0.18 * (1 - normDist));
                    }
                  }
                }
              });
            }

            // Accumulate residue
            if (maxInfluence > 0.05) {
              ch.residue = Math.min(1.0, ch.residue + maxInfluence * cfg.residueAccumulationRate * dtSec);
            }
            // Continuous slow decay so wall never stays stuck
            ch.residue *= residueDecayFactor;

            // Resting weight floor for this glyph including residue imprint (capped at 500)
            const residueContribution = (cfg.maxResidueWght - baseWeight) * ch.residue;
            const glyphRestingWght = baseWeight + residueContribution;

            let targetW = glyphRestingWght;
            let targetWd = baseWidth;

            // 2. Apply Visitor Influence with Semantic Mass Responsiveness
            if (maxInfluence > 0) {
              const effectiveInf = Math.max(0, maxInfluence - rippleWakeOffset);
              // Semantic responsiveness scales target weight delta!
              const semanticTargetDelta = (cfg.maxWght - glyphRestingWght) * effectiveInf * ch.wordResponsiveness;
              const visitorTargetW = glyphRestingWght + semanticTargetDelta;
              const visitorTargetWd = baseWidth + (cfg.maxWdth - baseWidth) * effectiveInf;

              targetW = targetW * (1 - presenceFactor) + visitorTargetW * presenceFactor;
              targetWd = targetWd * (1 - presenceFactor) + visitorTargetWd * presenceFactor;
            }

            // 3. Two-Hands Stretch between hands
            if (twoHandStretchActive && ch.x >= stretchMinX && ch.x <= stretchMaxX) {
              targetWd = Math.max(targetWd, stretchTargetWdth);
            }

            // 4. Idle Ambient Breathing / Attract Mode Wave
            if (ambientFactor > 0.001) {
              if (attractWaveActive && attractWaveCenterNorm >= 0) {
                // Attract mode sweeping wave
                const normX = ch.x / displayWidth;
                const distToWave = Math.abs(normX - attractWaveCenterNorm);
                if (distToWave < 0.22) {
                  const waveFactor = Math.pow(Math.cos((distToWave / 0.22) * (Math.PI / 2)), 2);
                  targetW += (cfg.attractWavePeakWght - baseWeight) * waveFactor * ambientFactor;
                }
              } else {
                // Subtle harmonic breath
                const wave = Math.sin(
                  timeSec * cfg.ambientWaveSpeed + lineIdx * 0.42 + ch.charIndex * 0.08
                );
                const breathMod = (wave + 1) * 0.5;
                targetW += breathMod * cfg.ambientWaveAmplitude * ambientFactor;
                targetWd += breathMod * 6 * ambientFactor;
              }
            }

            // 5. Physical Mass & Inertia with Semantic Inertia Scaling
            const normalizedCurrentWeight = Math.max(
              0,
              Math.min(1, (ch.currentWght - baseWeight) / (cfg.maxWght - baseWeight))
            );
            // Effective mass scaled by semantic word inertia!
            const basePhysicalMass = cfg.baseMass + (cfg.maxMass - cfg.baseMass) * normalizedCurrentWeight;
            const mass = basePhysicalMass * ch.wordInertia;

            const forceWght = cfg.springStiffness * (targetW - ch.currentWght) - cfg.dampingRatio * ch.velocityWght;
            const accelWght = forceWght / mass;
            ch.velocityWght += accelWght * dtFactor;
            ch.currentWght += ch.velocityWght * dtFactor;

            if (ch.velocityWght < -cfg.settleThumpThreshold) {
              if (Math.abs(ch.velocityWght) > maxWeightDropVelocity) {
                maxWeightDropVelocity = Math.abs(ch.velocityWght);
              }
            }

            const forceWdth = cfg.springStiffness * (targetWd - ch.currentWdth) - cfg.dampingRatio * ch.velocityWdth;
            const accelWdth = forceWdth / mass;
            ch.velocityWdth += accelWdth * dtFactor;
            ch.currentWdth += ch.velocityWdth * dtFactor;

            ch.currentWght = Math.max(cfg.baseWght, Math.min(cfg.maxWght, ch.currentWght));
            ch.currentWdth = Math.max(cfg.baseWdth, Math.min(cfg.maxWdth, ch.currentWdth));

            totalWghtSum += ch.currentWght;
            totalWdthSum += ch.currentWdth;
          });
        });

        const updateDuration = performance.now() - updateStart;

        // 2. RENDER PHASE: 100% DRAWIMAGE FROM GLYPH ATLAS CACHE (< 8ms TARGET)
        const renderStart = performance.now();

        ctx.fillStyle = '#080808';
        ctx.fillRect(0, 0, displayWidth, displayHeight);

        const slotHalfW = Math.ceil(fontSize * 1.5) / 2;
        const slotHalfH = Math.ceil(fontSize * 1.6) / 2;
        const drawW = slotHalfW * 2;
        const drawH = slotHalfH * 2;

        lines.forEach((lineChars) => {
          lineChars.forEach((ch) => {
            if (ch.char === ' ') return;

            // Optional Residue Heatmap visualization
            if (showResidueHeatmap && ch.residue > 0.05) {
              ctx.fillStyle = `rgba(168, 85, 247, ${ch.residue * 0.28})`;
              ctx.fillRect(ch.x - ch.slotWidth / 2, ch.y - fontSize * 0.7, ch.slotWidth, fontSize * 1.1);
            }

            // Quantized bounds for cross-fading
            const lowWght = Math.floor(ch.currentWght / 50) * 50;
            const highWght = Math.min(900, lowWght + 50);
            const tWght = (ch.currentWght - lowWght) / 50;

            const lowWdth = Math.floor(ch.currentWdth / 10) * 10;
            const highWdth = Math.min(120, lowWdth + 10);

            const drawX = ch.x - slotHalfW;
            const drawY = ch.y - slotHalfH;

            const imgLow = glyphAtlas.getGlyph(ch.char, lowWght, lowWdth);

            if (tWght < 0.05 || lowWght === highWght) {
              ctx.globalAlpha = 1.0;
              ctx.drawImage(imgLow, drawX, drawY, drawW, drawH);
            } else {
              const imgHigh = glyphAtlas.getGlyph(ch.char, highWght, highWdth);
              ctx.globalAlpha = 1.0 - tWght;
              ctx.drawImage(imgLow, drawX, drawY, drawW, drawH);
              ctx.globalAlpha = tWght;
              ctx.drawImage(imgHigh, drawX, drawY, drawW, drawH);
            }
          });
        });

        ctx.globalAlpha = 1.0;

        // Debug influence rings & Two-Hands Stretch bounds
        if (isDebugActive && showInfluencePoints) {
          if (twoHandStretchActive) {
            // Draw horizontal stretch bar between hands
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(stretchMinX, displayHeight * 0.2, stretchMaxX - stretchMinX, displayHeight * 0.6);
            ctx.setLineDash([]);

            ctx.font = '10px monospace';
            ctx.fillStyle = '#38bdf8';
            ctx.textAlign = 'center';
            ctx.fillText(
              `TWO-HAND STRETCH: ${(stretchTargetWdth).toFixed(0)}% WIDTH`,
              (stretchMinX + stretchMaxX) / 2,
              displayHeight * 0.18
            );
          }

          if (influencePoints.length > 0) {
            influencePoints.forEach((pt) => {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
              ctx.strokeStyle = pt.isFist ? 'rgba(244, 63, 94, 0.3)' : 'rgba(74, 222, 128, 0.15)';
              ctx.lineWidth = pt.isFist ? 2 : 1;
              ctx.stroke();

              ctx.beginPath();
              ctx.arc(pt.x, pt.y, pt.isFist ? 8 : 6, 0, Math.PI * 2);
              ctx.fillStyle = pt.isFist ? '#f43f5e' : '#4ade80';
              ctx.fill();

              ctx.font = '10px monospace';
              ctx.fillStyle = pt.isFist ? '#f43f5e' : '#4ade80';
              ctx.textAlign = 'left';
              ctx.fillText(`${pt.label} (${Math.round(pt.depth * 100)}%)`, pt.x + 12, pt.y - 6);
            });
          }
        }

        const renderDuration = performance.now() - renderStart;

        // Audio updates
        const meanWght = totalCharCount > 0 ? totalWghtSum / totalCharCount : cfg.baseWght;
        audioEngine.updateWeight(meanWght, presenceFactor);

        if (maxWeightDropVelocity > cfg.settleThumpThreshold) {
          const intensity = Math.min(1.0, (maxWeightDropVelocity - cfg.settleThumpThreshold) / 40);
          audioEngine.triggerSettlingThump(intensity);
        }

        if (totalCharCount > 0) {
          onMetricsUpdate?.(
            Math.round(meanWght),
            Math.round(totalWdthSum / totalCharCount)
          );
        }

        onTimingUpdate?.(
          Number(updateDuration.toFixed(1)),
          Number(renderDuration.toFixed(1))
        );

        ctx.restore();
      } catch (renderError) {
        console.warn('Render loop failsafe recovery:', renderError);
      }

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    animationFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [
    fontReady,
    manualAxes,
    trackedPeopleRef,
    trackedHandsRef,
    isDebugActive,
    showInfluencePoints,
    showResidueHeatmap,
    computeFixedSlotLayout,
    onFpsUpdate,
    onMetricsUpdate,
    onTimingUpdate
  ]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#080808'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
};
