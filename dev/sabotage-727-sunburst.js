var sabotage=require('./sabotage.js'),failed=0;
failed+=sabotage.prove({file:'globals.js',command:['node',['dev/run-tests.js','#727 Sunburst']],cases:[
 {label:'Sunburst defaults changed',find:'label:"GPT Image 2.6 Sunburst",slow:true,\n   body:function(p){return {prompt:p,image_size:"landscape_4_3",num_images:1};}',replace:'label:"GPT Image 2.6 Sunburst",slow:true,\n   body:function(p){return {prompt:p,image_size:"landscape_4_3",quality:"low",num_images:1};}',mustFail:'#727 Sunburst keeps the verified endpoint, defaults and queue requirement'},
 {label:'Flare removed from queue',find:'label:"GPT Image 2.5 Flare",slow:true',replace:'label:"GPT Image 2.5 Flare",slow:false',mustFail:'#727 Flare keeps the exact requested endpoint and provider defaults'}
]});
failed+=sabotage.prove({file:'ui-portrait.js',command:['node',['dev/tests-727-sunburst-portraits.js']],cases:[
 {label:'slow portraits sent synchronously',find:'if(mdlCfg.slow)falData=await falQueueRender',replace:'if(false)falData=await falQueueRender',mustFail:'#727 slow portrait models use one queued request with portrait framing'},
 {label:'queue rejection swallowed into an empty result',find:'falData=await falQueueRender(mdlCfg.id,portraitRenderBody(mdlCfg,stPrompt));',replace:'falData=await falQueueRender(mdlCfg.id,portraitRenderBody(mdlCfg,stPrompt)).catch(function(){return {};});',mustFail:'#727 queue errors stay loud without a second paid attempt'},
 {label:'empty queued result returned as absent URL',find:'if(!falData||!falData.images||!falData.images[0]||!falData.images[0].url)throw new Error("No image returned.");',replace:'if(!falData||!falData.images||!falData.images[0]||!falData.images[0].url)return undefined;',mustFail:'#727 empty queued results fail instead of returning an absent image'},
 {label:'reference strength changed',find:'image_url:refSrc,prompt:stPrompt,strength:0.75',replace:'image_url:refSrc,prompt:stPrompt,strength:0.25',mustFail:'#727 fast and reference portraits retain their synchronous transport'}
]});
process.exit(failed?1:0);
