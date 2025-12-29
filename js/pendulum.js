/**
 * Pendulum Physics Engine
 * Simulates simple pendulum motion with configurable parameters
 */

/**
 * TriggerLine - A vertical line that triggers drum sounds when the pendulum crosses it
 */
class TriggerLine {
  constructor(options = {}) {
    this.id = options.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    this.position = options.position !== undefined ? options.position : 0;  // Angle offset from center (radians), 0 = center
    this.drumType = options.drumType || 'kick';
    this.enabled = options.enabled !== false;
    this.subdivisions = options.subdivisions || 1;  // 1 = one direction, 2 = both directions

    // State for crossing detection
    this.lastAngle = null;
    this.triggered = false;
    this.triggerTime = 0;
  }

  // Check if pendulum crossed this line
  checkCrossing(currentAngle, angularVelocity) {
    if (this.lastAngle === null) {
      this.lastAngle = currentAngle;
      return false;
    }

    let crossed = false;
    const pos = this.position;

    // Check if we crossed the position
    const crossedLeft = this.lastAngle > pos && currentAngle <= pos;
    const crossedRight = this.lastAngle < pos && currentAngle >= pos;

    if (this.subdivisions >= 2) {
      // Trigger on both directions
      crossed = crossedLeft || crossedRight;
    } else {
      // Trigger only when moving right (positive velocity) - feels more musical
      crossed = crossedRight && angularVelocity > 0;
    }

    this.lastAngle = currentAngle;

    // Reset trigger visual after 100ms
    if (this.triggered && Date.now() - this.triggerTime > 100) {
      this.triggered = false;
    }

    if (crossed && this.enabled) {
      this.triggered = true;
      this.triggerTime = Date.now();
      return true;
    }

    return false;
  }

  // Get the X position of this line relative to a pendulum
  getXPosition(pivotX, pendulumLength) {
    return pivotX + pendulumLength * Math.sin(this.position);
  }

  reset() {
    this.lastAngle = null;
    this.triggered = false;
  }

  serialize() {
    return {
      id: this.id,
      position: this.position,
      drumType: this.drumType,
      enabled: this.enabled,
      subdivisions: this.subdivisions
    };
  }

  static deserialize(data) {
    return new TriggerLine(data);
  }
}

// Keep TriggerRing as alias for backwards compatibility with saved files
const TriggerRing = TriggerLine;

class Pendulum {
  constructor(options = {}) {
    this.id = options.id || Date.now().toString(36) + Math.random().toString(36).substr(2);
    this.name = options.name || `Pendulum ${this.id.substr(0, 4)}`;

    // Physical properties
    this.length = options.length || 150;
    this.angle = options.angle || Math.PI / 4;
    this.angularVelocity = options.angularVelocity || 0;
    this.angularAcceleration = 0;

    // Position (pivot point)
    this.pivotX = options.pivotX || 400;
    this.pivotY = options.pivotY || 100;

    // Bob properties
    this.bobRadius = options.bobRadius || 20;
    this.mass = options.mass || 1;

    // Visual
    this.color = options.color || this.generateColor();
    this.trailPoints = [];
    this.maxTrailLength = 50;

    // Audio parameters
    this.baseFrequency = options.baseFrequency || 220;
    this.waveform = options.waveform || 'sine';
    this.octave = options.octave || 0;
    this.midiNote = options.midiNote || 60;
    this.midiChannel = options.midiChannel || 1;

    // Trigger lines for drum sounds (renamed from rings)
    this.triggers = [];
    if (options.triggers) {
      this.triggers = options.triggers.map(t => TriggerLine.deserialize(t));
    } else if (options.rings) {
      // Backwards compatibility: convert old ring radius to angle position
      this.triggers = options.rings.map(r => {
        // Convert radius to approximate angle (rough conversion)
        const angle = r.radius ? Math.asin(Math.min(r.radius / 150, 0.95)) * 0.5 : 0;
        return new TriggerLine({
          ...r,
          position: angle,
          subdivisions: 2
        });
      });
    }

    // State
    this.isPlaying = false;
    this.lastCrossing = 0;
    this.crossingDirection = 0;
  }

  generateColor() {
    const hue = Math.random() * 360;
    return `hsl(${hue}, 70%, 60%)`;
  }

  update(gravity, damping, dt = 1/60) {
    // Simple pendulum equation: θ'' = -(g/L) * sin(θ)
    // Using scaled gravity for pixel-based lengths (makes pendulums swing at reasonable speeds)
    const g = gravity * 1500;
    this.angularAcceleration = (-g / this.length) * Math.sin(this.angle);

    // Apply velocity change
    this.angularVelocity += this.angularAcceleration * dt;

    // Apply damping (scaled to be frame-rate independent)
    const dampingPerFrame = Math.pow(damping, dt * 60);
    this.angularVelocity *= dampingPerFrame;

    this.angle += this.angularVelocity * dt;

    // Calculate bob position
    const bobX = this.pivotX + this.length * Math.sin(this.angle);
    const bobY = this.pivotY + this.length * Math.cos(this.angle);

    // Track trail
    this.trailPoints.push({ x: bobX, y: bobY, age: 0 });
    if (this.trailPoints.length > this.maxTrailLength) {
      this.trailPoints.shift();
    }
    this.trailPoints.forEach(p => p.age++);

    // Detect center crossing for triggering sounds
    const prevCrossing = this.crossingDirection;
    if (this.angle > 0 && this.angularVelocity < 0) {
      this.crossingDirection = -1;
    } else if (this.angle < 0 && this.angularVelocity > 0) {
      this.crossingDirection = 1;
    }

    const crossed = prevCrossing !== 0 && prevCrossing !== this.crossingDirection;

    // Check trigger lines
    const triggeredLines = [];
    for (const trigger of this.triggers) {
      if (trigger.checkCrossing(this.angle, this.angularVelocity)) {
        triggeredLines.push(trigger);
      }
    }

    return {
      bobX,
      bobY,
      velocity: Math.abs(this.angularVelocity),
      amplitude: Math.abs(this.angle),
      crossed,
      crossingVelocity: crossed ? Math.abs(this.angularVelocity) : 0,
      triggeredLines
    };
  }

  addTrigger(options = {}) {
    const trigger = new TriggerLine(options);
    this.triggers.push(trigger);
    return trigger;
  }

  removeTrigger(triggerId) {
    const index = this.triggers.findIndex(t => t.id === triggerId);
    if (index !== -1) {
      this.triggers.splice(index, 1);
      return true;
    }
    return false;
  }

  // Backwards compatibility aliases
  get rings() { return this.triggers; }
  addRing(options) { return this.addTrigger(options); }
  removeRing(id) { return this.removeTrigger(id); }

  getBobPosition() {
    return {
      x: this.pivotX + this.length * Math.sin(this.angle),
      y: this.pivotY + this.length * Math.cos(this.angle)
    };
  }

  getFrequency() {
    // Calculate frequency based on base frequency and octave
    return this.baseFrequency * Math.pow(2, this.octave);
  }

  // Get amplitude-based volume (0-1)
  getVolume() {
    const maxAmplitude = Math.PI / 2;
    return Math.min(Math.abs(this.angularVelocity) / 5, 1);
  }

  // Get position-based pan (-1 to 1)
  getPan() {
    return Math.sin(this.angle);
  }

  reset() {
    this.angularVelocity = 0;
    this.angle = Math.PI / 4;
    this.trailPoints = [];
    this.crossingDirection = 0;
    this.triggers.forEach(t => t.reset());
  }

  randomize() {
    this.angle = (Math.random() - 0.5) * Math.PI;
    this.angularVelocity = (Math.random() - 0.5) * 2;
    this.length = 80 + Math.random() * 200;
    this.baseFrequency = 110 * Math.pow(2, Math.floor(Math.random() * 4));
    this.color = this.generateColor();
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      length: this.length,
      angle: this.angle,
      angularVelocity: this.angularVelocity,
      pivotX: this.pivotX,
      pivotY: this.pivotY,
      bobRadius: this.bobRadius,
      mass: this.mass,
      color: this.color,
      baseFrequency: this.baseFrequency,
      waveform: this.waveform,
      octave: this.octave,
      midiNote: this.midiNote,
      midiChannel: this.midiChannel,
      triggers: this.triggers.map(t => t.serialize())
    };
  }

  static deserialize(data) {
    return new Pendulum(data);
  }
}

// Pendulum manager to handle multiple pendulums
class PendulumSystem {
  constructor() {
    this.pendulums = [];
    this.gravity = 1.0;
    this.damping = 0.999;
    this.isRunning = false;
  }

  add(options = {}) {
    const pendulum = new Pendulum(options);
    this.pendulums.push(pendulum);
    return pendulum;
  }

  remove(id) {
    const index = this.pendulums.findIndex(p => p.id === id);
    if (index !== -1) {
      this.pendulums.splice(index, 1);
      return true;
    }
    return false;
  }

  get(id) {
    return this.pendulums.find(p => p.id === id);
  }

  update() {
    const results = [];
    for (const pendulum of this.pendulums) {
      const result = pendulum.update(this.gravity, this.damping);
      results.push({ pendulum, ...result });
    }
    return results;
  }

  reset() {
    this.pendulums.forEach(p => p.reset());
  }

  randomize() {
    this.pendulums.forEach(p => p.randomize());
  }

  distributePositions(canvasWidth, canvasHeight) {
    const count = this.pendulums.length;
    if (count === 0) return;

    const margin = 100;
    const usableWidth = canvasWidth - margin * 2;
    const spacing = usableWidth / (count + 1);

    this.pendulums.forEach((p, i) => {
      p.pivotX = margin + spacing * (i + 1);
      p.pivotY = 80;
    });
  }

  serialize() {
    return {
      gravity: this.gravity,
      damping: this.damping,
      pendulums: this.pendulums.map(p => p.serialize())
    };
  }

  deserialize(data) {
    this.gravity = data.gravity || 1.0;
    this.damping = data.damping || 0.999;
    this.pendulums = data.pendulums.map(p => Pendulum.deserialize(p));
  }

  clear() {
    this.pendulums = [];
  }
}
