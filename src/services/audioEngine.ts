import { INSTALLATION_CONFIG } from '../config';

class WeightAudioEngine {
  private ctx: AudioContext | null = null;
  private droneOsc: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private droneGain: GainNode | null = null;
  private dronePanner: StereoPannerNode | null = null;
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;

  private isUnlocked: boolean = false;
  private isMuted: boolean = false;
  private lastSettleToneTime: number = 0;
  private lastToneLabel: string = 'None';
  private currentPan: number = 0;
  private currentDroneVolume: number = 0;

  constructor() {
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

      // Master Limiter (Dynamics Compressor) prevents clipping & harsh transients
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.setValueAtTime(-6, now);
      this.limiter.knee.setValueAtTime(10, now);
      this.limiter.ratio.setValueAtTime(12, now);
      this.limiter.attack.setValueAtTime(0.003, now);
      this.limiter.release.setValueAtTime(0.25, now);
      this.limiter.connect(this.ctx.destination);

      // Master Gain Node with 3-second gentle fade-in on start
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.0001, now);
      this.masterGain.gain.linearRampToValueAtTime(
        this.isMuted ? 0 : INSTALLATION_CONFIG.masterVolume,
        now + 3.0
      );
      this.masterGain.connect(this.limiter);

      // Stereo Panner for the architectural drone (follows weighed word position)
      if (typeof this.ctx.createStereoPanner === 'function') {
        this.dronePanner = this.ctx.createStereoPanner();
        this.dronePanner.pan.setValueAtTime(0, now);
        this.dronePanner.connect(this.masterGain);
      }

      // Lowpass resonant filter for deep body drone
      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = 'lowpass';
      this.droneFilter.frequency.setValueAtTime(INSTALLATION_CONFIG.filterMinCutoff, now);
      this.droneFilter.Q.setValueAtTime(2.2, now);

      if (this.dronePanner) {
        this.droneFilter.connect(this.dronePanner);
      } else {
        this.droneFilter.connect(this.masterGain);
      }

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
      subGain.gain.setValueAtTime(0.35, now);
      this.subOsc.connect(subGain);
      subGain.connect(this.droneGain);
      this.subOsc.start();

      this.isUnlocked = true;
    } catch (err) {
      console.warn('Web Audio initialization error:', err);
    }
  }

  /**
   * Update sustained tone based on global mean weight and active visitor position
   * @param meanWght Average glyph weight across the canvas
   * @param presenceFactor 0.0 (nobody present, silent) to 1.0 (active visitors)
   * @param pan Stereo pan (-1.0 to +1.0) following horizontal position of weighed word
   * @param enabled Mechanical switch toggle (true by default)
   */
  public updateWeight(meanWght: number, presenceFactor: number, pan: number = 0, enabled: boolean = true) {
    if (!this.ctx || !this.isUnlocked || !this.droneGain || !this.droneOsc || !this.droneFilter) {
      return;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const cfg = INSTALLATION_CONFIG;

    if (!enabled || this.isMuted) {
      this.droneGain.gain.setTargetAtTime(0, now, 0.1);
      this.currentDroneVolume = 0;
      return;
    }

    // Normalized weight factor [0..1]
    const normWeight = Math.max(
      0,
      Math.min(1, (meanWght - cfg.baseWght) / (cfg.maxWght - cfg.baseWght))
    );

    // Silent when empty room & no active presence / residue
    // Drone volume swells organically as weight is built
    const targetVolume = presenceFactor > 0.02
      ? Math.pow(normWeight, 1.4) * 0.85 * presenceFactor
      : (normWeight > 0.15 ? Math.pow(normWeight, 2.0) * 0.25 : 0);

    this.droneGain.gain.setTargetAtTime(targetVolume, now, 0.15);
    this.currentDroneVolume = targetVolume;

    // Pitch follows total typographic mass
    const targetFreq = cfg.droneBaseFreq + (cfg.droneMaxFreq - cfg.droneBaseFreq) * normWeight;
    this.droneOsc.frequency.setTargetAtTime(targetFreq, now, 0.2);
    if (this.subOsc) {
      this.subOsc.frequency.setTargetAtTime(targetFreq / 2, now, 0.2);
    }

    // Filter cutoff opens up as weight increases
    const targetCutoff = cfg.filterMinCutoff + (cfg.filterMaxCutoff - cfg.filterMinCutoff) * normWeight;
    this.droneFilter.frequency.setTargetAtTime(targetCutoff, now, 0.18);

    // Stereo pan tracks the active word
    this.currentPan = Math.max(-1, Math.min(1, pan));
    if (this.dronePanner) {
      this.dronePanner.pan.setTargetAtTime(this.currentPan, now, 0.25);
    }
  }

  /**
   * Settle Tone: Single low sine tone when a word settles at max weight.
   * Soft attack (120ms), soft release (900ms), stereo panned to word position.
   * Rate-limited to prevent multiple chime overlaps.
   */
  public playSettleTone(pan: number = 0, frequency: number = 55) {
    if (!this.ctx || !this.isUnlocked || !this.masterGain || this.isMuted) return;

    const nowMs = performance.now();
    if (nowMs - this.lastSettleToneTime < INSTALLATION_CONFIG.settleToneCooldownMs) {
      return; // Rate limited
    }
    this.lastSettleToneTime = nowMs;
    this.lastToneLabel = `${frequency.toFixed(0)}Hz (pan ${(pan >= 0 ? '+' : '') + pan.toFixed(2)})`;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, now);

      // Soft architectural envelope: gentle attack, long warm decay
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.38, now + 0.14); // 140ms soft attack
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1); // 960ms soft release

      if (typeof this.ctx.createStereoPanner === 'function') {
        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain);
      } else {
        osc.connect(gain);
        gain.connect(this.masterGain);
      }

      osc.start(now);
      osc.stop(now + 1.25);

      setTimeout(() => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      }, 1400);
    } catch (err) {
      console.warn('Settle tone error:', err);
    }
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

  public getLiveTelemetry() {
    return {
      droneLevel: Number(this.currentDroneVolume.toFixed(2)),
      lastToneText: this.lastToneLabel,
      currentPan: Number(this.currentPan.toFixed(2))
    };
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
