import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import type {
  CharacterItem,
  WordItem,
  TextureFragmentItem,
  TrackedPerson,
  TrackedHand,
  MechanicsSwitches,
  WallVisualizations,
  MechanicsLiveTelemetry
} from '../types';
import {
  INSTALLATION_TEXT_LINES,
  LINE_INDENT_PERCENTAGES,
  WORD_RESTING_AXES,
  BACKGROUND_TEXTURE_FRAGMENTS,
  INSTALLATION_CONFIG,
  SEMANTIC_MASS_TABLE,
  DEFAULT_SEMANTIC_CONFIG
} from '../config';
import { audioEngine } from '../services/audioEngine';
import { glyphAtlas } from '../utils/glyphAtlas';

export interface TypographyCanvasRef {
  clearAllResidue: () => void;
}

interface TypographyCanvasProps {
  trackedPeopleRef: React.MutableRefObject<TrackedPerson[]>;
  trackedHandsRef: React.MutableRefObject<TrackedHand[]>;
  isMechanicsPanelOpen: boolean;
  mechanicsSwitches: MechanicsSwitches;
  wallVisualizations: WallVisualizations;
  onFpsUpdate?: (fps: number) => void;
  onMetricsUpdate?: (avgWght: number, avgWdth: number) => void;
  onTimingUpdate?: (updateMs: number, renderMs: number) => void;
  onTelemetryUpdate?: (telemetry: MechanicsLiveTelemetry) => void;
}

export const TypographyCanvas = forwardRef<TypographyCanvasRef, TypographyCanvasProps>(({
  trackedPeopleRef,
  trackedHandsRef: _unusedHands,
  isMechanicsPanelOpen,
  mechanicsSwitches,
  wallVisualizations,
  onFpsUpdate,
  onMetricsUpdate,
  onTimingUpdate,
  onTelemetryUpdate
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const charactersRef = useRef<CharacterItem[][]>([]);
  const wordsRef = useRef<WordItem[]>([]);
  const textureFragmentsRef = useRef<TextureFragmentItem[]>([]);

  const isFontLoadedRef = useRef<boolean>(false);
  const animationFrameIdRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(performance.now());
  const lastRenderTimeRef = useRef<number>(performance.now());

  const presenceFadeRef = useRef<number>(0);
  const idleDurationSecRef = useRef<number>(0);
  const currentFontSizeRef = useRef<number>(84);

  const [fontReady, setFontReady] = useState(false);

  // Clear all residue instantly (triggered via R key or simulation exit)
  const clearAllResidue = useCallback(() => {
    charactersRef.current.forEach((line) => {
      line.forEach((ch) => {
        ch.residue = 0;
      });
    });
    wordsRef.current.forEach((w) => {
      w.isSettled = false;
      w.settledAt = 0;
      w.settledTimeLeft = 0;
      w.dwellBuild = 0;
    });
  }, []);

  useImperativeHandle(ref, () => ({
    clearAllResidue
  }), [clearAllResidue]);

  useEffect(() => {
    if ('fonts' in document) {
      document.fonts.load('900 84px "Roboto Flex Variable"')
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

  // Compute fixed slot layout with resting hierarchy, ragged indents, and background texture
  const computeInstallationLayout = useCallback((width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cfg = INSTALLATION_CONFIG;
    const lines = INSTALLATION_TEXT_LINES;

    // Sizing: text block commands the wall (~86% height with tighter leading)
    const targetBlockHeight = height * cfg.blockHeightRatio;
    const computedLineHeight = targetBlockHeight / lines.length;
    const responsiveFontSize = Math.floor(Math.max(42, Math.min(160, computedLineHeight / cfg.lineSpacing)));
    currentFontSizeRef.current = responsiveFontSize;

    const dpr = window.devicePixelRatio || 1;
    glyphAtlas.init(responsiveFontSize, dpr);

    // Warm cache with both main installation lines and texture fragments
    const allTextToWarm = [...lines, ...BACKGROUND_TEXTURE_FRAGMENTS.map((f) => f.text)];
    glyphAtlas.warmCache(allTextToWarm);

    const actualLineHeight = responsiveFontSize * cfg.lineSpacing;
    const blockTotalHeight = lines.length * actualLineHeight;
    const startY = (height - blockTotalHeight) / 2 + responsiveFontSize * 0.92;
    const baseLeftX = width * cfg.leftBaseMarginRatio;

    // Measurement font for max envelope slot sizing
    ctx.font = `${cfg.maxWght} ${responsiveFontSize}px "Roboto Flex Variable", sans-serif`;
    if ('fontVariationSettings' in ctx) {
      (ctx as any).fontVariationSettings = `'wght' ${cfg.maxWght}, 'wdth' ${cfg.maxWdth}`;
    }

    const newGrid: CharacterItem[][] = [];
    const newWords: WordItem[] = [];

    lines.forEach((lineText, lineIdx) => {
      const lineY = startY + lineIdx * actualLineHeight;
      const indentPx = width * (LINE_INDENT_PERCENTAGES[lineIdx] || 0);
      let currentX = baseLeftX + indentPx;

      const wordsInLine = lineText.split(' ');
      let charIdxInLine = 0;

      const lineChars: CharacterItem[] = [];

      wordsInLine.forEach((wordStr, wIdx) => {
        const cleanWord = wordStr.trim().toUpperCase();
        const wordKey = cleanWord;
        const semanticProps = SEMANTIC_MASS_TABLE[wordKey] || DEFAULT_SEMANTIC_CONFIG;
        const restingAxes = WORD_RESTING_AXES[wordKey] || { wght: cfg.baseWght, wdth: cfg.baseWdth };
        const wordId = `w_${lineIdx}_${wIdx}_${cleanWord}`;

        const wordCharIndices: { lineIdx: number; charIdx: number }[] = [];
        const wordStartX = currentX;

        for (let c = 0; c < cleanWord.length; c++) {
          const char = cleanWord[c];
          const metrics = ctx.measureText(char);
          const slotW = Math.ceil(metrics.width) + 1.2;
          const slotCenterX = currentX + slotW / 2;

          lineChars.push({
            char,
            charIndex: charIdxInLine,
            lineIndex: lineIdx,
            x: slotCenterX,
            y: lineY,
            slotWidth: slotW,
            currentWght: restingAxes.wght,
            targetWght: restingAxes.wght,
            velocityWght: 0,
            currentWdth: restingAxes.wdth,
            targetWdth: restingAxes.wdth,
            velocityWdth: 0,
            restingWght: restingAxes.wght,
            restingWdth: restingAxes.wdth,
            word: wordKey,
            wordId,
            wordResponsiveness: semanticProps.responsiveness,
            wordInertia: semanticProps.inertia,
            residue: 0,
            lastDrawnWght: 0,
            lastDrawnWdth: 0,
            dominantContributor: 'none'
          });

          wordCharIndices.push({ lineIdx, charIdx: charIdxInLine });
          currentX += slotW;
          charIdxInLine++;
        }

        const wordEndX = currentX;
        const wordW = wordEndX - wordStartX;

        newWords.push({
          id: wordId,
          word: cleanWord,
          lineIndex: lineIdx,
          charIndices: wordCharIndices,
          centerX: wordStartX + wordW / 2,
          centerY: lineY,
          width: wordW,
          height: actualLineHeight,
          dwellBuild: 0,
          isSettled: false,
          settledAt: 0,
          settledTimeLeft: 0,
          activeVisitorIds: [],
          responsiveness: semanticProps.responsiveness,
          inertia: semanticProps.inertia,
          restingWght: restingAxes.wght,
          restingWdth: restingAxes.wdth
        });

        // Space between words in the same line
        if (wIdx < wordsInLine.length - 1) {
          const spaceMetrics = ctx.measureText(' ');
          const spaceSlotW = Math.ceil(spaceMetrics.width * 1.1);

          lineChars.push({
            char: ' ',
            charIndex: charIdxInLine,
            lineIndex: lineIdx,
            x: currentX + spaceSlotW / 2,
            y: lineY,
            slotWidth: spaceSlotW,
            currentWght: restingAxes.wght,
            targetWght: restingAxes.wght,
            velocityWght: 0,
            currentWdth: restingAxes.wdth,
            targetWdth: restingAxes.wdth,
            velocityWdth: 0,
            restingWght: restingAxes.wght,
            restingWdth: restingAxes.wdth,
            word: '',
            wordId: '',
            wordResponsiveness: 1.0,
            wordInertia: 1.0,
            residue: 0,
            lastDrawnWght: 0,
            lastDrawnWdth: 0,
            dominantContributor: 'none'
          });

          currentX += spaceSlotW;
          charIdxInLine++;
        }
      });

      newGrid.push(lineChars);
    });

    charactersRef.current = newGrid;
    wordsRef.current = newWords;

    // Compute Second-Tier Background Texture Fragments
    const textureFontSize = Math.max(13, Math.floor(responsiveFontSize * cfg.textureFontRatio));
    const newFragments: TextureFragmentItem[] = BACKGROUND_TEXTURE_FRAGMENTS.map((frag, fIdx) => ({
      id: `frag_${fIdx}_${frag.text}`,
      text: frag.text,
      x: frag.relX * width,
      y: frag.relY * height,
      fontSize: textureFontSize,
      currentWght: frag.baseWght,
      targetWght: frag.baseWght,
      velocityWght: 0,
      baseWght: frag.baseWght,
      baseWdth: frag.baseWdth,
      opacity: frag.opacity
    }));
    textureFragmentsRef.current = newFragments;
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      computeInstallationLayout(canvas.clientWidth, canvas.clientHeight);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [computeInstallationLayout, fontReady]);

  // Main 60 FPS Render Loop (< 8ms target with pre-rendered Glyph Atlas)
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
          computeInstallationLayout(displayWidth, displayHeight);
        }

        ctx.save();
        ctx.scale(dpr, dpr);

        const lines = charactersRef.current;
        const words = wordsRef.current;
        const textureFragments = textureFragmentsRef.current;

        if (lines.length === 0 || words.length === 0) {
          ctx.restore();
          animationFrameIdRef.current = requestAnimationFrame(render);
          return;
        }

        const cfg = INSTALLATION_CONFIG;
        const fontSize = currentFontSizeRef.current;
        const timeSec = currentTime * 0.001;

        // =========================================================================
        // 1. UPDATE PHASE (Resting Breathing, Instant Swell, Dwell Build, Settle)
        // =========================================================================
        const updateStart = performance.now();

        const trackedPeople = trackedPeopleRef.current;
        const hasVisitors = trackedPeople.length > 0;

        // Presence cross-fade
        if (hasVisitors) {
          idleDurationSecRef.current = 0;
          presenceFadeRef.current = Math.min(1.0, presenceFadeRef.current + dtSec / 0.5); // fast 0.5s response
        } else {
          idleDurationSecRef.current += dtSec;
          presenceFadeRef.current = Math.max(0.0, presenceFadeRef.current - dtSec / 1.5);
        }

        const presenceFactor = presenceFadeRef.current;
        const ambientFactor = 1.0 - presenceFactor;

        // Reset per-frame active visitor lists on words
        words.forEach((w) => {
          w.activeVisitorIds = [];
        });

        // 1A. Visitor Head Tracking & Nearest Word Targeting
        let primaryWeighedWord: WordItem | null = null;
        let primaryVisitorStillTime = 0;
        let primaryVisitorPos = { x: 0, y: 0 };

        if (mechanicsSwitches.headTracking && hasVisitors) {
          for (const person of trackedPeople) {
            if (!person.active || !person.nosePos.visible) continue;

            const hx = person.nosePos.x * displayWidth;
            const hy = person.nosePos.y * displayHeight;
            primaryVisitorPos = { x: Math.round(hx), y: Math.round(hy) };
            primaryVisitorStillTime = Math.max(primaryVisitorStillTime, person.stillTime);

            // Find nearest word within capture radius
            let nearestWord: WordItem | null = null;
            let minDist = cfg.dwellTargetCaptureRadiusPx;

            for (const w of words) {
              const dist = Math.hypot(hx - w.centerX, hy - w.centerY);
              if (dist < minDist) {
                minDist = dist;
                nearestWord = w;
              }
            }

            if (nearestWord) {
              const target: WordItem = nearestWord;
              person.targetWordId = target.id;
              person.targetWordText = target.word;
              target.activeVisitorIds.push(person.id);

              if (!primaryWeighedWord || target.dwellBuild > primaryWeighedWord.dwellBuild) {
                primaryWeighedWord = target;
              }

              // 1B. Dwell Build Mechanic (Stillness -> Deep weight over DWELL_SECONDS)
              if (mechanicsSwitches.dwellBuild) {
                if (person.isStill) {
                  // Distance from camera scales build speed
                  const proximityRate = 1.0 + person.depth * 0.85;
                  const semanticResp = mechanicsSwitches.semanticMass ? target.responsiveness : 1.0;
                  const deltaBuild = (dtSec / cfg.dwellBuildDurationSec) * proximityRate * semanticResp;
                  target.dwellBuild = Math.min(1.0, target.dwellBuild + deltaBuild);
                } else {
                  // Moving fast stops the build and slowly releases it
                  target.dwellBuild = Math.max(0, target.dwellBuild - dtSec / cfg.dwellReleaseDurationSec);
                }
              }
            } else {
              person.targetWordId = null;
              person.targetWordText = null;
            }
          }
        }

        // Release words that have no active visitors dwelling on them
        words.forEach((w) => {
          if (w.activeVisitorIds.length === 0 && !w.isSettled) {
            w.dwellBuild = Math.max(0, w.dwellBuild - dtSec / cfg.dwellReleaseDurationSec);
          }

          // 1C. Settle Mechanic: When word reaches full weight (build >= 1.0)
          if (mechanicsSwitches.settle && w.dwellBuild >= 0.99 && !w.isSettled) {
            w.isSettled = true;
            w.settledAt = currentTime;
            w.dwellBuild = 1.0;

            // Trigger soft low settle tone, stereo panned to word position
            if (mechanicsSwitches.sound) {
              const pan = (w.centerX / displayWidth) * 2 - 1;
              const settleFreq = 52 + w.lineIndex * 4.5;
              audioEngine.playSettleTone(pan, settleFreq);
            }
          }
        });

        // 1D. Empty Room Life (Attract Mode): After 60s, one word swells and releases over ~20s
        let emptyLifeWordId: string | null = null;
        let emptyLifeWeightDelta = 0;
        let emptyLifeStatus = 'Waiting (Visitors active)';

        if (mechanicsSwitches.idleLife && idleDurationSecRef.current >= cfg.emptyRoomTriggerSec) {
          const idleElapsed = idleDurationSecRef.current - cfg.emptyRoomTriggerSec;
          const cycleIdx = Math.floor(idleElapsed / cfg.emptyRoomWaveDurationSec) % words.length;
          const cycleProgress = (idleElapsed % cfg.emptyRoomWaveDurationSec) / cfg.emptyRoomWaveDurationSec;
          const currentIdleWord = words[cycleIdx];

          if (currentIdleWord) {
            emptyLifeWordId = currentIdleWord.id;
            const bell = Math.sin(cycleProgress * Math.PI);
            emptyLifeWeightDelta = (cfg.emptyRoomPeakWght - currentIdleWord.restingWght) * bell * ambientFactor;
            emptyLifeStatus = `Active: "${currentIdleWord.word}" (${Math.round((1 - cycleProgress) * 20)}s left)`;
          }
        } else if (mechanicsSwitches.idleLife) {
          const rem = Math.max(0, Math.round(cfg.emptyRoomTriggerSec - idleDurationSecRef.current));
          emptyLifeStatus = hasVisitors ? 'Paused (Visitor present)' : `Trigger in ${rem}s`;
        } else {
          emptyLifeStatus = 'Mechanic Disabled';
        }

        // 1E. Residue Exponential Decay (Half-life ~3 minutes = 180s)
        const residueDecayFactor = mechanicsSwitches.residue
          ? Math.exp((-Math.LN2 / cfg.residueHalfLifeSeconds) * dtSec)
          : 0;

        let totalCanvasWght = 0;
        let totalCanvasWdth = 0;
        let totalGlyphCount = 0;
        let totalResidueSum = 0;

        const activeWeighedWord: WordItem | null = primaryWeighedWord;

        // Update second-tier background fragments (ripple softly at 0.3x)
        textureFragments.forEach((frag) => {
          let fragRipple = 0;
          if (hasVisitors && primaryVisitorPos.x > 0) {
            const dist = Math.hypot(frag.x - primaryVisitorPos.x, frag.y - primaryVisitorPos.y);
            if (dist < 500) {
              fragRipple += (1 - dist / 500) * 85 * presenceFactor;
            }
          }
          if (activeWeighedWord && activeWeighedWord.isSettled) {
            const distToSettled = Math.hypot(frag.x - activeWeighedWord.centerX, frag.y - activeWeighedWord.centerY);
            if (distToSettled < 600) {
              fragRipple += (1 - distToSettled / 600) * 120;
            }
          }

          const fragBreath = Math.sin(timeSec * 0.38 + frag.x * 0.008) * 10;
          frag.targetWght = frag.baseWght + (fragRipple * cfg.textureRippleFactor) + fragBreath;

          frag.velocityWght += (frag.targetWght - frag.currentWght) * 0.16;
          frag.velocityWght *= 0.78;
          frag.currentWght += frag.velocityWght;
        });

        // Apply weights and physics to each primary glyph
        lines.forEach((lineChars, lineIdx) => {
          lineChars.forEach((ch) => {
            if (ch.char === ' ') return;
            totalGlyphCount++;

            const word = words.find((w) => w.id === ch.wordId);
            const wordDwell = (word && mechanicsSwitches.dwellBuild) ? word.dwellBuild : 0;
            const wordSettled = (word && mechanicsSwitches.settle) ? word.isSettled : false;

            // 1. Subtle desynchronized harmonic per-letter breathing (±28 wght)
            const letterPhase = lineIdx * 2.3 + ch.charIndex * 0.45;
            const breathingDelta = Math.sin(timeSec * cfg.breathingSpeed + letterPhase) * cfg.breathingWghtDelta;

            // 2. Instant soft swell around head target within ~0.5s
            let instantSwell = 0;
            if (hasVisitors && primaryVisitorPos.x > 0) {
              const distToHead = Math.hypot(ch.x - primaryVisitorPos.x, ch.y - primaryVisitorPos.y);
              if (distToHead < cfg.instantSwellRadiusPx) {
                const swellNorm = distToHead / cfg.instantSwellRadiusPx;
                const swellFalloff = Math.pow(Math.cos(swellNorm * (Math.PI / 2)), 2);
                instantSwell = cfg.instantSwellWght * swellFalloff * presenceFactor;
              }
            }

            // 3. Dwell influence spread to adjacent letters
            let letterDwellInfluence = wordDwell;
            if (wordDwell === 0 && activeWeighedWord) {
              const distToActive = Math.hypot(ch.x - activeWeighedWord.centerX, ch.y - activeWeighedWord.centerY);
              if (distToActive < cfg.dwellSpreadRadiusPx) {
                const spreadRatio = 1 - distToActive / cfg.dwellSpreadRadiusPx;
                letterDwellInfluence = activeWeighedWord.dwellBuild * spreadRatio * 0.35;
              }
            }

            // 4. Residue accumulation & decay
            if (mechanicsSwitches.residue) {
              if (wordSettled) {
                ch.residue = 1.0;
              } else if (letterDwellInfluence > 0.08) {
                ch.residue = Math.min(1.0, ch.residue + letterDwellInfluence * cfg.residueAccumulationRate * dtSec);
              }
              ch.residue *= residueDecayFactor;
            } else {
              ch.residue = 0;
            }
            totalResidueSum += ch.residue;

            // 5. Empty room wave contribution
            let letterIdleDelta = 0;
            if (word && word.id === emptyLifeWordId) {
              letterIdleDelta = emptyLifeWeightDelta;
            }

            // Determine dominant contributor for Source Tinting
            const dwellDelta = (cfg.maxWght - ch.restingWght) * letterDwellInfluence * presenceFactor;
            const residueDelta = (cfg.maxResidueWght - ch.restingWght) * ch.residue;

            if (dwellDelta > 50 || wordSettled) {
              ch.dominantContributor = 'dwell';
            } else if (residueDelta > 30) {
              ch.dominantContributor = 'residue';
            } else if (letterIdleDelta > 35) {
              ch.dominantContributor = 'idle';
            } else {
              ch.dominantContributor = 'none';
            }

            // Target Weight & Width Calculation
            let targetW = ch.restingWght + breathingDelta;
            let targetWd = ch.restingWdth;

            if (wordSettled) {
              // Full dramatic settle state: wght 900, wdth 125%
              targetW = cfg.maxWght;
              targetWd = cfg.maxWdth;
            } else {
              if (instantSwell > 0) {
                targetW += instantSwell;
                targetWd += (cfg.maxWdth - ch.restingWdth) * (instantSwell / cfg.instantSwellWght) * 0.35;
              }
              if (letterDwellInfluence > 0) {
                targetW += dwellDelta;
                targetWd += (cfg.maxWdth - ch.restingWdth) * letterDwellInfluence * presenceFactor;
              }
              if (residueDelta > 0) {
                targetW = Math.max(targetW, ch.restingWght + residueDelta);
              }
              if (letterIdleDelta > 0) {
                targetW += letterIdleDelta;
              }
            }

            targetW = Math.max(100, Math.min(cfg.maxWght, targetW));
            targetWd = Math.max(65, Math.min(cfg.maxWdth, targetWd));

            // Physical Spring-Damper Inertia
            const weightRatio = Math.max(0, Math.min(1, (targetW - 100) / 800));
            const semanticInertia = mechanicsSwitches.semanticMass ? ch.wordInertia : 1.0;
            const mass = (cfg.baseMass + (cfg.maxMass - cfg.baseMass) * weightRatio) * semanticInertia;

            const forceW = cfg.springStiffness * (targetW - ch.currentWght) - cfg.dampingRatio * ch.velocityWght;
            ch.velocityWght += (forceW / mass) * dtFactor;
            ch.currentWght += ch.velocityWght * dtFactor;

            const forceWd = cfg.springStiffness * (targetWd - ch.currentWdth) - cfg.dampingRatio * ch.velocityWdth;
            ch.velocityWdth += (forceWd / mass) * dtFactor;
            ch.currentWdth += ch.velocityWdth * dtFactor;

            ch.currentWght = Math.max(100, Math.min(cfg.maxWght, ch.currentWght));
            ch.currentWdth = Math.max(65, Math.min(cfg.maxWdth, ch.currentWdth));

            totalCanvasWght += ch.currentWght;
            totalCanvasWdth += ch.currentWdth;
          });
        });

        const avgWght = totalGlyphCount > 0 ? Math.round(totalCanvasWght / totalGlyphCount) : cfg.baseWght;
        const avgWdth = totalGlyphCount > 0 ? Math.round(totalCanvasWdth / totalGlyphCount) : cfg.baseWdth;
        const meanResidue = totalGlyphCount > 0 ? Number((totalResidueSum / totalGlyphCount).toFixed(3)) : 0;

        // 1F. Web Audio Drone Update
        const activePan = activeWeighedWord
          ? (activeWeighedWord.centerX / displayWidth) * 2 - 1
          : 0;

        audioEngine.updateWeight(avgWght, presenceFactor, activePan, mechanicsSwitches.sound);
        onMetricsUpdate?.(avgWght, avgWdth);

        const updateDuration = performance.now() - updateStart;

        // =========================================================================
        // 2. RENDER PHASE: DRAWIMAGE GLYPH ATLAS (< 8ms TARGET)
        // =========================================================================
        const renderStart = performance.now();

        // Pure black museum background
        ctx.fillStyle = cfg.backgroundColor;
        ctx.fillRect(0, 0, displayWidth, displayHeight);

        // Render Second-Tier Background Texture Fragments (Quiet background ripples)
        textureFragments.forEach((frag) => {
          ctx.font = `${Math.round(frag.currentWght)} ${frag.fontSize}px "Roboto Flex Variable", sans-serif`;
          if ('fontVariationSettings' in ctx) {
            (ctx as any).fontVariationSettings = `'wght' ${Math.round(frag.currentWght)}, 'wdth' ${frag.baseWdth}`;
          }
          ctx.fillStyle = `rgba(237, 234, 226, ${frag.opacity})`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(frag.text, frag.x, frag.y);
        });

        const slotHalfW = Math.ceil(fontSize * 1.5) / 2;
        const slotHalfH = Math.ceil(fontSize * 1.6) / 2;
        const drawW = slotHalfW * 2;
        const drawH = slotHalfH * 2;

        const useSourceTint = isMechanicsPanelOpen && wallVisualizations.sourceTint;

        // Draw Main Installation Glyphs from Atlas
        lines.forEach((lineChars) => {
          lineChars.forEach((ch) => {
            if (ch.char === ' ') return;

            // Optional Residue Heatmap visualization (only when panel open)
            if (isMechanicsPanelOpen && wallVisualizations.residueHeatmap && ch.residue > 0.05) {
              ctx.fillStyle = `rgba(192, 132, 252, ${ch.residue * 0.35})`;
              ctx.fillRect(ch.x - ch.slotWidth / 2, ch.y - fontSize * 0.65, ch.slotWidth, fontSize * 1.1);
            }

            // Determine glyph color
            let glyphColor = cfg.textColor;
            if (useSourceTint) {
              if (ch.dominantContributor === 'dwell') glyphColor = cfg.dwellTintColor;
              else if (ch.dominantContributor === 'residue') glyphColor = cfg.residueTintColor;
              else if (ch.dominantContributor === 'idle') glyphColor = cfg.idleTintColor;
            }

            // Settle dramatic scale-up inside slot:
            const word = words.find((w) => w.id === ch.wordId);
            const isSettledWord = word && word.isSettled;
            const scale = isSettledWord ? cfg.settledScaleFactor : 1.0;

            // Quantized bounds for cross-fading
            const lowWght = Math.floor(ch.currentWght / 50) * 50;
            const highWght = Math.min(900, lowWght + 50);
            const tWght = (ch.currentWght - lowWght) / 50;

            const lowWdth = Math.floor(ch.currentWdth / 10) * 10;
            const highWdth = Math.min(125, lowWdth + 10);

            const scaledW = drawW * scale;
            const scaledH = drawH * scale;
            const drawX = ch.x - scaledW / 2;
            const drawY = ch.y - scaledH / 2;

            const imgLow = glyphAtlas.getGlyph(ch.char, lowWght, lowWdth, glyphColor);

            if (tWght < 0.05 || lowWght === highWght) {
              ctx.globalAlpha = 1.0;
              ctx.drawImage(imgLow, drawX, drawY, scaledW, scaledH);
            } else {
              const imgHigh = glyphAtlas.getGlyph(ch.char, highWght, highWdth, glyphColor);
              ctx.globalAlpha = 1.0 - tWght;
              ctx.drawImage(imgLow, drawX, drawY, scaledW, scaledH);
              ctx.globalAlpha = tWght;
              ctx.drawImage(imgHigh, drawX, drawY, scaledW, scaledH);
            }
          });
        });

        ctx.globalAlpha = 1.0;

        // =========================================================================
        // 3. WALL VISUALIZATIONS (ONLY WHILE MECHANICS PANEL IS OPEN)
        // =========================================================================
        if (isMechanicsPanelOpen) {
          // 3A. Word Labels (Semantic Multiplier Tags)
          if (wallVisualizations.wordLabels) {
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            words.forEach((w) => {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
              ctx.fillText(
                `${w.word} [${w.restingWght}w] (${w.responsiveness}x resp / ${w.inertia}x in)`,
                w.centerX,
                w.centerY - fontSize * 0.75
              );
            });
          }

          // 3B. Dwell Progress Rings (Thin ring on target word per visitor)
          if (wallVisualizations.dwellRings) {
            words.forEach((w) => {
              if (w.dwellBuild > 0.02 || w.isSettled) {
                const ringRadius = 24;
                const ringX = w.centerX;
                const ringY = w.centerY - fontSize * 0.98;

                // Track ring
                ctx.beginPath();
                ctx.arc(ringX, ringY, ringRadius, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
                ctx.lineWidth = 2.5;
                ctx.stroke();

                // Progress arc
                ctx.beginPath();
                const startAngle = -Math.PI / 2;
                const endAngle = startAngle + Math.PI * 2 * w.dwellBuild;
                ctx.arc(ringX, ringY, ringRadius, startAngle, endAngle);
                ctx.strokeStyle = w.isSettled ? '#4ade80' : cfg.dwellTintColor;
                ctx.lineWidth = 2.5;
                ctx.stroke();

                // Percentage text
                ctx.font = '9px monospace';
                ctx.fillStyle = w.isSettled ? '#4ade80' : cfg.dwellTintColor;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(w.isSettled ? 'SETTLED' : `${Math.round(w.dwellBuild * 100)}%`, ringX, ringY);
              }
            });
          }

          // 3C. Source Tint Legend
          if (wallVisualizations.sourceTint) {
            const legendX = 24;
            const legendY = displayHeight - 48;
            ctx.font = '10.5px monospace';
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';

            // Dwell
            ctx.fillStyle = cfg.dwellTintColor;
            ctx.beginPath();
            ctx.arc(legendX, legendY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillText('Dwell Build', legendX + 12, legendY);

            // Residue
            ctx.fillStyle = cfg.residueTintColor;
            ctx.beginPath();
            ctx.arc(legendX + 130, legendY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillText('Residue Memory', legendX + 142, legendY);

            // Idle
            ctx.fillStyle = cfg.idleTintColor;
            ctx.beginPath();
            ctx.arc(legendX + 280, legendY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillText('Empty Life', legendX + 292, legendY);

            // Default
            ctx.fillStyle = cfg.textColor;
            ctx.beginPath();
            ctx.arc(legendX + 400, legendY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#aaa';
            ctx.fillText('Base Hierarchy', legendX + 412, legendY);
          }
        }

        const renderDuration = performance.now() - renderStart;
        onTimingUpdate?.(
          Number(updateDuration.toFixed(1)),
          Number(renderDuration.toFixed(1))
        );

        // Update live telemetry for the Mechanics Panel
        const settledWords = words.filter((w) => w.isSettled).map((w) => w.word);
        const audioTelemetry = audioEngine.getLiveTelemetry();

        onTelemetryUpdate?.({
          dwellStatus: activeWeighedWord
            ? `${primaryVisitorStillTime.toFixed(1)}s still on "${activeWeighedWord.word}" (${Math.round(activeWeighedWord.dwellBuild * 100)}%)`
            : 'No visitor dwelling',
          settledWordsCount: settledWords.length,
          settledList: settledWords.length > 0 ? settledWords.join(', ') : 'None',
          meanResidue,
          semanticMultiplierText: activeWeighedWord
            ? `"${activeWeighedWord.word}": ${activeWeighedWord.responsiveness}x resp, ${activeWeighedWord.inertia}x in`
            : 'None under focus',
          headScreenPosText: hasVisitors
            ? `(${primaryVisitorPos.x}px, ${primaryVisitorPos.y}px)`
            : 'No visitors',
          trackedVisitorsCount: trackedPeople.length,
          idleLifeStatus: emptyLifeStatus,
          droneLevel: audioTelemetry.droneLevel,
          lastToneText: audioTelemetry.lastToneText,
          currentPan: audioTelemetry.currentPan
        });

        ctx.restore();
        animationFrameIdRef.current = requestAnimationFrame(render);
      } catch (err) {
        console.error('Render loop failsafe:', err);
        animationFrameIdRef.current = requestAnimationFrame(render);
      }
    };

    animationFrameIdRef.current = requestAnimationFrame(render);
    return () => {
      isRunning = false;
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, [
    computeInstallationLayout,
    isMechanicsPanelOpen,
    mechanicsSwitches,
    wallVisualizations,
    onFpsUpdate,
    onMetricsUpdate,
    onTimingUpdate,
    onTelemetryUpdate,
    trackedPeopleRef
  ]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000000',
        overflow: 'hidden'
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
});
