// sabotage-230-item-define.js — mutation proof for the truthful cap-drop result (joint f20).
// Usage: node dev/sabotage-230-item-define.js
var sabotage = require("./sabotage.js");

var rc = sabotage.prove({
  file: "game.js",
  command: ["node", ["dev/run-tests.js", "#81 item bible"]],
  cases: [
    { label: "joint f20: matching ITEM_DEF proposals stop being recognized",
      mustFail: "matching proposal was not recognized",
      find: "    if(proposed===key)return true;",
      replace: "    if(false)return true;" },
    { label: "joint f20: the caller forgets whether the queue was full before parsing",
      mustFail: "queue-full state is not captured before the handler can drop the proposal",
      find: "  var queueWasFull=pend.length>=5;",
      replace: "  var queueWasFull=false;" },
    { label: "joint f20: landed=false no longer distinguishes the queue-cap drop",
      mustFail: "landed=false does not distinguish the at-cap proposal drop",
      find: "    }else if(queueWasFull&&_itemDefProposalFor(resp,key)){",
      replace: "    }else if(false){" },
    { label: "joint f20: the queue-cap drop returns to a misleading toast",
      mustFail: "truthful queue-full toast missing",
      find: 'showToast("canon was proposed but the confirm queue is full — answer the pending item proposals first.",6000)',
      replace: 'showToast("No canon proposed",6000)' }
  ]
});

process.exit(rc ? 1 : 0);
