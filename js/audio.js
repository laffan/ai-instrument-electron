/**
 * Audio Engine using Web Audio API
 * Creates synthesizer voices for each pendulum
 */

class AudioEngine {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.voices = new Map();
    this.isInitialized = false;
    this.masterVolume = 0.5;
    this.compressor = null;
    this.reverb = null;
  }

  async init() {
    if (this.isInitialized) return;

    this.context = new (window.AudioContext || window.webkitAudioContext)();

    // Create master chain
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.masterVolume;

    // Create reverb
    this.reverb = await this.createReverb();

    // Connect chain
    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.context.destination);

    // Reverb send
    this.reverbGain = this.context.createGain();
    this.reverbGain.gain.value = 0.3;
    this.reverbGain.connect(this.reverb);
    this.reverb.connect(this.context.destination);

    this.isInitialized = true;
  }

  async createReverb() {
    const convolver = this.context.createConvolver();
    const rate = this.context.sampleRate;
    const length = rate * 2;
    const impulse = this.context.createBuffer(2, length, rate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }

    convolver.buffer = impulse;
    return convolver;
  }

  resume() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  createVoice(pendulum) {
    if (!this.isInitialized) return null;

    const voice = {
      oscillator: this.context.createOscillator(),
      gain: this.context.createGain(),
      panner: this.context.createStereoPanner(),
      filter: this.context.createBiquadFilter()
    };

    // Configure oscillator
    voice.oscillator.type = pendulum.waveform;
    voice.oscillator.frequency.value = pendulum.getFrequency();

    // Configure filter
    voice.filter.type = 'lowpass';
    voice.filter.frequency.value = 2000;
    voice.filter.Q.value = 1;

    // Configure gain (start silent)
    voice.gain.gain.value = 0;

    // Connect voice chain
    voice.oscillator.connect(voice.filter);
    voice.filter.connect(voice.gain);
    voice.gain.connect(voice.panner);
    voice.panner.connect(this.masterGain);
    voice.panner.connect(this.reverbGain);

    // Start oscillator
    voice.oscillator.start();

    this.voices.set(pendulum.id, voice);
    return voice;
  }

  updateVoice(pendulum, updateResult) {
    const voice = this.voices.get(pendulum.id);
    if (!voice) return;

    const now = this.context.currentTime;

    // Update frequency based on pendulum properties
    const targetFreq = pendulum.getFrequency();
    voice.oscillator.frequency.setTargetAtTime(targetFreq, now, 0.01);

    // Update waveform if changed
    if (voice.oscillator.type !== pendulum.waveform) {
      voice.oscillator.type = pendulum.waveform;
    }

    // Calculate volume based on velocity
    const volume = pendulum.getVolume() * 0.5;
    voice.gain.gain.setTargetAtTime(volume, now, 0.05);

    // Update panning based on position
    const pan = pendulum.getPan();
    voice.panner.pan.setTargetAtTime(pan, now, 0.02);

    // Update filter based on amplitude
    const filterFreq = 500 + updateResult.velocity * 3000;
    voice.filter.frequency.setTargetAtTime(
      Math.min(filterFreq, 8000),
      now,
      0.05
    );

    // Trigger note on center crossing
    if (updateResult.crossed) {
      this.triggerNote(pendulum, updateResult.crossingVelocity);
    }
  }

  triggerNote(pendulum, velocity) {
    const voice = this.voices.get(pendulum.id);
    if (!voice) return;

    const now = this.context.currentTime;
    const attackTime = 0.01;
    const releaseTime = 0.3;
    const volume = Math.min(velocity * 0.3, 0.8);

    // Quick attack
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(volume, now + attackTime);
    voice.gain.gain.exponentialRampToValueAtTime(0.001, now + attackTime + releaseTime);
  }

  removeVoice(pendulumId) {
    const voice = this.voices.get(pendulumId);
    if (voice) {
      voice.oscillator.stop();
      voice.oscillator.disconnect();
      voice.gain.disconnect();
      voice.panner.disconnect();
      voice.filter.disconnect();
      this.voices.delete(pendulumId);
    }
  }

  setMasterVolume(value) {
    this.masterVolume = value;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(value, this.context.currentTime, 0.02);
    }
  }

  stop() {
    this.voices.forEach((voice, id) => {
      const now = this.context.currentTime;
      voice.gain.gain.setTargetAtTime(0, now, 0.1);
    });
  }

  cleanup() {
    this.voices.forEach((voice, id) => {
      this.removeVoice(id);
    });
    if (this.context) {
      this.context.close();
    }
  }
}
