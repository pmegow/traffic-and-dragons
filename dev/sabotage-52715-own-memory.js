var sabotage=require('./sabotage.js');
process.exit(sabotage.prove({file:'api.js',command:['node',['dev/run-tests.js','#527(15)']],cases:[
  {
    "label": "STYLE again forbids lived detail",
    "find": "THE RECORD IS YOURS, NOT THEIRS: characters speak of the past in their own voice, feeling first, never as a recital of the record. Party members who lived a served memory may recall its details naturally; outsiders know only a passing, possibly garbled handle, never the record's wording or particulars. ",
    "replace": "THE RECORD IS YOURS, NOT THEIRS: when a character speaks of the past they speak as people do — short, vague, feeling first, never the wording of the record; a companion who was there says less, not more; a stranger has only heard a garbled version. ",
    "mustFail": "#527(15) composed STYLE"
  },
  {
    "label": "outsider correction again restricts everyone",
    "find": "Bystanders must let it rest now unless the hero raises it; if a bystander must touch it",
    "replace": "Let it rest now unless the hero raises it; if it must be touched",
    "mustFail": "#527(15) outsider correction"
  },
  {
    "label": "held past no longer binds everyone",
    "find": "a passing handle at most, from anyone",
    "replace": "a passing handle at most, from outsiders",
    "mustFail": "#527(15) outsider correction"
  }
]})?1:0);
