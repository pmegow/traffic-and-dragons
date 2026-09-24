// sabotage-442-modal-focus.js — mutation proof for #442: the shell moves focus into the dialog, wraps Tab, closes on
// Escape only when dismissible, and restores the opener's focus. Usage: node dev/sabotage-442-modal-focus.js
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  file:"ui-shell.js",
  command:["node",["dev/tests-442-modal-focus.js"]],
  cases:[
    { label:"#442: focus no longer moves into the dialog (Enter reaches the story box again)",
      mustFail:"opening moves focus off the story box",
      find:"  if(first&&first.focus)first.focus();else if(box&&box.focus)box.focus();\n",
      replace:"" },
    { label:"#442: Tab escapes the dialog from the last control",
      mustFail:"Tab from the last control wraps to the first",
      find:"      else if(i===-1||i>=f.length-1){e.preventDefault();f[0].focus();}",
      replace:"" },
    { label:"#442: a forced choice closes on Escape",
      mustFail:"a forced choice (wireClose:false) ignores Escape",
      find:'else if(e.key==="Escape"&&o.escape){',
      replace:'else if(e.key==="Escape"){' },
    { label:"#442: the opener never gets focus back",
      mustFail:"Escape closes a dismissible dialog and gives focus back to the opener",
      find:"  function restore(){if(restored)return;restored=true;",
      replace:"  function restore(){return;restored=true;" }
  ]
}));
