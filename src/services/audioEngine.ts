import { INSTALLATION_CONFIG } from '../config';

class WeightAudioEngine {
  private ctx: AudioContext | null = null;
  private droneOsc: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private droneGain: GainNode | null = null;
  private masterGain: GainNode | null = null;

  private isUnlocked: boolean = false;
  private isMuted: boolean = false;
  private lastThumpTime: number = 0;

  constructor() {
    // Lazy initialization on first user interaction
    this.setupUnlockListeners();
  }

  private setupUnlockListeners() {
    const unlock = () => {
      this.initContext();
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  }

  public initContext() {
    if (this.isUnlocked && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      const now = this.ctx.currentTime;

      // Master Gain Node
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.isMuted ? 0 : INSTALLATION_CONFIG.masterVolume,
        now
      );
      this.masterGain.connect(this.ctx.destination);

      // Lowpass resonant filter for drone
      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = 'lowpass';
      this.droneFilter.frequency.setValueAtTime(INSTALLATION_CONFIG.filterMinCutoff, now);
      this.droneFilter.Q.setValueAtTime(2.2, now);
      this.droneFilter.connect(this.masterGain);

      // Drone Gain (Silent when idle / no visitors)
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0, now);
      this.droneGain.connect(this.droneFilter);

      // Primary Sub-Bass Drone Oscillator (Sine)
      this.droneOsc = this.ctx.createOscillator();
      this.droneOsc.type = 'sine';
      this.droneOsc.frequency.setValueAtTime(INSTALLATION_CONFIG.droneBaseFreq, now);
      this.droneOsc.connect(this.droneGain);
      this.droneOsc.start();

      // Secondary Deep Rumble Oscillator (Triangle, 1 octave below)
      this.subOsc = this.ctx.createOscillator();
      this.subOsc.type = 'triangle';
      this.subOsc.frequency.setValueAtTime(INSTALLATION_CONFIG.droneBaseFreq / 2, now);
      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.4, now);
      this.subOsc.connect(subGain);
      subGain.connect(this.droneGain);
      this.subOsc.start();

      this.isUnlocked = true;
    } catch (err) {
      console.warn('Web Audio initialization deferral:', err);
    }
  }

  /**
   * Update sustained tone based on global mean weight and visitor presence
   * @param meanWght Average glyph weight across the canvas
   * @param presenceFactor 0.0 (nobody present, silent) to 1.0 (visitors active)
   */
  public updateWeight(meanWght: number, presenceFactor: number) {
    if (!this.ctx || !this.isUnlocked || !this.droneGain || !this.droneOsc || !this.droneFilter) {
      return;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const cfg = INSTALLATION_CONFIG;

    // Normalized weight factor [0..1]
    const normWeight = Math.max(
      0,
      Math.min(1, (meanWght - cfg.baseWght) / (cfg.maxWght - cfg.baseWght))
    );

    // Silent when nobody is present (presenceFactor === 0)
    // As visitors step close and weight rises, volume swells organically
    const targetVolume = presenceFactor > 0.01 ? Math.pow(normWeight, 1.2) * 0.9 * presenceFactor : 0;
    this.droneGain.gain.setTargetAtTime(targetVolume, now, 0.12);

    // Modulate pitch: deeper pitch when massive, subtle elevation with presence
    const targetFreq = cfg.droneBaseFreq + (cfg.droneMaxFreq - cfg.droneBaseFreq) * normWeight;
    this.droneOsc.frequency.setTargetAtTime(targetFreq, now, 0.18);
    if (this.subOsc) {
      this.subOsc.frequency.setTargetAtTime(targetFreq / 2, now, 0.18);
    }

    // Modulate resonant filter cutoff: opens up when weight is dense
    const targetCutoff =
      cfg.filterMinCutoff + (cfg.filterMaxCutoff - cfg.filterMinCutoff) * normWeight;
    this.droneFilter.frequency.setTargetAtTime(targetCutoff, now, 0.15);
  }

  /**
   * Produces a soft, low-frequency thump when heavy letters settle down
   * Rate-limited to prevent clicky bursts
   */
  public triggerSettlingThump(intensity: number = 0.5) {
    if (!this.ctx || !this.isUnlocked || !this.masterGain || this.isMuted) return;

    const nowMs = performance.now();
    if (nowMs - this.lastThumpTime < INSTALLATION_CONFIG.thumpCooldownMs) {
      return; // Rate limited
    }
    this.lastThumpTime = nowMs;

    try {
      const now = this.ctx.currentTime;
      const thumpOsc = this.ctx.createOscillator();
      const thumpGain = this.ctx.createGain();
      const thumpFilter = this.ctx.createBiquadFilter();

      // Deep 42Hz damped thump
      thumpOsc.type = 'sine';
      thumpOsc.frequency.setValueAtTime(48, now);
      thumpOsc.frequency.exponentialRampToValueAtTime(32, now + 0.28);

      // Lowpass to keep it soft and architectural (no high click)
      thumpFilter.type = 'lowpass';
      thumpFilter.frequency.setValueAtTime(95, now);

      // Amplitude envelope: instant soft attack, fast exponential decay
      const peakGain = Math.min(0.55, 0.2 + intensity * 0.35);
      thumpGain.gain.setValueAtTime(0.001, now);
      thumpGain.gain.linearRampToValueAtTime(peakGain, now + 0.02);
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

      thumpOsc.connect(thumpFilter);
      thumpFilter.connect(thumpGain);
      thumpGain.connect(this.masterGain);

      thumpOsc.start(now);
      thumpOsc.stop(now + 0.35);

      setTimeout(() => {
        thumpOsc.disconnect();
        thumpGain.disconnect();
        thumpFilter.disconnect();
      }, 400);
    } catch {
      // Audio node cleanup safe
    }
  }

  /**
   * Phase 3 Drop Gesture: Soft low architectural thud scaled by number of heavy letters dropped
   */
  public triggerDropThud(heavyCount: number) {
    if (!this.ctx || !this.isUnlocked || !this.masterGain || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const thudOsc = this.ctx.createOscillator();
      const thudGain = this.ctx.createGain();
      const thudFilter = this.ctx.createBiquadFilter();

      // Deep, low pitch (38Hz -> 26Hz) for gravity drop
      thudOsc.type = 'triangle';
      thudOsc.frequency.setValueAtTime(38, now);
      thudOsc.frequency.exponentialRampToValueAtTime(26, now + 0.38);

      thudFilter.type = 'lowpass';
      thudFilter.frequency.setValueAtTime(80, now);

      const scale = Math.min(1.0, 0.3 + (heavyCount / 12) * 0.7);
      const peakGain = 0.45 * scale;

      thudGain.gain.setValueAtTime(0.001, now);
      thudGain.gain.linearRampToValueAtTime(peakGain, now + 0.03);
      thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

      thudOsc.connect(thudFilter);
      thudFilter.connect(thudGain);
      thudGain.connect(this.masterGain);

      thudOsc.start(now);
      thudOsc.stop(now + 0.45);

      setTimeout(() => {
        thudOsc.disconnect();
        thudGain.disconnect();
        thudFilter.disconnect();
      }, 500);
    } catch {}
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : INSTALLATION_CONFIG.masterVolume,
        now,
        0.05
      );
    }
    return this.isMuted;
  }

  public getStatus() {
    return {
      unlocked: this.isUnlocked,
      muted: this.isMuted,
      state: this.ctx ? this.ctx.state : 'uninitialized'
    };
  }
}

export const audioEngine = new WeightAudioEngine();
