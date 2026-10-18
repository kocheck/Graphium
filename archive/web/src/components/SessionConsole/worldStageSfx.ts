import { type SynthType } from '../../types/sessionConsole';
import { toMediaProtocol } from '../../utils/mediaProtocol';

const SYNTH_IDS: ReadonlySet<string> = new Set(['chime', 'drone', 'snap', 'ping', 'test-tone']);

export function getStageAudioContext(existing: AudioContext | null): AudioContext | null {
  const Ctx = window.AudioContext;
  if (!Ctx) {
    return existing;
  }
  const context = existing ?? new Ctx();
  if (context.state === 'suspended') {
    void context.resume();
  }
  return context;
}

function playStageTestTone(context: AudioContext): void {
  const now = context.currentTime;
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.22, now + 0.2);
  gain.gain.setValueAtTime(0.22, now + 2.6);
  gain.gain.linearRampToValueAtTime(0.0001, now + 3);
  [220, 330, 440].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.detune.setValueAtTime(index * 4, now);
    oscillator.connect(gain);
    oscillator.start(now);
    oscillator.stop(now + 3.05);
  });
}

export function playStageSfx(context: AudioContext, type: SynthType): void {
  if (type === 'test-tone') {
    playStageTestTone(context);
    return;
  }

  const now = context.currentTime;
  const gain = context.createGain();
  gain.connect(context.destination);

  if (type === 'chime') {
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
    oscillator.connect(gain);
    oscillator.start(now);
    oscillator.stop(now + 2.6);
    return;
  }

  if (type === 'drone') {
    const oscillator = context.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(55, now);
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 220;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.8);
    gain.gain.linearRampToValueAtTime(0.0001, now + 5);
    oscillator.connect(lowpass);
    lowpass.connect(gain);
    oscillator.start(now);
    oscillator.stop(now + 5.1);
    return;
  }

  if (type === 'snap') {
    const source = context.createBufferSource();
    const buffer = context.createBuffer(
      1,
      Math.floor(context.sampleRate * 0.05),
      context.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let index = 0; index < buffer.length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / buffer.length);
    }
    source.buffer = buffer;
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 1000;
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    source.connect(highpass);
    highpass.connect(gain);
    source.start(now);
    return;
  }

  const oscillator = context.createOscillator();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(1200, now);
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
  oscillator.connect(gain);
  oscillator.start(now);
  oscillator.stop(now + 1.3);
}

export function resolveSynthType(
  sfxId: string | null,
  synthType?: SynthType | null,
): SynthType | null {
  if (synthType) {
    return synthType;
  }
  if (sfxId && SYNTH_IDS.has(sfxId)) {
    return sfxId as SynthType;
  }
  return null;
}

const decodedSfxBuffers = new WeakMap<AudioContext, Map<string, Promise<AudioBuffer>>>();

function sfxBufferCache(context: AudioContext): Map<string, Promise<AudioBuffer>> {
  const existing = decodedSfxBuffers.get(context);
  if (existing) {
    return existing;
  }
  const created = new Map<string, Promise<AudioBuffer>>();
  decodedSfxBuffers.set(context, created);
  return created;
}

async function loadLocalSfxBuffer(context: AudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Local SFX failed to play.');
  }
  return context.decodeAudioData(await response.arrayBuffer());
}

export async function playLocalSfx(context: AudioContext, src: string): Promise<void> {
  const url = toMediaProtocol(src);
  const cache = sfxBufferCache(context);
  let pending = cache.get(url);
  if (!pending) {
    pending = loadLocalSfxBuffer(context, url);
    cache.set(url, pending);
    pending.catch(() => {
      if (cache.get(url) === pending) {
        cache.delete(url);
      }
    });
  }
  const decoded = await pending;
  const source = context.createBufferSource();
  source.buffer = decoded;
  source.connect(context.destination);
  source.start();
}
