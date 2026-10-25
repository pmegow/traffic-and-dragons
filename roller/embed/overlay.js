// embed/overlay.js — dice-sim inside a host page: dice rolled over the host's own content, their faces
// decided by the host (Traffic and Dragons: the GM's check and the attack's damage; owner 2026-10-25,
// "roll it into TnD").
//
//   const dice = createDiceOverlay({ container });     // once: the host's own element, over its content
//   const result = await dice.roll([{ type: 'd20', value: 17 }]);   // resolves when the dice rest
//   dice.clear();                                     // the host's dismiss (a click, say)
//
// The container is the host's: it places, sizes, shows and hides it (a roll needs it visible and sized,
// since the screen's edges are the dice's walls — render/framing.js ▸ screenBounds). One view, one
// WebGL context and one sound engine for the overlay's whole life, however many rolls; dispose() ends
// them. A transparent view: no tray, only the dice and their shadows over whatever is behind.

import { DiceView, VIEW_DEFAULTS } from '../render/index.js';
import { DiceAudio } from '../audio/index.js';
import { samplePose } from '../src/index.js';

/** How long a roll waits for its sound (ms): the click bank loading, the browser unlocking audio. */
export const SOUND_WAIT_MS = { bank: 1500, unlock: 250 };

/** A promise's value, or false if it has not settled within ms. */
const soon = (promise, ms) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(false), ms))]);

/** How an overlay looks unless the host says otherwise: a steep view and a small stage, so the dice read big. */
export const OVERLAY_DEFAULTS = { tilt: 68, tray: { width: 0.15, depth: 0.10 } };

/**
 * container: the host's element (required). look: a die style {body, ink, finish, font} (default the
 * view's). sound: false for none. context: the host's own AudioContext, so the dice share its unlock
 * and its output. tilt, tray: the view's (OVERLAY_DEFAULTS).
 */
export function createDiceOverlay({ container, look = VIEW_DEFAULTS.dieStyle, sound = true, context = null, tilt = OVERLAY_DEFAULTS.tilt, tray = OVERLAY_DEFAULTS.tray } = {}) {
  if (!container) throw new Error('createDiceOverlay: a container element is required');
  const view = new DiceView({ container, transparent: true, tilt, tray, dieStyle: look });
  const audio = sound ? new DiceAudio({ context }) : null;
  const loading = audio ? audio.load().catch((e) => { console.warn('dice-sim: the dice sound is off: ' + e.message); return null; }) : Promise.resolve(null);
  let current = 0;   // the newest roll wins: an older one still playing is abandoned

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
      if (mine !== current) return null;
      await view.play(result, {
        onStart: ({ timeScale }) => {
          if (withSound) audio.scheduleRoll(result, { timeScale, pan: (i, t) => 0.7 * view.panFor(samplePose(result, i, t).position) });
        },
      });
      return mine === current ? result : null;
    },
    /** Takes the dice away and stops their sound; a roll in progress resolves null. */
    clear() {
      current++;
      if (audio) audio.stop();
      if (view.playing) view.playing.cancel();
      view.clear();
      view.render();
    },
    /** The dice's look for the next roll (and the dice now showing). */
    setLook(style) { return view.setDieStyle(style); },
    setMuted(muted) { if (audio) audio.setMuted(muted); },
    /** Ends the overlay: its WebGL context and its sound go. */
    dispose() {
      this.clear();
      if (audio) audio.stop();
      view.dispose();
    },
  };
}
