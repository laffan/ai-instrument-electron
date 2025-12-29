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

      // Build triggers list HTML
      const triggersHtml = p.triggers.map(trigger => {
        const drumType = DRUM_TYPES.find(d => d.id === trigger.drumType);
        const color = drumType ? drumType.color : '#888';
        // Convert position (radians) to percentage for slider (-1 to 1 range, mapped to angle)
        const posPercent = Math.round((trigger.position / (Math.PI / 3)) * 100);
        return `
          <div class="trigger-item" data-trigger-id="${trigger.id}">
            <span class="trigger-color" style="background: ${color}"></span>
            <select class="trigger-drum-select">
              ${DRUM_TYPES.map(d =>
                `<option value="${d.id}" ${d.id === trigger.drumType ? 'selected' : ''}>${d.name}</option>`
              ).join('')}
            </select>
            <input type="range" class="trigger-position" min="-100" max="100" value="${posPercent}" title="Position (left/right)">
            <select class="trigger-subdiv" title="Subdivisions">
              <option value="1" ${trigger.subdivisions === 1 ? 'selected' : ''}>1×</option>
              <option value="2" ${trigger.subdivisions === 2 ? 'selected' : ''}>2×</option>
            </select>
            <button class="trigger-remove">&times;</button>
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
        <div class="triggers-section">
          <div class="triggers-header">
            <span>Triggers</span>
            <button class="add-trigger-btn">+ Add</button>
          </div>
          <div class="triggers-list">${triggersHtml}</div>
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

      // Add trigger button
      item.querySelector('.add-trigger-btn').addEventListener('click', () => {
        // Add at center position by default
        p.addTrigger({ position: 0, drumType: 'kick', subdivisions: 2 });
        this.updatePendulumList();
      });

      // Trigger controls
      item.querySelectorAll('.trigger-item').forEach(triggerEl => {
        const triggerId = triggerEl.dataset.triggerId;
        const trigger = p.triggers.find(t => t.id === triggerId);
        if (!trigger) return;

        // Drum type select
        triggerEl.querySelector('.trigger-drum-select').addEventListener('change', (e) => {
          trigger.drumType = e.target.value;
          this.updatePendulumList();
        });

        // Position slider (converts percentage to radians)
        triggerEl.querySelector('.trigger-position').addEventListener('input', (e) => {
          const percent = parseFloat(e.target.value);
          trigger.position = (percent / 100) * (Math.PI / 3);  // Max swing angle ~60 degrees
        });

        // Subdivisions select
        triggerEl.querySelector('.trigger-subdiv').addEventListener('change', (e) => {
          trigger.subdivisions = parseInt(e.target.value);
        });

        // Remove trigger
        triggerEl.querySelector('.trigger-remove').addEventListener('click', () => {
          p.removeTrigger(triggerId);
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

        // Main pendulum with kick at center, snare offset
        const p1 = this.addPendulum({
          baseFrequency: 110,
          length: 180,
          angle: Math.PI / 3,
          waveform: 'triangle'
        });
        p1.addTrigger({ position: 0, drumType: 'kick', subdivisions: 2 });
        p1.addTrigger({ position: Math.PI / 6, drumType: 'snare', subdivisions: 1 });

        // Hi-hat pendulum (shorter = faster)
        const p2 = this.addPendulum({
          baseFrequency: 220,
          length: 100,
          angle: Math.PI / 4,
          waveform: 'sine'
        });
        p2.addTrigger({ position: 0, drumType: 'hihat', subdivisions: 2 });

        // Accent pendulum with rim at offset position
        const p3 = this.addPendulum({
          baseFrequency: 330,
          length: 140,
          angle: -Math.PI / 4,
          waveform: 'triangle'
        });
        p3.addTrigger({ position: -Math.PI / 8, drumType: 'rim', subdivisions: 2 });

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

        // Trigger drums for any lines that were crossed
        if (result.triggeredLines) {
          result.triggeredLines.forEach(trigger => {
            const velocity = Math.min(result.velocity * 0.5 + 0.5, 1);
            this.drumEngine.play(trigger.drumType, velocity);
          });
        }

        // Draw triggers first (behind pendulum)
        this.renderer.drawTriggers(result.pendulum);

        // Draw pendulum
        this.renderer.drawPendulum(result.pendulum, result);
        this.renderer.drawInfo(result.pendulum, result);
      });
    } else {
      // Just draw static pendulums
      this.pendulumSystem.pendulums.forEach(p => {
        const pos = p.getBobPosition();

        // Draw triggers
        this.renderer.drawTriggers(p);

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
