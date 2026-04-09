// Web Audio API note synthesis — guitar-like plucked string sound.
//
// iOS Safari audio gotchas (hard-won, April 2026):
//
// 1. SILENT MODE KILLS WEB AUDIO. iOS routes Web Audio API output through
//    the "ringer" channel. When Silent Mode is on (Action Button, Control
//    Center, or the old hardware switch), the ringer channel is muted —
//    so Web Audio produces no audible output even though AudioContext
//    reports state="running" and oscillators fire their onended callbacks.
//    WebKit bug: https://bugs.webkit.org/show_bug.cgi?id=237322
//
//    Fix: play a looping silent HTML <audio> element. HTML audio uses the
//    "media" channel, which ignores Silent Mode. Playing it forces iOS to
//    route all audio (including Web Audio) through the media channel.
//    Technique: https://github.com/feross/unmute-ios-audio
//
// 2. THE SILENT AUDIO FILE MUST BE SUBSTANTIAL. A 1-sample WAV (44 bytes)
//    is not enough — iOS ignores it. A ~0.5 s WAV at 8 kHz (~8 KB) works.
//    We generate it procedurally to avoid shipping a static asset.
//
// 3. AudioContext STARTS SUSPENDED on mobile Safari. Calling resume()
//    returns a promise. Scheduling audio in .then(play) works on desktop
//    but can lose the user-gesture context on iOS. However, scheduling
//    audio *before* the context finishes resuming (at currentTime=0) also
//    works — the nodes fire once the context actually resumes.
//
// 4. exponentialRampToValueAtTime works on Safari for gain envelopes.
//    setTargetAtTime(0, now, tau) does NOT — it produces silence on both
//    desktop and mobile Safari (reason unclear, possibly a WebKit bug with
//    target=0 at the same time as setValueAtTime).

let ctx: AudioContext | null = null;

// ---------------------------------------------------------------------------
// iOS audio unlock — plays a silent HTML <audio> element on first user
// interaction to switch iOS from "ringer" to "media" audio channel.
// ---------------------------------------------------------------------------

let iosUnlocked = false;

/** Build a silent WAV data URI (~0.5 s at 8 kHz, 16-bit mono = ~8 KB). */
function makeSilentWav(): string {
  const sampleRate = 8000;
  const seconds = 0.5;
  const numSamples = sampleRate * seconds;
  const dataBytes = numSamples * 2; // 16-bit = 2 bytes per sample
  const headerSize = 44;
  const buf = new ArrayBuffer(headerSize + dataBytes);
  const view = new DataView(buf);

  function writeStr(offset: number, s: string) {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
  }

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);
  // Samples are all zero (silence) — ArrayBuffer is zero-initialized.

  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

function unlockiOSAudio(): void {
  if (iosUnlocked) return;
  iosUnlocked = true;

  // Play a looping silent audio track via HTML <audio>.
  // This forces iOS to route audio through the "media" channel instead of
  // the "ringer" channel, bypassing Silent Mode.
  const audio = document.createElement('audio');
  audio.controls = false;
  audio.preload = 'auto';
  audio.loop = true;
  audio.src = makeSilentWav();
  audio.play().catch(() => {});

  // Also play a silent buffer through Web Audio to fully initialize it.
  if (ctx) {
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  }
}

// ---------------------------------------------------------------------------
// AudioContext management
// ---------------------------------------------------------------------------

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
  unlockiOSAudio();

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
