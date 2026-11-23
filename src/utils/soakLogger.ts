/**
 * Browser-side 30-minute memory leak & FPS telemetry recorder
 * Access results via `window.__SOAK_REPORT__` or console
 */

interface SoakSample {
  timestamp: string;
  uptimeSeconds: number;
  fps: number;
  heapUsedMb: number | null;
  heapTotalMb: number | null;
  meanWeight: number;
  trackedPoses: number;
}

class BrowserSoakLogger {
  private startTime: number = performance.now();
  private samples: SoakSample[] = [];
  private intervalId: number | null = null;
  private currentFps: number = 60;
  private currentMeanWeight: number = 200;
  private currentPoseCount: number = 0;

  constructor() {
    this.start();
  }

  public update(fps: number, meanWeight: number, poseCount: number) {
    this.currentFps = fps;
    this.currentMeanWeight = meanWeight;
    this.currentPoseCount = poseCount;
  }

  private start() {
    if (typeof window === 'undefined') return;

    this.intervalId = window.setInterval(() => {
      const perfMemory = (performance as any).memory;
      const heapUsedMb = perfMemory ? Number((perfMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)) : null;
      const heapTotalMb = perfMemory ? Number((perfMemory.totalJSHeapSize / 1024 / 1024).toFixed(2)) : null;
      const uptime = Math.round((performance.now() - this.startTime) / 1000);

      const sample: SoakSample = {
        timestamp: new Date().toISOString().substring(11, 19),
        uptimeSeconds: uptime,
        fps: this.currentFps,
        heapUsedMb,
        heapTotalMb,
        meanWeight: this.currentMeanWeight,
        trackedPoses: this.currentPoseCount
      };

      this.samples.push(sample);
      // Keep up to 30 minutes of 10s samples (180 samples)
      if (this.samples.length > 200) {
        this.samples.shift();
      }

      // Expose to window for live inspection
      (window as any).__SOAK_REPORT__ = {
        uptimeMinutes: (uptime / 60).toFixed(1),
        currentFps: this.currentFps,
        currentHeapMb: heapUsedMb,
        sampleCount: this.samples.length,
        history: this.samples,
        isStable: this.currentFps >= 55
      };
    }, 10000);
  }

  public stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}

export const soakLogger = new BrowserSoakLogger();
