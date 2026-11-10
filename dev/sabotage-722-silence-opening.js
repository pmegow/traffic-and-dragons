// Prove the shipped blueprint cannot silently lose its reveal boundaries.
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  "file": "samples/the_silence_between_leaves.blueprint",
  "command": [
    "node",
    [
      "dev/tests-722-silence-opening.js"
    ]
  ],
  "cases": [
    {
      "label": "Borrowed-Banner Raider loses revealAct",
      "find": "    {\n      \"name\": \"Borrowed-Banner Raider\",\n      \"kind\": \"goblin fae\",\n      \"threat\": \"moderate\",\n      \"notes\": \"One of Grist's raiders wearing a glamour and stolen court insignia. Uses ambushes and false shouted orders to blame another faction. The Fae Loop exposes the disguise; mismatched tracks, slipping masks, and captured supplies provide mundane clues. May flee or surrender when exposed. Their gear and trail survive if the raider dissolves on defeat.\",\n      \"revealAct\": 2,\n      \"displayName\": \"Reed-cloaked Raider\",\n      \"desc\": \"A slight fae fighter in a reed cloak and court silk, carrying a short blade beneath a dragonfly banner. A hood shadows the face as the fighter calls orders across the marsh.\"\n    }",
      "replace": "    {\n      \"name\": \"Borrowed-Banner Raider\",\n      \"kind\": \"goblin fae\",\n      \"threat\": \"moderate\",\n      \"notes\": \"One of Grist's raiders wearing a glamour and stolen court insignia. Uses ambushes and false shouted orders to blame another faction. The Fae Loop exposes the disguise; mismatched tracks, slipping masks, and captured supplies provide mundane clues. May flee or surrender when exposed. Their gear and trail survive if the raider dissolves on defeat.\",\n      \"displayName\": \"Reed-cloaked Raider\",\n      \"desc\": \"A slight fae fighter in a reed cloak and court silk, carrying a short blade beneath a dragonfly banner. A hood shadows the face as the fighter calls orders across the marsh.\"\n    }",
      "mustFail": "#722 turn zero with all nineteen rules withholds the Raider"
    },
    {
      "label": "Iron-Ward Sentry loses revealAct",
      "find": "    {\n      \"name\": \"Iron-Ward Sentry\",\n      \"kind\": \"goblin fae\",\n      \"threat\": \"moderate\",\n      \"notes\": \"A mine guard with a hooked spear, keys, and an alarm bell, stationed near the royal cells. Knows the ward anchors are worked metal, not invulnerable magic. Can be distracted, bribed, talked into abandoning Grist, or fought. Alarm brings an established nearby patrol, not limitless reinforcements; keys can also be obtained from the guard station.\",\n      \"revealAct\": 3\n    }",
      "replace": "    {\n      \"name\": \"Iron-Ward Sentry\",\n      \"kind\": \"goblin fae\",\n      \"threat\": \"moderate\",\n      \"notes\": \"A mine guard with a hooked spear, keys, and an alarm bell, stationed near the royal cells. Knows the ward anchors are worked metal, not invulnerable magic. Can be distracted, bribed, talked into abandoning Grist, or fought. Alarm brings an established nearby patrol, not limitless reinforcements; keys can also be obtained from the guard station.\"\n    }",
      "mustFail": "#722 Act II admits the Raider and Act III admits the Sentry"
    },
    {
      "label": "Fen Otter-Rider loses name",
      "find": "    {\n      \"name\": \"Fen Otter-Rider\",\n      \"kind\": \"marsh fae\",\n      \"threat\": \"moderate\",\n      \"desc\": \"A marsh fae in reed-woven armor rides a broad-backed otter, carrying a short spear beneath a dragonfly pennant. Water beads on the rider's green-brown cloak as the mount bounds between pools.\",\n      \"notes\": \"A genuine Stillwaters border-patrol member defending the marsh approaches. The rider and otter form one encounter combatant; size the encounter to the hero. Fights to protect the patrol, accepts a truce or help for the wounded, and retreats rather than pursuing a fleeing outsider. Can guide a helpful stranger toward the Fen Court; knows local grievances, not Grist's conspiracy.\"\n    }",
      "replace": "    {\n      \"name\": \"Missing patrol\",\n      \"kind\": \"marsh fae\",\n      \"threat\": \"moderate\",\n      \"desc\": \"A marsh fae in reed-woven armor rides a broad-backed otter, carrying a short spear beneath a dragonfly pennant. Water beads on the rider's green-brown cloak as the mount bounds between pools.\",\n      \"notes\": \"A genuine Stillwaters border-patrol member defending the marsh approaches. The rider and otter form one encounter combatant; size the encounter to the hero. Fights to protect the patrol, accepts a truce or help for the wounded, and retreats rather than pursuing a fleeing outsider. Can guide a helpful stranger toward the Fen Court; knows local grievances, not Grist's conspiracy.\"\n    }",
      "mustFail": "#722 opening has genuine combatants for either patrol"
    },
    {
      "label": "Mire-Gilded Stalker loses desc",
      "find": "    {\n      \"name\": \"Mire-Gilded Stalker\",\n      \"kind\": \"fey monstrosity\",\n      \"threat\": \"moderate\",\n      \"notes\": \"Bred by Grist's goblins using stolen Fen alchemy to frame Stillwater for raids. Submerged lures try to separate travelers before a dragging attack. Bright woodland light hardens the pitch until brittle; a lantern flower or exposed sunbeam can reveal this weakness. Iron fittings bear workshop marks. Bait, careful footing, and a detour can avoid combat. The creatures indicate manufactured raids, not marsh-wide guilt.\",\n      \"desc\": \"A lantern-eyed quadruped prowls low over the water, its hide caked in marsh pitch and jagged iron fittings. Submerged lights ripple beside its dragging limbs.\"\n    }",
      "replace": "    {\n      \"name\": \"Mire-Gilded Stalker\",\n      \"kind\": \"fey monstrosity\",\n      \"threat\": \"moderate\",\n      \"notes\": \"Bred by Grist's goblins using stolen Fen alchemy to frame Stillwater for raids. Submerged lures try to separate travelers before a dragging attack. Bright woodland light hardens the pitch until brittle; a lantern flower or exposed sunbeam can reveal this weakness. Iron fittings bear workshop marks. Bait, careful footing, and a detour can avoid combat. The creatures indicate manufactured raids, not marsh-wide guilt.\"\n    }",
      "mustFail": "#722 Stalker appearance stays separate from its private origin"
    },
    {
      "label": "Borrowed-Banner Raider loses displayName",
      "find": "    {\n      \"name\": \"Borrowed-Banner Raider\",\n      \"kind\": \"goblin fae\",\n      \"threat\": \"moderate\",\n      \"notes\": \"One of Grist's raiders wearing a glamour and stolen court insignia. Uses ambushes and false shouted orders to blame another faction. The Fae Loop exposes the disguise; mismatched tracks, slipping masks, and captured supplies provide mundane clues. May flee or surrender when exposed. Their gear and trail survive if the raider dissolves on defeat.\",\n      \"revealAct\": 2,\n      \"displayName\": \"Reed-cloaked Raider\",\n      \"desc\": \"A slight fae fighter in a reed cloak and court silk, carrying a short blade beneath a dragonfly banner. A hood shadows the face as the fighter calls orders across the marsh.\"\n    }",
      "replace": "    {\n      \"name\": \"Borrowed-Banner Raider\",\n      \"kind\": \"goblin fae\",\n      \"threat\": \"moderate\",\n      \"notes\": \"One of Grist's raiders wearing a glamour and stolen court insignia. Uses ambushes and false shouted orders to blame another faction. The Fae Loop exposes the disguise; mismatched tracks, slipping masks, and captured supplies provide mundane clues. May flee or surrender when exposed. Their gear and trail survive if the raider dissolves on defeat.\",\n      \"revealAct\": 2,\n      \"desc\": \"A slight fae fighter in a reed cloak and court silk, carrying a short blade beneath a dragonfly banner. A hood shadows the face as the fighter calls orders across the marsh.\"\n    }",
      "mustFail": "#722 actual enemy cards reveal no notes or disguised identity"
    }
  ]
})?1:0);
