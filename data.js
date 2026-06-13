var TONES=[
  {id:"high",nm:"High Fantasy",tl:"Epic. Heroic. World-saving stakes.",mg:"Abundant",vi:"Stylized",vc:"Write with grandeur and wonder. Heroes can be legendary. Magic is a fact of life. Evil is real and defeatable."},
  {id:"gritty",nm:"Gritty / Low Magic",tl:"Brutal. Grounded. Every wound matters.",mg:"Rare and feared",vi:"Visceral, permanent",vc:"Write with grit and realism. Magic is rare and unsettling. Wounds linger. Survival is never guaranteed. Morality is grey."},
  {id:"swords",nm:"Sword and Sorcery",tl:"Pulpy. Fast. Morally ambiguous.",mg:"Dark, transactional",vi:"Bloody but fast",vc:"Write with pulpy energy. The protagonist is competent and ruthless. Magic is dangerous and tempting. Gold and glory drive action."},
  {id:"horror",nm:"Dark Horror",tl:"Dread. Paranoia. Powerlessness.",mg:"Corrupting",vi:"Psychological, graphic",vc:"Write with creeping dread. Nothing is fully explained. Power corrupts. The world is indifferent. NPCs may be compromised."},
  {id:"politic",nm:"Political Intrigue",tl:"Scheming. Social. Slow-burn danger.",mg:"Background",vi:"Subtle, poison and ruin",vc:"Write with subtlety and tension. Words are weapons. Allies have agendas. Violence is expensive and messy."},
  {id:"custom",nm:"Custom",tl:"You define the world.",mg:"Your rules",vi:"Your call",vc:""}
];
var ANCS=[
  {id:"human",nm:"Human",bonus:"+1 to any two stats",stats:{},fc:2,desc:"Adaptable and relentless. Humans spread across every corner of the world through sheer stubbornness.",traits:["Fast learner -- gain one bonus skill proficiency","Resilient -- advantage on one type of saving throw","Versatile -- no class restriction penalties"],subraces:[{id:"northlander",nm:"Northlander",desc:"Born in harsh cold. Hardy and direct. Resistance to cold environments."},{id:"southron",nm:"Southron",desc:"Desert and coastal traders. Silver-tongued and well-traveled."},{id:"cityborn",nm:"City-born",desc:"Raised in urban sprawl. Street-smart and well-connected."}]},
  {id:"elf",nm:"Elf",bonus:"+2 DEX, +1 INT",stats:{DEX:2,INT:1},fc:0,desc:"Ancient and precise. Elves do not sleep -- they trance. Their memory is long and their grudges longer.",traits:["Darkvision 60ft -- see in darkness as dim light","Trance -- only 4 hours of meditation needed","Keen Senses -- advantage on Perception checks","Fey Ancestry -- immune to magical sleep, advantage vs charm"],subraces:[{id:"highelf",nm:"High Elf",desc:"Scholars and arcanists. Know one cantrip from the sorcerer list."},{id:"woodelf",nm:"Wood Elf",desc:"Hunters of deep forests. Nearly silent in natural terrain. +5ft speed."},{id:"drow",nm:"Drow",desc:"Exiles of the sunless deep. Superior darkvision 120ft. Sunlight sensitivity. Know the Dancing Lights cantrip. Can cast Faerie Fire and Darkness once per day.",racial_spells:[{nm:"Dancing Lights",lvl:0},{nm:"Faerie Fire (racial, 1/day)",lvl:1},{nm:"Darkness (racial, 1/day)",lvl:2}]}]},
  {id:"dwarf",nm:"Dwarf",bonus:"+2 CON, +1 STR",stats:{CON:2,STR:1},fc:0,desc:"Stubborn as the stone they carve from. Dwarves never get lost underground and hold grudges for centuries.",traits:["Darkvision 60ft","Stonecunning -- always know direction and depth underground","Poison Resistance -- advantage on saves, half damage","Dwarven Toughness -- +1 HP per level"],subraces:[{id:"mountain",nm:"Mountain Dwarf",desc:"Warriors for surface conflict. Proficient with all armor types."},{id:"hill",nm:"Hill Dwarf",desc:"Traders and craftsmen. Wise and observant. +1 WIS bonus."},{id:"deep",nm:"Deep Dwarf",desc:"Miners of the lightless depths. Immunity to being frightened."}]},
  {id:"gnome",nm:"Gnome",bonus:"+2 INT, +1 DEX",stats:{INT:2,DEX:1},fc:0,desc:"Quick minds in small bodies. Relentlessly curious, surprisingly resilient, and often underestimated.",traits:["Darkvision 60ft","Gnomish Cunning -- advantage on INT/WIS/CHA saves vs magic","Small size -- easier to hide, harder to grapple","Tinker -- craft minor mechanical devices given time"],subraces:[{id:"forest",nm:"Forest Gnome",desc:"Naturalists and illusionists. Communicate with small animals. Know Minor Illusion."},{id:"rock",nm:"Rock Gnome",desc:"Inventors and engineers. Proficient with tinker tools and alchemist supplies."},{id:"deepg",nm:"Deep Gnome",desc:"Silent survivors of the underdark. Advantage on Stealth in rocky terrain."}]},
  {id:"halfblood",nm:"Half-Blood",bonus:"+1 to any three stats",stats:{},fc:3,desc:"Caught between worlds, belonging fully to neither. Half-bloods carry the strengths of two lineages and the prejudice of both.",traits:["Flex stats -- +1 to any three attributes of your choice","One parent trait -- gain one minor racial trait from your non-human heritage","Outsider -- disadvantage on CHA checks with those hostile to your heritage"],subraces:[
    {id:"half_elven",nm:"Half-Elven",desc:"Charming and perceptive. Gain the Fey Ancestry trait.",lineages:[
      {id:"wood_elf",nm:"Wood Elf",desc:"Near-silent in natural terrain. +5ft speed. Gain the Mask of the Wild trait."},
      {id:"high_elf",nm:"High Elf",desc:"Scholarly and arcane. Know one wizard cantrip of your choice. +1 INT."},
      {id:"drow",nm:"Drow",desc:"Sunless blood. Superior darkvision 120ft. Can cast Faerie Fire once per day.",racial_spells:[{nm:"Faerie Fire (racial)",lvl:1}]}
    ]},
    {id:"half_orcish",nm:"Half-Orcish",desc:"Powerful and imposing. Once per day, drop to 1 HP instead of 0.",lineages:[
      {id:"mountain_orc",nm:"Mountain Orc",desc:"Bred for war. Proficiency with two martial weapons of your choice. +1 STR."},
      {id:"grey_orc",nm:"Grey Orc",desc:"Cunning survivors. Advantage on Survival checks and resistance to the frightened condition."}
    ]},
    {id:"half_draconic",nm:"Half-Draconic",desc:"Scaled patches, slit pupils. Resistance to one elemental damage type.",lineages:[
      {id:"fire_drake",nm:"Fire Drake",desc:"Fire resistance. Breath weapon: 15ft cone, 2d6 fire damage. Once per day."},
      {id:"frost_drake",nm:"Frost Drake",desc:"Cold resistance. Breath weapon: 15ft cone, 2d6 cold damage. Once per day."},
      {id:"storm_drake",nm:"Storm Drake",desc:"Lightning resistance. Breath weapon: 5x30ft line, 2d6 lightning damage. Once per day."},
      {id:"acid_drake",nm:"Acid Drake",desc:"Acid resistance. Breath weapon: 5x30ft line, 2d6 acid damage. Once per day."}
    ]},
    {id:"half_infernal",nm:"Half-Infernal",desc:"Distant tiefling blood. Darkvision 60ft. Cast Thaumaturgy at will."},
    {id:"half_fey",nm:"Half-Fey",desc:"Advantage on saves vs charm. Can cast Charm Person once per day."},
    {id:"half_gnomish",nm:"Half-Gnomish",desc:"Quick-minded and small-framed. Gnomish Cunning trait against magic.",lineages:[
      {id:"forest_gnome",nm:"Forest Gnome",desc:"Minor Illusion cantrip. Can communicate simple ideas with small beasts."},
      {id:"rock_gnome",nm:"Rock Gnome",desc:"Tinker trait: craft tiny clockwork devices. Advantage on INT checks involving alchemy or mechanisms."},
      {id:"deep_gnome",nm:"Deep Gnome",desc:"Darkvision 120ft. Advantage on Stealth checks underground. Stone Camouflage."}
    ]},
    {id:"half_hollow",nm:"Half-Hollow",desc:"Born with a sliver of soul missing -- touched by whatever lies between the living and dead. Cold runs deeper in you than it should. Resistance to necrotic damage. The undead hesitate before you."}
  ]},
  {id:"hollow",nm:"Hollow-Born",bonus:"+2 INT, +1 CHA",stats:{INT:2,CHA:1},fc:0,desc:"Something left its mark on your bloodline. You were born with one foot in the dark. The living find you unsettling without knowing why.",traits:["See in magical darkness","Sense undead and fiends within 30ft before you see them","Unsettling Presence -- advantage on Intimidation","Necrotic Resistance -- half damage from necrotic sources"],subraces:[{id:"shade",nm:"Shade-touched",desc:"Step into shadows and emerge from another within 30ft, once per rest."},{id:"void",nm:"Void-kissed",desc:"Your eyes are wrong. You can see invisible creatures as faint outlines."},{id:"haunted",nm:"Haunted",desc:"Communicate with the recently dead for one minute per day."}]},
  {id:"tiefling",nm:"Tiefling",bonus:"+2 CHA, +1 INT",stats:{CHA:2,INT:1},fc:0,desc:"Infernal heritage runs in your veins. Horns, tail, ember eyes. Distrusted in most places. Feared in the right ones.",traits:["Darkvision 60ft","Fire Resistance -- half damage from fire","Hellish Rebuke -- once per day reaction, 2d10 fire damage to attacker","Infernal Legacy -- minor devil-touched abilities as you level"],subraces:[{id:"infernal",nm:"Infernal",desc:"Descended from devils. Cast Disguise Self once per day."},{id:"abyssal",nm:"Abyssal",desc:"Demon blood. Below half HP, melee attacks deal +1d4 bonus damage."},{id:"fey_tie",nm:"Fey-touched",desc:"Fey and infernal crossed. Unsettling beauty. Misty Step once per day."}]}
];
var CLSS=[
  {id:"Warrior",desc:"Weapon master, armor bearer",gear:"hand-and-a-half sword, chainmail, belt knife, travel rations (3 days)",hd:12,prime:"STR"},
  {id:"Rogue",desc:"Shadow, cunning, and coin",gear:"short blades x2, leather armor, lockpicks, smoke powder, travel rations (3 days)",hd:8,prime:"DEX"},
  {id:"Sorcerer",desc:"Arcane power, fragile body",gear:"carved staff, spell components, grimoire, travel rations (3 days)",hd:6,prime:"INT"},
  {id:"Ranger",desc:"Hunter and tracker",gear:"recurve bow, hunting knife, leather armor, trail kit, travel rations (3 days)",hd:10,prime:"DEX"},
  {id:"Berserker",desc:"Rage, fury, no mercy",gear:"great axe, hide armor, war paint, iron flask, travel rations (3 days)",hd:12,prime:"STR"},
  {id:"Paladin",desc:"Holy warrior, oath-bound",gear:"longsword, shield, chainmail, holy symbol, travel rations (3 days)",hd:10,prime:"CHA"},
  {id:"Cleric",desc:"Divine power, battle priest",gear:"mace, scale armor, shield, holy symbol, prayer beads, travel rations (3 days)",hd:8,prime:"WIS"},
  {id:"Druid",desc:"Nature magic, wild shape",gear:"wooden staff, leather armor, herbalism kit, totem fetish, travel rations (3 days)",hd:8,prime:"WIS"},
  {id:"Necromancer",desc:"Death magic, bone and shadow",gear:"skull focus, dark robes, grimoire of the dead, grave dust pouch, travel rations (3 days)",hd:6,prime:"INT"}
];
var ABILS={
  "Warrior":[{nm:"Power Strike",ds:"+d6 bonus damage on a declared attack."},{nm:"Shield Wall",ds:"Reduce incoming damage by 3 until next turn."},{nm:"Weapon Mastery",ds:"No penalty for improvised or unfamiliar arms."}],
  "Rogue":[{nm:"Sneak Attack",ds:"Double damage dice when unseen or flanking."},{nm:"Evasion",ds:"On a failed DEX save, take half damage instead of full."},{nm:"Lockpick",ds:"Open locks and bypass traps with a DEX check."}],
  "Sorcerer":[{nm:"Arcane Bolt",ds:"Ranged magic attack. INT vs AC, d8 damage."},{nm:"Fire Lance",ds:"d10 damage, ignites flammable targets."},{nm:"Arcane Shield",ds:"Absorbs 5 damage. Lasts until hit."},{nm:"Blink",ds:"Teleport 30ft. DC15 DEX or arrive off target."}],
  "Ranger":[{nm:"Hunter's Mark",ds:"Mark a target. +d4 damage and advantage on tracking."},{nm:"Trackless Step",ds:"Leave no trail in natural terrain."},{nm:"Volley",ds:"Hit up to 2 targets in range with one action."}],
  "Berserker":[{nm:"Rage",ds:"+2 STR, +2 damage, ignore pain. Lasts 3 rounds."},{nm:"Reckless Attack",ds:"Advantage on attack, enemy has advantage back."},{nm:"Intimidating Presence",ds:"CHA check to terrify. Success: enemy shaken (-2 all rolls)."}],
  "Paladin":[{nm:"Divine Smite",ds:"Expend a spell slot to deal +2d8 radiant damage on a hit."},{nm:"Lay on Hands",ds:"Pool of 5xLevel HP. Touch to heal or cure disease/poison."},{nm:"Divine Sense",ds:"Detect undead, fiends, and celestials within 60ft."}],
  "Cleric":[{nm:"Sacred Flame",ds:"Radiant damage cantrip. DEX save or take d8 radiant."},{nm:"Turn Undead",ds:"Undead within 30ft must flee. DC = 8+WIS+proficiency."},{nm:"Healing Word",ds:"Bonus action. Heal target for d4+WIS modifier HP."}],
  "Druid":[{nm:"Wild Shape",ds:"Transform into a beast. CR limit scales with level."},{nm:"Druidic",ds:"Secret language of druids. Leave hidden messages in nature."},{nm:"Speak with Animals",ds:"Communicate with beasts. They share what they have sensed."}],
  "Necromancer":[{nm:"Raise Thrall",ds:"Animate a fresh corpse within 10ft as a zombie thrall. Requires a body present. The thrall follows basic commands and collapses if you fall unconscious. One thrall at a time until your archetype expands this."},{nm:"Drain Life",ds:"Melee or 30ft necrotic attack. Deal d6 necrotic damage; regain HP equal to half the damage dealt."},{nm:"Death Sight",ds:"Sense undead, corpses, and death-taint within 60ft without seeing them. Advantage on Arcana and Lore checks involving undead, curses, or death magic."}]
};
var ARCHETYPES={
  "Warrior":[{id:"champion",nm:"Champion",desc:"Critical hits on 19-20. Superior Athlete. Remarkable endurance in battle."},{id:"battlemaster",nm:"Battle Master",desc:"Maneuver dice to trip, disarm, feint, and rally allies in combat."},{id:"eldritchknight",nm:"Eldritch Knight",desc:"Abjuration and evocation spells. Weapon Bond -- blade returns to hand always."}],
  "Rogue":[{id:"thief",nm:"Thief",desc:"Use objects and magic items as a bonus action. Fast Hands. Supreme Sneak."},{id:"assassin",nm:"Assassin",desc:"Automatic crit against surprised targets. Perfect disguise. Infiltration Expertise."},{id:"arcanetrickster",nm:"Arcane Trickster",desc:"Illusion and enchantment spells. Mage Hand for theft. Distract and confuse."}],
  "Sorcerer":[{id:"draconic",nm:"Draconic Bloodline",desc:"Dragon ancestry. Bonus HP per level. Elemental affinity. Wings at high level."},{id:"wildmagic",nm:"Wild Magic",desc:"Chaotic unstable power. Random surges. Tides of Chaos for lucky advantage."},{id:"shadow",nm:"Shadow Magic",desc:"Power from the Shadowfell. Darkvision. Hound of Ill Omen. Shadow Walk."}],
  "Ranger":[{id:"hunter",nm:"Hunter",desc:"Colossus Slayer on wounded targets. Giant Killer reaction. Defensive multiattack."},{id:"beastmaster",nm:"Beast Master",desc:"Bond with a beast companion that fights alongside you. Primal bond."},{id:"gloomstalker",nm:"Gloom Stalker",desc:"Invisible in magical darkness. Extra attack on first round. Dread Ambusher."}],
  "Berserker":[{id:"totem",nm:"Totem Warrior",desc:"Spirit animal bond. Bear for resistance, Eagle for mobility, Wolf for pack tactics."},{id:"frenzy",nm:"Berserker",desc:"Frenzied rage -- bonus attack every turn. Immune to charm and fear while raging."},{id:"stormherald",nm:"Storm Herald",desc:"Aura of lightning, thunder, or arctic cold. Living storm of destruction."}],
  "Paladin":[{id:"vengeance",nm:"Oath of Vengeance",desc:"Hunter of the wicked. Vow of Enmity for advantage. Relentless pursuit. Banishment."},{id:"devotion",nm:"Oath of Devotion",desc:"Sacred Weapon -- add CHA to attacks. Holy Nimbus aura. Purity of spirit."},{id:"ancients",nm:"Oath of Ancients",desc:"Nature's warrior. Aura of Warding vs spells. Undying Sentinel at 0 HP."}],
  "Cleric":[{id:"life",nm:"Life Domain",desc:"Master healer. Disciple of Life -- healing spells restore bonus HP. Preserve Life."},{id:"war",nm:"War Domain",desc:"God of battle. War Priest bonus attack. Guided Strike -- +10 to a missed attack."},{id:"trickery",nm:"Trickery Domain",desc:"Deception and illusion. Invoke Duplicity -- create a perfect duplicate of yourself."}],
  "Druid":[{id:"land",nm:"Circle of the Land",desc:"Ancient magic of terrain. Bonus spells by terrain type. Natural Recovery of spell slots."},{id:"moon",nm:"Circle of the Moon",desc:"Powerful Wild Shape. Combat beast forms. Elemental forms at high level."},{id:"spores",nm:"Circle of Spores",desc:"Halo of Spores necrotic damage. Symbiotic Entity -- enhanced Wild Shape for combat."}],
  "Necromancer":[{id:"bonesculptor",nm:"Bone Sculptor",desc:"Raise up to 3 thralls simultaneously from available corpses with one casting. Thralls gain +2 AC from bone reinforcement. Can animate dead from a distance of 30ft. The path to undeath begins here."},{id:"shadowweaver",nm:"Shadow Weaver",desc:"Teleport between areas of dim light or darkness within 60ft as a bonus action. Once per rest -- Wraith Form: become incorporeal for 1 round, immune to physical damage and able to pass through walls."},{id:"soulbinder",nm:"Soul Binder",desc:"Trap a dying creature's soul in a prepared vessel (bone, gem, or bottle). One soul per casting, unlimited vessels. Bound souls answer questions truthfully or can be shattered for a 15ft burst of 3d8 necrotic damage."}]
};
var CLASS_FEATURES={
  "Warrior":{2:"Action Surge -- one additional action, once per rest.",5:"Extra Attack -- attack twice per action.",7:"Indomitable -- reroll a failed save, once per rest.",9:"Indomitable (x2) -- twice per rest."},
  "Rogue":{2:"Cunning Action -- Dash, Disengage, or Hide as bonus action.",5:"Uncanny Dodge -- halve an attack's damage as reaction.",7:"Evasion -- no damage on successful DEX saves, half on fail.",9:"Blindsense -- know location of hidden creatures within 10ft."},
  "Sorcerer":{2:"Font of Magic -- sorcery points for spell slots and metamagic.",5:"Metamagic -- Quickened, Twinned, Extended, Subtle spells.",7:"Sorcerous Restoration -- regain 4 sorcery points on short rest.",9:"Overchannel -- maximize spell damage at HP cost."},
  "Ranger":{2:"Fighting Style -- Archery, Defense, Dueling, or Two-Weapon.",5:"Extra Attack -- attack twice per action.",7:"Land's Stride -- no difficult terrain penalty.",9:"Hide in Plain Sight -- +10 Stealth camouflage."},
  "Berserker":{2:"Danger Sense -- advantage on DEX saves vs visible effects.",5:"Extra Attack -- attack twice per action.",7:"Feral Instinct -- advantage on initiative. Act normally if surprised while raging.",9:"Brutal Critical -- extra damage die on critical hits."},
  "Paladin":{2:"Fighting Style -- Defense, Dueling, Great Weapon, or Protection.",5:"Extra Attack -- attack twice per action.",7:"Aura of Protection -- add CHA modifier to saves within 10ft.",9:"Aura of Courage -- allies within 10ft cannot be frightened."},
  "Cleric":{2:"Channel Divinity -- powerful divine ability, once per rest.",5:"Destroy Undead -- Turn Undead destroys weaker undead outright.",7:"Divine Strike -- bonus damage of domain type, once per turn.",9:"Divine Intervention -- 10% chance of deity response."},
  "Druid":{2:"Wild Shape (CR 1/4) -- transform into a beast you have seen.",5:"Wild Shape (CR 1) -- more powerful beast forms available.",7:"Timeless Body -- age at 1/10 normal rate.",9:"Beast Spells -- cast druid spells while in Wild Shape."},
  "Necromancer":{2:"Undead Thrall -- your Raise Thrall servant persists permanently until destroyed. Gains bonus HP equal to your INT modifier. Can follow complex multi-step orders.",5:"Grim Harvest -- when you kill a creature with a spell, regain HP equal to twice the spell's level (minimum 2). Once per turn.",7:"Necrotic Resilience -- resistance to necrotic damage, advantage on death saving throws. Undead you control cannot be Turned by Clerics or Paladins.",9:"Command Undead -- attempt to seize control of any undead creature you can see. INT save (DC 8 + INT modifier + proficiency). Success: under your control for 24 hours."}
};
var SPELLS={
  "Sorcerer":{cantrips:["Fire Bolt (d10 fire, 120ft)","Ray of Frost (d8 cold, slows target)","Mage Hand (telekinesis, 30ft)","Prestidigitation (minor magical tricks)"],1:["Magic Missile (3x d4+1, auto-hit)","Shield (+5 AC as reaction)","Thunderwave (2d8, pushes 10ft)","Chromatic Orb (3d8, choose element)"],2:["Misty Step (teleport 30ft, bonus action)","Scorching Ray (3x 2d6 fire)","Hold Person (paralyze humanoid)","Invisibility (until attack or cast)"],3:["Fireball (8d6 fire, 20ft radius)","Counterspell (negate a spell)","Fly (60ft fly speed, 10 min)"]},
  "Cleric":{cantrips:["Sacred Flame (d8 radiant, DEX save)","Guidance (+d4 to one ability check)","Spare the Dying (stabilize at 0 HP)","Thaumaturgy (minor divine display)"],1:["Healing Word (d4+WIS, bonus action)","Bless (+d4 attacks and saves, 3 targets)","Guiding Bolt (4d6 radiant, next attack has advantage)","Shield of Faith (+2 AC, 10 min)"],2:["Spiritual Weapon (d8+WIS, bonus action attack)","Hold Person (paralyze humanoid)","Lesser Restoration (cure disease or condition)"],3:["Spirit Guardians (3d8 radiant aura)","Revivify (resurrect within 1 min)","Dispel Magic (end one spell)"]},
  "Druid":{cantrips:["Produce Flame (d8 fire, 30ft)","Shillelagh (staff becomes d8+WIS)","Druidcraft (nature minor tricks)","Thorn Whip (d6, pull 10ft)"],1:["Entangle (restrain in 20ft square)","Healing Word (d4+WIS, bonus action)","Thunderwave (2d8, push 10ft)","Faerie Fire (reveal invisible, grants advantage)"],2:["Moonbeam (2d10 radiant, move each turn)","Barkskin (AC cannot be less than 16)","Pass Without Trace (+10 Stealth, party)"],3:["Call Lightning (3d10 lightning each turn)","Conjure Animals (summon beasts)","Plant Growth (difficult terrain, 100ft)"]},
  "Ranger":{1:["Hunter's Mark (d6 bonus damage, track target)","Cure Wounds (d8+WIS heal)","Ensnaring Strike (restrain on hit)","Hail of Thorns (d10 AoE on hit)"],2:["Pass Without Trace (+10 Stealth, party)","Spike Growth (2d4 per 5ft moved)","Silence (no sound in 20ft sphere)"],3:["Conjure Barrage (3d8 weapon AoE)","Lightning Arrow (4d8 lightning)"]},
  "Paladin":{1:["Divine Smite (+2d8 radiant on hit)","Cure Wounds (d8+CHA heal)","Bless (+d4 attacks and saves, 3 targets)","Shield of Faith (+2 AC, 10 min)"],2:["Aid (+5 max HP to 3 allies)","Magic Weapon (+1 to weapon, 1 hour)","Find Steed (summon a warhorse)"],3:["Revivify (resurrect within 1 min)","Dispel Magic (end one spell)","Aura of Vitality (2d6 heal as bonus action)"]},
  "Necromancer":{cantrips:["Chill Touch (d8 necrotic, 120ft; target cannot regain HP until your next turn)","Toll the Dead (WIS save or d8 necrotic; d12 if target is already wounded, 60ft)","Bone Whisper (touch a skull or bone fragment -- sense an echo of its final moments)","Grave Touch (CON save or target has disadvantage on their next attack, 30ft)"],1:["Inflict Wounds (3d10 necrotic, melee touch)","Ray of Sickness (d8 necrotic + poisoned condition, 60ft)","False Life (gain d4+4 temporary HP)","Cause Fear (WIS save or frightened; concentration, 60ft)","Bleed (target bleeds from every orifice for 1d4 necrotic per turn, 1d10 turns or until cancelled, 30ft)"],2:["Ray of Enfeeblement (target STR attacks deal half damage; concentration, 60ft)","Blindness (CON save or blinded for 1 minute)","Shadow Step (teleport 30ft between areas of dim light or darkness)","Shackles of Bone (skeletal arms erupt from earth and wall to pin the target prone or against a surface; restrained until a STR check snaps the bones, 60ft)","Rot (target festers with necrotic sores for 1d6 per turn, 1d10 turns or until cancelled; the greater Bleed, 30ft)"],3:["Vampiric Touch (3d6 necrotic melee; regain HP equal to half damage dealt; concentration)","Speak with Dead (ask a corpse up to 5 questions from its last memories)","Wave of Scarabs (3d6 necrotic in a 30ft directional cone from caster; DEX save for half)","Bestow Curse (WIS save or suffer disadvantage on one ability, vulnerability to one damage type, or lose action on roll of 1-4; concentration)","Miasma (10x10ft cloud of despair, +1ft per INT modifier; creatures inside are wracked with grief and hopelessness -- WIS save or act at disadvantage while within)","Death Walk (step between the worlds of living and dead; move unimpeded through creatures, obstacles, and difficult terrain up to INT feet, ignoring attacks of opportunity)"],4:["Rigor Mortis (CON save or the target seizes rigid and incapacitated for 1d4 turns + caster level)","Possess Thrall (project your mind into one of your thralls, seeing and speaking through it; your own body lies in suspended animation for 1 turn per INT point or until you withdraw)","Sleep of the Dead (feign death on yourself or a creature you touch -- indistinguishable from a true corpse; lasts caster level + INT + INT modifier turns or until cancelled; a self-cast always gets the full duration)"]}
};
var ARCH_SPELLS={
  "eldritchknight":{cantrips:["Fire Bolt (d10 fire, 120ft)","Booming Blade (melee + d8 thunder)"],1:["Shield (+5 AC as reaction)","Absorb Elements (halve element dmg)","Magic Missile (3x d4+1, auto-hit)"],2:["Misty Step (teleport 30ft)","Mirror Image (3 illusory duplicates)"]},
  "arcanetrickster":{cantrips:["Mage Hand (invisible, 30ft)","Minor Illusion (sound or image, 30ft)","Message (whisper 120ft, target replies)"],1:["Charm Person (charmed 1 hour)","Silent Image (visual illusion)","Disguise Self (change appearance)","Feather Fall (reaction; you and nearby allies drift down safely, no fall damage)"],2:["Invisibility (until attack or cast)","Shadow Blade (2d8 psychic weapon)","Knock (a sharp clang unlocks one locked door, chest, or manacle within 60ft)","Darkness (15ft sphere of magical darkness, blocks darkvision, 60ft)","Shadow Step (teleport 30ft between areas of dim light or darkness)","Mirror Image (3 illusory duplicates)"],3:["Blink (at each turn's end roll d20; on 11+ you slip to the ethereal until your next turn -- unhittable, then reappear)","Lethe's Kiss (touch or 30ft; WIS save or the target loses up to 15 minutes of memory per point of your INT modifier -- recent events simply vanish)"],4:["Oubliate (WIS save or surgically erase ONE specific person or event from the target's memory entirely -- the engine scrubs it from what they know, and they cannot recall it even when reminded)"]}
};
var XP_LEVELS=[0,300,900,2700,6500,14000,23000,34000,48000,64000];
var STAT_BUMP_LEVELS=[4,8];
var STATS=["STR","DEX","CON","INT","WIS","CHA"];
var PBC={8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9};var PBM=27;
var STAT_PRIORITY={"Warrior":["STR","CON","DEX","WIS","CHA","INT"],"Rogue":["DEX","INT","CHA","CON","WIS","STR"],"Sorcerer":["INT","DEX","CON","WIS","CHA","STR"],"Ranger":["DEX","WIS","CON","STR","INT","CHA"],"Berserker":["STR","CON","DEX","WIS","CHA","INT"],"Paladin":["CHA","STR","CON","WIS","DEX","INT"],"Cleric":["WIS","CON","STR","CHA","DEX","INT"],"Druid":["WIS","CON","DEX","INT","CHA","STR"],"Necromancer":["INT","CON","DEX","WIS","CHA","STR"]};
var DEFAULT_RULES=[
  "No children or minors may appear in the narrative under any circumstances. All NPCs must be adults.",
  "The world state is absolute truth. Never contradict it.",
  "Player death must be possible. Do not shield the player from consequences.",
  "Never break character or acknowledge being an AI.",
  "Never repeat lore the player already knows. Check memory first.",
  "Never reuse a specific detail, phrase, number, or image you have already used in this session. The conversation history is your reference — if you wrote it once (e.g. 'eight years', 'crimson blade', 'the old debt'), do not write it again. Find a different angle or omit it entirely.",
  "NPCs must behave consistently with their recorded attitude and knowledge.",
  "NPC pronouns are absolute once established. Never use a different pronoun for any NPC. If the player corrects you, immediately emit [NPC_PRONOUN:name|correct/pronouns] and never deviate again.",
  "Pending future events must be honored when their time arrives.",
  "Do not introduce major new NPCs without narrative reason. Use existing NPCs when possible.",
  "Currency is tracked in gold pieces (gp) only. Exchange rate: 10 silver pieces (sp) = 1 gp; 100 copper pieces (cp) = 1 gp. When any transaction is in silver or copper, convert to gp first, then emit [GOLD:±N]. NEVER re-denominate the player's existing gold balance to another denomination -- it is always stored and displayed in gp.",
  "When naming a new NPC, choose from the AVAILABLE NAMES list provided in the system prompt. NEVER use a name on the USED NAMES list. If no available names remain, invent a thematic name in the same style as the provided pool.",
  "HARD LIMIT: Each response must contain NO MORE THAN 3 sentences of narrative prose before the 'You could...' suggestion line. Count your sentences before outputting. If you have written 4 or more, cut until you have 3 or fewer.",
  "Be economical with words. Favour punchy, precise prose over elaborate description. Never restate what the player just did. Never narrate the obvious. Cut any sentence that adds atmosphere but no information.",
  "CHARACTER SHEET UPKEEP — emit state tags in the same response as the event, never deferred: [RELATIONSHIP:entity|descriptor] the moment the player forms, shifts, or severs a bond with any named NPC or faction; [CONDITION:name|duration] the instant a status effect is applied to the player; [CONDITION_REMOVED:name] when it ends; [NPC:name|status|relation] whenever any NPC's attitude or status changes; [QUEST:title|status] on every quest state change (discovered/active/completed/failed). For party members (not the player), use COMPANION_ prefixed tags instead: [COMPANION_CONDITION:Name|cond|dur], [COMPANION_RELATIONSHIP:Name|entity|descriptor], [COMPANION_HP:Name|+/-N], etc. If the narrative says it happened, the tag must be in that response.",
  "XP IS ENGINE-CONTROLLED — award [XP:N] in the same response as the accomplishment: combat won, quest milestone reached, clever or non-violent solution, significant discovery, social victory. Do not wait to be asked. NEVER announce new levels or HP totals — the engine levels the character and reports the numbers; your next prompt reflects the new state. Acknowledge growth narratively only, without numbers.",
  "Any NPC the player directly interacts with (speaks to, trades with, fights) MUST be named and registered with [NPC:name|status|relation] and [NPC_PRONOUN:name|pronouns] in the same response that introduces them — including functional NPCs like innkeepers, guards, and shopkeepers. Unregistered NPCs are forgotten between scenes and will drift. Pure background figures with no direct interaction may stay anonymous.",
  "QUESTS — create freely, but always commit through tags; the ACTIVE QUESTS block in the prompt is the single source of truth. To offer a quest, emit [QUEST:title|offered|one-line description]. An OFFERED quest is NOT active: never treat it as a goal or advance its objectives until the player accepts it. The player accepts via the journal OR by clearly agreeing in the story — only then emit [QUEST:title|active]. NEVER auto-accept on the player's behalf. Add or check off objectives with [QUEST_STEP:title|objective|true/false]. When a quest resolves, emit [QUEST:title|completed] or [QUEST:title|failed] AND award any reward in the same response ([XP:N], [GOLD:N], [ITEM_GAINED:name]). Never describe a quest as existing, advanced, accepted, or completed unless the matching tag is in that same response. Never rename or silently drop a quest already in the ACTIVE QUESTS block."
];
var DEITY_CENTRIC=["Cleric","Paladin","Druid"];
var DEITY_MAP={
  "Cleric":{
    "Lawful Good":"Pelor, God of Sun and Healing",
    "Neutral Good":"Ioun, Goddess of Knowledge and Prophecy",
    "Chaotic Good":"Avandra, Goddess of Change and Luck",
    "Lawful Neutral":"Erathis, Goddess of Civilization",
    "True Neutral":"The Raven Queen, Mistress of Fate",
    "Chaotic Neutral":"Sehanine, Goddess of Moonlight and Illusion",
    "Lawful Evil":"Asmodeus, God of Tyranny",
    "Neutral Evil":"Vecna, the Undying God",
    "Chaotic Evil":"Tharizdun, the Chained God"
  },
  "Paladin":{
    "Lawful Good":"Bahamut, the Platinum Dragon",
    "Neutral Good":"Pelor, God of Sun and Healing",
    "Chaotic Good":"Kord, God of Strength and Thunder",
    "Lawful Neutral":"Erathis, Goddess of Civilization",
    "True Neutral":"The Raven Queen, Mistress of Fate",
    "Chaotic Neutral":"Kord, God of Strength and Thunder",
    "Lawful Evil":"Asmodeus, God of Tyranny",
    "Neutral Evil":"Tiamat, the Dragon Queen",
    "Chaotic Evil":"Tiamat, the Dragon Queen"
  },
  "Druid":{
    "Lawful Good":"Melora, Goddess of Nature and the Sea",
    "Neutral Good":"Corellon, God of Spring and Beauty",
    "Chaotic Good":"Corellon, God of Spring and Beauty",
    "Lawful Neutral":"Melora, Goddess of Nature and the Sea",
    "True Neutral":"The Primal Spirits",
    "Chaotic Neutral":"The Primal Spirits",
    "Lawful Evil":"Torog, God of the Underdark",
    "Neutral Evil":"Torog, God of the Underdark",
    "Chaotic Evil":"Tharizdun, the Chained God"
  }
};
var SPELL_PICK_LIMITS={"cantrips":2,"1":2,"2":2,"3":1};
var SKILLS=[
  // Physical
  {id:"Jumping",          label:"Jumping",              stats:["STR","DEX"], cat:"Physical"},
  {id:"Sprinting",        label:"Sprinting",            stats:["DEX","STR"], cat:"Physical"},
  {id:"Lifting",          label:"Lifting",              stats:["STR"],       cat:"Physical"},
  {id:"Grappling",        label:"Grappling",            stats:["STR"],       cat:"Physical"},
  {id:"Climbing",         label:"Climbing",             stats:["STR","DEX"], cat:"Physical"},
  {id:"Swimming",         label:"Swimming",             stats:["STR","CON"], cat:"Physical"},
  {id:"Distance Running", label:"Distance Running",     stats:["CON","STR"], cat:"Physical"},
  {id:"Riding",           label:"Riding",               stats:["DEX","WIS"], cat:"Physical"},
  // Endurance
  {id:"Hold Breath",           label:"Hold Breath",           stats:["CON"],       cat:"Endurance"},
  {id:"Endure Pain",           label:"Endure Pain",           stats:["CON"],       cat:"Endurance"},
  {id:"Tolerate Alcohol/Drugs",label:"Tolerate Alcohol/Drugs",stats:["CON"],       cat:"Endurance"},
  // Wilderness
  {id:"Foraging",       label:"Foraging",       stats:["WIS","INT"], cat:"Wilderness"},
  {id:"Cooking",        label:"Cooking",        stats:["INT","WIS"], cat:"Wilderness"},
  {id:"Survival",       label:"Survival",       stats:["WIS","INT"], cat:"Wilderness"},
  {id:"Animal Handling",label:"Animal Handling",stats:["WIS"],       cat:"Wilderness"},
  {id:"Navigation",     label:"Navigation",     stats:["WIS","INT"], cat:"Wilderness"},
  {id:"Tracking",       label:"Tracking",       stats:["WIS","INT"], cat:"Wilderness"},
  // Knowledge
  {id:"Arcana",      label:"Arcana",      stats:["INT"],       cat:"Knowledge"},
  {id:"Lore",        label:"Lore",        stats:["INT"],       cat:"Knowledge"},
  {id:"Investigation",label:"Investigation",stats:["INT"],     cat:"Knowledge"},
  {id:"Nature",      label:"Nature",      stats:["INT"],       cat:"Knowledge"},
  {id:"First Aid",   label:"First Aid",   stats:["INT","WIS"], cat:"Knowledge"},
  {id:"Alchemy",     label:"Alchemy",     stats:["INT"],       cat:"Knowledge"},
  // Craft
  {id:"Smithing",  label:"Smithing",  stats:["STR","INT"], cat:"Craft"},
  {id:"Handcraft", label:"Handcraft", stats:["DEX","INT"], cat:"Craft"},
  // Social
  {id:"Persuasion", label:"Persuasion", stats:["CHA"],       cat:"Social"},
  {id:"Deception",  label:"Deception",  stats:["CHA","INT"], cat:"Social"},
  {id:"Intimidation",label:"Intimidation",stats:["CHA","STR"],cat:"Social"},
  {id:"Performance",label:"Performance",stats:["CHA"],       cat:"Social"},
  {id:"Trading",    label:"Trading",    stats:["CHA","INT"], cat:"Social"},
  // Roguish
  {id:"Stealth",        label:"Stealth",        stats:["DEX"],       cat:"Roguish"},
  {id:"Sleight of Hand",label:"Sleight of Hand",stats:["DEX"],       cat:"Roguish"},
  {id:"Lockpicking",    label:"Lockpicking",    stats:["DEX","INT"], cat:"Roguish"},
  {id:"Gambling",       label:"Gambling",       stats:["INT","CHA"], cat:"Roguish"},
  // Perception
  {id:"Perception",label:"Perception",stats:["WIS"],cat:"Perception"},
  {id:"Insight",   label:"Insight",   stats:["WIS"],cat:"Perception"}
];
var SKILL_THRESHOLDS=[1,5,12,25,50]; // cumulative successes for levels 1-5
var SKILL_LEVELS=["Unskilled","Familiar","Trained","Proficient","Expert","Master"];
var SAVE_THREAT_TYPES=["Poison","Disease","Magic","Fire","Cold","Lightning","Fear","Charm","Psionic","Holy","Shadow","Other"];
var NAMES={
  human:["Theron","Aldric","Nia","Brynn","Corven","Caelan","Zara","Devra","Eldric","Dorian","Sable","Edric","Morwen","Eryth","Cade","Fayla","Vesper","Farren","Isolde","Gavric","Davin","Gwynne","Petra","Harlan","Rylan","Hessa","Celeste","Idren","Hawke","Ilara","Nyla","Jareth","Corvus","Kaelan","Seren","Liryn","Aldus","Lorcan","Wyla","Maerik","Thane","Maeve","Briar","Nessa","Kiran","Norvan","Verity","Orla","Draven","Osric","Faye","Palyn","Oswin","Pyra","Tessaly","Rendal","Gareth","Reva","Nolan","Saevar","Sylvie","Thessa","Coran","Torvan","Elara","Vanya","Holt","Wren","Mirren","Arden","Zephyr","Eryn","Cavin","Dael","Lyra","Raen","Doran","Solene","Vesna","Crest","Rhett","Mira","Asha","Hadden","Aldwyn","Taryn","Corva","Vael","Siris","Brecken","Bramble","Lysa","Kessa","Fenwick","Vorn","Aldara","Lyss","Brennan","Calder","Caelin"],
  elf:["Aerindel","Calenmir","Thasindra","Daeris","Quelarin","Erevan","Veilindra","Faerindel","Sorindel","Galindra","Nyrindel","Ilrien","Aelith","Liriel","Caerindel","Miriel","Lythindra","Naelindra","Sereniel","Orindel","Vorindel","Sylvara","Thessindra","Thalindra","Pirindel","Uraiel","Aeravel","Valarei","Galindel","Windrel","Nirithel","Yaelindra","Calyindra","Zirindel","Selaindel","Elorin","Vyrindra","Farindel","Elarindel","Silindra","Norindel","Quelindel","Sylindra","Rindara","Kaeindel","Thessindel","Thornindra","Isindra","Yrindel","Aeravel"],
  dwarf:["Gelvak","Aldun","Rumdun","Borunn","Bakvur","Carunn","Thordun","Dorunn","Olvak","Erdun","Brindun","Fordin","Kadrun","Gorunn","Helvik","Hardin","Darvak","Igrun","Murvun","Jordin","Toldun","Khrunn","Bruvak","Lordin","Orvun","Mordun","Grimvak","Nordin","Kelvun","Skorunn","Durdun","Thorvik","Halvak","Urgrun","Beldvik","Valdun","Karvun","Beldun","Thelvak","Grimrun","Mordvik","Durvak","Brundun","Helgrun","Golvak","Irvunn","Reldun","Korunn","Halvun","Margrun"],
  gnome:["Drixwick","Alwick","Fimwick","Bilwick","Sprockwick","Cogwhistle","Buzzwick","Dazzwick","Clipwick","Elwick","Tinkwick","Figwick","Gizwick","Grizwick","Whirwick","Hemwick","Snapwick","Inkwick","Blipwick","Jixwick","Ratchwick","Krizwick","Cogwick","Nixwick","Frizwick","Pizwick","Nubwick","Quizzwick","Spritzwick","Rizwick","Drizzwick","Sizzwick","Flickwick","Trixwick","Hixwick","Wizzwick","Jotwick","Zippwick","Kixwick","Fumwick"],
  other:["Void","Ash","Scar","Bale","Brand","Cinder","Pyre","Ember","Hex","Flint","Wraith","Grim","Blight","Haze","Crave","Iron","Dusk","Knox","Spite","Lash","Gloom","Mire","Vane","Null","Rack","Onyx","Brood","Pitch","Pall","Quell","Scorn","Ruin","Naught","Soot","Bane","Thorn","Murk","Vex","Shard","Cairn","Dread","Dirge","Lorn","Fell","Gloam","Ghast","Bleak","Smear","Murk","Brand"],
  surnames:["Mirefoot","Stonegall","Keldrun","Wyndfall","Ravenmoor","Flinthallow","Orvaine","Tharwick","Aldenmoor","Grimtide","Saltborn","Harrowfield","Dreadveil","Lorrath","Brackstone","Vareth","Nighthollow","Ulvane","Jornwick","Crestfall","Mordrath","Islevane","Tideborn","Pallwick","Lochvane","Halvorn","Ravenwick","Edenmire","Narwick","Greystone","Quelrath","Farrenholt","Oakhallow","Ironside","Keldmoor","Emberveil","Valdrath","Zethran","Perdrath","Ashvane","Yarwick","Coldwater","Quellvane","Duskmantle","Urnvale","Zaldmoor","Whitlock","Blackthorn","Xandrel","Yornwick"]
};
