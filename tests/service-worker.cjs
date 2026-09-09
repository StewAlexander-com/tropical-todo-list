const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const handlers={}, deleted=[],stored=[],adds=[];
const cache={addAll:async reqs=>adds.push(...reqs),put:async(req,res)=>stored.push(req.url),match:async req=>((typeof req==='string'?req:req.url).endsWith('index.html')?new Response('offline shell'):undefined)};
let offline=false,options;
const context={self:{addEventListener:(e,f)=>handlers[e]=f,skipWaiting:async()=>{},clients:{claim:async()=>{}}},location:{origin:'https://www.troplist.com'},URL,Response,Request:class extends Request{constructor(url,opts){super(new URL(url,'https://www.troplist.com/'),opts);}},caches:{open:async()=>cache,keys:async()=>['quiet-v31','quiet-v39-release-1.2.5','other-app'],delete:async k=>deleted.push(k)},fetch:async(req,opts)=>{options=opts;if(offline)throw Error('offline');return new Response('fresh');}};
vm.runInNewContext(fs.readFileSync('sw.js','utf8'),context);
async function life(name){let pending;handlers[name]({waitUntil:p=>pending=p});await pending;}
async function request(path,mode='cors'){let response;const pending=[];handlers.fetch({request:{method:'GET',url:'https://www.troplist.com/'+path,mode,destination:path.endsWith('.html')?'document':'script',headers:new Headers()},respondWith:p=>response=p,waitUntil:p=>pending.push(p)});const res=await response;await Promise.all(pending);return res;}
(async()=>{
 await life('install');assert.ok(adds.every(r=>r.cache==='reload'));assert.ok(adds.some(r=>r.url.endsWith('soundscape.js?v=1.2.3')));
 await life('activate');assert.deepEqual(deleted,['quiet-v31']);
 assert.equal(await (await request('app.js?v=1.2.3')).text(),'fresh');assert.equal(options.cache,'no-store');
 offline=true;assert.equal(await (await request('index.html','navigate')).text(),'offline shell');
 assert.equal((await request('missing.js')).type,'error');
 for(const url of adds){assert.ok(fs.existsSync('.'+new URL(url.url).pathname.replace(/\/$/,'/index.html')),url.url);}
 console.log('Service worker passed: cache bypass, versioned precache, scoped cleanup, fresh scripts, offline navigation, no HTML for missing scripts');
})().catch(e=>{console.error(e);process.exitCode=1;});
