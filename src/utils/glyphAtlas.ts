/**
 * High-Performance Pre-rendered Glyph Cache & Atlas
 * Eliminates per-glyph ctx.font string parsing in the 60 FPS render loop.
 * Renders glyphs at quantized (wght: 50, wdth: 10) axes into offscreen canvases.
 * Supports instantaneous colored variants for Mechanics Source Tinting without runtime cost.
 */

import { INSTALLATION_CONFIG } from '../config';

export class GlyphAtlas {
  private cache: Map<string, HTMLCanvasElement> = new Map();
  private fontSize: number = 72;
  private dpr: number = 1;

  public init(fontSize: number, dpr: number) {
    if (this.fontSize !== fontSize || this.dpr !== dpr) {
      this.clear();
      this.fontSize = fontSize;
      this.dpr = dpr;
    }
  }

  public clear() {
    this.cache.clear();
  }

  /**
   * Quantize weight to steps of 50 (200, 250, 300, ..., 900)
   */
  public static quantizeWght(wght: number): number {
    return Math.max(200, Math.min(900, Math.round(wght / 50) * 50));
  }

  /**
   * Quantize width to steps of 10 (70, 80, 90, 100, 110, 120)
   */
  public static quantizeWdth(wdth: number): number {
    return Math.max(70, Math.min(120, Math.round(wdth / 10) * 10));
  }

  private getKey(char: string, wght: number, wdth: number, color: string): string {
    return `${char}_${wght}_${wdth}_${color}`;
  }

  /**
   * Retrieve or lazily render a quantized glyph canvas with optional color tint
   */
  public getGlyph(
    char: string,
    rawWght: number,
    rawWdth: number,
    color: string = INSTALLATION_CONFIG.textColor
  ): HTMLCanvasElement {
    const qWght = GlyphAtlas.quantizeWght(rawWght);
    const qWdth = GlyphAtlas.quantizeWdth(rawWdth);
    const key = this.getKey(char, qWght, qWdth, color);

    let canvas = this.cache.get(key);
    if (canvas) return canvas;

    // Lazily create and render offscreen canvas for this (char, wght, wdth, color)
    canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return canvas;

    const baseSize = this.fontSize;
    const dpr = this.dpr;

    // Allocate canvas bounds accommodating maximum expanded width
    const canvasWidth = Math.ceil(baseSize * 1.5 * dpr);
    const canvasHeight = Math.ceil(baseSize * 1.6 * dpr);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.scale(dpr, dpr);

    // Configure font variation settings once for this cached glyph
    ctx.font = `${qWght} ${baseSize}px "Roboto Flex Variable", sans-serif`;
    if ('fontVariationSettings' in ctx) {
      (ctx as any).fontVariationSettings = `'wght' ${qWght}, 'wdth' ${qWdth}`;
    }
    if ('fontStretch' in ctx) {
      (ctx as any).fontStretch = `${qWdth}%`;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = color;
    ctx.fillText(char, (canvasWidth / dpr) / 2, (canvasHeight / dpr) / 2);

    this.cache.set(key, canvas);
    return canvas;
  }

  /**
   * Pre-warm cache for the installation alphabet glyphs
   */
  public warmCache(textLines: string[], baseWght = 200, maxWght = 900, baseWdth = 75, maxWdth = 120) {
    const uniqueChars = new Set<string>();
    textLines.forEach((line) => {
      for (let i = 0; i < line.length; i++) {
        if (line[i] !== ' ') uniqueChars.add(line[i]);
      }
    });

    const weights = [baseWght, 350, 500, 700, maxWght];
    const widths = [baseWdth, maxWdth];
    const colors = [
      INSTALLATION_CONFIG.textColor,
      INSTALLATION_CONFIG.dwellTintColor,
      INSTALLATION_CONFIG.residueTintColor,
      INSTALLATION_CONFIG.idleTintColor
    ];

    uniqueChars.forEach((char) => {
      weights.forEach((w) => {
        widths.forEach((wd) => {
          colors.forEach((c) => {
            this.getGlyph(char, w, wd, c);
          });
        });
      });
    });
  }
}

export const glyphAtlas = new GlyphAtlas();
