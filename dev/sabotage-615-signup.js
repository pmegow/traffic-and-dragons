var sabotage=require('./sabotage.js'),rc=0,command=['node',['dev/tests-615-signup.js']];
rc|=sabotage.prove({file:'website/index.html',command:command,cases:[
 {label:'Sign up returns to the boot-skipping game URL',mustFail:'Sign up has a dedicated destination even with saved credentials',find:'href="https://traffic-and-dragons.pages.dev/signup.html">Sign up',replace:'href="https://traffic-and-dragons.pages.dev/">Sign up'}
]});
rc|=sabotage.prove({file:'signup.html',command:command,cases:[
 {label:'existing session automatically enters play',mustFail:'signup page cannot boot or write a campaign',find:'$("account-name").textContent=info.username;view("account");',replace:'$("account-name").textContent=info.username;view("account");location.href="index.html";'},
 {label:'identity error exposes account continuation',mustFail:'failed session verification offers retry and sign-out without account continuation',find:'view("recovery");status("Could not verify your account: "',replace:'view("account");status("Could not verify your account: "'},
 {label:'popup error is swallowed',mustFail:'blocked and cancelled popup errors remain visible and allow retry',find:'if(err){status(String(err),true);return;}',replace:'if(err){return;}'},
 {label:'account name can inject HTML',mustFail:'untrusted account names are rendered as text',find:'$("account-name").textContent=info.username;',replace:'$("account-name").innerHTML=info.username;'},
 {label:'double click starts another login',mustFail:'double click and unsupported provider cannot start a second login',find:'if(pending||!Object.prototype.hasOwnProperty.call(providers,provider))return;',replace:'if(!Object.prototype.hasOwnProperty.call(providers,provider))return;'}
]});process.exit(rc?1:0);
