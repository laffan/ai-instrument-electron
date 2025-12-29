/**
 * Harmonic Pendulum - Main Application
 * Ties together physics, audio, MIDI, and rendering
 */

class HarmonicPendulumApp {
  constructor() {
    this.pendulumSystem = new PendulumSystem();
    this.audioEngine = new AudioEngine();
    this.drumEngine = null;  // Will be initialized after audio context
    this.midiHandler = new MIDIHandler();
    this.renderer = null;

    this.isPlaying = false;
    this.lastTime = 0;
    this.frameCount = 0;
    this.fps = 0;
    this.fpsUpdateTime = 0;

    this.init();
  }

  async init() {
    // Initialize canvas
    const canvas = document.getElementById('pendulum-canvas');
    this.renderer = new Renderer(canvas);

    // Initialize audio
    await this.audioEngine.init();

    // Initialize drum engine (uses the same audio context)
    this.drumEngine = new DrumEngine(this.audioEngine.context, this.audioEngine.masterGain);
    this.drumEngine.init();

    // Initialize MIDI
    await this.midiHandler.init();
    this.updateMIDIOutputList();

    // Set up event listeners
    this.setupEventListeners();

    // Set up menu listeners
    this.setupMenuListeners();

    // Load default preset
    this.loadPreset('minimal');

    // Start render loop
    this.render();
  }

  setupEventListeners() {
    // Transport controls
    document.getElementById('play-btn').addEventListener('click', () => this.play());
    document.getElementById('stop-btn').addEventListener('click', () => this.stop());

    // Global controls
    document.getElementById('gravity').addEventListener('input', (e) => {
      this.pendulumSystem.gravity = parseFloat(e.target.value);
      document.getElementById('gravity-val').textContent = e.target.value;
    });

    document.getElementById('damping').addEventListener('input', (e) => {
      this.pendulumSystem.damping = parseFloat(e.target.value);
      document.getElementById('damping-val').textContent = e.target.value;
    });

    document.getElementById('master-volume').addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      this.audioEngine.setMasterVolume(vol);
      document.getElementById('master-volume-val').textContent = Math.round(vol * 100) + '%';
    });

    document.getElementById('drum-volume').addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      this.drumEngine.setVolume(vol);
      document.getElementById('drum-volume-val').textContent = Math.round(vol * 100) + '%';
    });

    // Add pendulum button
    document.getElementById('add-pendulum').addEventListener('click', () => {
      this.addPendulum();
    });

    // MIDI controls
    document.getElementById('midi-output').addEventListener('change', (e) => {
      this.midiHandler.selectOutput(e.target.value);
    });

    document.getElementById('midi-enabled').addEventListener('change', (e) => {
      this.midiHandler.setEnabled(e.target.checked);
    });

    // Preset buttons
    document.querySelectorAll('.preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.loadPreset(e.target.dataset.preset);
      });
    });

    // Save/Load buttons
    document.getElementById('save-btn').addEventListener('click', () => this.saveState());
    document.getElementById('load-btn').addEventListener('click', () => this.loadState());

    // Canvas click to add pendulum
    const canvas = document.getElementById('pendulum-canvas');
    canvas.addEventListener('click', (e) => {
      if (e.shiftKey) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.addPendulum({ pivotX: x, pivotY: Math.min(y, 150) });
      }
    });
  }

  setupMenuListeners() {
    if (window.electronAPI) {
      window.electronAPI.onMenuSave(() => this.saveState());
      window.electronAPI.onMenuLoad(() => this.loadState());
      window.electronAPI.onMenuReset(() => this.resetPendulums());
      window.electronAPI.onMenuRandomize(() => this.randomizePendulums());
    }
  }

  updateMIDIOutputList() {
    const select = document.getElementById('midi-output');
    select.innerHTML = '<option value="">No MIDI</option>';

    this.midiHandler.outputs.forEach(output => {
      const option = document.createElement('option');
      option.value = output.id;
      option.textContent = output.name;
      select.appendChild(option);
    });
  }

  addPendulum(options = {}) {
    const pendulum = this.pendulumSystem.add(options);

    // Redistribute positions
    this.pendulumSystem.distributePositions(
      this.renderer.getWidth(),
      this.renderer.getHeight()
    );

    // Create audio voice if playing
    if (this.isPlaying) {
      this.audioEngine.createVoice(pendulum);
    }

    // Update UI
    this.updatePendulumList();
    this.updatePendulumCount();

    return pendulum;
  }

  removePendulum(id) {
    this.audioEngine.removeVoice(id);
    this.pendulumSystem.remove(id);
    this.pendulumSystem.distributePositions(
      this.renderer.getWidth(),
      this.renderer.getHeight()
    );
    this.updatePendulumList();
    this.updatePendulumCount();
  }

  updatePendulumList() {
    const list = document.getElementById('pendulum-list');
    list.innerHTML = '';

    this.pendulumSystem.pendulums.forEach(p => {
      const item = document.createElement('div');
      item.className = 'pendulum-item';
      item.dataset.id = p.id;

      // Build ring options HTML
      const drumOptions = DRUM_TYPES.map(d =>
        `<option value="${d.id}">${d.name}</option>`
      ).join('');

      // Build rings list HTML
      const ringsHtml = p.rings.map(ring => {
        const drumType = DRUM_TYPES.find(d => d.id === ring.drumType);
        const color = drumType ? drumType.color : '#888';
        return `
          <div class="ring-item" data-ring-id="${ring.id}">
            <span class="ring-color" style="background: ${color}"></span>
            <select class="ring-drum-select">
              ${DRUM_TYPES.map(d =>
                `<option value="${d.id}" ${d.id === ring.drumType ? 'selected' : ''}>${d.name}</option>`
              ).join('')}
            </select>
            <input type="range" class="ring-radius" min="40" max="250" value="${ring.radius}" title="Ring radius">
            <button class="ring-remove">&times;</button>
          </div>
        `;
      }).join('');

      item.innerHTML = `
        <div class="header">
          <span>
            <span class="color-dot" style="background: ${p.color}"></span>
            <span class="name">${p.name}</span>
          </span>
          <button class="remove-btn">&times;</button>
        </div>
        <div class="control-row">
          <label>Frequency</label>
          <input type="range" class="freq-slider" min="55" max="880" value="${p.baseFrequency}">
          <span class="value">${p.baseFrequency}Hz</span>
        </div>
        <div class="control-row">
          <label>Waveform</label>
          <select class="waveform-select">
            <option value="sine" ${p.waveform === 'sine' ? 'selected' : ''}>Sine</option>
            <option value="triangle" ${p.waveform === 'triangle' ? 'selected' : ''}>Triangle</option>
            <option value="sawtooth" ${p.waveform === 'sawtooth' ? 'selected' : ''}>Sawtooth</option>
            <option value="square" ${p.waveform === 'square' ? 'selected' : ''}>Square</option>
          </select>
        </div>
        <div class="control-row">
          <label>Length</label>
          <input type="range" class="length-slider" min="50" max="300" value="${p.length}">
          <span class="value">${Math.round(p.length)}px</span>
        </div>
        <div class="rings-section">
          <div class="rings-header">
            <span>Trigger Rings</span>
            <button class="add-ring-btn">+ Ring</button>
          </div>
          <div class="rings-list">${ringsHtml}</div>
        </div>
      `;

      // Remove button
      item.querySelector('.remove-btn').addEventListener('click', () => {
        this.removePendulum(p.id);
      });

      // Frequency slider
      const freqSlider = item.querySelector('.freq-slider');
      freqSlider.addEventListener('input', (e) => {
        p.baseFrequency = parseFloat(e.target.value);
        e.target.nextElementSibling.textContent = p.baseFrequency + 'Hz';
      });

      // Waveform select
      const waveformSelect = item.querySelector('.waveform-select');
      waveformSelect.addEventListener('change', (e) => {
        p.waveform = e.target.value;
      });

      // Length slider
      const lengthSlider = item.querySelector('.length-slider');
      lengthSlider.addEventListener('input', (e) => {
        p.length = parseFloat(e.target.value);
        e.target.nextElementSibling.textContent = Math.round(p.length) + 'px';
      });

      // Add ring button
      item.querySelector('.add-ring-btn').addEventListener('click', () => {
        p.addRing({ radius: 80 + p.rings.length * 40, drumType: 'kick' });
        this.updatePendulumList();
      });

      // Ring controls
      item.querySelectorAll('.ring-item').forEach(ringEl => {
        const ringId = ringEl.dataset.ringId;
        const ring = p.rings.find(r => r.id === ringId);
        if (!ring) return;

        // Drum type select
        ringEl.querySelector('.ring-drum-select').addEventListener('change', (e) => {
          ring.drumType = e.target.value;
          this.updatePendulumList();
        });

        // Radius slider
        ringEl.querySelector('.ring-radius').addEventListener('input', (e) => {
          ring.radius = parseFloat(e.target.value);
        });

        // Remove ring
        ringEl.querySelector('.ring-remove').addEventListener('click', () => {
          p.removeRing(ringId);
          this.updatePendulumList();
        });
      });

      list.appendChild(item);
    });
  }

  updatePendulumCount() {
    document.getElementById('pendulum-count').textContent =
      `Pendulums: ${this.pendulumSystem.pendulums.length}`;
  }

  play() {
    if (this.isPlaying) return;

    this.audioEngine.resume();
    this.isPlaying = true;
    this.pendulumSystem.isRunning = true;

    // Create voices for all pendulums
    this.pendulumSystem.pendulums.forEach(p => {
      this.audioEngine.createVoice(p);
    });

    document.getElementById('play-btn').textContent = '▶ Playing';
    document.getElementById('play-btn').disabled = true;
  }

  stop() {
    this.isPlaying = false;
    this.pendulumSystem.isRunning = false;
    this.audioEngine.stop();
    this.midiHandler.allNotesOff();

    document.getElementById('play-btn').textContent = '▶ Play';
    document.getElementById('play-btn').disabled = false;
  }

  resetPendulums() {
    this.pendulumSystem.reset();
    this.renderer.clearFull();
  }

  randomizePendulums() {
    this.pendulumSystem.randomize();
    this.updatePendulumList();
  }

  async saveState() {
    const state = {
      version: '1.0',
      timestamp: Date.now(),
      system: this.pendulumSystem.serialize(),
      masterVolume: this.audioEngine.masterVolume,
      midiEnabled: this.midiHandler.isEnabled
    };

    if (window.electronAPI) {
      const result = await window.electronAPI.saveFile(state);
      if (result.success) {
        console.log('Saved to:', result.path);
      }
    } else {
      // Fallback for browser testing
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pendulum-state.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async loadState() {
    let state;

    if (window.electronAPI) {
      const result = await window.electronAPI.loadFile();
      if (result.success) {
        state = result.data;
      } else {
        return;
      }
    } else {
      // Fallback for browser testing
      return;
    }

    // Stop current playback
    this.stop();

    // Clear current pendulums
    this.pendulumSystem.pendulums.forEach(p => {
      this.audioEngine.removeVoice(p.id);
    });

    // Load state
    this.pendulumSystem.deserialize(state.system);

    // Update UI
    document.getElementById('gravity').value = this.pendulumSystem.gravity;
    document.getElementById('gravity-val').textContent = this.pendulumSystem.gravity;
    document.getElementById('damping').value = this.pendulumSystem.damping;
    document.getElementById('damping-val').textContent = this.pendulumSystem.damping;

    if (state.masterVolume !== undefined) {
      this.audioEngine.setMasterVolume(state.masterVolume);
      document.getElementById('master-volume').value = state.masterVolume;
      document.getElementById('master-volume-val').textContent =
        Math.round(state.masterVolume * 100) + '%';
    }

    this.updatePendulumList();
    this.updatePendulumCount();
    this.renderer.clearFull();
  }

  loadPreset(name) {
    // Stop and clear
    this.stop();
    this.pendulumSystem.pendulums.forEach(p => {
      this.audioEngine.removeVoice(p.id);
    });
    this.pendulumSystem.clear();

    switch (name) {
      case 'minimal':
        this.pendulumSystem.gravity = 1.0;
        this.pendulumSystem.damping = 0.999;
        this.addPendulum({ baseFrequency: 220, length: 150, angle: Math.PI / 4 });
        this.addPendulum({ baseFrequency: 330, length: 180, angle: -Math.PI / 5 });
        break;

      case 'beats': {
        this.pendulumSystem.gravity = 1.0;
        this.pendulumSystem.damping = 0.9995;

        // Main pendulum with kick and snare rings
        const p1 = this.addPendulum({
          baseFrequency: 110,
          length: 180,
          angle: Math.PI / 3,
          waveform: 'triangle'
        });
        p1.addRing({ radius: 100, drumType: 'kick' });
        p1.addRing({ radius: 160, drumType: 'snare' });

        // Hi-hat pendulum (shorter = faster)
        const p2 = this.addPendulum({
          baseFrequency: 220,
          length: 100,
          angle: Math.PI / 4,
          waveform: 'sine'
        });
        p2.addRing({ radius: 80, drumType: 'hihat' });

        // Accent pendulum
        const p3 = this.addPendulum({
          baseFrequency: 330,
          length: 140,
          angle: -Math.PI / 4,
          waveform: 'triangle'
        });
        p3.addRing({ radius: 120, drumType: 'rim' });

        this.updatePendulumList();
        break;
      }

      case 'chaos':
        this.pendulumSystem.gravity = 1.5;
        this.pendulumSystem.damping = 0.998;
        for (let i = 0; i < 6; i++) {
          this.addPendulum({
            baseFrequency: 110 + Math.random() * 440,
            length: 80 + Math.random() * 150,
            angle: (Math.random() - 0.5) * Math.PI,
            angularVelocity: (Math.random() - 0.5) * 2
          });
        }
        break;

      case 'harmony':
        this.pendulumSystem.gravity = 0.8;
        this.pendulumSystem.damping = 0.9995;
        const harmonicFreqs = [220, 275, 330, 440, 550];
        harmonicFreqs.forEach((freq, i) => {
          this.addPendulum({
            baseFrequency: freq,
            length: 120 + i * 30,
            angle: Math.PI / 6,
            waveform: 'triangle'
          });
        });
        break;

      case 'polyrhythm':
        this.pendulumSystem.gravity = 1.0;
        this.pendulumSystem.damping = 0.999;
        // Different lengths create different periods
        const lengths = [100, 112, 125, 141, 158];
        lengths.forEach((len, i) => {
          this.addPendulum({
            baseFrequency: 220 * (i + 1) / 2,
            length: len,
            angle: Math.PI / 4,
            waveform: i % 2 === 0 ? 'sine' : 'triangle'
          });
        });
        break;
    }

    // Update UI
    document.getElementById('gravity').value = this.pendulumSystem.gravity;
    document.getElementById('gravity-val').textContent = this.pendulumSystem.gravity;
    document.getElementById('damping').value = this.pendulumSystem.damping;
    document.getElementById('damping-val').textContent = this.pendulumSystem.damping;

    this.renderer.clearFull();
  }

  render(timestamp = 0) {
    // Calculate FPS
    this.frameCount++;
    if (timestamp - this.fpsUpdateTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsUpdateTime = timestamp;
      document.getElementById('fps').textContent = `FPS: ${this.fps}`;
    }

    // Clear with fade effect
    this.renderer.clear();

    // Draw grid
    this.renderer.drawGrid();

    // Update and draw pendulums
    if (this.isPlaying) {
      const results = this.pendulumSystem.update();

      results.forEach(result => {
        // Update audio
        this.audioEngine.updateVoice(result.pendulum, result);

        // Trigger MIDI on crossing
        if (result.crossed) {
          this.midiHandler.triggerNote(result.pendulum, result.crossingVelocity);
        }

        // Trigger drums for any rings that were crossed
        if (result.triggeredRings) {
          result.triggeredRings.forEach(ring => {
            const velocity = Math.min(result.velocity * 0.5 + 0.5, 1);
            this.drumEngine.play(ring.drumType, velocity);
          });
        }

        // Draw rings first (behind pendulum)
        this.renderer.drawRings(result.pendulum);

        // Draw pendulum
        this.renderer.drawPendulum(result.pendulum, result);
        this.renderer.drawInfo(result.pendulum, result);
      });
    } else {
      // Just draw static pendulums
      this.pendulumSystem.pendulums.forEach(p => {
        const pos = p.getBobPosition();

        // Draw rings
        this.renderer.drawRings(p);

        // Draw pendulum
        this.renderer.drawPendulum(p, {
          bobX: pos.x,
          bobY: pos.y,
          velocity: 0,
          crossed: false
        });
      });
    }

    requestAnimationFrame((t) => this.render(t));
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new HarmonicPendulumApp();
});
