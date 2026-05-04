/**
 * Procedural slot machine sound effects via Web Audio API.
 * No audio files needed — everything generated in real-time.
 * Uses Howler.js as a fallback audio sprite manager.
 */

type SoundName = 'spinStart' | 'reelStop' | 'win' | 'bigWin' | 'jackpot' | 'buttonClick' | 'scatter' | 'freeSpin' | 'coinDrop';

class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private gainNode: GainNode | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = 0.5;
      this.gainNode.connect(this.ctx.destination);
    }
    // Resume if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  /** Short mechanical click for reel stop */
  playReelStop(pitch: number = 1.0) {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    const now = ctx.currentTime;

    // Sharp transient click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.value = 800 * pitch;

    filter.type = 'highpass';
    filter.frequency.value = 400;

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.gainNode!);

    osc.start(now);
    osc.stop(now + 0.08);

    // Add a noise burst for mechanical texture
    this.playNoiseBurst(0.05, 0.15, 2000);
  }

  /** Whirring spin start sound */
  playSpinStart() {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    const now = ctx.currentTime;

    // Descending tone sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);

    filter.type = 'lowpass';
    filter.frequency.value = 800;

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.gainNode!);

    osc.start(now);
    osc.stop(now + 0.3);

    // Continuous whirring during spin — background noise
    this.playSpinWhirr();
  }

  private spinWhirrNode: AudioBufferSourceNode | null = null;

  /** Looping mechanical whirr — call once, stops with stopSpinWhirr() */
  playSpinWhirr() {
    if (!this.enabled) return;
    this.stopSpinWhirr();
    const ctx = this.getCtx();

    // Create a looped buffer of filtered noise
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 300;
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.gainNode!);
    source.start();

    // Fade in
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.1);

    this.spinWhirrNode = source;
  }

  stopSpinWhirr() {
    if (!this.spinWhirrNode || !this.ctx) return;
    const ctx = this.ctx;
    const gain = this.spinWhirrNode.context as AudioContext;

    // Try to get the gain node from the source's connection graph
    try {
      const connections = (this.spinWhirrNode as any)._connections;
      if (connections && connections[0]) {
        const gn = connections[0];
        if (gn.gain) {
          gn.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
        }
      }
    } catch (_) {}

    this.spinWhirrNode.stop();
    this.spinWhirrNode = null;
  }

  /** Short noise burst */
  private playNoiseBurst(volume: number, duration: number, filterFreq: number) {
    const ctx = this.getCtx();
    const now = ctx.currentTime;

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.gainNode!);
    source.start(now);
  }

  /** Win sound — ascending chime arpeggio */
  playWin() {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      const start = now + i * 0.08;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);

      osc.connect(gain);
      gain.connect(this.gainNode!);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  }

  /** Big Win — triumphant fanfare with noise */
  playBigWin() {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    const now = ctx.currentTime;

    // Chord stab
    const freqs = [261.63, 329.63, 392.00, 523.25]; // C major chord
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = i < 2 ? 'sawtooth' : 'square';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
      gain.gain.setValueAtTime(0.15, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.gainNode!);
      osc.start(now);
      osc.stop(now + 1.2);
    });

    // Shimmer overlay
    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 2000 + Math.random() * 3000;
      const start = now + i * 0.05;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.05, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.connect(gain);
      gain.connect(this.gainNode!);
      osc.start(start);
      osc.stop(start + 0.2);
    }

    // Rumble
    this.playNoiseBurst(0.1, 0.5, 150);
  }

  /** Jackpot — thunder crack + triumphant fanfare */
  playJackpot() {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    const now = ctx.currentTime;

    // Thunder crack — low frequency burst
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain);
    gain.connect(this.gainNode!);
    osc.start(now);
    osc.stop(now + 0.6);

    // White noise thunder
    this.playNoiseBurst(0.3, 0.8, 100);

    // Fanfare after 0.5s
    setTimeout(() => {
      if (!this.enabled) return;
      const ctx2 = this.getCtx();
      const t = ctx2.currentTime;
      const chord = [261.63, 329.63, 392.00, 523.25, 659.25];
      chord.forEach((freq, i) => {
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t + i * 0.05);
        gain.gain.linearRampToValueAtTime(0.18, t + i * 0.05 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 2);
        osc.connect(gain);
        gain.connect(this.gainNode!);
        osc.start(t + i * 0.05);
        osc.stop(t + 2);
      });
    }, 500);
  }

  /** Button click */
  playButtonClick() {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(this.gainNode!);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /** Scatter hit — magical sparkle */
  playScatter() {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    const now = ctx.currentTime;

    for (let i = 0; i < 12; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1500 + Math.random() * 2500;
      const start = now + i * 0.04;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.08, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(gain);
      gain.connect(this.gainNode!);
      osc.start(start);
      osc.stop(start + 0.25);
    }
  }

  /** Free spins awarded — ascending magical sweep */
  playFreeSpin() {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    const now = ctx.currentTime;

    const notes = [392.00, 523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain);
      gain.connect(this.gainNode!);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  }

  /** Coin drop — cascading coin sounds for balance increase */
  playCoinDrop(count: number = 5) {
    if (!this.enabled) return;
    for (let i = 0; i < Math.min(count, 10); i++) {
      setTimeout(() => {
        if (!this.enabled) return;
        const ctx = this.getCtx();
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        // Pitch descends slightly — coin clunk
        osc.frequency.setValueAtTime(2800 + Math.random() * 400, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.05);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(this.gainNode!);
        osc.start(now);
        osc.stop(now + 0.08);
      }, i * 60);
    }
  }

  /** Master volume 0–1 */
  setVolume(v: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, v));
    }
  }
}

// Singleton
export const soundManager = new SoundManager();
