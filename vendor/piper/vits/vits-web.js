const u = "https://huggingface.co/diffusionstudio/piper-voices/resolve/main", B = "https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/", x = "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize", c = {
  "ar_JO-kareem-low": "ar/ar_JO/kareem/low/ar_JO-kareem-low.onnx",
  "ar_JO-kareem-medium": "ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx",
  "ca_ES-upc_ona-medium": "ca/ca_ES/upc_ona/medium/ca_ES-upc_ona-medium.onnx",
  "ca_ES-upc_ona-x_low": "ca/ca_ES/upc_ona/x_low/ca_ES-upc_ona-x_low.onnx",
  "ca_ES-upc_pau-x_low": "ca/ca_ES/upc_pau/x_low/ca_ES-upc_pau-x_low.onnx",
  "cs_CZ-jirka-low": "cs/cs_CZ/jirka/low/cs_CZ-jirka-low.onnx",
  "cs_CZ-jirka-medium": "cs/cs_CZ/jirka/medium/cs_CZ-jirka-medium.onnx",
  "da_DK-talesyntese-medium": "da/da_DK/talesyntese/medium/da_DK-talesyntese-medium.onnx",
  "de_DE-eva_k-x_low": "de/de_DE/eva_k/x_low/de_DE-eva_k-x_low.onnx",
  "de_DE-karlsson-low": "de/de_DE/karlsson/low/de_DE-karlsson-low.onnx",
  "de_DE-kerstin-low": "de/de_DE/kerstin/low/de_DE-kerstin-low.onnx",
  "de_DE-mls-medium": "de/de_DE/mls/medium/de_DE-mls-medium.onnx",
  "de_DE-pavoque-low": "de/de_DE/pavoque/low/de_DE-pavoque-low.onnx",
  "de_DE-ramona-low": "de/de_DE/ramona/low/de_DE-ramona-low.onnx",
  "de_DE-thorsten-high": "de/de_DE/thorsten/high/de_DE-thorsten-high.onnx",
  "de_DE-thorsten-low": "de/de_DE/thorsten/low/de_DE-thorsten-low.onnx",
  "de_DE-thorsten-medium": "de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx",
  "de_DE-thorsten_emotional-medium": "de/de_DE/thorsten_emotional/medium/de_DE-thorsten_emotional-medium.onnx",
  "el_GR-rapunzelina-low": "el/el_GR/rapunzelina/low/el_GR-rapunzelina-low.onnx",
  "en_GB-alan-low": "en/en_GB/alan/low/en_GB-alan-low.onnx",
  "en_GB-alan-medium": "en/en_GB/alan/medium/en_GB-alan-medium.onnx",
  "en_GB-alba-medium": "en/en_GB/alba/medium/en_GB-alba-medium.onnx",
  "en_GB-aru-medium": "en/en_GB/aru/medium/en_GB-aru-medium.onnx",
  "en_GB-cori-high": "en/en_GB/cori/high/en_GB-cori-high.onnx",
  "en_GB-cori-medium": "en/en_GB/cori/medium/en_GB-cori-medium.onnx",
  "en_GB-jenny_dioco-medium": "en/en_GB/jenny_dioco/medium/en_GB-jenny_dioco-medium.onnx",
  "en_GB-northern_english_male-medium": "en/en_GB/northern_english_male/medium/en_GB-northern_english_male-medium.onnx",
  "en_GB-semaine-medium": "en/en_GB/semaine/medium/en_GB-semaine-medium.onnx",
  "en_GB-southern_english_female-low": "en/en_GB/southern_english_female/low/en_GB-southern_english_female-low.onnx",
  "en_GB-vctk-medium": "en/en_GB/vctk/medium/en_GB-vctk-medium.onnx",
  "en_US-amy-low": "en/en_US/amy/low/en_US-amy-low.onnx",
  "en_US-amy-medium": "en/en_US/amy/medium/en_US-amy-medium.onnx",
  "en_US-arctic-medium": "en/en_US/arctic/medium/en_US-arctic-medium.onnx",
  "en_US-danny-low": "en/en_US/danny/low/en_US-danny-low.onnx",
  "en_US-hfc_female-medium": "en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx",
  "en_US-hfc_male-medium": "en/en_US/hfc_male/medium/en_US-hfc_male-medium.onnx",
  "en_US-joe-medium": "en/en_US/joe/medium/en_US-joe-medium.onnx",
  "en_US-kathleen-low": "en/en_US/kathleen/low/en_US-kathleen-low.onnx",
  "en_US-kristin-medium": "en/en_US/kristin/medium/en_US-kristin-medium.onnx",
  "en_US-kusal-medium": "en/en_US/kusal/medium/en_US-kusal-medium.onnx",
  "en_US-l2arctic-medium": "en/en_US/l2arctic/medium/en_US-l2arctic-medium.onnx",
  "en_US-lessac-high": "en/en_US/lessac/high/en_US-lessac-high.onnx",
  "en_US-lessac-low": "en/en_US/lessac/low/en_US-lessac-low.onnx",
  "en_US-lessac-medium": "en/en_US/lessac/medium/en_US-lessac-medium.onnx",
  "en_US-libritts-high": "en/en_US/libritts/high/en_US-libritts-high.onnx",
  "en_US-libritts_r-medium": "en/en_US/libritts_r/medium/en_US-libritts_r-medium.onnx",
  "en_US-ljspeech-high": "en/en_US/ljspeech/high/en_US-ljspeech-high.onnx",
  "en_US-ljspeech-medium": "en/en_US/ljspeech/medium/en_US-ljspeech-medium.onnx",
  "en_US-ryan-high": "en/en_US/ryan/high/en_US-ryan-high.onnx",
  "en_US-ryan-low": "en/en_US/ryan/low/en_US-ryan-low.onnx",
  "en_US-ryan-medium": "en/en_US/ryan/medium/en_US-ryan-medium.onnx",
  "es_ES-carlfm-x_low": "es/es_ES/carlfm/x_low/es_ES-carlfm-x_low.onnx",
  "es_ES-davefx-medium": "es/es_ES/davefx/medium/es_ES-davefx-medium.onnx",
  "es_ES-mls_10246-low": "es/es_ES/mls_10246/low/es_ES-mls_10246-low.onnx",
  "es_ES-mls_9972-low": "es/es_ES/mls_9972/low/es_ES-mls_9972-low.onnx",
  "es_ES-sharvard-medium": "es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx",
  "es_MX-ald-medium": "es/es_MX/ald/medium/es_MX-ald-medium.onnx",
  "es_MX-claude-high": "es/es_MX/claude/high/es_MX-claude-high.onnx",
  "fa_IR-amir-medium": "fa/fa_IR/amir/medium/fa_IR-amir-medium.onnx",
  "fa_IR-gyro-medium": "fa/fa_IR/gyro/medium/fa_IR-gyro-medium.onnx",
  "fi_FI-harri-low": "fi/fi_FI/harri/low/fi_FI-harri-low.onnx",
  "fi_FI-harri-medium": "fi/fi_FI/harri/medium/fi_FI-harri-medium.onnx",
  "fr_FR-gilles-low": "fr/fr_FR/gilles/low/fr_FR-gilles-low.onnx",
  "fr_FR-mls-medium": "fr/fr_FR/mls/medium/fr_FR-mls-medium.onnx",
  "fr_FR-mls_1840-low": "fr/fr_FR/mls_1840/low/fr_FR-mls_1840-low.onnx",
  "fr_FR-siwis-low": "fr/fr_FR/siwis/low/fr_FR-siwis-low.onnx",
  "fr_FR-siwis-medium": "fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx",
  "fr_FR-tom-medium": "fr/fr_FR/tom/medium/fr_FR-tom-medium.onnx",
  "fr_FR-upmc-medium": "fr/fr_FR/upmc/medium/fr_FR-upmc-medium.onnx",
  "hu_HU-anna-medium": "hu/hu_HU/anna/medium/hu_HU-anna-medium.onnx",
  "hu_HU-berta-medium": "hu/hu_HU/berta/medium/hu_HU-berta-medium.onnx",
  "hu_HU-imre-medium": "hu/hu_HU/imre/medium/hu_HU-imre-medium.onnx",
  "is_IS-bui-medium": "is/is_IS/bui/medium/is_IS-bui-medium.onnx",
  "is_IS-salka-medium": "is/is_IS/salka/medium/is_IS-salka-medium.onnx",
  "is_IS-steinn-medium": "is/is_IS/steinn/medium/is_IS-steinn-medium.onnx",
  "is_IS-ugla-medium": "is/is_IS/ugla/medium/is_IS-ugla-medium.onnx",
  "it_IT-riccardo-x_low": "it/it_IT/riccardo/x_low/it_IT-riccardo-x_low.onnx",
  "ka_GE-natia-medium": "ka/ka_GE/natia/medium/ka_GE-natia-medium.onnx",
  "kk_KZ-iseke-x_low": "kk/kk_KZ/iseke/x_low/kk_KZ-iseke-x_low.onnx",
  "kk_KZ-issai-high": "kk/kk_KZ/issai/high/kk_KZ-issai-high.onnx",
  "kk_KZ-raya-x_low": "kk/kk_KZ/raya/x_low/kk_KZ-raya-x_low.onnx",
  "lb_LU-marylux-medium": "lb/lb_LU/marylux/medium/lb_LU-marylux-medium.onnx",
  "ne_NP-google-medium": "ne/ne_NP/google/medium/ne_NP-google-medium.onnx",
  "ne_NP-google-x_low": "ne/ne_NP/google/x_low/ne_NP-google-x_low.onnx",
  "nl_BE-nathalie-medium": "nl/nl_BE/nathalie/medium/nl_BE-nathalie-medium.onnx",
  "nl_BE-nathalie-x_low": "nl/nl_BE/nathalie/x_low/nl_BE-nathalie-x_low.onnx",
  "nl_BE-rdh-medium": "nl/nl_BE/rdh/medium/nl_BE-rdh-medium.onnx",
  "nl_BE-rdh-x_low": "nl/nl_BE/rdh/x_low/nl_BE-rdh-x_low.onnx",
  "nl_NL-mls-medium": "nl/nl_NL/mls/medium/nl_NL-mls-medium.onnx",
  "nl_NL-mls_5809-low": "nl/nl_NL/mls_5809/low/nl_NL-mls_5809-low.onnx",
  "nl_NL-mls_7432-low": "nl/nl_NL/mls_7432/low/nl_NL-mls_7432-low.onnx",
  "no_NO-talesyntese-medium": "no/no_NO/talesyntese/medium/no_NO-talesyntese-medium.onnx",
  "pl_PL-darkman-medium": "pl/pl_PL/darkman/medium/pl_PL-darkman-medium.onnx",
  "pl_PL-gosia-medium": "pl/pl_PL/gosia/medium/pl_PL-gosia-medium.onnx",
  "pl_PL-mc_speech-medium": "pl/pl_PL/mc_speech/medium/pl_PL-mc_speech-medium.onnx",
  "pl_PL-mls_6892-low": "pl/pl_PL/mls_6892/low/pl_PL-mls_6892-low.onnx",
  "pt_BR-edresson-low": "pt/pt_BR/edresson/low/pt_BR-edresson-low.onnx",
  "pt_BR-faber-medium": "pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx",
  "pt_PT-tugão-medium": "pt/pt_PT/tugão/medium/pt_PT-tugão-medium.onnx",
  "ro_RO-mihai-medium": "ro/ro_RO/mihai/medium/ro_RO-mihai-medium.onnx",
  "ru_RU-denis-medium": "ru/ru_RU/denis/medium/ru_RU-denis-medium.onnx",
  "ru_RU-dmitri-medium": "ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium.onnx",
  "ru_RU-irina-medium": "ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx",
  "ru_RU-ruslan-medium": "ru/ru_RU/ruslan/medium/ru_RU-ruslan-medium.onnx",
  "sk_SK-lili-medium": "sk/sk_SK/lili/medium/sk_SK-lili-medium.onnx",
  "sl_SI-artur-medium": "sl/sl_SI/artur/medium/sl_SI-artur-medium.onnx",
  "sr_RS-serbski_institut-medium": "sr/sr_RS/serbski_institut/medium/sr_RS-serbski_institut-medium.onnx",
  "sv_SE-nst-medium": "sv/sv_SE/nst/medium/sv_SE-nst-medium.onnx",
  "sw_CD-lanfrica-medium": "sw/sw_CD/lanfrica/medium/sw_CD-lanfrica-medium.onnx",
  "tr_TR-dfki-medium": "tr/tr_TR/dfki/medium/tr_TR-dfki-medium.onnx",
  "tr_TR-fahrettin-medium": "tr/tr_TR/fahrettin/medium/tr_TR-fahrettin-medium.onnx",
  "tr_TR-fettah-medium": "tr/tr_TR/fettah/medium/tr_TR-fettah-medium.onnx",
  "uk_UA-lada-x_low": "uk/uk_UA/lada/x_low/uk_UA-lada-x_low.onnx",
  "uk_UA-ukrainian_tts-medium": "uk/uk_UA/ukrainian_tts/medium/uk_UA-ukrainian_tts-medium.onnx",
  "vi_VN-25hours_single-low": "vi/vi_VN/25hours_single/low/vi_VN-25hours_single-low.onnx",
  "vi_VN-vais1000-medium": "vi/vi_VN/vais1000/medium/vi_VN-vais1000-medium.onnx",
  "vi_VN-vivos-x_low": "vi/vi_VN/vivos/x_low/vi_VN-vivos-x_low.onnx",
  "zh_CN-huayan-medium": "zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx",
  "zh_CN-huayan-x_low": "zh/zh_CN/huayan/x_low/zh_CN-huayan-x_low.onnx"
};
async function p(e, m) {
  if (e.match("https://huggingface.co"))
    try {
      const o = await (await navigator.storage.getDirectory()).getDirectoryHandle("piper", {
        create: !0
      }), a = e.split("/").at(-1), t = await (await o.getFileHandle(a, { create: !0 })).createWritable();
      await t.write(m), await t.close();
    } catch (n) {
      console.error(n);
    }
}
async function R(e) {
  try {
    const n = await (await navigator.storage.getDirectory()).getDirectoryHandle("piper"), o = e.split("/").at(-1);
    await (await n.getFileHandle(o)).remove();
  } catch (m) {
    console.error(m);
  }
}
async function D(e) {
  if (e.match("https://huggingface.co"))
    try {
      const n = await (await navigator.storage.getDirectory()).getDirectoryHandle("piper", {
        create: !0
      }), o = e.split("/").at(-1);
      return await (await n.getFileHandle(o)).getFile();
    } catch {
      return;
    }
}
async function S(e, m) {
  var r;
  // ═══ T&D PATCH v1.341 (r6) — stall watchdog. Upstream's reader loop had no timeout: a
  // connection that stalls mid-body (network hop mid-download) hangs read() forever, which hangs
  // _piperEnsureVoice forever — and since the tts.js op mutex (audit #9) serializes engine work,
  // one hung download would block every later Piper op until reload. Abort after 30s with NO new
  // data (progress resets the clock, so slow-but-alive connections are fine) and throw loud.
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  let stallT = null;
  const resetStall = () => {
    if (!ctrl) return;
    if (stallT) clearTimeout(stallT);
    stallT = setTimeout(() => { try { ctrl.abort(); } catch (e2) {} }, 30000);
  };
  resetStall();   // armed BEFORE fetch — a stall at the headers stage must abort too
  const n = await fetch(e, ctrl ? { signal: ctrl.signal } : {}).catch((err) => {
    if (ctrl && ctrl.signal.aborted) throw new Error("voice download stalled — no response for 30s: " + e);
    throw err;
  });
  // ═══ T&D PATCH v1.335 — download integrity. Upstream saved WHATEVER the fetch returned: an HF
  // 404/rate-limit page written to OPFS as the .onnx, which stored() then reports as "downloaded"
  // forever — every predict() fails and nothing ever re-fetches. Non-OK must THROW (propagates to
  // _piperEnsureVoice's loud catch) so nothing is written and the next attempt retries.
  if (!n.ok) throw new Error("voice download failed: HTTP " + n.status + " for " + e);
  const o = (r = n.body) == null ? void 0 : r.getReader(), a = +(n.headers.get("Content-Length") ?? 0);
  let i = 0, t = [];
  resetStall();   // fresh window for the body
  try {
    for (; o; ) {
      const { done: s, value: d } = await o.read();
      if (s)
        break;
      resetStall();
      t.push(d), i += d.length, m == null || m({
        url: e,
        total: a,
        loaded: i
      });
    }
  } catch (err) {
    if (ctrl && ctrl.signal.aborted) throw new Error("voice download stalled — no data for 30s: " + e);
    throw err;
  } finally {
    if (stallT) clearTimeout(stallT);
  }
  return new Blob(t, { type: n.headers.get("Content-Type") ?? void 0 });
}
function b(e, m, n) {
  const o = e.length, a = 44, i = new DataView(new ArrayBuffer(o * m * 2 + a));
  i.setUint32(0, 1179011410, !0), i.setUint32(4, i.buffer.byteLength - 8, !0), i.setUint32(8, 1163280727, !0), i.setUint32(12, 544501094, !0), i.setUint32(16, 16, !0), i.setUint16(20, 1, !0), i.setUint16(22, m, !0), i.setUint32(24, n, !0), i.setUint32(28, m * 2 * n, !0), i.setUint16(32, m * 2, !0), i.setUint16(34, 16, !0), i.setUint32(36, 1635017060, !0), i.setUint32(40, 2 * o, !0);
  let t = a;
  for (let r = 0; r < o; r++) {
    const s = e[r];
    s >= 1 ? i.setInt16(t, 32767, !0) : s <= -1 ? i.setInt16(t, -32768, !0) : i.setInt16(t, s * 32768 | 0, !0), t += 2;
  }
  return i.buffer;
}
// ═══ T&D PATCH v1.336 (2026-07-17, piper-audit finding #5) — dependency delivery rev. The
// ?tnd= mechanism only covered THIS file; piper-DeOu3H9E.js (relative import → query dropped)
// and the phonemize wasm/data sat in the permanent PIPER_CACHE + immutable HTTP cache with NO
// way to deliver a patch to installed phones. TND_DEP_REV rides every dependency URL this file
// controls — bump it when piper-DeOu3H9E.js or piper_phonemize.{wasm,data} change content.
// (The ORT files are the remaining gap: the import map in index.html carries its own ?tnd= rev
// for ort.wasm.min.js, and the .wasm binaries — fetched via the wasmPaths PREFIX, which cannot
// carry a query — are delivered by RENAME-on-change. See the tts.js PIPER_ORT_PATH comment.)
const TND_DEP_REV = "r1";
let h, _;
async function N(e, m) {
  h = h ?? await import(`./piper-DeOu3H9E.js?tnd=${TND_DEP_REV}`), _ = _ ?? await import("onnxruntime-web");
  const n = c[e.voiceId], o = JSON.stringify([{ text: e.text.trim() }]);
  _.env.allowLocalModels = !1, _.env.wasm.numThreads = navigator.hardwareConcurrency, _.env.wasm.wasmPaths = B;
  const a = await f(`${u}/${n}.json`), i = JSON.parse(await a.text()), t = await tndPhonemize(i.espeak.voice, o) /* T&D PATCH v1.323 — cached phonemizer, see above */, r = 0, s = i.audio.sample_rate, d = i.inference.noise_scale, g = i.inference.length_scale / (e.rate || 1) /* T&D PATCH r7 — speech rate, see header */, U = i.inference.noise_w, y = await tndGetSession(n, m) /* T&D PATCH v1.322 — cached session, see above */, w = {
    input: new _.Tensor("int64", t, [1, t.length]),
    input_lengths: new _.Tensor("int64", [t.length]),
    scales: new _.Tensor("float32", [d, g, U])
  };
  Object.keys(i.speaker_id_map).length && Object.assign(w, { sid: new _.Tensor("int64", [r]) });
  const {
    output: { data: E }
  } = await y.run(w);
  return new Blob([b(E, 1, s)], { type: "audio/x-wav" });
}
// ═══ T&D PATCH v1.322 (2026-07-16) — session cache. Upstream predict() created a NEW
// ORT InferenceSession from the FULL model (~60MB) on EVERY call and never released it:
// per-sentence memory growth that Chrome absorbed and iOS Safari could not (tab killed at
// the same unit count every read — the Turn-769 repro). ONE session per voice, evict+
// release() on voice change. If this file is ever re-vendored, REAPPLY this patch (the
// engine test 'vendored vits-web carries the T&D session-cache patch' trips otherwise).
// ═══ T&D PATCH v1.323 (2026-07-16) — phonemizer reuse. Upstream instantiated a FRESH Emscripten
// phonemizer module (own WebAssembly.Memory + the espeak-ng-data FS payload) on EVERY predict —
// the second per-sentence memory faucet behind the v1.322 session leak; Safari collects discarded
// wasm memories too lazily under pressure and killed long reads. ONE cached instance re-driven
// via callMain per call; if a build can't re-run main (ExitStatus/no output), we mark it broken
// LOUDLY and fall back to upstream per-call behavior — never worse than before this patch.
// ═══ T&D PATCH v1.335 (2026-07-17) — offline integrity (piper-audit findings #1+#2 + hang rider):
// ① S() rejects non-OK responses (see above) so an HF error page can never be cached as a model;
// ② the phonemizer .wasm/.data now load from the SAME-ORIGIN vendored copies below (upstream's x
// still points at jsdelivr — the SW ignores cross-origin, so those fetches were never in
// PIPER_CACHE and broke the offline claim); ③ the fallback phonemizer path rejects/times out
// instead of hanging predict() forever on a load failure (no-silent-failures).
// ═══ T&D PATCH r7 (2026-07-17, Car Mode audit rank 20 — todo_carplay.html) — speech rate. predict()
// now accepts an optional `rate` (0.8–1.3, default 1) and divides length_scale by it: Piper has no
// native rate knob, but length_scale inversely scales phoneme duration (the standard VITS speed
// trick). See the `g = i.inference.length_scale / (e.rate || 1)` line in N() above. Falls back to
// unchanged length_scale when the caller omits rate (e.g. an older cached caller pre-dating this).
const TND_VITS_PATCH = "r9"; // T&D patch revision — surfaced in Voice Settings so a phone can PROVE which build it runs (the tnd-piper-v1 SW cache is permanent; delivery is via the ?tnd= query rev in tts.js PIPER_LIB_PATH)
const TND_PHON_BASE = "/vendor/piper/phonemize/piper_phonemize"; // T&D r3 — vendored, same-origin (upstream x = jsdelivr CDN)
const tndPhon = { mod: null, sink: null, broken: false };
let tndPhonCalls = 0;   // r9: main() re-entries — the denominator for per-synth growth
const tndLocate = (l) => l.endsWith(".wasm") ? `${TND_PHON_BASE}.wasm?tnd=${TND_DEP_REV}` : l.endsWith(".data") ? `${TND_PHON_BASE}.data?tnd=${TND_DEP_REV}` : l;
async function tndPhonemize(espeakVoice, input) {
  if (!tndPhon.broken) {
    try {
      if (!tndPhon.mod) tndPhon.mod = await h.createPiperPhonemize({
        print: (l) => { if (tndPhon.sink) tndPhon.sink(l); },
        printErr: (l) => { throw new Error(l); },
        locateFile: tndLocate
      });
      return await new Promise((v, rej) => {
        let done = false;
        tndPhon.sink = (l) => { done = true; v(JSON.parse(l).phoneme_ids); };
        tndPhonCalls++;
        try { tndPhon.mod.callMain(["-l", espeakVoice, "--input", input, "--espeak_data", "/espeak-ng-data"]); }
        catch (e) { if (!done) rej(e); }
        setTimeout(() => { if (!done) rej(new Error("phonemizer reuse produced no output")); }, 8000);
      });
    } catch (e) {
      tndPhon.broken = true; tndPhon.mod = null;
      console.warn("[T&D patch] phonemizer reuse unavailable — per-call instances (upstream behavior):", e && e.message);
    }
  }
  // T&D r3: upstream's fallback promise had NO reject path — a createPiperPhonemize/callMain
  // failure hung predict() forever (narration wedged with _playing=true, silently). Reject on
  // every failure surface + the same 8s no-output timeout the cached path uses.
  return await new Promise((v, rej) => {
    let done = false;
    h.createPiperPhonemize({
      print: (l) => { try { done = true; v(JSON.parse(l).phoneme_ids); } catch (e) { if (!done) rej(e); } },
      printErr: (l) => { if (!done) rej(new Error(l)); },
      locateFile: tndLocate
    }).then((mod) => {
      try { mod.callMain(["-l", espeakVoice, "--input", input, "--espeak_data", "/espeak-ng-data"]); }
      catch (e) { if (!done) rej(e); }
      setTimeout(() => { if (!done) rej(new Error("phonemizer produced no output")); }, 8000);
    }, (e) => { if (!done) rej(e); });
  });
}
const tndSess = { key: null, sess: null };
async function tndGetSession(n2, m2) {
  if (tndSess.key !== n2) {
    const k2 = await f(`${u}/${n2}`, m2);
    const s2 = await _.InferenceSession.create(await k2.arrayBuffer());
    if (tndSess.sess) { try { tndSess.sess.release(); } catch (e2) {} }
    tndSess.key = n2; tndSess.sess = s2;
  }
  return tndSess.sess;
}
// ═══ T&D PATCH r8 (2026-07-17) — session recycle. v1.322/323 fixed the PER-SENTENCE leaks, but
// the surviving cached session's wasm-side arena + per-shape execution-plan cache still grow
// ACROSS turns (every sentence is a new input length = new shape, and wasm linear memory never
// shrinks) — the 2026-07-17 field crash: three full turns fine, iOS killed the tab at unit 9 of
// turn 4. tts.js calls this between narrations once enough predicts have accumulated; the next
// predict (or tts.js's background warm call) rebuilds the session from OPFS. The phonemizer is
// deliberately NOT recycled — recreating it per turn would reintroduce the v1.323 leak class
// (Safari collects discarded wasm memories too lazily under pressure).
// T&D r9 (2026-07-22) — B9 instrumentation. Reports the phonemizer's wasm linear memory, which
// grows only and never shrinks, so a per-callMain leak shows up here as a monotonic climb. Also
// reports how many times main() has been re-entered, so growth can be expressed PER SYNTH — the
// unit the six field crumbs are measured in. Cheap, allocation-free, safe to leave shipped.
function tndDiag() {
  var phon = 0, heap = null;
  try { heap = tndPhon.mod && (tndPhon.mod.HEAPU8 || (tndPhon.mod.wasmMemory && new Uint8Array(tndPhon.mod.wasmMemory.buffer))); } catch (e) {}
  try { phon = heap ? heap.length : 0; } catch (e) {}
  return { phonBytes: phon, phonCalls: tndPhonCalls, phonBroken: !!tndPhon.broken, sessKey: tndSess.key || null, patch: TND_VITS_PATCH };
}
async function tndRecycleSession() {
  if (tndSess.sess) { try { const r = tndSess.sess.release(); if (r && r.then) await r; } catch (e) {} }
  tndSess.sess = null; tndSess.key = null;
}
async function f(e, m) {
  let n = await D(e);
  return n || (n = await S(e, m), await p(e, n)), n;
}
async function I(e, m) {
  const n = c[e], o = [`${u}/${n}`, `${u}/${n}.json`];
  await Promise.all(
    o.map(async (a) => {
      // ═══ T&D PATCH v1.337 (r5) — upstream fired p() (the OPFS write) WITHOUT awaiting it, so
      // download() resolved while the ~78MB commit was still in flight. The first predict right
      // after a download then read the not-yet-committed (empty) file → ORT "No graph was found
      // in the protobuf" — reliably reproduced on a fast connection (2026-07-17 live verify).
      await p(a, await S(a, a.endsWith(".onnx") ? m : void 0));
    })
  );
}
async function F(e) {
  const m = c[e], n = [`${u}/${m}`, `${u}/${m}.json`];
  await Promise.all(n.map((o) => R(o)));
}
async function L() {
  const m = await (await navigator.storage.getDirectory()).getDirectoryHandle("piper", {
    create: !0
  }), n = [];
  for await (const o of m.keys()) {
    const a = o.split(".")[0];
    o.endsWith(".onnx") && a in c && n.push(a);
  }
  return n;
}
async function j() {
  try {
    await (await (await navigator.storage.getDirectory()).getDirectoryHandle("piper")).remove({ recursive: !0 });
  } catch (e) {
    console.error(e);
  }
}
async function P() {
  const e = await fetch(`${u}/voices.json`);
  if (!e.ok)
    throw new Error("Could not retrieve voices file from huggingface");
  return Object.values(await e.json());
}
export {
  TND_VITS_PATCH,
  tndRecycleSession,
  tndDiag,
  u as HF_BASE,
  B as ONNX_BASE,
  c as PATH_MAP,
  x as WASM_BASE,
  I as download,
  j as flush,
  N as predict,
  F as remove,
  L as stored,
  P as voices
};
