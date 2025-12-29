# Development Notes

## Project: Harmonic Pendulum

### Initial Concept (v1.0)

The idea was to create an instrument that generates sound through physics simulation rather than traditional sequencing. Pendulums naturally create polyrhythmic patterns because their period is proportional to the square root of their length.

### Architecture Decisions

1. **Modular JavaScript Structure**
   - `pendulum.js`: Physics simulation and state management
   - `audio.js`: Web Audio synthesis and effects
   - `midi.js`: MIDI output handling
   - `renderer.js`: Canvas visualization
   - `app.js`: Main application logic connecting all modules

2. **Simple Pendulum Physics**
   - Using the equation: θ'' = -(g/L) * sin(θ)
   - Added damping coefficient for energy loss
   - Configurable gravity for tempo control

3. **Sound Design**
   - Center crossing triggers notes (like striking a percussion instrument)
   - Velocity controls volume and filter cutoff
   - Position controls stereo panning
   - Reverb adds spatial depth

### Features Implemented

- [x] Pendulum physics simulation
- [x] Web Audio synthesis with multiple waveforms
- [x] Dynamic filter based on pendulum velocity
- [x] Stereo panning based on pendulum position
- [x] MIDI output support
- [x] Visual trails and glow effects
- [x] Save/load state as JSON
- [x] Preset configurations
- [x] Per-pendulum parameter controls

### Potential Future Enhancements

- Coupled pendulums (pendulums affecting each other)
- Audio input for reactive mode
- More synthesis options (FM, granular)
- Recording/export audio
- Pattern quantization mode
- Custom scales/tunings
- Multi-window support for separate control and visualization

### Known Issues / To Test

- MIDI timing may drift slightly from physics
- High pendulum counts may affect performance
- Audio context may need user gesture to start on some browsers

---

*Last updated: Initial release*
