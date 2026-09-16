// Outdoor commons are authored scene bindings; a sublocation is not necessarily indoors.
var AUDIO_EXTERIORS = { village: ["the square", "the animal handler's yard"] };
// Delivery assets are versioned independently of the ignored WAV masters in Audio/.
var AUDIO_SCENES = [{
  id: "smithy", label: "Smithy fire", bind: { kind: "village", common: "the smithy" },
  bed: { url: "sfx/smithy-fire-v2.mp3", gain: 0.55, loopStart: 0, loopEnd: 9.005,
    maxSeconds: 20, channels: 1, maxBytes: 500000, maxDecodedBytes: 4000000 },
  layers: []
},
{
  "id": "village-morning",
  "label": "Village morning",
  "bind": {
    "kind": "village",
    "exterior": true,
    "from": 300,
    "to": 600
  },
  "bed": {
    "url": "sfx/village-morning-v2.mp3",
    "gain": 0.55,
    "loopStart": 0,
    "loopEnd": 27.067,
    "maxSeconds": 125,
    "channels": 1,
    "maxBytes": 2200000,
    "maxDecodedBytes": 24000000
  },
  "layers": []
},
{
  "id": "village-day",
  "label": "Village day",
  "bind": {
    "kind": "village",
    "exterior": true,
    "from": 600,
    "to": 1080
  },
  "bed": {
    "url": "sfx/village-day-v2.mp3",
    "gain": 0.55,
    "loopStart": 0,
    "loopEnd": 55.838,
    "maxSeconds": 125,
    "channels": 1,
    "maxBytes": 2200000,
    "maxDecodedBytes": 24000000
  },
  "layers": []
},
{
  "id": "village-evening",
  "label": "Village evening",
  "bind": {
    "kind": "village",
    "exterior": true,
    "from": 1080,
    "to": 1260
  },
  "bed": {
    "url": "sfx/village-evening-v2.mp3",
    "gain": 0.55,
    "loopStart": 0,
    "loopEnd": 27.919,
    "maxSeconds": 125,
    "channels": 1,
    "maxBytes": 2200000,
    "maxDecodedBytes": 24000000
  },
  "layers": []
},
{
  "id": "village-night",
  "label": "Village night",
  "bind": {
    "kind": "village",
    "exterior": true,
    "from": 1260,
    "to": 300
  },
  "bed": {
    "url": "sfx/village-night-v3.mp3",
    "gain": 0.55,
    "loopStart": 0,
    "loopEnd": 57.79,
    "maxSeconds": 125,
    "channels": 1,
    "maxBytes": 2200000,
    "maxDecodedBytes": 24000000
  },
  "layers": []
},
{
  id: "tavern", label: "Tavern crowd", bind: { kind: "village", common: "the tavern" },
  bed: { url: "sfx/tavern-v1.mp3", gain: 0.55, loopStart: 0, loopEnd: 35.485,
    maxSeconds: 40, channels: 1, maxBytes: 700000, maxDecodedBytes: 8000000 },
  layers: []
}];
