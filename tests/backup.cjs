const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8');
let writes=[],fail=false;
const c=vm.createContext({Date,Map,Set,Number,window:{},navigator:{language:'en-US'},
FileReader:class{readAsText(file){this.result=file;this.onload();}},
STORE:{restoreSnapshot:async(...args)=>{if(fail)throw Error('disk full');writes.push(args);},put:async()=>{},setMeta:async()=>{}},
render(){},afterChange(){},rememberChoice(){},toast(){}});
vm.runInContext(source.slice(source.indexOf('const Parse ='),source.indexOf('const $ ='))+
"\nlet tasks=[],catLabelTimes={},catPickId=null;const uid=()=> 'generated';\n"+
source.slice(source.indexOf('const BackupRules ='),source.indexOf('/* ============================================================\n * Confetti'))+
source.slice(source.indexOf('async function fileTask('),source.indexOf('/* Pointer drag'))+
'\nglobalThis.api={Classify,BackupRules,Backup,fileTask};',c);
const {Classify:C,BackupRules:R,Backup:B}=c.api;
const defaults={...C.DEFAULTS};let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
check(R.taskStamp({created:100,completedAt:300,updatedAt:200})===300,'latest task timestamp wins');
check(R.taskStamp({created:'bad',updatedAt:Infinity})===0,'invalid timestamps remain unknown');
let x=R.folders({...defaults,work:'Office'},{work:200},{work:'Studio'},{work:100});check(x.labels.work==='Office','older name preserves local');
x=R.folders({...defaults,work:'Office'},{work:200},{work:'Studio'},{work:300});check(x.labels.work==='Studio'&&x.times.work===300,'newer name wins');
x=R.folders({...defaults,work:'Office'},{work:200},{work:'Studio'},{work:200});check(x.labels.work==='Office','tie keeps local');
x=R.folders({...defaults,work:'Office'},{},{work:'Studio'},{});check(x.labels.work==='Office','legacy backup preserves custom name');
x=R.folders(defaults,{}, {work:'Studio'},{});check(x.labels.work==='Studio','legacy backup populates untouched default');
x=R.folders(defaults,{work:200},{work:'Studio'},{});check(x.labels.work==='Work','legacy cannot undo explicit reset');
x=R.folders(defaults,{}, {work:'Home'},{work:300});check(x.labels.work==='Work','duplicate name rejected');
x=R.folders(defaults,{}, {work:'Home',home:'Work'},{work:300,home:300});check(x.labels.work==='Home'&&x.labels.home==='Work','valid name swap accepted');
x=R.folders({...defaults,work:'Office'},{work:300},{work:'Studio'}, {},true);check(x.labels.work==='Studio','replace honors older snapshot');
const importData=(data,mode='merge')=>new Promise((res,rej)=>B.importFile(JSON.stringify(data),mode,(err,result)=>err?rej(err):res(result)));
(async()=>{
vm.runInContext("tasks=[{id:'a',title:'Invoice',category:'work',created:100,updatedAt:100}];",c);
await c.api.fileTask('a','home');const moved=vm.runInContext('tasks[0]',c);check(moved.updatedAt>100&&moved.category==='home','folder move stamps edit');
let result=await importData({tasks:[{id:'a',title:'Old',created:100,updatedAt:100}]});check(result.kept===1&&vm.runInContext('tasks[0].category',c)==='home','old backup cannot undo refile');
result=await importData({tasks:[{id:'b',title:'Legacy',created:100,completedAt:300,done:true}]});check(vm.runInContext("tasks.find(t=>t.id==='b').updatedAt",c)===300,'legacy completion timestamp survives normalization');
vm.runInContext("Classify.LABELS.work='Office';catLabelTimes={work:300};",c);
result=await importData({tasks:[],folders:{work:'Studio'},folderUpdatedAt:{work:100}});check(C.LABELS.work==='Office','import preserves newer folder name');
const before=vm.runInContext('JSON.stringify(tasks)',c);fail=true;
await assert.rejects(importData({tasks:[{id:'new',title:'Replacement'}],folders:{work:'Studio'}},'replace'),/disk full/);
check(vm.runInContext('JSON.stringify(tasks)',c)===before&&C.LABELS.work==='Office','failed replace leaves in-memory state intact');fail=false;
check(writes.length===3,'successful imports use combined persistence boundary');
console.log(`${checks} backup reliability checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
