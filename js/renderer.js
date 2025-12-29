/**
 * Canvas Renderer
 * Draws pendulums with trails and visual effects
 */

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.resize();

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  clear() {
    this.ctx.fillStyle = 'rgba(15, 15, 26, 0.15)';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  clearFull() {
    this.ctx.fillStyle = '#0f0f1a';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawGrid() {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    this.ctx.lineWidth = 1;

    const gridSize = 50;

    for (let x = 0; x < this.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }

    for (let y = 0; y < this.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }
  }

  drawTriggers(pendulum) {
    const ctx = this.ctx;

    for (const trigger of pendulum.triggers) {
      if (!trigger.enabled) continue;

      // Get drum color from DRUM_TYPES if available
      let triggerColor = '#e94560';
      if (typeof DRUM_TYPES !== 'undefined') {
        const drumType = DRUM_TYPES.find(d => d.id === trigger.drumType);
        if (drumType) triggerColor = drumType.color;
      }

      // Calculate line X position based on trigger angle position
      const lineX = trigger.getXPosition(pendulum.pivotX, pendulum.length);

      // Draw vertical trigger line from pivot down past the pendulum's reach
      const lineTop = pendulum.pivotY;
      const lineBottom = pendulum.pivotY + pendulum.length + 40;

      ctx.beginPath();
      ctx.strokeStyle = trigger.triggered
        ? triggerColor
        : this.adjustAlpha(triggerColor, 0.4);
      ctx.lineWidth = trigger.triggered ? 3 : 1;

      // Draw dashed line if single direction, solid if both
      if (trigger.subdivisions < 2) {
        ctx.setLineDash([4, 4]);
      }

      ctx.moveTo(lineX, lineTop);
      ctx.lineTo(lineX, lineBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw trigger flash when triggered
      if (trigger.triggered) {
        // Flash along the entire line
        const flashGradient = ctx.createLinearGradient(lineX - 20, 0, lineX + 20, 0);
        flashGradient.addColorStop(0, 'transparent');
        flashGradient.addColorStop(0.5, this.adjustAlpha(triggerColor, 0.6));
        flashGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = flashGradient;
        ctx.fillRect(lineX - 20, lineTop, 40, lineBottom - lineTop);
      }

      // Label at the bottom
      ctx.font = '10px monospace';
      ctx.fillStyle = this.adjustAlpha(triggerColor, 0.8);
      ctx.textAlign = 'center';
      ctx.fillText(trigger.drumType, lineX, lineBottom + 12);

      // Show subdivision indicator
      if (trigger.subdivisions >= 2) {
        ctx.fillText('↔', lineX, lineBottom + 24);
      }
    }
  }

  // Backwards compatibility alias
  drawRings(pendulum) {
    this.drawTriggers(pendulum);
  }

  drawPendulum(pendulum, updateResult) {
    const ctx = this.ctx;
    const { bobX, bobY, velocity } = updateResult;

    // Draw trail
    if (pendulum.trailPoints.length > 1) {
      ctx.beginPath();
      ctx.moveTo(pendulum.trailPoints[0].x, pendulum.trailPoints[0].y);

      for (let i = 1; i < pendulum.trailPoints.length; i++) {
        const point = pendulum.trailPoints[i];
        const alpha = 1 - (point.age / pendulum.maxTrailLength);
        ctx.strokeStyle = this.adjustAlpha(pendulum.color, alpha * 0.5);
        ctx.lineWidth = 2;
        ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    }

    // Draw arm
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.moveTo(pendulum.pivotX, pendulum.pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();

    // Draw pivot
    ctx.beginPath();
    ctx.fillStyle = '#444';
    ctx.arc(pendulum.pivotX, pendulum.pivotY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Draw bob glow
    const glowSize = pendulum.bobRadius + velocity * 20;
    const gradient = ctx.createRadialGradient(
      bobX, bobY, 0,
      bobX, bobY, glowSize
    );
    gradient.addColorStop(0, this.adjustAlpha(pendulum.color, 0.6));
    gradient.addColorStop(0.5, this.adjustAlpha(pendulum.color, 0.2));
    gradient.addColorStop(1, 'transparent');

    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(bobX, bobY, glowSize, 0, Math.PI * 2);
    ctx.fill();

    // Draw bob
    ctx.beginPath();
    ctx.fillStyle = pendulum.color;
    ctx.shadowColor = pendulum.color;
    ctx.shadowBlur = 15;
    ctx.arc(bobX, bobY, pendulum.bobRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw highlight
    ctx.beginPath();
    const highlightGradient = ctx.createRadialGradient(
      bobX - pendulum.bobRadius * 0.3,
      bobY - pendulum.bobRadius * 0.3,
      0,
      bobX,
      bobY,
      pendulum.bobRadius
    );
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    highlightGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = highlightGradient;
    ctx.arc(bobX, bobY, pendulum.bobRadius, 0, Math.PI * 2);
    ctx.fill();

    // Flash on crossing
    if (updateResult.crossed) {
      ctx.beginPath();
      const flashGradient = ctx.createRadialGradient(
        bobX, bobY, 0,
        bobX, bobY, pendulum.bobRadius * 3
      );
      flashGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      flashGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = flashGradient;
      ctx.arc(bobX, bobY, pendulum.bobRadius * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCenterLine() {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(233, 69, 96, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 10]);
    ctx.moveTo(this.width / 2, 0);
    ctx.lineTo(this.width / 2, this.height);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawInfo(pendulum, updateResult) {
    const ctx = this.ctx;
    const { bobX, bobY } = updateResult;

    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'center';

    const freq = pendulum.getFrequency().toFixed(1);
    ctx.fillText(`${freq} Hz`, bobX, bobY + pendulum.bobRadius + 20);
  }

  adjustAlpha(color, alpha) {
    // Handle HSL colors
    if (color.startsWith('hsl')) {
      return color.replace('hsl', 'hsla').replace(')', `, ${alpha})`);
    }
    // Handle hex colors
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }

  getWidth() {
    return this.width;
  }

  getHeight() {
    return this.height;
  }
}
