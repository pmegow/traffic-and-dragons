// embed/overlay.js — dice-sim inside a host page: dice rolled over the host's own content, their faces
// decided by the host (Traffic and Dragons: the GM's check and the attack's damage; owner 2026-10-25,
// "roll it into TnD").
//
//   const dice = createDiceOverlay({ container });     // once: the host's own element, over its content
//   const result = await dice.roll([{ type: 'd20', value: 17 }]);   // resolves when the dice rest
//   dice.setExit('smoke');                            // how they leave (render/exit-table.js; 'none' by default)
//   await dice.dismiss();                             // the host's dismiss (a click, say): they leave by it, heard
//   dice.clear();                                     // or at once, silently
//
// The container is the host's: it places, sizes, shows and hides it (a roll needs it visible and sized,
// since the screen's edges are the dice's walls — render/framing.js ▸ screenBounds). One view, one
// WebGL context and one sound engine for the overlay's whole life, however many rolls; dispose() ends
// them. A transparent view: no tray, only the dice and their shadows over whatever is behind.

import { DiceView, VIEW_DEFAULTS } from '../render/index.js';
import { DiceAudio } from '../audio/index.js';
import { samplePose } from '../src/index.js';
import { EXIT_TABLE } from '../render/exit-table.js';

/** How long a roll waits for its sound (ms): the click bank loading, the browser unlocking audio. */
export const SOUND_WAIT_MS = { bank: 1500, unlock: 250 };

/** How long a roll waits for a vendored numeral font to load (ms), so the first roll is painted in it; painted sooner, the dice are repainted when it arrives. */
export const FONT_WAIT_MS = 1500;
/** How long a roll waits at most for the dice's pipeline (view.warmTable), readied as the overlay is made and for each look. */
export const WARM_WAIT_MS = 1500;

/** A promise's value, or false if it has not settled within ms. */
const soon = (promise, ms) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(false), ms))]);

/** How an overlay looks unless the host says otherwise: a steep view and a small stage, so the dice read big. */
export const OVERLAY_DEFAULTS = { tilt: 68, tray: { width: 0.15, depth: 0.10 } };

/**
 * container: the host's element (required). look: a die style {body, ink, finish, font} (default the
 * view's). sound: false for none. context: the host's own AudioContext, so the dice share its unlock
 * and its output. exit: how dismiss() takes the dice away (an EXIT_TABLE name; 'none', at once). tilt,
 * tray: the view's (OVERLAY_DEFAULTS).
 */
export function createDiceOverlay({ container, look = VIEW_DEFAULTS.dieStyle, sound = true, context = null, exit = 'none', tilt = OVERLAY_DEFAULTS.tilt, tray = OVERLAY_DEFAULTS.tray } = {}) {
  if (!container) throw new Error('createDiceOverlay: a container element is required');
  const view = new DiceView({ container, transparent: true, tilt, tray, dieStyle: look });
  const audio = sound ? new DiceAudio({ context }) : null;
  const loading = audio ? audio.load().catch((e) => { console.warn('dice-sim: the dice sound is off: ' + e.message); return null; }) : Promise.resolve(null);
  let current = 0;   // the newest roll wins: an older one still playing is abandoned
  const checkExit = (name) => {
    if (!EXIT_TABLE[name]) throw new Error('createDiceOverlay: no exit "' + name + '" (known: ' + Object.keys(EXIT_TABLE).join(', ') + ')');
    return name;
  };
  let leaveBy = checkExit(exit);
  // An exit compiles shaders the first time it plays (a burn's first frame stalled 6.9 s on glass, measured
  // 2026-10-25): they are readied while the dice rest, and for a new look — never in the middle of a dismiss.
  const warm = () => { view.warmTable(); if (leaveBy !== 'none') view.warmExits(); };
  // The look's own pipeline is readied as the overlay is made (a host makes it ahead of the first roll: the first die
  // drawn before it was built stalled 0.6 s in the air after a reload, 2026-10-28), and the exit's shaders with it.
  warm();
  // An exit's sounds (a spider's steps) play only once the sound is up: the bank loaded and the context running
  // (a step on a sleeping clock would wait for it and then sound with all the rest at once).
  const exitSound = (s) => { if (audio.buffer && audio.ctx && audio.ctx.state === 'running') audio.playExitSound(s.kind, { ...s, pan: 0.7 * s.pan }); };

  return {
    view,
    audio,
    /**
     * Rolls dice = [{ type: 'd20', value: 17 }, …] (a value the die shows; leave it out for an honest
     * roll). Resolves with the roll's result when the dice rest, or null when a newer roll or clear()
     * took over. Call it from inside the user's gesture when you can: browsers start sound only there.
     */
    async roll(dice) {
      const mine = ++current;
      if (audio) audio.stop();
      const unlocking = audio ? audio.unlock().catch(() => false) : Promise.resolve(false);
      view.resize();                 // the container is showing now: the screen's edges come from its size
      view.clear();
      const result = view.bake({ dice });
      // Sound never holds the dice back. Outside a user gesture a browser leaves the AudioContext's resume() pending
      // until the next one, so waiting on it hung the roll (found in TnD's browser suite, 2026-10-25): a moment for
      // the unlock and the bank, then the dice go, silent if the sound is not ready.
      const withSound = (await soon(loading, SOUND_WAIT_MS.bank)) && (await soon(unlocking, SOUND_WAIT_MS.unlock));
      // The look's font too (a vendored one loads from a file): a moment, so the first roll is painted in it.
      await soon(view.readyFont(view.o.dieStyle.font).catch(() => false), FONT_WAIT_MS);
      // And the dice's pipeline (warmTable): built as the overlay was made, or for the first roll after a look, now.
      await soon(view.warmTable(), WARM_WAIT_MS);
      if (mine !== current) return null;
      await view.play(result, {
        onStart: ({ timeScale }) => {
          if (withSound) audio.scheduleRoll(result, { timeScale, pan: (i, t) => 0.7 * view.panFor(samplePose(result, i, t).position) });
        },
      });
      if (mine === current) warm();
      return mine === current ? result : null;
    },
    /**
     * The host's dismiss: the dice leave by the overlay's exit (setExit), its sounds through the overlay's audio,
     * a roll in progress abandoned. Resolves when the last has gone — with 'none', at once (clear()). A roll may
     * start while they leave: the new dice come in as the old go.
     */
    dismiss() {
      if (leaveBy === 'none') { this.clear(); return Promise.resolve(); }
      current++;
      if (audio) audio.stop();
      if (view.playing) view.playing.cancel();
      return view.clear({ exit: leaveBy, onSound: audio ? exitSound : null });
    },
    /** How dismiss() takes the dice away from now on (an EXIT_TABLE name); an unknown one is refused. */
    setExit(name) { leaveBy = checkExit(name); warm(); },
    get exit() { return leaveBy; },
    /** Takes the dice away and stops their sound; a roll in progress resolves null. */
    clear() {
      current++;
      if (audio) audio.stop();
      if (view.playing) view.playing.cancel();
      view.clear();
      view.render();
    },
    /** The dice's look for the next roll (and the dice now showing). */
    setLook(style) { return view.setDieStyle(style).then(() => warm()); },
    setMuted(muted) { if (audio) audio.setMuted(muted); },
    /** Ends the overlay: its WebGL context and its sound engine go (the engine closes the audio context it made; one the host lent stays the host's). */
    dispose() {
      this.clear();
      if (audio) audio.dispose();
      view.dispose();
    },
  };
}
