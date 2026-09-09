const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync('app.js','utf8');
const context=vm.createContext({navigator:{language:'en-US'}, Date});
vm.runInContext(source.slice(source.indexOf('const Parse ='),source.indexOf('const $ ='))+'\nglobalThis.api={Parse,Classify,Vocabulary,fuzzy};',context);
const {Parse,Classify,Vocabulary,fuzzy}=context.api;
let checks=0;
for(const [title,category] of [
 ['Touch base with teammates','work'],['Prepare a slide deck','work'],['Proofreading client reports','work'],
 ['Wash the clothes','home'],['Cut the grass','home'],['Take the bins out','home'],['Tidy up the pantry','home'],
 ['Food shopping','home'],['Visit the chemist','misc'],['Book a holiday','misc'],['Go to the fitness centre','misc'],
 ['Pay invoice','work'],['Buy milk','home']]) {
 assert.equal(Classify.suggest(title,[],null,false,{},'').top,category,title);checks++;
}
for(const [q,t,expected] of [['holiday','Book a vacation',true],['laundry','Wash the clothes',true],['slides','Prepare slide deck',true],['exercise','Workout',true],['car','carpet',false],['home','homework',false],['invoice','Invite friends',false]]) {
 assert.equal(Vocabulary.matches(q,t),expected,`${q}: ${t}`);checks++;
}
assert.equal(Classify.suggest('Wash clothes',['work'],null,false,{},'').top,'work');checks++;
assert.equal(Classify.suggest('zebra',[],null,false,{home:['zebra']},'').top,'home');checks++;
for (const text of ['Wash the clothes','monitor deployment','wedding arrangements','mix 3/4 cup','buy 2-3 apples']) {
 assert.equal(Parse.parse(text).title,text);assert.equal(Parse.parse(text).due,null);checks++;
}
const parsed=Parse.parse('Wash the clothes #home tomorrow 3pm');
assert.equal(parsed.title,'Wash the clothes');assert.equal(parsed.tags[0],'home');assert.equal(new Date(parsed.due).getHours(),15);checks++;
assert.ok(fuzzy('invce','invoice')>-1);checks++;
console.log(`${checks} language regression cases passed`);

(async()=>{
 let listeners={}, windowListeners={}, buttonHandler, plays=0, paused=true, reject=true;
 const waves={dataset:{},volume:0,loop:false,get paused(){return paused;},play(){plays++;if(reject)return Promise.reject(Error('blocked'));paused=false;return Promise.resolve();},pause(){paused=true;},addEventListener(){}};
 const btn={dataset:{},setAttribute(){},addEventListener(e,fn){buttonHandler=fn;}};
 const classes={add(){},remove(){},toggle(){}};
 const video={play(){return Promise.resolve();},style:{},classList:classes,pause(){},getAttribute(){return '';},setAttribute(){},addEventListener(){},load(){},readyState:0};
 const document={hidden:false,body:{classList:classes},getElementById(id){return {scene:{classList:classes},btnAmbient:btn,waves,vidA:video,vidB:video}[id];},addEventListener(e,fn){(listeners[e]??=[]).push(fn);}};
 vm.runInNewContext(readFileSync('ambient.js','utf8'),{AmbientPlayer:class extends require('../soundscape.js') { constructor(media){super(media,null);} },document,window:{addEventListener(e,f){windowListeners[e]=f;}},matchMedia:()=>({matches:false,addEventListener(){}}),STORE:{getMeta:async()=>null,setMeta:async()=>{}},setTimeout:()=>1,clearTimeout(){},Promise});
 const settle=()=>new Promise(r=>setImmediate(r));await settle();
 const gesture=()=>listeners.click.forEach(f=>f({target:{closest:()=>null}}));
 gesture();await settle();assert.equal(paused,true);
 reject=false;buttonHandler();await settle();assert.equal(paused,false);assert.equal(plays,2);
 document.hidden=true;listeners.visibilitychange.forEach(f=>f());assert.equal(paused,false);
 buttonHandler();assert.equal(paused,true);
 gesture();await settle();assert.equal(paused,true);
 buttonHandler();await settle();assert.equal(paused,false);
 paused=true;document.hidden=false;listeners.visibilitychange.forEach(f=>f());await settle();assert.equal(paused,false);
 assert.equal(waves.loop,true);
 console.log('Audio regressions passed: rejected-play retry, hidden continuity, mute, unmute, interruption recovery');
})().catch(e=>{console.error(e);process.exitCode=1;});
