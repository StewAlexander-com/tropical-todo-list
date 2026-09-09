const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8');let handler;
const start=source.indexOf("  $('#catStrip').addEventListener('click'");
const end=source.indexOf("  document.addEventListener('click'",start);
const ctx=vm.createContext({$:()=>({addEventListener:(type,fn)=>handler=fn}),Date,render(){}});
vm.runInContext('let catFilter=null,catPickId=null,sel=-1,suppressCatClickUntil=0;'+source.slice(start,end),ctx);
const state=()=>vm.runInContext('catFilter',ctx);
const click=(id,detail=1)=>handler({detail,target:{closest:()=>({dataset:{cat:id}})},preventDefault(){},stopPropagation(){}});
for(const id of ['work','home','misc']){click(id);assert.equal(state(),id);click(id);assert.equal(state(),null);}
click('work');click('home');assert.equal(state(),'home');click('home');assert.equal(state(),null);
vm.runInContext('suppressCatClickUntil=Date.now()-1',ctx);click('misc');assert.equal(state(),'misc');
vm.runInContext('suppressCatClickUntil=Date.now()+350',ctx);click('misc');assert.equal(state(),'misc');click('misc');assert.equal(state(),null);
vm.runInContext('suppressCatClickUntil=Date.now()+350',ctx);click('work',0);assert.equal(state(),'work');
console.log('Folder regressions passed: all toggles, switching, expired drag guard, synthetic click, keyboard activation');
