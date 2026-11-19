var fs = require("fs"), vm = require("vm"), path = require("path");
var root = "C:/Projects/traffic-and-dragons";
var c = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, "car-commands.js"), "utf8"), c);
var gp = fs.readFileSync(path.join(root, "game.js"), "utf8"), ga = gp.indexOf("var CAR_COMMANDS = [");
vm.runInContext(gp.slice(ga, gp.indexOf("\n];", ga) + 3), c);
var lines = [
  "I repeat my offer", "pause at the door", "roll the barrel aside", "one of them", "never mind the guard",
  "I pause", "I pause.", "I roll", "Roll.", "I'll roll", "I repeat", "I resume", "I resume my watch", "repeat", "Again.",
  "Take the last one", "I take the last one", "I'll take the second", "I take two", "do two", "the one", "One.", "two",
  "I do it again", "do it again", "So, again", "Okay, again", "I'll do the first one", "first", "Pick last",
  "Undo", "Undo that", "Put it back", "I put it back", "Scratch that", "Remind me", "Where was I?", "What happened?",
  "What happened before", "Stop here", "I stop here", "Let's stop here", "Wrap it up", "end it for now", "recap",
  "options", "the options", "my options", "choices", "What are my choices?", "Read the story", "Play the scene",
  "Say everything", "Read all", "Play all", "read that again", "one more time", "so one more time", "please repeat",
  "I'll take everything", "Repeat the ritual", "Pause.", "I'll go with three", "Give me four", "Give me the third",
  "Choose life", "choose one", "take one", "Do one", "I roll the dice", "previously", "number one", "option five",
  "the last", "last", "I'll go with the last one", "the fourth", "fourth one"
];
function show(l, n) { var r = c.parseCarCommand(l, n, c.CAR_COMMANDS); return JSON.stringify(r); }
lines.forEach(function (l) { console.log(JSON.stringify(l).padEnd(32), "opts3:", show(l, 3).padEnd(26), "opts0:", show(l, 0), " opts9:", show(l, 9)); });
console.log("--- off-by-one/picks");
[[ "last", 0 ], [ "last", 1 ], [ "last", 9 ], [ "four", 3 ], [ "four", 0 ], [ "one", 1 ], [ "two", 1 ], [ "option 9", 9 ], [ "nine", 9 ], [ "option four", 9 ], ["5", 9]].forEach(function (p) { console.log(p[0], p[1], show(p[0], p[1])); });
console.log("--- confirm");
["what", "right", "the right", "so what", "no time to lose", "never mind", "again", "sure", "i do", "dont", "send"].forEach(function (l) { console.log(l, c.parseConfirmCommand(l)); });
