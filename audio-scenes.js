// Delivery assets are versioned independently of the ignored WAV masters in Audio/.
var AUDIO_SCENES = [{
  id: "smithy", bind: { kind: "village", common: "the smithy" },
  bed: { url: "sfx/smithy-fire-v1.mp3", gain: 0.55, loopStart: 0, loopEnd: 18,
    maxSeconds: 20, channels: 1, maxBytes: 500000, maxDecodedBytes: 4000000 },
  layers: []
}];
