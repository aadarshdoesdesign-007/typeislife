import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import type {
  CharacterItem,
  FontAxisState,
  TrackedPerson,
  TrackedHand,
  MechanicsSwitches,
  WallVisualizations,
  MechanicsLiveTelemetry,
  DominantContributor
} from '../types';
import { EXHIBITION_PASSAGES, INSTALLATION_CONFIG, SEMANTIC_MASS_TABLE, DEFAULT_SEMANTIC_CONFIG } from '../config';
import { audioEngine } from '../services/audioEngine';
import { glyphAtlas } from '../utils/glyphAtlas';

export interface TypographyCanvasRef {
  clearAllResidue: () => void;
  triggerSimulatedDrop: (x: number, y: number) => void;
}

interface TypographyCanvasProps {
  manualAxes?: FontAxisState;
  fillScale?: number;
  trackedPeopleRef: React.MutableRefObject<TrackedPerson[]>;
  trackedHandsRef: React.MutableRefObject<TrackedHand[]>;
  silhouetteMaskRef: React.MutableRefObject<Uint8Array | null>;
  fps?: number;
  isDebugActive?: boolean;
  showInfluencePoints?: boolean;
  showResidueHeatmap?: boolean;
  isMechanicsPanelOpen?: boolean;
  mechanicsSwitches?: MechanicsSwitches;
  wallVisualizations?: WallVisualizations;
  onFpsUpdate?: (fps: number) => void;
  onMetricsUpdate?: (meanWght: number, meanWdth: number) => void;
  onTimingUpdate?: (updateMs: number, renderMs: number) => void;
  onTelemetryUpdate?: (telemetry: MechanicsLiveTelemetry) => void;
}

const DEFAULT_MECHANICS_SWITCHES: MechanicsSwitches = {
  contrastGuard: true,
  gravity: true,
  bodySilhouette: true,
  dropGesture: true,
  gestures: true,
  speedRipple: true,
  headTracking: true,
  semanticMass: true,
  residue: true,
  attractMode: true,
  sound: true,
  hands: true,
  handRhythm: true
};

const DEFAULT_WALL_VISUALIZATIONS: WallVisualizations = {
  sourceTint: false,
  residueHeatmap: false,
  influenceDots: false,
  maskOutline: false
};

function smoothMax(a: number, b: number, k: number = 0.12): number {
  if (k <= 0) return Math.max(a, b);
  const h = Math.max(0, Math.min(1, 0.5 + (a - b) / (2 * k)));
  return a * h + b * (1 - h) + k * h * (1 - h);
}

function sampleSilhouetteMask(mask: Uint8Array, normX: number, normY: number): number {
  const mx = Math.max(1, Math.min(126, Math.floor(normX * 128)));
  const my = Math.max(1, Math.min(70, Math.floor(normY * 72)));
  let sum = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      sum += mask[(my + dy) * 128 + (mx + dx)];
    }
  }
  return sum / (9 * 255);
}

function wrapWordsGreedy(words: string[], maxLineChars: number): string[] {
  const lines: string[] = [];
  let currentWords: string[] = [];
  let currentLength = 0;

  for (const w of words) {
    const space = currentWords.length > 0 ? 1 : 0;
    if (currentLength + space + w.length <= maxLineChars) {
      currentWords.push(w);
      currentLength += space + w.length;
    } else {
      if (currentWords.length > 0) {
        lines.push(currentWords.join(' '));
      }
      currentWords = [w];
      currentLength = w.length;
    }
  }

  if (currentWords.length > 0) {
    lines.push(currentWords.join(' '));
  }

  return lines;
}

function solveLayoutFit(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cfg: typeof INSTALLATION_CONFIG,
  fillScale: number = cfg.fillScale
): { lines: string[]; fontSize: number; lineSpacing: number; usingAppendedPassage: boolean } {
  // Real breathing room: min margin of 8% left/right, 10% top/bottom
  const maxAllowedW = width * (1.0 - 2 * cfg.minMarginXRatio);
  const maxAllowedH = height * (1.0 - 2 * cfg.minMarginYRatio);

  const targetW = Math.min(maxAllowedW, width * fillScale);
  const targetH = Math.min(maxAllowedH, height * (fillScale * (0.65 / 0.72)));
  const aspect = width / height;

  const wordsP1 = EXHIBITION_PASSAGES.paragraph1.split(/\s+/).filter(Boolean);
  const wordsBoth = `${EXHIBITION_PASSAGES.paragraph1} ${EXHIBITION_PASSAGES.paragraph2}`.split(/\s+/).filter(Boolean);

  let bestConfig: {
    lines: string[];
    fontSize: number;
    lineSpacing: number;
    usingAppendedPassage: boolean;
    score: number;
  } | null = null;

  const passageCandidates = [
    { words: wordsP1, isAppended: false },
    { words: wordsBoth, isAppended: true }
  ];

  for (const { words, isAppended } of passageCandidates) {
    for (let maxChars = 28; maxChars <= 85; maxChars++) {
      const candidateLines = wrapWordsGreedy(words, maxChars);
      const numLines = candidateLines.length;
      if (numLines < 6 || numLines > 32) continue;

      const refSize = 100;
      ctx.font = `${cfg.maxWght} ${refSize}px "Roboto Flex Variable", sans-serif`;
      if ('fontVariationSettings' in ctx) {
        (ctx as any).fontVariationSettings = `'wght' ${cfg.maxWght}, 'wdth' ${cfg.maxWdth}`;
      }

      let maxLineNormW = 0;
      for (const lineText of candidateLines) {
        const lineWords = lineText.split(/\s+/).filter(Boolean);
        let lineW = 0;
        for (let wi = 0; wi < lineWords.length; wi++) {
          const w = lineWords[wi];
          const wMeasure = ctx.measureText(w).width;
          const spaceMeasure = wi < lineWords.length - 1 ? refSize * cfg.wordSpacingFactor : 0;
          lineW += wMeasure + spaceMeasure;
        }
        if (lineW > maxLineNormW) maxLineNormW = lineW;
      }

      if (maxLineNormW <= 0) continue;

      const fontSizeByWidth = (targetW / maxLineNormW) * refSize;
      const requiredL = (targetH - fontSizeByWidth) / ((numLines - 1) * fontSizeByWidth);

      if (requiredL >= cfg.minLineSpacing && requiredL <= cfg.maxLineSpacing) {
        const idealSpacingDelta = Math.abs(requiredL - 1.48);
        const appendBias = aspect < 1.15 ? (isAppended ? 30 : -10) : (isAppended ? -30 : 20);
        const score = 100 - idealSpacingDelta * 40 + appendBias;

        if (!bestConfig || score > bestConfig.score) {
          bestConfig = {
            lines: candidateLines,
            fontSize: Math.floor(fontSizeByWidth),
            lineSpacing: requiredL,
            usingAppendedPassage: isAppended,
            score
          };
        }
      }
    }

    if (bestConfig && !bestConfig.usingAppendedPassage && bestConfig.score > 80 && aspect >= 1.2) {
      break;
    }
  }

  if (!bestConfig) {
    const candidateLines = wrapWordsGreedy(wordsP1, 55);
    const numLines = candidateLines.length;
    const estFontSize = Math.floor(Math.min((targetW / 55) * 1.5, targetH / (numLines * 1.48)));
    return {
      lines: candidateLines,
      fontSize: Math.max(16, estFontSize),
      lineSpacing: 1.48,
      usingAppendedPassage: false
    };
  }

  return {
    lines: bestConfig.lines,
    fontSize: Math.max(16, bestConfig.fontSize),
    lineSpacing: Math.max(cfg.minLineSpacing, Math.min(cfg.maxLineSpacing, bestConfig.lineSpacing)),
    usingAppendedPassage: bestConfig.usingAppendedPassage
  };
}

export const TypographyCanvas = forwardRef<TypographyCanvasRef, TypographyCanvasProps>(({
  manualAxes,
  fillScale = INSTALLATION_CONFIG.fillScale,
  trackedPeopleRef,
  trackedHandsRef,
  silhouetteMaskRef,
  fps = 60,
  isDebugActive = false,
  showInfluencePoints = false,
  showResidueHeatmap = false,
  isMechanicsPanelOpen = false,
  mechanicsSwitches = DEFAULT_MECHANICS_SWITCHES,
  wallVisualizations = DEFAULT_WALL_VISUALIZATIONS,
  onFpsUpdate,
  onMetricsUpdate,
  onTimingUpdate,
  onTelemetryUpdate
}, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const charactersRef = useRef<CharacterItem[][]>([]);
  const currentFontSizeRef = useRef<number>(32);
  const isFontLoadedRef = useRef<boolean>(false);
  const [fontReady, setFontReady] = useState<boolean>(false);

  const animationFrameIdRef = useRef<number | null>(null);
  const lastRenderTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(performance.now());

  // Attract mode & idle timer
  const idleDurationSecRef = useRef<number>(0);
  const presenceFadeRef = useRef<number>(0.0);

  // Layout transition cross-fade state (short fade on resize / aspect ratio changes)
  const layoutFadeAlphaRef = useRef<number>(1.0);
  const isFadingLayoutRef = useRef<boolean>(false);
  const fadeStartTimeRef = useRef<number>(0);

  // Phase 3 Drop Gesture state tracking per hand
  const prevHandFistStateRef = useRef<boolean[]>([false, false, false, false]);
  const handFistStartTimeRef = useRef<number[]>([0, 0, 0, 0]);
  const lastDropTimeRef = useRef<number>(0);
  const lastDropInfoRef = useRef<string>('None');

  // Hand Rhythm tracking per hand
  const prevHandNearestCharIdRef = useRef<Record<number, number>>({});
  const lastHandMoveTimeRef = useRef<Record<number, number>>({});

  // Trigger Drop Gesture helper
  const triggerDropAt = useCallback((x: number, y: number) => {
    const cfg = INSTALLATION_CONFIG;
    let heavyCount = 0;
    const lines = charactersRef.current;

    lines.forEach((lineChars) => {
      lineChars.forEach((ch) => {
        if (ch.char === ' ') return;
        const dist = Math.hypot(ch.x - x, ch.y - y);
        if (dist < cfg.dropRadiusPx) {
          const prox = Math.cos((dist / cfg.dropRadiusPx) * (Math.PI / 2));
          const wNorm = Math.max(0, Math.min(1, (ch.currentWght - cfg.baseWght) / (cfg.maxWght - cfg.baseWght)));
          // Heavy ones drop further (up to 20px), light ones drop 12px
          const dropDist = (cfg.minDropDistPx + (cfg.maxDropDistPx - cfg.minDropDistPx) * wNorm) * prox;

          ch.dropOffset = dropDist;
          ch.dropVelocity = 45 * prox;

          if (ch.currentWght >= 450) {
            heavyCount++;
          }
        }
      });
    });

    if (heavyCount > 0 && mechanicsSwitches.sound) {
      audioEngine.triggerDropThud(heavyCount);
      if (mechanicsSwitches.handRhythm) {
        audioEngine.triggerHandRhythmHit({
          handIndex: 0,
          xNorm: x / (canvasRef.current?.clientWidth || 1920),
          speed: 0.85,
          letterWeight: 900,
          word: 'DROP',
          isHeavyWord: true,
          isLightWord: false,
          isFist: false,
          isDrop: true
        });
      }
    }
    lastDropInfoRef.current = `Dropped (${heavyCount} heavy letters)`;
  }, [mechanicsSwitches.sound, mechanicsSwitches.handRhythm]);

  // Expose imperative methods
  useImperativeHandle(ref, () => ({
    clearAllResidue: () => {
      const cfg = INSTALLATION_CONFIG;
      charactersRef.current.forEach((lineChars) => {
        lineChars.forEach((ch) => {
          ch.residue = 0;
          const restWght = ch.isHeavyWord ? 390 : cfg.baseWght;
          const restWdth = ch.isHeavyWord ? 88 : cfg.baseWdth;
          ch.currentWght = restWght;
          ch.targetWght = restWght;
          ch.currentWdth = restWdth;
          ch.targetWdth = restWdth;
          ch.velocityWght = 0;
          ch.velocityWdth = 0;
        });
      });
    },
    triggerSimulatedDrop: (x: number, y: number) => {
      triggerDropAt(x, y);
    }
  }), [triggerDropAt]);

  // Ensure Roboto Flex font is loaded
  useEffect(() => {
    if ('fonts' in document) {
      document.fonts
        .load(`400 32px "Roboto Flex Variable"`)
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

  // Compute fixed slot layout: guarantees paragraph fits canvas aspect ratio with breathing room margins
  const computeFixedSlotLayout = useCallback((width: number, height: number, customFillScale?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cfg = INSTALLATION_CONFIG;
    const activeFillScale = customFillScale ?? fillScale;
    const { lines, fontSize, lineSpacing } = solveLayoutFit(ctx, width, height, cfg, activeFillScale);

    currentFontSizeRef.current = fontSize;

    const dpr = window.devicePixelRatio || 1;
    glyphAtlas.init(fontSize, dpr);
    glyphAtlas.warmCache(lines);

    const lineHeight = fontSize * lineSpacing;
    const blockTotalHeight = (lines.length - 1) * lineHeight + fontSize;
    const startY = (height - blockTotalHeight) / 2 + fontSize * 0.85;
    const wordSpacing = fontSize * cfg.wordSpacingFactor;

    const newGrid: CharacterItem[][] = [];
    let globalCharIdx = 0;

    lines.forEach((lineText, lineIdx) => {
      const lineY = startY + lineIdx * lineHeight;
      const lineWords = lineText.split(/\s+/).filter(Boolean);

      // Measure max word widths at wght: 900, wdth: 125%
      ctx.font = `${cfg.maxWght} ${fontSize}px "Roboto Flex Variable", sans-serif`;
      if ('fontVariationSettings' in ctx) {
        (ctx as any).fontVariationSettings = `'wght' ${cfg.maxWght}, 'wdth' ${cfg.maxWdth}`;
      }
      const wordMaxMetrics: number[] = lineWords.map((w) => ctx.measureText(w).width);
      const totalLineMaxW =
        wordMaxMetrics.reduce((sum, w) => sum + w, 0) +
        Math.max(0, lineWords.length - 1) * wordSpacing;

      // Measure base word widths at wght: 200, wdth: 70%
      ctx.font = `${cfg.baseWght} ${fontSize}px "Roboto Flex Variable", sans-serif`;
      if ('fontVariationSettings' in ctx) {
        (ctx as any).fontVariationSettings = `'wght' ${cfg.baseWght}, 'wdth' ${cfg.baseWdth}`;
      }
      const wordBaseMetrics: number[] = lineWords.map((w) => ctx.measureText(w).width);

      // Center the line horizontally with perfectly even margins
      const lineStartX = (width - totalLineMaxW) / 2;
      let currentWordX = lineStartX;
      const lineChars: CharacterItem[] = [];

      lineWords.forEach((wStr, wordIdx) => {
        const wordMaxW = wordMaxMetrics[wordIdx];
        const wordBaseW = wordBaseMetrics[wordIdx];
        const N = wStr.length;

        const cleanWord = wStr.replace(/[^A-Z]/g, '');
        const semanticProps = SEMANTIC_MASS_TABLE[cleanWord] || DEFAULT_SEMANTIC_CONFIG;

        // Semantic Mass resting hierarchy: heavy words rest at ~390w, light/normal at 200w
        const baseRestingWght = semanticProps.isHeavy ? 390 : cfg.baseWght;
        const baseRestingWdth = semanticProps.isHeavy ? 88 : cfg.baseWdth;

        for (let c = 0; c < N; c++) {
          // Max envelope character offsets
          ctx.font = `${cfg.maxWght} ${fontSize}px "Roboto Flex Variable", sans-serif`;
          if ('fontVariationSettings' in ctx) {
            (ctx as any).fontVariationSettings = `'wght' ${cfg.maxWght}, 'wdth' ${cfg.maxWdth}`;
          }
          const maxBefore = ctx.measureText(wStr.slice(0, c)).width;
          const maxUpTo = ctx.measureText(wStr.slice(0, c + 1)).width;
          const maxCharW = maxUpTo - maxBefore;
          const maxCenterRel = maxBefore + maxCharW / 2;

          // Base envelope character offsets with consistent optical tracking
          ctx.font = `${cfg.baseWght} ${fontSize}px "Roboto Flex Variable", sans-serif`;
          if ('fontVariationSettings' in ctx) {
            (ctx as any).fontVariationSettings = `'wght' ${cfg.baseWght}, 'wdth' ${cfg.baseWdth}`;
          }
          const baseBefore = ctx.measureText(wStr.slice(0, c)).width;
          const baseUpTo = ctx.measureText(wStr.slice(0, c + 1)).width;
          const baseCharW = baseUpTo - baseBefore;
          const baseNaturalCenterRel = baseBefore + baseCharW / 2;

          let baseCenterRel: number;
          if (N <= 1) {
            baseCenterRel = wordMaxW / 2;
          } else {
            const extraTracking = (wordMaxW - wordBaseW) / (N - 1);
            baseCenterRel = baseNaturalCenterRel + c * extraTracking;
          }

          const baseX = currentWordX + baseCenterRel;
          const maxX = currentWordX + maxCenterRel;

          lineChars.push({
            char: wStr[c],
            charIndex: globalCharIdx++,
            lineIndex: lineIdx,
            x: baseX,
            y: lineY,
            baseX,
            maxX,
            wordStartX: currentWordX,
            wordMaxW,
            slotWidth: maxCharW,
            currentWght: baseRestingWght,
            targetWght: baseRestingWght,
            velocityWght: 0,
            currentWdth: baseRestingWdth,
            targetWdth: baseRestingWdth,
            velocityWdth: 0,
            word: cleanWord,
            wordResponsiveness: semanticProps.responsiveness,
            wordInertia: semanticProps.inertia,
            isHeavyWord: Boolean(semanticProps.isHeavy),
            isLightWord: Boolean(semanticProps.isLight),
            residue: 0,
            dominantContributor: 'none',
            lastDrawnWght: 0,
            lastDrawnWdth: 0,
            offsetX: 0,
            targetOffsetX: 0,
            velocityX: 0,
            offsetY: 0,
            targetOffsetY: 0,
            velocityY: 0,
            dropOffset: 0,
            dropVelocity: 0
          });
        }

        currentWordX += wordMaxW + wordSpacing;
      });

      newGrid.push(lineChars);
    });

    charactersRef.current = newGrid;

    // Trigger smooth fade so layout change is not jarring
    isFadingLayoutRef.current = true;
    fadeStartTimeRef.current = performance.now();
    layoutFadeAlphaRef.current = 0.0;
  }, [fillScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fontReady) return;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    computeFixedSlotLayout(displayWidth, displayHeight, fillScale);
  }, [fillScale, fontReady, computeFixedSlotLayout]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      canvas.width = Math.floor(displayWidth * dpr);
      canvas.height = Math.floor(displayHeight * dpr);
      computeFixedSlotLayout(displayWidth, displayHeight);
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleResize);
    };
  }, [computeFixedSlotLayout]);

  // Main 60 FPS Render Loop
  useEffect(() => {
    if (!fontReady) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
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
          const calculatedFps = Math.round(
            (frameCountRef.current * 1000) / (currentTime - lastFpsTimeRef.current)
          );
          onFpsUpdate?.(calculatedFps);
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

        // 1. UPDATE PHASE (Spatial Field, Gestures, Silhouette, Gravity, Drop)
        const updateStart = performance.now();

        const rawPeople = trackedPeopleRef.current;
        const rawHands = trackedHandsRef.current;

        const trackedPeople = mechanicsSwitches.headTracking ? rawPeople : [];
        const trackedHands = mechanicsSwitches.hands ? rawHands : [];
        const hasHumanPose = trackedPeople.length > 0 || trackedHands.length > 0;
        const activeMask = (mechanicsSwitches.bodySilhouette && fps >= cfg.fpsFallbackThreshold && hasHumanPose)
          ? silhouetteMaskRef.current
          : null;

        const hasVisitors = hasHumanPose;

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
        if (mechanicsSwitches.attractMode && idleDurationSecRef.current >= cfg.attractModeIdleTriggerSec) {
          const attractCycle = (idleDurationSecRef.current - cfg.attractModeIdleTriggerSec) % cfg.attractWavePeriodSec;
          if (attractCycle < cfg.attractWaveDurationSec) {
            attractWaveActive = true;
            attractWaveCenterNorm = attractCycle / cfg.attractWaveDurationSec;
          }
        }

        // Two-Hands Stretch Calculation
        let twoHandStretchActive = false;
        let stretchMinX = 0;
        let stretchMaxX = 0;
        let stretchTargetWdth = cfg.baseWdth;

        if (mechanicsSwitches.gestures && trackedHands.length >= 2) {
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

        // Phase 3: Drop Gesture Detection (Fist held >= 300ms, then released to open palm)
        if (mechanicsSwitches.dropGesture && trackedHands.length > 0) {
          trackedHands.forEach((hand, hIdx) => {
            if (!hand.active) return;
            const wasFist = prevHandFistStateRef.current[hIdx];
            const isFist = hand.isFist;
            const now = currentTime;

            if (isFist) {
              if (!wasFist) {
                handFistStartTimeRef.current[hIdx] = now;
              }
            } else if (wasFist) {
              // Transition from fist to open palm
              const heldTime = now - handFistStartTimeRef.current[hIdx];
              if (heldTime >= cfg.fistHoldTriggerMs && (now - lastDropTimeRef.current >= cfg.dropCooldownMs)) {
                // Drop gesture triggered!
                lastDropTimeRef.current = now;
                triggerDropAt(hand.palmX * displayWidth, hand.palmY * displayHeight);
              }
              handFistStartTimeRef.current[hIdx] = 0;
            }

            prevHandFistStateRef.current[hIdx] = isFist;
          });
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

          if (hand.isFist && mechanicsSwitches.gestures) {
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

        // Hand Rhythm Layer (Mechanic Row 9): Hand plays paragraph on 16th grid (84 BPM)
        if (mechanicsSwitches.handRhythm && mechanicsSwitches.sound) {
          const nowMs = performance.now();
          trackedHands.forEach((hand, handIdx) => {
            if (!hand.active) return;
            const hx = hand.palmX * displayWidth;
            const hy = hand.palmY * displayHeight;

            if (hand.speed >= 0.04) {
              lastHandMoveTimeRef.current[hand.id] = nowMs;
            }

            const isStill = nowMs - (lastHandMoveTimeRef.current[hand.id] || 0) > cfg.rhythmStillnessTimeoutMs;
            if (isStill) return; // Hand still = silence within 300ms

            // Find closest letter under hand
            let closestChar: CharacterItem | null = null;
            let minDist = hand.isFist ? cfg.fistRadius : (cfg.openPalmRadius * 0.85);

            for (let l = 0; l < lines.length; l++) {
              const lineChars = lines[l];
              for (let c = 0; c < lineChars.length; c++) {
                const ch = lineChars[c];
                const dist = Math.hypot(ch.x - hx, ch.y - hy);
                if (dist < minDist) {
                  minDist = dist;
                  closestChar = ch;
                }
              }
            }

            if (closestChar && closestChar.charIndex !== prevHandNearestCharIdRef.current[hand.id]) {
              prevHandNearestCharIdRef.current[hand.id] = closestChar.charIndex;
              audioEngine.triggerHandRhythmHit({
                handIndex: handIdx,
                xNorm: hand.palmX,
                speed: hand.speed,
                letterWeight: closestChar.currentWght,
                word: closestChar.word,
                isHeavyWord: Boolean(closestChar.isHeavyWord),
                isLightWord: Boolean(closestChar.isLightWord),
                isFist: Boolean(hand.isFist),
                isDrop: false
              });
            }
          });
        }

        // Add Head
        if (mechanicsSwitches.headTracking) {
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
        }

        // Phase 0: Contrast Guard & 30s half-life decay
        const residueDecayFactor = Math.exp((-Math.LN2 / cfg.residueHalfLifeSeconds) * dtSec);

        let totalWghtSum = 0;
        let totalWdthSum = 0;
        let totalCharCount = 0;
        let totalResidueSum = 0;
        let maxWeightDropVelocity = 0;
        let totalSilhouetteCoverage = 0;

        const baseWeight = manualAxes ? manualAxes.wght : cfg.baseWght;
        const baseWidth = manualAxes ? manualAxes.wdth : cfg.baseWdth;

        lines.forEach((lineChars, lineIdx) => {
          lineChars.forEach((ch) => {
            totalCharCount++;

            // 1. Spatial Hand/Head Influence
            let handHeadInfluence = 0;
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
                  if (inf > handHeadInfluence) handHeadInfluence = inf;

                  // Hand speed ripple
                  if (mechanicsSwitches.speedRipple && pt.wakeSpeed > 0.35) {
                    const dot = (dx * pt.wakeVx + dy * pt.wakeVy) / (dist * pt.wakeSpeed);
                    if (dot < -0.3) {
                      rippleWakeOffset = Math.min(0.25, rippleWakeOffset + 0.18 * (1 - normDist));
                    }
                  }
                }
              });
            }

            // 2. Phase 2: Body Silhouette Mask Sampling (Soft edge blurred)
            let silhouetteInfluence = 0;
            if (activeMask) {
              const normX = ch.x / displayWidth;
              const normY = ch.y / displayHeight;
              const cov = sampleSilhouetteMask(activeMask, normX, normY);
              silhouetteInfluence = Math.min(1.0, cov * cfg.silhouetteCoverageScale);
              totalSilhouetteCoverage += silhouetteInfluence;
            }

            // Merge Hand/Head and Silhouette via smooth max
            const mergedMaxInfluence = smoothMax(handHeadInfluence, silhouetteInfluence, 0.12);

            // 3. Phase 0 Residue Update (Capped at wght +150 above resting weight)
            if (mechanicsSwitches.residue) {
              // Accumulate only under deliberate active influence (> 0.18) to ignore camera background noise
              if (mergedMaxInfluence > cfg.residueInfluenceThreshold) {
                ch.residue = Math.min(1.0, ch.residue + mergedMaxInfluence * cfg.residueAccumulationRate * dtSec);
              }
              // Continuous global half-life decay
              ch.residue *= residueDecayFactor;

              // Phase 0 Contrast Guard: Active pull restoring resting mean toward 200-260w
              if (mechanicsSwitches.contrastGuard) {
                ch.residue *= Math.exp(-cfg.idleMeanPullRate * dtSec);
              }
            } else {
              ch.residue = 0;
            }
            totalResidueSum += ch.residue;

            // Semantic resting hierarchy: heavy words rest at ~390w (350-450w range), light/normal at 200w
            const baseRestingWght = ch.isHeavyWord ? 390 : baseWeight;
            const baseRestingWdth = ch.isHeavyWord ? 88 : baseWidth;

            // Phase 0: Cap residue at wght +150 above resting weight
            const maxOffset = cfg.maxResidueWghtOffset;
            const residueContribution = Math.min(maxOffset, maxOffset * ch.residue);
            const glyphRestingWght = baseRestingWght + residueContribution;

            let targetW = glyphRestingWght;
            let targetWd = baseRestingWdth;

            // Dominant contributor tracking for Source Tinting
            let contributor: DominantContributor = 'none';

            // 4. Apply Visitor Influence with Semantic Mass Responsiveness
            if (mergedMaxInfluence > 0) {
              const effectiveInf = Math.max(0, mergedMaxInfluence - rippleWakeOffset);
              const semanticResp = mechanicsSwitches.semanticMass ? ch.wordResponsiveness : 1.0;
              const semanticTargetDelta = (cfg.maxWght - glyphRestingWght) * effectiveInf * semanticResp;
              const visitorTargetW = glyphRestingWght + semanticTargetDelta;
              const visitorTargetWd = baseRestingWdth + (cfg.maxWdth - baseRestingWdth) * effectiveInf;

              targetW = targetW * (1 - presenceFactor) + visitorTargetW * presenceFactor;
              targetWd = targetWd * (1 - presenceFactor) + visitorTargetWd * presenceFactor;

              if (silhouetteInfluence > handHeadInfluence && silhouetteInfluence > 0.15) {
                contributor = 'silhouette';
              } else if (effectiveInf * presenceFactor > 0.15) {
                contributor = 'interaction';
              }
            }

            // Two-Hands Stretch between hands
            if (twoHandStretchActive && ch.x >= stretchMinX && ch.x <= stretchMaxX) {
              targetWd = Math.max(targetWd, stretchTargetWdth);
              contributor = 'interaction';
            }

            // Idle Ambient Breathing / Attract Mode Wave
            if (ambientFactor > 0.001) {
              if (attractWaveActive && attractWaveCenterNorm >= 0) {
                const normX = ch.x / displayWidth;
                const distToWave = Math.abs(normX - attractWaveCenterNorm);
                if (distToWave < 0.22) {
                  const waveFactor = Math.pow(Math.cos((distToWave / 0.22) * (Math.PI / 2)), 2);
                  targetW += (cfg.attractWavePeakWght - baseWeight) * waveFactor * ambientFactor;
                  contributor = 'idle';
                }
              } else {
                // Subtle harmonic breath
                const wave = Math.sin(
                  timeSec * cfg.ambientWaveSpeed + lineIdx * 0.42 + ch.charIndex * 0.08
                );
                const breathMod = (wave + 1) * 0.5;
                targetW += breathMod * cfg.ambientWaveAmplitude * ambientFactor;
                targetWd += breathMod * 5 * ambientFactor;
              }
            }

            if (contributor === 'none' && ch.residue > 0.15) {
              contributor = 'residue';
            }
            ch.dominantContributor = contributor;

            // 5. Phase 1: Physical Gravity & Drift Offsets
            if (mechanicsSwitches.gravity) {
              const currentWNorm = Math.max(0, Math.min(1, (ch.currentWght - baseWeight) / (cfg.maxWght - baseWeight)));

              if (ch.isHeavyWord) {
                // Heavy words sag up to 8px below baseline proportional to current weight
                ch.targetOffsetY = currentWNorm * cfg.heavyMaxSagPx;
                ch.targetOffsetX = 0;
              } else if (ch.isLightWord) {
                // Light words lift up to 6px and drift sideways 2-3px when influenced
                if (mergedMaxInfluence > 0.05) {
                  ch.targetOffsetY = -cfg.lightMaxLiftPx * Math.min(1.0, mergedMaxInfluence * 1.5);
                  ch.targetOffsetX = Math.sin(ch.charIndex * 1.7 + timeSec * 1.5) * cfg.lightMaxDriftPx * mergedMaxInfluence;
                } else {
                  ch.targetOffsetY = 0;
                  ch.targetOffsetX = 0;
                }
              } else {
                ch.targetOffsetY = 0;
                ch.targetOffsetX = 0;
              }

              // Spring settle for Y offset
              const forceOffsetY = cfg.gravitySpringStiffness * (ch.targetOffsetY - ch.offsetY) - cfg.gravityDampingRatio * ch.velocityY;
              ch.velocityY += forceOffsetY * dtFactor;
              ch.offsetY += ch.velocityY * dtFactor;

              // Spring settle for X offset
              const forceOffsetX = cfg.gravitySpringStiffness * (ch.targetOffsetX - ch.offsetX) - cfg.gravityDampingRatio * ch.velocityX;
              ch.velocityX += forceOffsetX * dtFactor;
              ch.offsetX += ch.velocityX * dtFactor;
            } else {
              ch.offsetY = 0;
              ch.offsetX = 0;
            }

            // Phase 3: Drop Gesture Recovery Spring
            if (ch.dropOffset > 0.05 || Math.abs(ch.dropVelocity) > 0.05) {
              // Spring back over ~1.2s, ordered by weight (heavy ones recover slower via wordInertia)
              const recoveryInertia = ch.wordInertia * 1.1;
              const dropSpringForce = -cfg.gravitySpringStiffness * ch.dropOffset - cfg.gravityDampingRatio * ch.dropVelocity;
              ch.dropVelocity += (dropSpringForce / recoveryInertia) * dtFactor;
              ch.dropOffset += ch.dropVelocity * dtFactor;

              if (Math.abs(ch.dropOffset) < 0.05 && Math.abs(ch.dropVelocity) < 0.05) {
                ch.dropOffset = 0;
                ch.dropVelocity = 0;
              }
            }

            // 6. Physical Mass & Inertia with Semantic Inertia Scaling
            const normalizedCurrentWeight = Math.max(
              0,
              Math.min(1, (ch.currentWght - baseWeight) / (cfg.maxWght - baseWeight))
            );
            const basePhysicalMass = cfg.baseMass + (cfg.maxMass - cfg.baseMass) * normalizedCurrentWeight;
            const wordInertia = mechanicsSwitches.semanticMass ? ch.wordInertia : 1.0;
            const mass = basePhysicalMass * wordInertia;

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

            // Dynamic word-envelope positioning:
            // Resting: ch.baseX (consistent optical tracking with uniform letter-spacing)
            // Heavy: ch.maxX (smoothly expands to fill the word's maximum reserved envelope)
            const wNorm = Math.max(0, Math.min(1, (ch.currentWght - cfg.baseWght) / (cfg.maxWght - cfg.baseWght)));
            ch.x = (1 - wNorm) * ch.baseX + wNorm * ch.maxX;

            totalWghtSum += ch.currentWght;
            totalWdthSum += ch.currentWdth;
          });
        });

        const updateDuration = performance.now() - updateStart;

        // 2. RENDER PHASE: 100% DRAWIMAGE FROM GLYPH ATLAS CACHE (< 8ms TARGET)
        const renderStart = performance.now();

        // Update layout cross-fade on resize / fullscreen
        if (isFadingLayoutRef.current) {
          const elapsed = performance.now() - fadeStartTimeRef.current;
          const t = Math.min(1.0, elapsed / cfg.layoutFadeDurationMs);
          layoutFadeAlphaRef.current = t;
          if (t >= 1.0) isFadingLayoutRef.current = false;
        }
        const layoutAlpha = layoutFadeAlphaRef.current;

        ctx.fillStyle = cfg.backgroundColor;
        ctx.fillRect(0, 0, displayWidth, displayHeight);

        const slotHalfW = Math.ceil(fontSize * 1.5) / 2;
        const slotHalfH = Math.ceil(fontSize * 1.6) / 2;
        const drawW = slotHalfW * 2;
        const drawH = slotHalfH * 2;

        const effectiveShowResidueHeatmap = showResidueHeatmap || (isMechanicsPanelOpen && wallVisualizations.residueHeatmap);
        const useSourceTint = isMechanicsPanelOpen && wallVisualizations.sourceTint;

        // Draw Glyphs from Atlas
        lines.forEach((lineChars) => {
          lineChars.forEach((ch) => {
            if (ch.char === ' ') return;

            // Optional Residue Heatmap visualization
            if (effectiveShowResidueHeatmap && ch.residue > 0.05) {
              ctx.fillStyle = `rgba(168, 85, 247, ${ch.residue * 0.28 * layoutAlpha})`;
              ctx.fillRect(ch.x - ch.slotWidth / 2, ch.y - fontSize * 0.7, ch.slotWidth, fontSize * 1.1);
            }

            // Determine glyph color
            let glyphColor = cfg.textColor;
            if (useSourceTint) {
              if (ch.dominantContributor === 'interaction') glyphColor = cfg.interactionTintColor;
              else if (ch.dominantContributor === 'silhouette') glyphColor = cfg.silhouetteTintColor;
              else if (ch.dominantContributor === 'residue') glyphColor = cfg.residueTintColor;
              else if (ch.dominantContributor === 'idle') glyphColor = cfg.idleTintColor;
            }

            // Quantized bounds for cross-fading
            const lowWght = Math.floor(ch.currentWght / 50) * 50;
            const highWght = Math.min(900, lowWght + 50);
            const tWght = (ch.currentWght - lowWght) / 50;

            const lowWdth = Math.floor(ch.currentWdth / 10) * 10;
            const highWdth = Math.min(120, lowWdth + 10);

            // Phase 1 Gravity & Phase 3 Drop Offset move ONLY the draw position!
            const drawX = ch.x - slotHalfW + ch.offsetX;
            const drawY = ch.y - slotHalfH + ch.offsetY + ch.dropOffset;

            const imgLow = glyphAtlas.getGlyph(ch.char, lowWght, lowWdth, glyphColor);

            if (tWght < 0.05 || lowWght === highWght) {
              ctx.globalAlpha = layoutAlpha;
              ctx.drawImage(imgLow, drawX, drawY, drawW, drawH);
            } else {
              const imgHigh = glyphAtlas.getGlyph(ch.char, highWght, highWdth, glyphColor);
              ctx.globalAlpha = layoutAlpha * (1.0 - tWght);
              ctx.drawImage(imgLow, drawX, drawY, drawW, drawH);
              ctx.globalAlpha = layoutAlpha * tWght;
              ctx.drawImage(imgHigh, drawX, drawY, drawW, drawH);
            }
          });
        });

        ctx.globalAlpha = 1.0;

        // Phase 2 Silhouette Mask Outline Visualization
        if (wallVisualizations.maskOutline && activeMask) {
          ctx.save();
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.45)';
          ctx.lineWidth = 1.5;
          const stepX = displayWidth / 128;
          const stepY = displayHeight / 72;

          for (let my = 1; my < 71; my += 2) {
            for (let mx = 1; mx < 127; mx += 2) {
              const idx = my * 128 + mx;
              if (activeMask[idx] > 128) {
                // Check edge
                const isEdge = activeMask[idx - 1] === 0 || activeMask[idx + 1] === 0 ||
                               activeMask[idx - 128] === 0 || activeMask[idx + 128] === 0;
                if (isEdge) {
                  ctx.strokeRect(mx * stepX, my * stepY, stepX * 2, stepY * 2);
                }
              }
            }
          }
          ctx.restore();
        }

        // Source Tint Legend on Canvas when active
        if (useSourceTint) {
          const legendX = 24;
          const legendY = displayHeight - 48;
          ctx.font = '10px monospace';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';

          ctx.fillStyle = cfg.interactionTintColor;
          ctx.fillText('■ Hand/Head', legendX, legendY);

          ctx.fillStyle = cfg.silhouetteTintColor;
          ctx.fillText('■ Silhouette', legendX + 95, legendY);

          ctx.fillStyle = cfg.residueTintColor;
          ctx.fillText('■ Residue Memory', legendX + 195, legendY);

          ctx.fillStyle = cfg.idleTintColor;
          ctx.fillText('■ Attract Wave', legendX + 325, legendY);

          ctx.fillStyle = cfg.textColor;
          ctx.fillText('■ Baseline', legendX + 435, legendY);
        }

        // Debug influence rings & Two-Hands Stretch bounds
        const effectiveShowInfluence = (isDebugActive && showInfluencePoints) || (isMechanicsPanelOpen && wallVisualizations.influenceDots);

        if (effectiveShowInfluence) {
          if (twoHandStretchActive) {
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
              ctx.strokeStyle = pt.isFist ? 'rgba(244, 63, 94, 0.35)' : 'rgba(74, 222, 128, 0.18)';
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
        if (mechanicsSwitches.sound) {
          audioEngine.updateWeight(meanWght, presenceFactor);

          if (maxWeightDropVelocity > cfg.settleThumpThreshold) {
            const intensity = Math.min(1.0, (maxWeightDropVelocity - cfg.settleThumpThreshold) / 40);
            audioEngine.triggerSettlingThump(intensity);
          }
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

        // Update telemetry for Mechanics Panel
        if (isMechanicsPanelOpen) {
          const primaryHand = trackedHands[0];
          const primaryPerson = trackedPeople[0];
          const gestureText = twoHandStretchActive
            ? 'TWO-HAND STRETCH'
            : (primaryHand?.isFist ? 'FIST (MAX WEIGHT)' : (primaryHand?.isOpen ? 'OPEN PALM' : 'None'));

          const headNose = primaryPerson?.nosePos;
          const headPosText = headNose?.visible
            ? `${Math.round(headNose.x * displayWidth)}px, ${Math.round(headNose.y * displayHeight)}px`
            : 'None';

          const rhythmTelemetry = audioEngine.getRhythmTelemetry();
          onTelemetryUpdate?.({
            gestureStateText: gestureText,
            handSpeedText: primaryHand ? `${primaryHand.speed.toFixed(2)}` : '0.00',
            headPosText,
            trackedHandsCount: trackedHands.length,
            meanResidue: totalCharCount > 0 ? totalResidueSum / totalCharCount : 0,
            idleStatus: attractWaveActive ? 'Attract Wave Sweeping' : (hasVisitors ? 'Active' : `Idle (${Math.round(idleDurationSecRef.current)}s)`),
            meanWeight: Math.round(meanWght),
            droneActive: presenceFactor > 0,
            silhouetteFps: activeMask ? 18 : 0,
            silhouetteCoverage: totalCharCount > 0 ? (totalSilhouetteCoverage / totalCharCount) * 100 : 0,
            lastDropInfo: lastDropInfoRef.current,
            rhythmBpm: rhythmTelemetry.bpm,
            rhythmVoices: rhythmTelemetry.voices,
            lastRhythmHit: rhythmTelemetry.lastHit
          });
        }

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
    silhouetteMaskRef,
    fps,
    isDebugActive,
    showInfluencePoints,
    showResidueHeatmap,
    isMechanicsPanelOpen,
    mechanicsSwitches,
    wallVisualizations,
    computeFixedSlotLayout,
    onFpsUpdate,
    onMetricsUpdate,
    onTimingUpdate,
    onTelemetryUpdate,
    triggerDropAt
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
        background: '#000000'
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
