import { INSTALLATION_CONFIG } from '../config';

export interface HandRhythmHitParams {
  handIndex: number;
  xNorm: number;
  speed: number;
  letterWeight: number;
  word: string;
  isHeavyWord: boolean;
  isLightWord: boolean;
  isFist: boolean;
  isDrop: boolean;
}

interface RhythmVoiceChannel {
  id: number;
  panner: StereoPannerNode | null;
  gain: GainNode;
  filter: BiquadFilterNode;
  busyUntil: number;
}

class WeightAudioEngine {
  private ctx: AudioContext | null = null;
  private droneOsc: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private droneGain: GainNode | null = null;
  private droneDuckingGain: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;

  // Hand Rhythm Pre-allocated Voice Pool
  private rhythmBusGain: GainNode | null = null;
  private voiceChannels: RhythmVoiceChannel[] = [];
  private noiseBuffer: AudioBuffer | null = null;
  private handHitTimestamps: Record<number, number[]> = {};
  private lastHitText: string = 'None';

  private isUnlocked: boolean = false;
  private isMuted: boolean = false;
  private lastThumpTime: number = 0;

  constructor() {
    // Lazy initialization on first user interaction (click, keydown, touch)
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
      const cfg = INSTALLATION_CONFIG;

      // 1. Master Output Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.isMuted ? 0 : cfg.masterVolume,
        now
      );
      this.masterGain.connect(this.ctx.destination);

      // 2. Master Limiter to prevent any clipping on dense rhythm hits
      this.masterLimiter = this.ctx.createDynamicsCompressor();
      this.masterLimiter.threshold.setValueAtTime(-1.0, now);
      this.masterLimiter.knee.setValueAtTime(3.0, now);
      this.masterLimiter.ratio.setValueAtTime(12.0, now);
      this.masterLimiter.attack.setValueAtTime(0.003, now);
      this.masterLimiter.release.setValueAtTime(0.08, now);
      this.masterLimiter.connect(this.masterGain);

      // 3. Drone Bus with Ducking Gain Node (-3dB ducking while hits play)
      this.droneDuckingGain = this.ctx.createGain();
      this.droneDuckingGain.gain.setValueAtTime(1.0, now);

      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = 'lowpass';
      this.droneFilter.frequency.setValueAtTime(cfg.filterMinCutoff, now);
      this.droneFilter.Q.setValueAtTime(2.2, now);

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0, now);
      this.droneGain.connect(this.droneDuckingGain);
      this.droneDuckingGain.connect(this.droneFilter);
      this.droneFilter.connect(this.masterLimiter);

      // Drone Oscillators
      this.droneOsc = this.ctx.createOscillator();
      this.droneOsc.type = 'sine';
      this.droneOsc.frequency.setValueAtTime(cfg.droneBaseFreq, now);
      this.droneOsc.connect(this.droneGain);
      this.droneOsc.start();

      this.subOsc = this.ctx.createOscillator();
      this.subOsc.type = 'triangle';
      this.subOsc.frequency.setValueAtTime(cfg.droneBaseFreq / 2, now);
      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.4, now);
      this.subOsc.connect(subGain);
      subGain.connect(this.droneGain);
      this.subOsc.start();

      // 4. Hand Rhythm Voice Pool (6 pre-allocated channels, no per-hit allocation)
      this.rhythmBusGain = this.ctx.createGain();
      this.rhythmBusGain.gain.setValueAtTime(0.85, now);
      this.rhythmBusGain.connect(this.masterLimiter);

      // Pre-render 1-second white noise buffer for crisp physical transient clicks
      const sampleRate = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, sampleRate, sampleRate);
      const noiseData = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < sampleRate; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }

      this.voiceChannels = [];
      for (let i = 0; i < cfg.rhythmMaxVoices; i++) {
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, now);

        const filter = this.ctx.createBiquadFilter();
        gain.connect(filter);

        let panner: StereoPannerNode | null = null;
        if ('createStereoPanner' in this.ctx) {
          panner = this.ctx.createStereoPanner();
          panner.pan.setValueAtTime(0, now);
          filter.connect(panner);
          panner.connect(this.rhythmBusGain);
        } else {
          filter.connect(this.rhythmBusGain);
        }

        this.voiceChannels.push({
          id: i,
          panner,
          gain,
          filter,
          busyUntil: 0
        });
      }

      this.isUnlocked = true;
    } catch (err) {
      console.warn('Web Audio initialization deferral:', err);
    }
  }

  /**
   * Update sustained tone based on global mean weight and visitor presence
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

    const normWeight = Math.max(
      0,
      Math.min(1, (meanWght - cfg.baseWght) / (cfg.maxWght - cfg.baseWght))
    );

    const targetVolume = presenceFactor > 0.01 ? Math.pow(normWeight, 1.2) * 0.9 * presenceFactor : 0;
    this.droneGain.gain.setTargetAtTime(targetVolume, now, 0.12);

    const targetFreq = cfg.droneBaseFreq + (cfg.droneMaxFreq - cfg.droneBaseFreq) * normWeight;
    this.droneOsc.frequency.setTargetAtTime(targetFreq, now, 0.18);
    if (this.subOsc) {
      this.subOsc.frequency.setTargetAtTime(targetFreq / 2, now, 0.18);
    }

    const targetCutoff =
      cfg.filterMinCutoff + (cfg.filterMaxCutoff - cfg.filterMinCutoff) * normWeight;
    this.droneFilter.frequency.setTargetAtTime(targetCutoff, now, 0.15);
  }

  /**
   * Hand Rhythm Layer: Play tight musical hits when hand sweeps over letters/words
   * Quantized to 84 BPM 16th-note grid (polyrhythmic triplets for second hand)
   */
  public triggerHandRhythmHit(params: HandRhythmHitParams) {
    if (!this.ctx || !this.isUnlocked || !this.rhythmBusGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const nowMs = performance.now();
    const cfg = INSTALLATION_CONFIG;

    // 1. Density rate limiting: max 12 hits/sec per hand
    const handKey = params.handIndex;
    const lastTimestamps = this.handHitTimestamps[handKey] || [];
    const recentHits = lastTimestamps.filter((t) => nowMs - t < 1000);
    if (recentHits.length >= cfg.rhythmMaxHitsPerSecPerHand) {
      return; // Rate limit reached
    }
    recentHits.push(nowMs);
    this.handHitTimestamps[handKey] = recentHits;

    // 2. Hand stillness gate: speed < 0.05 = silence
    if (params.speed < 0.04) {
      return;
    }

    // 3. Quantize to 84 BPM grid (16th notes for Hand 0, 16th triplets for Hand 1)
    const bpm = cfg.rhythmBpm;
    const beatDuration = 60 / bpm; // 0.714s
    const gridStep = params.handIndex === 1 ? beatDuration / 6 : beatDuration / 4; // 119ms vs 178ms

    const nextStep = Math.ceil(now / gridStep) * gridStep;
    let hitTime = nextStep;
    if (nextStep - now > cfg.rhythmQuantizeWindowSec) {
      // If past the tight window, evaluate if close to previous step
      const prevStep = nextStep - gridStep;
      if (now - prevStep <= cfg.rhythmQuantizeWindowSec) {
        hitTime = now;
      } else {
        hitTime = nextStep;
      }
    }

    // 4. Voice Stealing: find idle voice or steal oldest
    let chosenVoice: RhythmVoiceChannel | null = null;
    let oldestVoice: RhythmVoiceChannel = this.voiceChannels[0];
    let minBusyTime = Infinity;

    for (const v of this.voiceChannels) {
      if (v.busyUntil <= now) {
        chosenVoice = v;
        break;
      }
      if (v.busyUntil < minBusyTime) {
        minBusyTime = v.busyUntil;
        oldestVoice = v;
      }
    }

    if (!chosenVoice) {
      chosenVoice = oldestVoice; // Steal oldest voice
    }

    // 5. Position stereo panning by hand X position
    if (chosenVoice.panner) {
      const panVal = Math.max(-1, Math.min(1, params.xNorm * 2 - 1));
      chosenVoice.panner.pan.setValueAtTime(panVal, hitTime);
    }

    // 6. Velocity follows hand speed
    const velocity = Math.max(0.18, Math.min(1.0, 0.25 + params.speed * 1.6));

    // 7. Duck the background drone by ~3dB (gain 0.707) while rhythm hits play
    if (this.droneDuckingGain) {
      this.droneDuckingGain.gain.setValueAtTime(cfg.rhythmDuckingGain, hitTime);
      this.droneDuckingGain.gain.setTargetAtTime(1.0, hitTime + 0.12, 0.18);
    }

    // 8. Generate physical hit sound based on gesture, weight, and word class
    let hitDuration = 0.08;
    let hitLabel = '';

    if (params.isDrop) {
      // Fist release (drop): deep kick + low resonant tail
      hitLabel = 'DROP (GRAVITY)';
      hitDuration = 0.32;

      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(46, hitTime);
      osc.frequency.exponentialRampToValueAtTime(24, hitTime + 0.28);

      chosenVoice.filter.type = 'lowpass';
      chosenVoice.filter.frequency.setValueAtTime(110, hitTime);

      chosenVoice.gain.gain.setValueAtTime(0.001, hitTime);
      chosenVoice.gain.gain.linearRampToValueAtTime(0.62 * velocity, hitTime + 0.012);
      chosenVoice.gain.gain.exponentialRampToValueAtTime(0.0001, hitTime + hitDuration);

      osc.connect(chosenVoice.gain);
      osc.start(hitTime);
      osc.stop(hitTime + hitDuration + 0.05);
    } else if (params.isFist) {
      // Fist: single deep kick on the beat
      hitLabel = 'KICK (FIST)';
      hitDuration = 0.16;

      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(62, hitTime);
      osc.frequency.exponentialRampToValueAtTime(32, hitTime + 0.14);

      chosenVoice.filter.type = 'lowpass';
      chosenVoice.filter.frequency.setValueAtTime(140, hitTime);

      chosenVoice.gain.gain.setValueAtTime(0.001, hitTime);
      chosenVoice.gain.gain.linearRampToValueAtTime(0.70 * velocity, hitTime + 0.008);
      chosenVoice.gain.gain.exponentialRampToValueAtTime(0.0001, hitTime + hitDuration);

      osc.connect(chosenVoice.gain);
      osc.start(hitTime);
      osc.stop(hitTime + hitDuration + 0.03);
    } else if (params.isHeavyWord || params.letterWeight >= 520) {
      // Heavy words/letters (MASS, BURDEN, WEIGHT): low stone/wood thud
      hitLabel = `THUD (${params.word || 'HEAVY'})`;
      hitDuration = 0.085;

      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(86, hitTime);
      osc.frequency.exponentialRampToValueAtTime(44, hitTime + 0.065);

      chosenVoice.filter.type = 'lowpass';
      chosenVoice.filter.frequency.setValueAtTime(190, hitTime);

      chosenVoice.gain.gain.setValueAtTime(0.001, hitTime);
      chosenVoice.gain.gain.linearRampToValueAtTime(0.58 * velocity, hitTime + 0.006);
      chosenVoice.gain.gain.exponentialRampToValueAtTime(0.0001, hitTime + hitDuration);

      osc.connect(chosenVoice.gain);
      osc.start(hitTime);
      osc.stop(hitTime + hitDuration + 0.02);

      // Short transient noise burst
      if (this.noiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const transientGain = this.ctx.createGain();
        transientGain.gain.setValueAtTime(0.20 * velocity, hitTime);
        transientGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.018);
        noise.connect(transientGain);
        transientGain.connect(chosenVoice.gain);
        noise.start(hitTime);
        noise.stop(hitTime + 0.02);
      }
    } else if (params.isLightWord || params.letterWeight <= 260) {
      // Light words/letters (AIRY, FRAGILITY, SILENCE): high, dry tick/brush
      hitLabel = `TICK (${params.word || 'LIGHT'})`;
      hitDuration = 0.026;

      if (this.noiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        chosenVoice.filter.type = 'bandpass';
        chosenVoice.filter.frequency.setValueAtTime(2900, hitTime);
        chosenVoice.filter.Q.setValueAtTime(3.2, hitTime);

        chosenVoice.gain.gain.setValueAtTime(0.001, hitTime);
        chosenVoice.gain.gain.linearRampToValueAtTime(0.26 * velocity, hitTime + 0.003);
        chosenVoice.gain.gain.exponentialRampToValueAtTime(0.0001, hitTime + hitDuration);

        noise.connect(chosenVoice.gain);
        noise.start(hitTime);
        noise.stop(hitTime + hitDuration + 0.01);
      }
    } else {
      // Mid weight: soft knock, pitched from D minor pentatonic scale
      hitLabel = `KNOCK (${params.word || 'MID'})`;
      hitDuration = 0.055;

      // Select D minor pentatonic pitch from scale
      const cleanWord = params.word || 'TEXT';
      const charSum = cleanWord.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
      const noteIdx = Math.abs(charSum) % cfg.rhythmDScalePentatonic.length;
      const pitchFreq = cfg.rhythmDScalePentatonic[noteIdx];

      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitchFreq, hitTime);
      osc.frequency.exponentialRampToValueAtTime(pitchFreq * 0.72, hitTime + 0.045);

      chosenVoice.filter.type = 'lowpass';
      chosenVoice.filter.frequency.setValueAtTime(380, hitTime);

      chosenVoice.gain.gain.setValueAtTime(0.001, hitTime);
      chosenVoice.gain.gain.linearRampToValueAtTime(0.44 * velocity, hitTime + 0.004);
      chosenVoice.gain.gain.exponentialRampToValueAtTime(0.0001, hitTime + hitDuration);

      osc.connect(chosenVoice.gain);
      osc.start(hitTime);
      osc.stop(hitTime + hitDuration + 0.02);
    }

    chosenVoice.busyUntil = hitTime + hitDuration;
    this.lastHitText = hitLabel;
  }

  /**
   * Get Hand Rhythm telemetry for the Mechanics Panel
   */
  public getRhythmTelemetry() {
    const now = this.ctx ? this.ctx.currentTime : 0;
    const activeVoices = this.voiceChannels.filter((v) => v.busyUntil > now).length;
    return {
      bpm: INSTALLATION_CONFIG.rhythmBpm,
      voices: activeVoices,
      lastHit: this.lastHitText
    };
  }

  /**
   * Settling thump when heavy letters snap back
   */
  public triggerSettlingThump(intensity: number = 0.5) {
    if (!this.ctx || !this.isUnlocked || !this.masterLimiter || this.isMuted) return;

    const nowMs = performance.now();
    if (nowMs - this.lastThumpTime < INSTALLATION_CONFIG.thumpCooldownMs) {
      return;
    }
    this.lastThumpTime = nowMs;

    try {
      const now = this.ctx.currentTime;
      const thumpOsc = this.ctx.createOscillator();
      const thumpGain = this.ctx.createGain();
      const thumpFilter = this.ctx.createBiquadFilter();

      thumpOsc.type = 'sine';
      thumpOsc.frequency.setValueAtTime(48, now);
      thumpOsc.frequency.exponentialRampToValueAtTime(32, now + 0.28);

      thumpFilter.type = 'lowpass';
      thumpFilter.frequency.setValueAtTime(95, now);

      const peakGain = Math.min(0.55, 0.2 + intensity * 0.35);
      thumpGain.gain.setValueAtTime(0.001, now);
      thumpGain.gain.linearRampToValueAtTime(peakGain, now + 0.02);
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

      thumpOsc.connect(thumpFilter);
      thumpFilter.connect(thumpGain);
      thumpGain.connect(this.masterLimiter);

      thumpOsc.start(now);
      thumpOsc.stop(now + 0.35);

      setTimeout(() => {
        thumpOsc.disconnect();
        thumpGain.disconnect();
        thumpFilter.disconnect();
      }, 400);
    } catch {}
  }

  /**
   * Phase 3 Drop Gesture Thud
   */
  public triggerDropThud(heavyCount: number) {
    if (!this.ctx || !this.isUnlocked || !this.masterLimiter || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const thudOsc = this.ctx.createOscillator();
      const thudGain = this.ctx.createGain();
      const thudFilter = this.ctx.createBiquadFilter();

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
      thudGain.connect(this.masterLimiter);

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
