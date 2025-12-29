# Harmonic Pendulum

An experimental physics-based synthesizer that transforms pendulum motion into sound. Each virtual pendulum generates tones based on its swing, creating polyrhythmic patterns and evolving soundscapes.

## Concept

The instrument simulates multiple pendulums swinging at different rates. As each pendulum crosses its center point, it triggers a sound. Because pendulums with different lengths swing at different frequencies, complex polyrhythmic patterns emerge naturally from the physics.

## Features

- **Physics-Based Sound Generation**: Pendulum motion directly controls synthesis parameters
- **Web Audio Synthesis**: Real-time oscillator-based sound with filtering and reverb
- **MIDI Output**: Send notes to external synthesizers and DAWs
- **Visual Feedback**: Animated canvas rendering with trails and glow effects
- **Save/Load State**: Export and import your pendulum configurations
- **Presets**: Quick-start configurations for different musical styles

## Installation

```bash
# Clone or download this repository
cd harmonic-pendulum

# Install dependencies
npm install

# Run the application
npm start
```

## Usage

### Basic Controls

- **Play/Stop**: Start or stop the simulation
- **Gravity**: Affects swing speed (higher = faster swings)
- **Damping**: Controls how quickly pendulums lose energy (1.0 = no loss)
- **Master Volume**: Overall audio output level

### Pendulum Controls

Each pendulum has individual parameters:
- **Frequency**: Base pitch of the generated tone
- **Octave**: Shift pitch up or down by octaves
- **Waveform**: Oscillator type (sine, triangle, sawtooth, square)
- **Length**: Pendulum arm length (affects swing period)
- **MIDI Channel**: Which MIDI channel to send notes on

### Adding Pendulums

- Click the **+ Add** button to add a new pendulum
- **Shift+Click** on the canvas to add a pendulum at a specific position

### Presets

- **Minimal**: Two pendulums in simple harmony
- **Chaos**: Six randomly configured pendulums
- **Harmony**: Five pendulums tuned to harmonic intervals
- **Polyrhythm**: Five pendulums with lengths creating complex rhythmic ratios

### MIDI Output

1. Select a MIDI output device from the dropdown
2. Enable the MIDI checkbox
3. Each pendulum will send notes on its configured channel when crossing center

### Saving Your Work

- **Cmd/Ctrl+S**: Save state to a JSON file
- **Cmd/Ctrl+O**: Load a previously saved state

## Technical Details

- Built with Electron for cross-platform desktop support
- Web Audio API for real-time synthesis
- Web MIDI API for external instrument control
- Canvas 2D for 60fps visualization
- Simple pendulum physics simulation

## Tips for Experimentation

1. Start with the **Polyrhythm** preset to hear how different pendulum lengths create evolving patterns
2. Try high damping (0.999+) for sustained drones, lower damping for rhythmic patterns
3. Use different waveforms on each pendulum for timbral variety
4. Route MIDI to a DAW with different instruments on each channel
5. Experiment with gravity to speed up or slow down the overall tempo

## License

MIT
