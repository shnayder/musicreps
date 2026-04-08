// Web Audio API note synthesis — guitar-like plucked string sound.
// Lazy AudioContext creation satisfies iOS autoplay policy.

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** Convert semitone (0=C, 9=A) + octave to frequency in Hz. */
function freq(semitone: number, octave: number): number {
  // MIDI note: C4 = 60, A4 = 69 → 440 Hz
  const midi = 12 * (octave + 1) + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Harmonic amplitudes relative to fundamental (triangle-ish pluck).
const HARMONICS = [1, 0.4, 0.15, 0.06];
const NOTE_DURATION = 1.5;

/**
 * Play a guitar-like plucked note.
 * @param semitone  0–11 (C=0, matches music-data.ts NOTES[].num)
 * @param octave    e.g. 3 or 4
 */
export function playNote(semitone: number, octave: number): void {
  const ac = ensureCtx();

  // Resume returns a promise — schedule audio only after it resolves.
  // On non-suspended contexts this resolves immediately.
  const play = () => {
    const now = ac.currentTime;
    const f0 = freq(semitone, octave);

    // Brightness sweep: lowpass filter starts bright, decays quickly.
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.1);

    // Pluck envelope: sharp attack, exponential decay.
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    filter.connect(gain);
    gain.connect(ac.destination);

    // Stack harmonics for a richer tone.
    const oscs: OscillatorNode[] = [];
    const hGains: GainNode[] = [];
    for (let i = 0; i < HARMONICS.length; i++) {
      const osc = ac.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.value = f0 * (i + 1);

      const hGain = ac.createGain();
      hGain.gain.value = HARMONICS[i];
      osc.connect(hGain);
      hGain.connect(filter);

      osc.start(now);
      osc.stop(now + NOTE_DURATION);
      oscs.push(osc);
      hGains.push(hGain);
    }

    // Disconnect nodes after playback to avoid leaking audio graph nodes.
    oscs[oscs.length - 1].onended = () => {
      for (const o of oscs) o.disconnect();
      for (const h of hGains) h.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  };

  if (ac.state === 'suspended') {
    ac.resume().then(play).catch(() => {});
  } else {
    play();
  }
}
