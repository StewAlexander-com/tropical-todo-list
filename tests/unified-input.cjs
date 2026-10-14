const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8');
assert.equal((html.match(/id="search"/g)||[]).length,1);
assert.ok(!/id="(?:add|addWrap|addPlus)"/.test(html));
assert.ok(html.indexOf('id="search"')<html.indexOf('id="catStrip"'));
const nodes=new Map();
function $(id){if(!nodes.has(id))nodes.set(id,{value:'',hidden:true,listeners:{},classList:{toggle(){}},addEventListener(e,f){this.listeners[e]=f;},focus(){this.focused=true;}});return nodes.get(id);}
let added=[],release;
const c=vm.createContext({$,updateHint(raw){c.hint=raw;},syncAddIdle(){},render(){c.rendered=c.query;},addFromInput:async text=>{added.push(text);await new Promise(r=>release=r);}});
vm.runInContext("let listCollapsed=true,query='',sel=4,pendingCat='home';"+source.slice(source.indexOf("  const add =",source.indexOf('function wire()')),source.indexOf("  $('#hint').addEventListener",source.indexOf('function wire()'))),c);
(async()=>{
$('#search').value='Buy milk tomorrow #groceries';$('#search').listeners.input();
assert.equal(vm.runInContext('query',c),'Buy milk tomorrow #groceries');assert.equal(vm.runInContext('listCollapsed',c),false);assert.equal(added.length,0);
const enter=(extra={})=>$('#search').listeners.keydown({key:'Enter',preventDefault(){},...extra});
enter({isComposing:true});enter({keyCode:229});enter({repeat:true});assert.equal(added.length,0);
enter();$('#addBtn').onclick();assert.equal(added.length,1,'rapid Enter plus click must not double-add');assert.equal(added[0],'Buy milk tomorrow #groceries');
release();await new Promise(r=>setImmediate(r));
$('#clearInput').onclick();assert.equal($('#search').value,'');assert.equal(vm.runInContext('query',c),'');assert.equal(vm.runInContext('pendingCat',c),null);assert.ok($('#search').focused);
$('#search').value='another task';await (async()=>{const p=$('#addBtn').onclick();release();await p;})();assert.equal(added.length,2);
console.log('Unified input passed: one top field, live search without creation, raw NLP input, Enter/Add, IME and repeat guards, concurrent-submit guard, clear and refocus');
})().catch(e=>{console.error(e);process.exitCode=1;});
