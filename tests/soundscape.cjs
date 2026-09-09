const assert = require('node:assert/strict');
const AmbientPlayer = require('../soundscape.js');
let fetches=0, resolveDownload;
global.fetch=()=>{fetches++;return new Promise(resolve=>{resolveDownload=()=>resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});});};
class Context {
 constructor(){this.state='suspended';this.currentTime=0;this.created=0;this.resumes=0;}
 createGain(){return {gain:{value:0,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){}},connect(){}};}
 addEventListener(){}
 resume(){this.resumes++;if(this.failResume){this.failResume=false;return Promise.reject(Error('blocked'));}this.state='running';return Promise.resolve();}
 suspend(){this.state='suspended';return Promise.resolve();}
 decodeAudioData(){return Promise.resolve({duration:60});}
 createBufferSource(){this.created++;return {connect(){},start(){this.starts=(this.starts||0)+1;}};}
}
const media=()=>({dataset:{},querySelector:()=>({getAttribute:()=>'/assets/ambient-crossfade.wav'}),pause(){}});
(async()=>{
 const p=new AmbientPlayer(media(),Context,{userAgent:'iPhone',audioSession:{type:'auto'}});
 const a=p.start(),b=p.start();
 assert.equal(fetches,1,'parallel gestures share one fetch');
 p.stop();resolveDownload();await Promise.all([a,b]);
 assert.equal(p.source,null,'mute during download must not start a source');
 await p.start();assert.equal(p.context.created,1);assert.equal(p.source.loop,true);
 const source=p.source;
 await p.start();assert.equal(p.source,source,'ordinary interactions retain the source');
 p.context.currentTime=.1;
 const before=p.levelAt(.1);p.stop();assert.equal(p.ramp.from,before,'mute holds interpolated level');
 p.context.currentTime=.14;const mutedLevel=p.levelAt(.14);
 await p.start();assert.equal(p.ramp.from,mutedLevel,'rapid unmute must not jump');
 await new Promise(r=>setTimeout(r,180));assert.equal(p.context.state,'running','stale mute timer cancelled');
 p.stop();await new Promise(r=>setTimeout(r,180));assert.equal(p.context.state,'suspended');
 p.context.failResume=true;await p.start();assert.equal(p.media.dataset.playback,'waiting');
 await p.start();assert.equal(p.context.state,'running');assert.equal(p.source,source);
 // A transient fetch failure must be retryable, without layering extra sources.
 global.fetch=async()=>({ok:false});const q=new AmbientPlayer(media(),Context,{userAgent:'iPhone',audioSession:{type:'auto'}});await q.start();assert.equal(q.loading,null);
 global.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});await q.start();assert.equal(q.context.created,1);
 console.log('Soundscape passed: concurrent start, mute during load, held gain ramps, rapid toggles, suspend/resume, unlock and fetch retry, one looping source');
})().catch(e=>{console.error(e);process.exitCode=1;});
