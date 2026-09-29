// ── BUILT-IN SOUND LIBRARY ──────────────────────────────────
// Programmatic sound generation using Web Audio API.
// All sounds are 100% original — no external audio files needed.
// Works offline, no downloads, no licensing issues.

const SAMPLE_RATE = 44100;

// ── WAV ENCODER ─────────────────────────────────────────────

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);          // chunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s * 0x7FFF, true);
  }

  return buffer;
}

// ── SOUND GENERATOR ─────────────────────────────────────────

async function renderSound(
  duration: number,
  setup: (ctx: OfflineAudioContext) => void,
): Promise<string> {
  const length = Math.ceil(SAMPLE_RATE * duration);
  const ctx = new OfflineAudioContext(1, length, SAMPLE_RATE);
  setup(ctx);
  const buffer = await ctx.startRendering();
  const samples = buffer.getChannelData(0);
  const wav = encodeWav(samples, SAMPLE_RATE);
  const blob = new Blob([wav], { type: 'audio/wav' });

  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

// Helper: schedule a sine tone
function sine(
  ctx: OfflineAudioContext,
  freq: number,
  start: number,
  dur: number,
  gain = 0.5,
  decay?: number,
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, start);
  if (decay !== undefined) {
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  }
  osc.connect(g).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur);
}

// Helper: schedule a square wave
function square(
  ctx: OfflineAudioContext,
  freq: number,
  start: number,
  dur: number,
  gain = 0.3,
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur);
}

// Helper: schedule a sawtooth wave
function sawtooth(
  ctx: OfflineAudioContext,
  freq: number,
  start: number,
  dur: number,
  gain = 0.3,
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur);
}

// Helper: noise burst
function noise(
  ctx: OfflineAudioContext,
  start: number,
  dur: number,
  gain = 0.3,
) {
  const sr = ctx.sampleRate;
  const len = Math.ceil(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  src.connect(g).connect(ctx.destination);
  src.start(start);
  src.stop(start + dur);
}

// Helper: frequency sweep
function sweep(
  ctx: OfflineAudioContext,
  freqStart: number,
  freqEnd: number,
  start: number,
  dur: number,
  gain = 0.3,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, start);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, start + dur);
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur);
}

// ── SOUND DEFINITIONS ───────────────────────────────────────

interface SoundDef {
  id: string;
  name: string;
  category: string;
  tags: string[];
  generate: () => Promise<string>;
}

const SOUNDS: SoundDef[] = [
  // ── MEMES ──
  {
    id: 'builtin-airhorn',
    name: 'Airhorn',
    category: 'memes',
    tags: ['horn', 'loud', 'alert', 'streamer'],
    generate: () => renderSound(1.5, (ctx) => {
      const t = 0;
      // Layer multiple square waves for the classic airhorn timbre
      square(ctx, 520, t, 1.5, 0.25);
      square(ctx, 780, t, 1.5, 0.15);
      square(ctx, 1040, t, 1.5, 0.1);
      square(ctx, 1560, t, 1.2, 0.06);
      // Slight vibrato
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.linearRampToValueAtTime(540, t + 0.3);
      osc.frequency.linearRampToValueAtTime(500, t + 0.6);
      osc.frequency.linearRampToValueAtTime(540, t + 0.9);
      osc.frequency.linearRampToValueAtTime(520, t + 1.2);
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.5);
    }),
  },
  {
    id: 'builtin-bruh',
    name: 'Bruh',
    category: 'memes',
    tags: ['funny', 'fail', 'disappointed'],
    generate: () => renderSound(0.8, (ctx) => {
      // Low descending tone
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(280, 0);
      osc.frequency.linearRampToValueAtTime(180, 0.15);
      osc.frequency.linearRampToValueAtTime(140, 0.4);
      osc.frequency.linearRampToValueAtTime(100, 0.8);
      g.gain.setValueAtTime(0.35, 0);
      g.gain.exponentialRampToValueAtTime(0.001, 0.8);
      osc.connect(g).connect(ctx.destination);
      osc.start(0);
      osc.stop(0.8);
    }),
  },
  {
    id: 'builtin-vine-boom',
    name: 'Vine Boom',
    category: 'memes',
    tags: ['dramatic', 'bass', 'thud', 'impact'],
    generate: () => renderSound(1.0, (ctx) => {
      // Deep bass hit
      sine(ctx, 60, 0, 1.0, 0.7, true);
      sine(ctx, 45, 0, 0.8, 0.5, true);
      // Initial impact noise
      noise(ctx, 0, 0.15, 0.4);
    }),
  },
  {
    id: 'builtin-sad-trombone',
    name: 'Sad Trombone',
    category: 'memes',
    tags: ['wah', 'fail', 'disappointment', 'sad'],
    generate: () => renderSound(1.6, (ctx) => {
      // Descending "wah wah wah waaaah"
      sawtooth(ctx, 330, 0, 0.35, 0.2);
      sawtooth(ctx, 311, 0.35, 0.35, 0.2);
      sawtooth(ctx, 294, 0.7, 0.35, 0.2);
      sawtooth(ctx, 262, 1.05, 0.55, 0.25);
    }),
  },
  {
    id: 'builtin-rimshot',
    name: 'Rimshot',
    category: 'memes',
    tags: ['ba dum tss', 'drum', 'comedy', 'joke'],
    generate: () => renderSound(0.8, (ctx) => {
      // "ba dum tss" — two hits + cymbal
      noise(ctx, 0, 0.08, 0.5);
      sine(ctx, 150, 0, 0.08, 0.4, true);
      noise(ctx, 0.15, 0.08, 0.5);
      sine(ctx, 130, 0.15, 0.08, 0.4, true);
      // Cymbal (filtered noise)
      noise(ctx, 0.3, 0.5, 0.35);
    }),
  },

  // ── GAMING ──
  {
    id: 'builtin-level-up',
    name: 'Level Up',
    category: 'gaming',
    tags: ['upgrade', 'advance', 'progress', 'fanfare'],
    generate: () => renderSound(1.2, (ctx) => {
      // Ascending arpeggio: C5 E5 G5 C6
      sine(ctx, 523, 0, 0.2, 0.4, true);
      sine(ctx, 659, 0.15, 0.2, 0.4, true);
      sine(ctx, 784, 0.3, 0.2, 0.4, true);
      sine(ctx, 1047, 0.45, 0.4, 0.5, true);
      // Shimmer on top
      sine(ctx, 1568, 0.45, 0.4, 0.15, true);
    }),
  },
  {
    id: 'builtin-power-up',
    name: 'Power Up',
    category: 'gaming',
    tags: ['boost', 'energy', 'charge'],
    generate: () => renderSound(0.8, (ctx) => {
      // Rising frequency sweep
      sweep(ctx, 200, 2000, 0, 0.8, 0.35, 'square');
      // Subtle harmony sweep
      sweep(ctx, 300, 3000, 0.05, 0.75, 0.1, 'sine');
    }),
  },
  {
    id: 'builtin-game-over',
    name: 'Game Over',
    category: 'gaming',
    tags: ['lose', 'death', 'end', 'defeat'],
    generate: () => renderSound(1.2, (ctx) => {
      // Descending minor scale
      sine(ctx, 440, 0, 0.25, 0.35, true);
      sine(ctx, 392, 0.2, 0.25, 0.35, true);
      sine(ctx, 349, 0.4, 0.25, 0.35, true);
      sine(ctx, 330, 0.6, 0.25, 0.35, true);
      sine(ctx, 262, 0.8, 0.4, 0.4, true);
    }),
  },
  {
    id: 'builtin-coins',
    name: 'Coins',
    category: 'gaming',
    tags: ['money', 'collect', 'ding', 'reward', 'coins'],
    generate: () => renderSound(0.6, (ctx) => {
      // Quick high-pitched dings
      sine(ctx, 1318, 0, 0.15, 0.4, true);
      sine(ctx, 1568, 0.1, 0.15, 0.4, true);
      sine(ctx, 2093, 0.2, 0.25, 0.35, true);
    }),
  },
  {
    id: 'builtin-achievement',
    name: 'Achievement',
    category: 'gaming',
    tags: ['unlock', 'badge', 'complete', 'trophy'],
    generate: () => renderSound(1.0, (ctx) => {
      // Major chord arpeggio: C4 E4 G4 C5
      sine(ctx, 262, 0, 0.15, 0.3, true);
      sine(ctx, 330, 0.12, 0.15, 0.3, true);
      sine(ctx, 392, 0.24, 0.15, 0.3, true);
      sine(ctx, 523, 0.36, 0.3, 0.4, true);
      // Hold the final chord
      sine(ctx, 262, 0.36, 0.3, 0.15, true);
      sine(ctx, 330, 0.36, 0.3, 0.15, true);
      sine(ctx, 392, 0.36, 0.3, 0.15, true);
    }),
  },

  // ── REACTIONS ──
  {
    id: 'builtin-laugh',
    name: 'Laugh',
    category: 'reactions',
    tags: ['haha', 'funny', 'comedy', 'lol'],
    generate: () => renderSound(0.6, (ctx) => {
      // Rapid modulated tone
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 400;
      lfo.type = 'sine';
      lfo.frequency.value = 12;
      lfoGain.gain.value = 80;
      lfo.connect(lfoGain).connect(osc.frequency);
      g.gain.setValueAtTime(0.35, 0);
      g.gain.exponentialRampToValueAtTime(0.001, 0.6);
      osc.connect(g).connect(ctx.destination);
      osc.start(0);
      lfo.start(0);
      osc.stop(0.6);
      lfo.stop(0.6);
    }),
  },
  {
    id: 'builtin-applause',
    name: 'Applause',
    category: 'reactions',
    tags: ['clap', 'cheer', 'celebrate', 'bravo'],
    generate: () => renderSound(1.5, (ctx) => {
      // Filtered noise burst to simulate crowd applause
      noise(ctx, 0, 1.5, 0.4);
      noise(ctx, 0.1, 1.4, 0.25);
      noise(ctx, 0.2, 1.3, 0.15);
    }),
  },
  {
    id: 'builtin-boo',
    name: 'Boo',
    category: 'reactions',
    tags: ['boo', 'disapprove', 'negative', 'heckle'],
    generate: () => renderSound(0.8, (ctx) => {
      // Low descending tone
      sweep(ctx, 300, 120, 0, 0.8, 0.35, 'sawtooth');
    }),
  },
  {
    id: 'builtin-wow',
    name: 'Wow',
    category: 'reactions',
    tags: ['amazing', 'surprise', 'impressed', 'ooh'],
    generate: () => renderSound(0.6, (ctx) => {
      // Ascending then slight descent
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, 0);
      osc.frequency.linearRampToValueAtTime(700, 0.25);
      osc.frequency.linearRampToValueAtTime(600, 0.6);
      g.gain.setValueAtTime(0.35, 0);
      g.gain.exponentialRampToValueAtTime(0.001, 0.6);
      osc.connect(g).connect(ctx.destination);
      osc.start(0);
      osc.stop(0.6);
    }),
  },
  {
    id: 'builtin-crickets',
    name: 'Crickets',
    category: 'reactions',
    tags: ['awkward', 'silence', 'nothing', 'quiet'],
    generate: () => renderSound(1.2, (ctx) => {
      // High-pitched repeated chirps
      for (let i = 0; i < 6; i++) {
        const t = i * 0.2;
        sine(ctx, 4200, t, 0.08, 0.15, true);
        sine(ctx, 5600, t + 0.02, 0.06, 0.1, true);
      }
    }),
  },

  // ── EFFECTS ──
  {
    id: 'builtin-whoosh',
    name: 'Whoosh',
    category: 'effects',
    tags: ['swoosh', 'transition', 'fast', 'wind'],
    generate: () => renderSound(0.5, (ctx) => {
      // Filtered noise sweep
      noise(ctx, 0, 0.5, 0.4);
      // Add a subtle sine sweep for body
      sweep(ctx, 200, 800, 0.05, 0.4, 0.15, 'sine');
    }),
  },
  {
    id: 'builtin-impact',
    name: 'Impact',
    category: 'effects',
    tags: ['hit', 'thud', 'punch', 'collision'],
    generate: () => renderSound(0.6, (ctx) => {
      // Deep thud
      sine(ctx, 80, 0, 0.5, 0.6, true);
      sine(ctx, 50, 0, 0.3, 0.4, true);
      // Impact noise
      noise(ctx, 0, 0.1, 0.5);
    }),
  },
  {
    id: 'builtin-laser',
    name: 'Laser',
    category: 'effects',
    tags: ['pew', 'shoot', 'sci-fi', 'blaster'],
    generate: () => renderSound(0.4, (ctx) => {
      // Descending sweep (pew!)
      sweep(ctx, 2000, 200, 0, 0.4, 0.35, 'sawtooth');
      // Subtle octave layer
      sweep(ctx, 4000, 400, 0.02, 0.35, 0.1, 'square');
    }),
  },
  {
    id: 'builtin-explosion',
    name: 'Explosion',
    category: 'effects',
    tags: ['boom', 'blast', 'destroy', 'bomb'],
    generate: () => renderSound(1.0, (ctx) => {
      // Heavy noise with decay
      noise(ctx, 0, 1.0, 0.5);
      noise(ctx, 0.05, 0.9, 0.3);
      // Deep sub-bass
      sine(ctx, 40, 0, 0.8, 0.6, true);
      sine(ctx, 30, 0.05, 0.6, 0.4, true);
    }),
  },
  {
    id: 'builtin-glitch',
    name: 'Glitch',
    category: 'effects',
    tags: ['error', 'digital', 'malfunction', 'static'],
    generate: () => renderSound(0.4, (ctx) => {
      // Rapid random tones
      for (let i = 0; i < 8; i++) {
        const t = i * 0.05;
        const freq = 200 + Math.random() * 2000;
        square(ctx, freq, t, 0.04, 0.15);
      }
      noise(ctx, 0, 0.4, 0.15);
    }),
  },

  // ── NOTIFICATIONS ──
  {
    id: 'builtin-ding',
    name: 'Ding',
    category: 'notifications',
    tags: ['bell', 'chime', 'notify', 'new'],
    generate: () => renderSound(0.5, (ctx) => {
      // Single clear tone
      sine(ctx, 880, 0, 0.4, 0.4, true);
      sine(ctx, 1760, 0, 0.3, 0.15, true);
    }),
  },
  {
    id: 'builtin-chord',
    name: 'Chord',
    category: 'notifications',
    tags: ['pleasant', 'harmony', 'major', 'tonal'],
    generate: () => renderSound(0.8, (ctx) => {
      // C major chord: C4 E4 G4
      sine(ctx, 262, 0, 0.7, 0.25, true);
      sine(ctx, 330, 0, 0.7, 0.25, true);
      sine(ctx, 392, 0, 0.7, 0.25, true);
    }),
  },
  {
    id: 'builtin-alert',
    name: 'Alert',
    category: 'notifications',
    tags: ['urgent', 'warning', 'attention', 'beep'],
    generate: () => renderSound(0.6, (ctx) => {
      // Double beep
      sine(ctx, 880, 0, 0.15, 0.35, true);
      sine(ctx, 880, 0.2, 0.15, 0.35, true);
      sine(ctx, 1100, 0.4, 0.15, 0.3, true);
    }),
  },
  {
    id: 'builtin-success',
    name: 'Success',
    category: 'notifications',
    tags: ['correct', 'done', 'complete', 'yes', 'ok'],
    generate: () => renderSound(0.6, (ctx) => {
      // Ascending major: C5 E5 G5
      sine(ctx, 523, 0, 0.18, 0.35, true);
      sine(ctx, 659, 0.12, 0.18, 0.35, true);
      sine(ctx, 784, 0.24, 0.3, 0.4, true);
    }),
  },
  {
    id: 'builtin-error',
    name: 'Error',
    category: 'notifications',
    tags: ['wrong', 'fail', 'incorrect', 'buzz'],
    generate: () => renderSound(0.6, (ctx) => {
      // Descending minor: E5 C5 A4
      sine(ctx, 659, 0, 0.18, 0.35, true);
      sine(ctx, 523, 0.12, 0.18, 0.35, true);
      sine(ctx, 440, 0.24, 0.3, 0.4, true);
    }),
  },
];

// ── PUBLIC API ──────────────────────────────────────────────

export interface BuiltInSound {
  id: string;
  name: string;
  category: string;
  tags: string[];
}

const dataUrlCache = new Map<string, string>();

/** Get the catalog of all built-in sounds (no audio data). */
export function getBuiltInSoundCatalog(): BuiltInSound[] {
  return SOUNDS.map(({ generate: _, ...rest }) => rest);
}

/** Get the base64 dataURL for a built-in sound (generates + caches on first call). */
export async function getBuiltInSoundDataUrl(id: string): Promise<string | null> {
  const cached = dataUrlCache.get(id);
  if (cached) return cached;

  const def = SOUNDS.find((s) => s.id === id);
  if (!def) return null;

  const dataUrl = await def.generate();
  dataUrlCache.set(id, dataUrl);
  return dataUrl;
}

/** Check if an ID belongs to a built-in sound. */
export function isBuiltInSound(id: string): boolean {
  return SOUNDS.some((s) => s.id === id);
}

/** Get the total count of built-in sounds. */
export function getBuiltInSoundCount(): number {
  return SOUNDS.length;
}
