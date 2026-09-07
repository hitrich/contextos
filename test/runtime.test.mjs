import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { Store } from '../core.mjs';
import { ContextOS } from '../sdk/contextos.mjs';

test('real HTTP and MCP clients share durable context, enforce boundaries, and preserve handoffs', { timeout: 20000 }, async () => {
  const temp = mkdtempSync(`${tmpdir()}/contextos-runtime-`), database = resolve(temp,'memory.db');
  const probe = createServer(); probe.listen(0,'127.0.0.1'); await once(probe,'listening');
  const port = probe.address().port; await new Promise(done=>probe.close(done));
  const child = spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(port),CONTEXTOS_DB:database},stdio:['ignore','pipe','pipe']});
  let startupTimer;
  try {
    await new Promise((resolve,reject)=>{
      startupTimer=setTimeout(()=>reject(new Error('Server did not start')),5000);
      child.once('error',reject);child.once('exit',code=>reject(new Error(`Server exited: ${code}`)));
      child.stdout.on('data',data=>{if(data.toString().includes('ContextOS →'))resolve();});
    });
    clearTimeout(startupTimer);
    const base=`http://127.0.0.1:${port}`,client=new ContextOS(base);
    assert.equal((await fetch(base)).status,200);
    assert.equal((await fetch(`${base}/api/state`,{headers:{Origin:'https://untrusted.invalid'}})).status,403);
    assert.equal((await fetch(`${base}/api/memories`,{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'})).status,415);
    assert.equal((await fetch(`${base}/api/tools/call`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'recall',agent:'human'})})).status,400);
    const first=await client.remember({title:'Shared task',content:'Build a portable memory store.',type:'semantic',namespace:'project',source:'Runtime integration check'});
    const updated=await client.remember({...first,content:'Build the SQLite memory store, then add history search.'});
    assert.equal(updated.version,2);
    await assert.rejects(()=>client.remember({...first,content:'A stale edit'}),/changed/);
    assert.equal((await client.history('"portable memory store"')).length,1);
    assert.equal((await client.recall('"portable memory store"')).length,0);
    assert.equal((await client.get(first.id)).versions.length,2);
    const privateMemory=await client.remember({title:'Private constraint',content:'private-content-marker',type:'semantic',namespace:'project',visibility:'private',source:'Owner note'});
    const expired=await client.remember({title:'Outdated decision',content:'expired-content-marker',type:'semantic',namespace:'project',expires_at:'2020-01-01T00:00:00Z',source:'Old session'});
    const review=await client.remember({title:'Review this decision',content:'Confirm the database choice.',type:'procedural',namespace:'project',due_at:'2020-01-01T00:00:00Z',source:'Owner review'});
    const mcp=(agent,calls)=>{
      const messages=[{method:'initialize',params:{protocolVersion:'2025-11-25'}},{method:'tools/list'},...calls.map(([name,args])=>({method:'tools/call',params:{name,arguments:args}}))].map((m,i)=>({jsonrpc:'2.0',id:i+1,...m}));
      const result=spawnSync(process.execPath,['mcp.mjs'],{input:messages.map(m=>JSON.stringify(m)).join('\n')+'\n',env:{...process.env,CONTEXTOS_DB:database,CONTEXTOS_AGENT:agent},encoding:'utf8',timeout:5000});
      assert.equal(result.status,0,result.stderr);
      const output=result.stdout.trim().split('\n').map(JSON.parse);
      assert.equal(output[1].result.tools.length,6);
      return output.slice(2).map(m=>m.result);
    };
    const results=mcp('claude',[
      ['recall',{query:'',tier:'full'}],
      ['remember',{title:'Next step from Claude',content:'Implement namespace filtering next.',type:'procedural',namespace:'project',source:'Claude continuity check'}],
      ['get_memory',{id:privateMemory.id}],['get_memory',{id:expired.id}],
      ['remember',{id:first.id,title:'Blind overwrite',content:'No expected version',type:'semantic',namespace:'project',source:'Unknown'}],
    ]);
    const recalled=JSON.parse(results[0].content[0].text);
    assert(!JSON.stringify(recalled).includes('private-content-marker'));
    assert(!JSON.stringify(recalled).includes('expired-content-marker'));
    assert(recalled.reviews_due.some(m=>m.id===review.id));
    assert(results[2].isError&&results[3].isError&&results[4].isError);
    const next=JSON.parse(results[1].content[0].text);
    const resumed=mcp('codex',[['recall',{query:'"namespace filtering"',tier:'full'}]]);
    assert.equal(JSON.parse(resumed[0].content[0].text).memories[0].id,next.id);
    const handoff=await client.handoff({title:'Continue with Codex',target:'codex',memory_ids:[first.id,next.id],notes:'Preserve the database choice.'});
    const markdown=await (await fetch(`${base}/api/handoffs/${handoff.id}.md`)).text();
    assert(markdown.includes('namespace filtering')&&markdown.includes('Runtime integration check'));
    const fs=await (await fetch(`${base}/api/fs?path=${encodeURIComponent(first.path)}`)).json();assert.equal(fs.id,first.id);
    const reread=new Store(database);assert.equal(reread.get(first.id).version,2);reread.close();
    for(const agent of ['claude','codex','opencode']){const config=await(await fetch(`${base}/api/agents/${agent}/config`)).json();assert(config.code.includes(database));if(agent!=='codex')assert(JSON.parse(config.code));}
    const archive=await client.export(),restored=new Store(':memory:');
    assert.equal(restored.import(archive).imported,5);assert.equal(restored.handoffs().length,1);
    restored.remove(first.id);assert(!JSON.stringify(restored.export()).includes('Runtime integration check'));restored.close();
    const py=spawnSync('python3',['-c','from sdk.contextos import ContextOS; import sys; c=ContextOS(sys.argv[1]); assert len(c.recall("namespace:project")) >= 1',base],{encoding:'utf8',timeout:5000});
    assert.equal(py.status,0,py.stderr);
    writeFileSync(resolve(temp,'mem0.json'),JSON.stringify({results:[{id:'original-1',memory:'Keep the original provenance.',metadata:{project:'Atlas'}}]}));
    const migration=spawnSync(process.execPath,['scripts/migrate-mem0.mjs','--input',resolve(temp,'mem0.json'),'--output',resolve(temp,'archive.json')],{encoding:'utf8',timeout:5000});
    assert.equal(migration.status,0,migration.stderr);
    const migrated=JSON.parse(readFileSync(resolve(temp,'archive.json'),'utf8'));
    assert.equal(migrated.memories[0].visibility,'private');assert(migrated.memories[0].content.includes('original-1'));
    assert.equal((await client.import(migrated)).imported,1);
  } finally {
    clearTimeout(startupTimer);const exited=once(child,'exit');child.kill('SIGTERM');if(child.exitCode===null)await exited;
    rmSync(temp,{recursive:true,force:true});
  }
});
