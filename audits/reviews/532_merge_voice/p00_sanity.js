require("./h.js");
out("APP_VERSION", APP_VERSION);
out("typeof TTS", typeof TTS);
out("slots", TTS.characterVoiceSlots().map(function (s) { return s.provider + ":" + s.field; }));
out("voicePinFields", typeof voicePinFields === "function" ? voicePinFields() : "(absent)");
out("inheritVoicePins", typeof inheritVoicePins);
out("releaseRowVoicePins", typeof releaseRowVoicePins);
makeWorld();
out("stars", TTS.starsList().length + " " + JSON.stringify(TTS.starsList().slice(0, 4)));
