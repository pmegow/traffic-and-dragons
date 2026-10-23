// Active surfaces: root apps, developer tools, the player guide and public landing page.
// Archived reports retain their historical presentation. The synthesis iframe has no visible UI.
const cp=require('child_process');
module.exports=function(root){return cp.execFileSync('git',['ls-files','*.html'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(f=>f!=='piper-host.html'&&(!f.includes('/')||f.startsWith('dev/')||['DOC/beta-guide.html','website/index.html'].includes(f)));};
