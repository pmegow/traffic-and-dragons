// audio/engine.js — DiceAudio: plays the dice sound planned by audio/plan.js through Web Audio.
//
//   const audio = new DiceAudio();
//   await audio.load();                         // the click bank (fetch + decode, verified)
//   await audio.unlock();                       // inside a click or tap: browsers start sound only then
//   view.play(result, { onStart: ({ timeScale }) => audio.scheduleRoll(result, { timeScale, pan }) });
//
// Every click is scheduled ahead on the audio clock, so it lands on its frame however busy the
// page is. A click runs source → high-pass → low-pass → gain → pan → the master gain, then a gentle
// compressor so a pile of dice never clips.
//
// Pass { context } (an OfflineAudioContext, say) to render without speakers — the tests do.

import { rollEvents, exitSoundEvent, TIMBRES } from './plan.js';

const PRE_ROLL = 0.001;   // s of silence before each click's attack (dev/cut-clicks.js cuts 1 ms early)

export class DiceAudio {
  constructor({ bank = new URL('./bank/clicks-v1.json', import.meta.url), volume = 0.9, context = null } = {}) {
    this.bankUrl = bank;
    this.volume = volume;
    this.injected = context;
    this.ctx = null;
    this.bank = null;
    this.buffer = null;
    this.active = new Set();
    this.muted = false;
  }

  /** Fetches and decodes the click bank; refuses one that does not match its own receipt. */
  async load() {
    if (this.buffer) return this;
    const manifestUrl = new URL(this.bankUrl, globalThis.location?.href);
    const res = await fetch(manifestUrl);
    if (!res.ok) throw new Error('DiceAudio: the click bank manifest ' + manifestUrl + ' answered HTTP ' + res.status);
    const bank = await res.json();
    if (bank.schema !== 1 || !bank.clicks) throw new Error('DiceAudio: ' + manifestUrl + ' is not a schema-1 click bank');
    const fileUrl = new URL(bank.file, manifestUrl);
    const bin = await fetch(fileUrl);
    if (!bin.ok) throw new Error('DiceAudio: the click sprite ' + fileUrl + ' answered HTTP ' + bin.status);
    const bytes = await bin.arrayBuffer();
    if (bytes.byteLength !== bank.bytes) throw new Error('DiceAudio: the click sprite is ' + bytes.byteLength + ' bytes; its receipt says ' + bank.bytes);
    if (globalThis.crypto?.subtle) {
      const hex = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
      if (hex !== bank.sha256) throw new Error('DiceAudio: the click sprite\'s sha256 ' + hex + ' is not its receipt\'s ' + bank.sha256);
    }
    // Decoded on a throwaway offline context: a live context born before a tap sits suspended.
    const decoder = new OfflineAudioContext(1, 1, bank.sampleRate);
    const buffer = await decoder.decodeAudioData(bytes);
    const last = Math.max(...Object.values(bank.clicks).flat().map((c) => c.start + c.length));
    if (buffer.duration + 1e-3 < last) throw new Error('DiceAudio: the decoded sprite (' + buffer.duration.toFixed(3) + ' s) ends before its last click (' + last.toFixed(3) + ' s)');
    this.bank = bank;
    this.buffer = buffer;
    this.latency = await measureLatency();
    return this;
  }

  /** The audio graph, made on first use (inside a gesture for a live page). */
  context() {
    if (this.ctx) return this.ctx;
    const ctx = this.injected || new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    const comp = ctx.createDynamicsCompressor();
    compressorSettings(comp);
    this.master.connect(comp).connect(ctx.destination);
    return ctx;
  }

  /** Starts (or resumes) sound. Call from a click or tap; resolves true when sound can play. */
  async unlock() {
    const ctx = this.context();
    if (ctx.state === 'suspended' && ctx.resume) await ctx.resume();
    return this.injected ? true : ctx.state === 'running';
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.muted ? 0 : v; }
  setMuted(m) { this.muted = !!m; if (this.master) this.master.gain.value = this.muted ? 0 : this.volume; }

  requireLoaded() { if (!this.buffer) throw new Error('DiceAudio: call load() before playing'); }

  /** One planned event at audio time `when`, panned −1 (left) … 1 (right). */
  play(e, when, pan = 0) {
    const ctx = this.context();
    const spec = TIMBRES[e.timbre];
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = e.rate;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = spec.highpass;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(spec.lowpass, ctx.sampleRate / 2 - 100);
    const g = ctx.createGain(); g.gain.value = e.gain;
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(hp).connect(lp).connect(g).connect(p).connect(this.master);
    // Early by the click's pre-roll and the compressor's look-ahead, so the attack is heard at `when`.
    // Stopped explicitly at the region's end on the context clock (length ÷ rate), so the region is
    // exactly the click whatever the playback rate.
    const at = Math.max(when - PRE_ROLL / e.rate - this.latency, ctx.currentTime);
    src.start(at, e.click.start);
    src.stop(at + e.click.length / e.rate);
    this.active.add(src);
    // No disconnect here: the filters are still ringing when the source ends, and cutting them off
    // stepped the output to silence (a faint broadband tick after every felt click, seen on a
    // spectrogram 2026-10-24). A finished chain is freed by Web Audio once its tail has decayed.
    src.onended = () => { this.active.delete(src); };
    return src;
  }

  /**
   * Schedules every impact of a roll from now (or from `at`, a time on the audio clock). timeScale is
   * roll seconds per real second (DiceView's onStart); pan(dieIndex, rollTime) places a click across
   * the stereo field. Returns the events.
   */
  scheduleRoll(result, { timeScale = 1, pan = null, at = null } = {}) {
    this.requireLoaded();
    const events = rollEvents(result, { bank: this.bank, timeScale });
    // From the frame itself, no lead: the view started its clock on this frame, and a roll's first
    // impact is a falling die's tenth of a second away, so nothing lands in the past.
    const t0 = at ?? this.context().currentTime;
    for (const e of events) this.play(e, t0 + e.time, pan ? pan(e.die, e.t) : 0);
    return events;
  }

  /**
   * An exit's sound (audio/plan.js ▸ exitSoundEvent) now — a few ms on, by the event — panned −1 … 1:
   * what a DiceView exit's onSound reports ({ kind, type, surface, strength, pan }).
   */
  playExitSound(kind, { type, surface, strength = 1, pan = 0 } = {}) {
    this.requireLoaded();
    const e = exitSoundEvent(kind, { bank: this.bank, type, surface, strength });
    return this.play(e, this.context().currentTime + e.after, pan);
  }

  /** Silences everything scheduled or sounding (a new roll took over). */
  stop() {
    for (const src of this.active) { try { src.stop(); } catch { /* already ended */ } }
    this.active.clear();
  }
}

function compressorSettings(comp) {
  comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.08;
}

/**
 * The output path's delay, measured: a DynamicsCompressor looks ahead (about 6 ms in Chromium) and
 * Web Audio does not report it. An impulse through the same compressor, rendered offline, shows it.
 * Without this every click sounded ~7 ms after its frame (measured 2026-10-24).
 */
async function measureLatency(sampleRate = 48000) {
  const ctx = new OfflineAudioContext(1, Math.round(sampleRate * 0.05), sampleRate);
  const comp = ctx.createDynamicsCompressor();
  compressorSettings(comp);
  const imp = ctx.createBuffer(1, 1, sampleRate);
  imp.getChannelData(0)[0] = 0.5;
  const src = ctx.createBufferSource();
  src.buffer = imp;
  src.connect(comp).connect(ctx.destination);
  src.start(0.01);
  const x = (await ctx.startRendering()).getChannelData(0);
  let i = 0;
  while (i < x.length && Math.abs(x[i]) < 1e-4) i++;
  if (i === x.length) throw new Error('DiceAudio: the latency probe heard nothing through the compressor');
  return Math.max(0, i / sampleRate - 0.01);
}
