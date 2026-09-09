const assert=require('node:assert/strict');
const Player=require('../soundscape.js');
const devices=[{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'},{userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)'},{userAgent:'Mozilla/5.0 Macintosh',platform:'MacIntel',maxTouchPoints:5}];
(async()=>{
 for(const device of devices){
  let block=true,plays=0;
  const media={dataset:{},paused:true,ended:false,muted:true,addEventListener(){},play(){plays++;if(block)return Promise.reject(Error('blocked'));this.paused=false;return Promise.resolve();},pause(){this.paused=true;}};
  device.audioSession={type:'auto'};
  const p=new Player(media,class {constructor(){throw Error('Must not create Web Audio on iPhone/iPad');}},device);
  await p.start();assert.equal(p.isPlaying,false);assert.equal(media.dataset.playback,'waiting');
  block=false;const started=p.start();assert.equal(plays,2,'native play occurs synchronously');await started;
  assert.equal(p.isPlaying,true);assert.equal(media.dataset.engine,'native-media');assert.equal(media.muted,false);assert.equal(device.audioSession.type,'playback');
  p.stop();assert.equal(p.isPlaying,false);await p.start();assert.equal(p.isPlaying,true);
 }
 let finish,plays=0;
 const media={dataset:{},paused:true,play(){plays++;return new Promise(r=>finish=()=>{this.paused=false;r();});},pause(){this.paused=true;}};
 const p=new Player(media,null,{});const a=p.start(),b=p.start();assert.equal(plays,1);p.stop();finish();await Promise.all([a,b]);assert.equal(media.paused,true,'late play cannot undo mute');
 console.log('iPhone/iPad regressions passed: native routing, immediate gesture playback, blocked-play retry, mute/resume, pending-play race, optional playback session');
})().catch(e=>{console.error(e);process.exitCode=1;});
