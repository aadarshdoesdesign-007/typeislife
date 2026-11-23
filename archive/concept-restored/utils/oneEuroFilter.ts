/**
 * 1€ (One Euro) Filter for low-latency, jitter-free real-time tracking
 * Based on Géry Casiez, Nicolas Roussel, Daniel Vogel (CHI 2012)
 */

function smoothingFactor(te: number, cutoff: number): number {
  const r = 2 * Math.PI * cutoff * te;
  return r / (r + 1);
}

function exponentialSmoothing(a: number, x: number, xPrev: number): number {
  return a * x + (1 - a) * xPrev;
}

export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev: number = 0;
  private tPrev: number | null = null;

  constructor(minCutoff: number = 1.0, beta: number = 0.007, dCutoff: number = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  public filter(x: number, timestamp: number = performance.now()): number {
    if (this.tPrev === null || this.xPrev === null) {
      this.xPrev = x;
      this.dxPrev = 0;
      this.tPrev = timestamp;
      return x;
    }

    const te = Math.max((timestamp - this.tPrev) / 1000, 1e-4); // delta time in seconds
    this.tPrev = timestamp;

    // Filter the derivative
    const dx = (x - this.xPrev) / te;
    const aD = smoothingFactor(te, this.dCutoff);
    const edx = exponentialSmoothing(aD, dx, this.dxPrev);
    this.dxPrev = edx;

    // Filter the signal based on dynamic cutoff
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const a = smoothingFactor(te, cutoff);
    const filteredX = exponentialSmoothing(a, x, this.xPrev);
    this.xPrev = filteredX;

    return filteredX;
  }

  public reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}

export class Point3DOneEuroFilter {
  private xFilter: OneEuroFilter;
  private yFilter: OneEuroFilter;
  private zFilter: OneEuroFilter;

  constructor(minCutoff: number = 1.2, beta: number = 0.008, dCutoff: number = 1.0) {
    this.xFilter = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.yFilter = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.zFilter = new OneEuroFilter(minCutoff, beta, dCutoff);
  }

  public filter(x: number, y: number, z: number, timestamp: number = performance.now()): { x: number; y: number; z: number } {
    return {
      x: this.xFilter.filter(x, timestamp),
      y: this.yFilter.filter(y, timestamp),
      z: this.zFilter.filter(z, timestamp)
    };
  }

  public reset(): void {
    this.xFilter.reset();
    this.yFilter.reset();
    this.zFilter.reset();
  }
}
