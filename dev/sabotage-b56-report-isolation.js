// B56: prove that the development-loader boundary prevents accidental live reporting.
const sabotage=require('./sabotage.js');
process.exitCode=sabotage.prove({file:'dev/load-engine.js',command:['node',['dev/tests-b56-report-isolation.js']],cases:[
 {label:'production report endpoint remains armed',find:'if (FILES[i] === "error-report.js") global.ERROR_WEBHOOK_URL = "";',replace:'/* production report endpoint remains armed */',mustFail:'B56 development engine loads never send fixture crashes'},
 {label:'partial engine load escapes report isolation',find:'if (FILES[i] === "error-report.js") global.ERROR_WEBHOOK_URL = "";',replace:'if (!upTo && FILES[i] === "error-report.js") global.ERROR_WEBHOOK_URL = "";',mustFail:'B56 development engine loads never send fixture crashes'}
]});
