// Designer file operations share one disclosure; image choices come from the game's registry.
function focusDesignerFile(){document.getElementById("designer-file-toggle").focus();}
function showDesignerRenderOptions(){
  renderModel=resolveRenderModel(store.get(RENDER_MDL_K)||renderModel);
  var options=RENDER_MODELS.map(function(model){return "<option value='"+esc(model.id)+"'"+(model.id===renderModel?" selected":"")+">"+esc(model.label)+"</option>";}).join("");
  modalShell("designer-render-modal",
    "<div class='designer-render-heading'><h2>Render Options</h2><button class='tbtn' id='designer-render-close'>Close</button></div>"
    +"<label for='designer-render-model'>Image model</label><select id='designer-render-model'>"+options+"</select>"
    +"<p>Used for Designer portraits and shared with the game's Render Options. Reload an already-open game to use a changed choice.</p>"
    +"<p>Text generation uses the separate Text model setting in File.</p>"
    +"<p id='designer-render-status' role='status' aria-live='polite'></p>",
    {maxWidth:440,closeId:"designer-render-close",outside:true});
  document.getElementById("designer-render-model").addEventListener("change",function(){
    renderModel=resolveRenderModel(this.value);
    var status=document.getElementById("designer-render-status");
    try{store.set(RENDER_MDL_K,renderModel);if(localStorage.getItem(RENDER_MDL_K)!==renderModel)throw new Error("Browser storage did not retain the image model setting.");status.className="";status.textContent="Image model saved.";}
    catch(e){console.warn("[designer render options] "+e.message);status.className="err";status.textContent="Model selected for this tab, but the setting could not be saved: "+e.message;}
  });
}
function buildDesignerFileMenu(){
  var groups=[
    [{id:"btn-new",label:"New blueprint"},{id:"btn-load",label:"Load…"},{id:"btn-save",label:"Save .blueprint"}],
    [{id:"btn-library",label:"Library…"},{id:"btn-publish",label:"Save to My Library"},{id:"btn-publish-catalog",label:"Publish to Catalog",hidden:true}],
    [{id:"btn-render-options",label:"Render Options…"},{id:"btn-render-missing",label:"Render all missing portraits"},{id:"btn-fit-text",label:"Shorten long text",hidden:true},{id:"btn-original-text",label:"Download original text",hidden:true}]
  ];
  var menu=document.getElementById("designer-file"),panel=document.getElementById("designer-file-panel");
  panel.innerHTML=groups.map(function(group){return "<div class='designer-file-group'>"+group.map(function(item){return "<button type='button' id='"+item.id+"'"+(item.hidden?" hidden":"")+">"+item.label+"</button>";}).join("")+"</div>";}).join("")
    +"<div class='designer-file-model'><label for='llm-sel'>Text model</label><select id='llm-sel' title='Model used by Generate, AI assistant and Review'></select></div>";
  menu.addEventListener("click",function(event){
    var button=event.target.closest("button");
    if(button&&panel.contains(button)){menu.open=false;focusDesignerFile();}
  },true); // Close before an action opens a modal, so its focus returns to the visible summary.
  document.addEventListener("click",function(event){if(!menu.contains(event.target))menu.open=false;});
  document.addEventListener("keydown",function(event){if(event.key==="Escape"&&menu.open){event.preventDefault();menu.open=false;focusDesignerFile();}});
  menu.addEventListener("focusout",function(event){if(event.relatedTarget&&!menu.contains(event.relatedTarget))menu.open=false;});
  document.getElementById("btn-render-options").addEventListener("click",showDesignerRenderOptions);
  document.getElementById("btn-render-missing").addEventListener("click",renderMissingDesignerPortraits);
}
buildDesignerFileMenu();
