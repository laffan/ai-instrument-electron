/**
 * Drum Synthesis Engine
 * Creates percussive sounds using Web Audio API synthesis
 */

class DrumEngine {
  constructor(audioContext, masterGain) {
    this.ctx = audioContext;
    this.masterGain = masterGain;
    this.drumGain = null;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;

    this.drumGain = this.ctx.createGain();
    this.drumGain.gain.value = 0.7;
    this.drumGain.connect(this.masterGain);

    this.isInitialized = true;
  }

  // Synthesized kick drum
  kick(time = 0, velocity = 1) {
    const now = this.ctx.currentTime + time;

    // Pitch envelope oscillator
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);

    oscGain.gain.setValueAtTime(velocity * 0.8, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    // Click transient
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();

    click.type = 'square';
    click.frequency.value = 80;

    clickGain.gain.setValueAtTime(velocity * 0.3, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    // Connect and play
    osc.connect(oscGain);
    oscGain.connect(this.drumGain);
    click.connect(clickGain);
    clickGain.connect(this.drumGain);

    osc.start(now);
    osc.stop(now + 0.5);
    click.start(now);
    click.stop(now + 0.05);
  }

  // Synthesized snare
  snare(time = 0, velocity = 1) {
    const now = this.ctx.currentTime + time;

    // Noise component
    const noiseBuffer = this.createNoiseBuffer(0.2);
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(velocity * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    // Tone component
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);

    oscGain.gain.setValueAtTime(velocity * 0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    // Connect
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.drumGain);

    osc.connect(oscGain);
    oscGain.connect(this.drumGain);

    noise.start(now);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Hi-hat (closed)
  hihat(time = 0, velocity = 1) {
    const now = this.ctx.currentTime + time;

    const noiseBuffer = this.createNoiseBuffer(0.1);
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(velocity * 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumGain);

    noise.start(now);
  }

  // Open hi-hat
  openHat(time = 0, velocity = 1) {
    const now = this.ctx.currentTime + time;

    const noiseBuffer = this.createNoiseBuffer(0.4);
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(velocity * 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumGain);

    noise.start(now);
  }

  // Rim shot / click
  rim(time = 0, velocity = 1) {
    const now = this.ctx.currentTime + time;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.01);

    gain.gain.setValueAtTime(velocity * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.drumGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Tom
  tom(time = 0, velocity = 1, pitch = 1) {
    const now = this.ctx.currentTime + time;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const baseFreq = 100 * pitch;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 1.5, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.1);

    gain.gain.setValueAtTime(velocity * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.drumGain);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  // Clap
  clap(time = 0, velocity = 1) {
    const now = this.ctx.currentTime + time;

    // Multiple noise bursts for clap texture
    for (let i = 0; i < 3; i++) {
      const noiseBuffer = this.createNoiseBuffer(0.02);
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2000;
      filter.Q.value = 1;

      const gain = this.ctx.createGain();
      const offset = i * 0.01;
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(velocity * 0.3, now + offset + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.drumGain);

      noise.start(now + offset);
    }
  }

  // Cowbell
  cowbell(time = 0, velocity = 1) {
    const now = this.ctx.currentTime + time;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'square';
    osc1.frequency.value = 587;
    osc2.type = 'square';
    osc2.frequency.value = 845;

    gain.gain.setValueAtTime(velocity * 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.drumGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.2);
    osc2.stop(now + 0.2);
  }

  createNoiseBuffer(duration) {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  // Play a drum by name
  play(drumName, velocity = 1) {
    if (!this.isInitialized) return;

    switch (drumName) {
      case 'kick': this.kick(0, velocity); break;
      case 'snare': this.snare(0, velocity); break;
      case 'hihat': this.hihat(0, velocity); break;
      case 'openhat': this.openHat(0, velocity); break;
      case 'rim': this.rim(0, velocity); break;
      case 'tom-high': this.tom(0, velocity, 1.5); break;
      case 'tom-mid': this.tom(0, velocity, 1); break;
      case 'tom-low': this.tom(0, velocity, 0.7); break;
      case 'clap': this.clap(0, velocity); break;
      case 'cowbell': this.cowbell(0, velocity); break;
    }
  }

  setVolume(value) {
    if (this.drumGain) {
      this.drumGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
    }
  }
}

// Available drum sounds for UI
const DRUM_TYPES = [
  { id: 'kick', name: 'Kick', color: '#e94560' },
  { id: 'snare', name: 'Snare', color: '#f39c12' },
  { id: 'hihat', name: 'Hi-Hat', color: '#3498db' },
  { id: 'openhat', name: 'Open Hat', color: '#9b59b6' },
  { id: 'rim', name: 'Rim', color: '#1abc9c' },
  { id: 'tom-high', name: 'Tom Hi', color: '#e74c3c' },
  { id: 'tom-mid', name: 'Tom Mid', color: '#e67e22' },
  { id: 'tom-low', name: 'Tom Low', color: '#d35400' },
  { id: 'clap', name: 'Clap', color: '#2ecc71' },
  { id: 'cowbell', name: 'Cowbell', color: '#f1c40f' }
];
