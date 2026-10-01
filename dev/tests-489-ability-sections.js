// tests-489-ability-sections.js — #489 (owner 2026-09-30: "Is sneak attack a racial ability, no… but you might
// think so from the sheet"): the sheet's ability list is grouped under headings — Racial / Class / Archetype /
// Story. An ability record is {nm,ds,gained} with no source field, and "[Racial]" was only text inside one
// ability's name, so everything after it read as racial.
//
// Two kinds of assertion (the tests-429 pattern):
//   • PURE — abilityGroup / abilityGroups (helpers.js) decide the section from the name alone.
//   • RENDER — the real csSheetSections is geval'd into node with DOM stubs; the headings and their order are
//     read out of the HTML it returns.
// DEV TOOL, node-only, registered in dev/run-standalone-suites.js.
//   node dev/tests-489-ability-sections.js

var fs = require("fs"), path = require("path"), assert = require("assert"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");

loader.loadEngine();
loader.makeTestWorld({ kind: "adventure", clock: { min: 625 } });

function __stubEl() {
  return { appendChild: function () {}, style: {}, remove: function () {}, textContent: "", innerHTML: "",
    className: "", classList: { add: function () {}, remove: function () {} }, addEventListener: function () {},
    setAttribute: function () {}, querySelector: function () { return null; }, querySelectorAll: function () { return []; } };
}
global.window = global;
global.navigator = { userAgent: "node" };
global.document = { getElementById: function () { return null; }, querySelector: function () { return null; },
  querySelectorAll: function () { return []; }, createElement: function () { return __stubEl(); },
  body: { appendChild: function () {}, classList: { add: function () {}, remove: function () {}, toggle: function () {} } } };
var geval = eval;
["ui-shell.js", "ui-panels.js", "ui-sheets.js"].forEach(function (f) {
  geval(fs.readFileSync(path.join(ROOT, f), "utf8"));
});

var failed = 0;
function test(name, fn) {
  try { fn(); console.log("PASS #489 " + name); }
  catch (e) { failed++; console.error("FAIL #489 " + name + " — " + (e && e.message)); }
}
/* The shape of the owner's hero sheet, with invented wording: a racial trait first, then class, archetype
   and story abilities interleaved in the order they were gained. */
function hero() {
  var w = loader.makeTestWorld({ kind: "adventure", clock: { min: 625 } }), c = w.character;
  c.cls = "Rogue"; c.level = 14; c.archetype = "arcanetrickster"; c.archetypeNm = "Arcane Trickster";
  c.abilities = [
    { nm: "[Racial] One parent trait", ds: "Advantage on saves against charm." },
    { nm: "Sneak Attack", ds: "Double damage dice when unseen or flanking." },
    { nm: "Arcane Trickster", ds: "Illusion and enchantment spells." },
    { nm: "Lv5", ds: "Uncanny Dodge -- halve an attack's damage as reaction." },
    { nm: "Half-Fey Charm", ds: "Cast a charm once per day." },
    { nm: "Never Caught", ds: "The first time each scene you would be seized, you are not." },
    { nm: "Phantasmal Force", ds: "The target believes a constructed illusion is real." }
  ];
  return c;
}
function keys(c) { return abilityGroups(c).map(function (g) { return g.key + ":" + g.items.join(","); }); }
function headings(html) {
  var out = [], re = /class="cs-abil-grp" data-grp="([a-z]+)"[^>]*>([^<]*)</g, m;
  while ((m = re.exec(html))) out.push(m[1] + "=" + m[2]);
  return out;
}

test("each ability falls under one heading, decided by its name: racial prefix, class bible row, the committed archetype's row, else story", function () {
  var c = hero();
  assert.deepEqual(keys(c), ["racial:0", "class:1,3", "archetype:2,5", "story:4,6"]);
  assert.equal(abilityGroup(c, { nm: "Sneak Attack", ds: "" }), "class", "the reported case: Sneak Attack is a class ability");
  assert.equal(abilityGroup(c, { nm: "sneak attack", ds: "" }), "class", "the name match ignores case");
  assert.equal(abilityGroup(c, { nm: "Lv9", ds: "Blindsense -- know location of hidden creatures within 10ft." }), "class", "an old 'LvN' entry is read by the name inside it");
});
test("another archetype's row is not this character's archetype ability, and a class with no bible entry groups everything as story", function () {
  var c = hero();
  assert.equal(abilityGroup(c, { nm: "Master Poisoner", ds: "" }), "story", "an Assassin row on an Arcane Trickster is not theirs by the bible");
  c.archetype = "";
  assert.equal(abilityGroup(c, { nm: "Never Caught", ds: "" }), "story", "no committed archetype → no archetype section");
  c.cls = "Tinkerer";
  assert.deepEqual(keys(c), ["racial:0", "story:1,2,3,4,5,6"]);
});
test("the headings read in a fixed order, carry the class and archetype names, and an empty group has none", function () {
  var c = hero();
  assert.deepEqual(abilityGroups(c).map(function (g) { return g.label; }), ["Racial", "Class — Rogue", "Archetype — Arcane Trickster", "Story"]);
  c.abilities = [{ nm: "Half-Fey Charm", ds: "x" }, { nm: "Sneak Attack", ds: "y" }];
  assert.deepEqual(abilityGroups(c).map(function (g) { return g.key; }), ["class", "story"], "class reads before story whatever the stored order");
  c.abilities = [];
  assert.deepEqual(abilityGroups(c), [], "no abilities → no headings");
});
test("the render: the sheet prints the headings in order, each ability once under its own, and the racial prefix is not repeated under 'Racial'", function () {
  var c = hero(), html = csSheetSections(c, "");
  assert.deepEqual(headings(html), ["racial=Racial", "class=Class — Rogue", "archetype=Archetype — Arcane Trickster", "story=Story"]);
  var at = function (s) { var i = html.indexOf(s); assert(i >= 0, "missing from the sheet: " + s); return i; };
  var hClass = at('data-grp="class"'), hArch = at('data-grp="archetype"'), hStory = at('data-grp="story"');
  var sneak = at(">Sneak Attack<"), dodge = at(">Uncanny Dodge<"), caught = at(">Never Caught<"), charm = at(">Half-Fey Charm<");
  assert(sneak > hClass && sneak < hArch, "Sneak Attack is not under Class");
  assert(dodge > hClass && dodge < hArch, "the old-format Uncanny Dodge is not under Class by its real name");
  assert(caught > hArch && caught < hStory, "Never Caught is not under Archetype");
  assert(charm > hStory, "Half-Fey Charm is not under Story");
  assert(html.indexOf(">One parent trait<") > 0 && html.indexOf("[Racial] One parent trait<") < 0, "the racial name repeats its own heading");
  assert(html.indexOf(">Lv5<") < 0, "an old 'Lv5' label is still printed as a name");
  assert.equal(html.split('class="cs-abil"').length - 1, c.abilities.length, "an ability is printed twice or dropped");
});
test("the render: a heading is plain text, never a pill, and a sheet with no abilities still says so", function () {
  var c = hero(), html = csSheetSections(c, ""), h = html.slice(html.indexOf('class="cs-abil-grp"'), html.indexOf(">", html.indexOf('class="cs-abil-grp"')));
  assert(!/border|background|border-radius/.test(h), "a heading must not look clickable: " + h);
  c.abilities = [];
  assert(/None yet/.test(csSheetSections(c, "")), "the empty list lost its 'None yet'");
  assert(fs.readFileSync(path.join(ROOT, "dev/run-standalone-suites.js"), "utf8").indexOf("dev/tests-489-ability-sections.js") >= 0, "this battery is not registered in run-standalone-suites.js");
});

if (failed) { console.error("#489 ability sections: " + failed + " FAILED"); process.exit(1); }
console.log("#489 ability sections: all green");
