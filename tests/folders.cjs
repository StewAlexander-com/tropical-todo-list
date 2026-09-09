const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8');let handler;
const start=source.indexOf("  $('#catStrip').addEventListener('click'");
const end=source.indexOf("  document.addEventListener('click'",start);
const ctx=vm.createContext({$:()=>({addEventListener:(type,fn)=>handler=fn}),Date,render(){}});
vm.runInContext('let listCollapsed=false,catFilter=null,catPickId=null,sel=-1,suppressCatClickUntil=0;'+source.slice(start,end),ctx);
const state=()=>vm.runInContext('catFilter',ctx);
const click=(id,detail=1)=>handler({detail,target:{closest:()=>({dataset:{cat:id}})},preventDefault(){},stopPropagation(){}});
for(const id of ['work','home','misc']){click(id);assert.equal(state(),id);click(id);assert.equal(state(),null);}
click('work');click('home');assert.equal(state(),'home');click('home');assert.equal(state(),null);
vm.runInContext('suppressCatClickUntil=Date.now()-1',ctx);click('misc');assert.equal(state(),'misc');
vm.runInContext('suppressCatClickUntil=Date.now()+350',ctx);click('misc');assert.equal(state(),'misc');click('misc');assert.equal(state(),null);
vm.runInContext('suppressCatClickUntil=Date.now()+350',ctx);click('work',0);assert.equal(state(),'work');
console.log('Folder regressions passed: all toggles, switching, expired drag guard, synthetic click, keyboard activation');

// Exercise the real renderer with a populated folder, not only its filter flag.
class Node {
 constructor(){this.children=[];this.hidden=false;}
 set innerHTML(value){this.children=[];this.html=value;}
 appendChild(child){this.children.push(child);}
 setAttribute(){}
}
const nodes=new Map();
const node=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
let renderedClick;
const rendering=vm.createContext({
 $:id=>id==='#catStrip'?{addEventListener:(e,f)=>renderedClick=f}:node(id),
 Date,Classify:{LABELS:{work:'Work',home:'Home',misc:'Misc'}},
 Dates:{bucketOf:()=> 'someday'},BUCKETS:[{id:'someday',label:'Someday'}],
 el:()=>new Node(),bucketHead:()=>({header:true}),taskRow:t=>({task:t.id}),
 syncBadge(){},syncCatStrip(){},paintSel(){}
});
vm.runInContext(`let listCollapsed=false,catFilter=null,catPickId=null,sel=-1,suppressCatClickUntil=0,tagFilter=null,query='',view=[];
let tasks=['work','home','misc'].map(category=>({id:category,category,done:false,created:0}));
function matches(t){return !catFilter || t.category===catFilter;}
`+source.slice(source.indexOf('function render()'),source.indexOf('function syncCatStrip()'))+source.slice(start,end),rendering);
const tap=id=>renderedClick({detail:1,target:{closest:()=>({dataset:{cat:id}})},preventDefault(){},stopPropagation(){}});
for(const id of ['work','home','misc']){
 tap(id);assert.equal(node('#list').hidden,false);assert.equal(node('#list').children[0].children[1].task,id);
 tap(id);assert.equal(node('#list').hidden,true);assert.equal(node('#list').children.length,0);assert.equal(vm.runInContext('view.length',rendering),0);
 assert.equal(vm.runInContext('tasks.length',rendering),3,'closing must never delete tasks');
 node('#showAllTasks').onclick();assert.equal(node('#list').hidden,false);assert.equal(node('#list').children[0].children.filter(n=>n.task).length,3);
}
console.log('Rendered folder regressions passed: populated Work/Home/Misc rows disappear on close, remain saved, and return via All tasks');
