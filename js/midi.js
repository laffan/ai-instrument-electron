/**
 * MIDI Output Handler
 * Sends MIDI notes when pendulums cross center
 */

class MIDIHandler {
  constructor() {
    this.midiAccess = null;
    this.selectedOutput = null;
    this.isEnabled = false;
    this.outputs = [];
    this.activeNotes = new Map(); // Track active notes per pendulum
  }

  async init() {
    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API not supported');
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.refreshOutputs();

      // Listen for device changes
      this.midiAccess.onstatechange = () => {
        this.refreshOutputs();
      };

      return true;
    } catch (err) {
      console.error('MIDI access denied:', err);
      return false;
    }
  }

  refreshOutputs() {
    this.outputs = [];
    if (this.midiAccess) {
      this.midiAccess.outputs.forEach((output) => {
        this.outputs.push({
          id: output.id,
          name: output.name,
          output: output
        });
      });
    }
    return this.outputs;
  }

  selectOutput(outputId) {
    const found = this.outputs.find(o => o.id === outputId);
    if (found) {
      this.selectedOutput = found.output;
      return true;
    }
    this.selectedOutput = null;
    return false;
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.allNotesOff();
    }
  }

  // Convert frequency to MIDI note number
  frequencyToMidi(frequency) {
    return Math.round(12 * Math.log2(frequency / 440) + 69);
  }

  // Send MIDI note based on pendulum state
  triggerNote(pendulum, velocity) {
    if (!this.isEnabled || !this.selectedOutput) return;

    const channel = Math.max(0, Math.min(15, pendulum.midiChannel - 1));
    const note = this.frequencyToMidi(pendulum.getFrequency());
    const vel = Math.max(1, Math.min(127, Math.floor(velocity * 127)));

    // Note off for any previous note
    this.noteOff(pendulum.id, channel);

    // Note on
    const noteOnMessage = [0x90 | channel, note, vel];
    this.selectedOutput.send(noteOnMessage);

    // Store active note
    this.activeNotes.set(pendulum.id, { channel, note });

    // Schedule note off
    setTimeout(() => {
      this.noteOff(pendulum.id, channel);
    }, 200);
  }

  noteOff(pendulumId, channel) {
    if (!this.selectedOutput) return;

    const active = this.activeNotes.get(pendulumId);
    if (active) {
      const noteOffMessage = [0x80 | active.channel, active.note, 0];
      this.selectedOutput.send(noteOffMessage);
      this.activeNotes.delete(pendulumId);
    }
  }

  // Send control change
  sendCC(channel, cc, value) {
    if (!this.isEnabled || !this.selectedOutput) return;

    const ccMessage = [0xB0 | (channel - 1), cc, Math.floor(value * 127)];
    this.selectedOutput.send(ccMessage);
  }

  // All notes off on all channels
  allNotesOff() {
    if (!this.selectedOutput) return;

    for (let channel = 0; channel < 16; channel++) {
      // All notes off (CC 123)
      this.selectedOutput.send([0xB0 | channel, 123, 0]);
    }
    this.activeNotes.clear();
  }

  cleanup() {
    this.allNotesOff();
    this.selectedOutput = null;
  }
}
