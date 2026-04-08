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
const DECAY_TAU = 0.3; // time constant for exponential decay

/**
 * Play a guitar-like plucked note.
 * @param semitone  0–11 (C=0, matches music-data.ts NOTES[].num)
 * @param octave    e.g. 3 or 4
 */
/** Bare-minimum test: single oscillator → destination. No filter, no gain. */
export function playTestTone(): void {
  const ac = ensureCtx();
  if (ac.state !== 'running') ac.resume();
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 440;
  osc.connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.5);
  // deno-lint-ignore no-console
  console.log(`[sound] TEST TONE 440Hz state=${ac.state} t=${ac.currentTime}`);
  osc.onended = () => {
    // deno-lint-ignore no-console
    console.log('[sound] TEST TONE ended');
    osc.disconnect();
  };
}

export function playNote(semitone: number, octave: number): void {
  const ac = ensureCtx();
  const stateBefore = ac.state;

  // Resume synchronously within user gesture — don't chain with .then()
  // because Safari drops the gesture context across microtasks.
  // Audio scheduled while suspended plays once resume completes.
  if (ac.state !== 'running') ac.resume();

  const now = ac.currentTime;
  const f0 = freq(semitone, octave);

  // deno-lint-ignore no-console
  console.log(
    `[sound] note=${semitone} oct=${octave} f0=${f0.toFixed(1)}Hz` +
      ` state=${stateBefore}→${ac.state} t=${now.toFixed(3)}` +
      ` sampleRate=${ac.sampleRate} dest=${ac.destination.channelCount}ch`,
  );

  // Brightness sweep: lowpass filter starts bright, decays quickly.
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(4000, now);
  filter.frequency.exponentialRampToValueAtTime(800, now + 0.1);

  // Pluck envelope: sharp attack, exponential decay.
  // Use setTargetAtTime (exponential approach) — more reliable across
  // browsers than exponentialRampToValueAtTime which has Safari issues.
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.5, now);
  gain.gain.setTargetAtTime(0, now, DECAY_TAU);

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
    // deno-lint-ignore no-console
    console.log(`[sound] ended note=${semitone} oct=${octave}`);
    for (const o of oscs) o.disconnect();
    for (const h of hGains) h.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}
