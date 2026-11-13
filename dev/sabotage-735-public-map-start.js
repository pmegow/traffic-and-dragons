// Public creation must be empty and atomic even when the story already holds private location facts.
// Every clause uses a real section plus its exact guarding assertion; sabotage.js mutates a scratch clone.
var sabotage = require("./sabotage.js");
function refusal(label, condition, message, test) {
  return { label: label, find: "if(" + condition + ")throw new Error(\"" + message + "\");", replace: "", mustFail: test };
}
process.exit(sabotage.prove({
  file: "atlas.js",
  command: ["node", ["dev/run-tests.js", "#735 public map creation"]],
  cases: [
    { label: "public creation falls through to procedural generation", find: "if(opts&&opts.knowledge===true)return atlasCreatePublic(seed);", replace: "", mustFail: "#735 public creation never invokes a procedural generator or fingerprint" },
    { label: "public creation fingerprints a document", find: "p=atlasPointer();g=MapKnowledge.create();why=MapKnowledge.problem(g);", replace: "p=atlasPointer();atlasFingerprint({});g=MapKnowledge.create();why=MapKnowledge.problem(g);", mustFail: "#735 public creation never invokes a procedural generator or fingerprint" },
    { label: "public store loses its knowledge mode", find: "A=atlasBaseStore(seed);A.knowledge=1;A.publicNotes=keyedDict();", replace: "A=atlasBaseStore(seed);A.publicNotes=keyedDict();", mustFail: "#735 public creation installs one valid empty store at the final starting place" },
    { label: "the neutral root gains invented geometry parameters", find: 'params:{seed:seed},name:p.sub||p.world', replace: 'params:{seed:seed,width:800,height:500},name:p.sub||p.world', mustFail: "#735 public creation installs one valid empty store at the final starting place" },
    refusal("malformed location memory is accepted", '!record(M)||!record(M.map)||!record(M.map.nodes)||!Array.isArray(M.map.edges)', "atlas: public creation needs valid location memory", "#735 null incomplete and malformed memory refuse before either store is installed"),
    refusal("another campaign's memory is accepted", 'typeof memoryOwnerMismatch==="function"&&memoryOwnerMismatch(W,M)', "atlas: the map memory belongs to a different campaign", "#735 a mismatched memory owner refuses without changing either campaign record"),
    refusal("existing false or null atlas evidence is replaced", '"atlas" in W', "atlas: public creation cannot replace an existing atlas record", "#735 any existing atlas is preserved including damaged and newer evidence"),
    refusal("existing geography is replaced", '"geography" in map', "atlas: public creation cannot overwrite existing geography", "#735 existing geography is never overwritten even when null undefined or newer"),
    refusal("a nonwritable destination allows a partial install", '!writable(W,"atlas")||!writable(W,"ver")||!writable(map,"geography")', "atlas: public map destinations are not writable", "#735 nonwritable destinations refuse before partial installation"),
    refusal("a build that cannot save knowledge creates it anyway", 'typeof SAVE_VER!=="number"||!isFinite(SAVE_VER)||SAVE_VER<13||Math.floor(SAVE_VER)!==SAVE_VER||typeof ATLAS_VER!=="number"||!isFinite(ATLAS_VER)||ATLAS_VER<2||Math.floor(ATLAS_VER)!==ATLAS_VER', "atlas: this build cannot safely save public map knowledge", "#735 unsupported save or atlas compatibility refuses without version stamping"),
    refusal("a newer campaign is silently restamped", 'typeof W.ver!=="number"||!isFinite(W.ver)||W.ver<1||Math.floor(W.ver)!==W.ver||W.ver>SAVE_VER', "atlas: the campaign save version is not compatible with public map creation", "#735 unsupported save or atlas compatibility refuses without version stamping"),
    { label: "an object sublocation becomes a public starting name", find: '||(W.world.sublocation!=null&&typeof W.world.sublocation!=="string")', replace: "", mustFail: "#735 no campaign or no valid final place refuses atomically" },
    refusal("creation installs state without the public renderer", 'typeof MapKnowledge==="undefined"||typeof MapKnowledge.create!=="function"||typeof MapKnowledge.problem!=="function"||typeof TnDMaps==="undefined"||typeof TnDMaps.schematic!=="function"', "atlas: the public map libraries are unavailable", "#735 missing public library refuses without installing either store"),
    { label: "prepared geography bypasses validation", find: "p=atlasPointer();g=MapKnowledge.create();why=MapKnowledge.problem(g);", replace: "p=atlasPointer();g=MapKnowledge.create();why=null;", mustFail: "#735 invalid prepared geography refuses before either install" },
    { label: "prepared atlas bypasses validation", find: 'why=atlasShapeProblem(A);if(why)throw new Error("atlas: public store could not be prepared — "+why);', replace: 'why=null;if(why)throw new Error("atlas: public store could not be prepared — "+why);', mustFail: "#735 a refused prepared atlas shape leaves geography untouched" }
  ]
}));
