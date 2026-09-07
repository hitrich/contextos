import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { Store, NAMESPACES } from '../core.mjs';

const { values } = parseArgs({ options: { input: {type:'string'}, output:{type:'string'}, namespace:{type:'string',default:'user'}, share:{type:'boolean',default:false} } });
if (!values.input || !values.output || !NAMESPACES.includes(values.namespace)) {
  console.error('Usage: node scripts/migrate-mem0.mjs --input mem0.json --output contextos.json [--namespace user|project|team] [--share]');
  process.exit(1);
}
const store = new Store(':memory:');
try {
  if (statSync(values.input).size>12*1024*1024) throw new Error('Input must be at most 12 MiB.');
  const raw=readFileSync(values.input,'utf8');
  const data=JSON.parse(raw), rows=Array.isArray(data)?data:data.results;
  if (!Array.isArray(rows)||rows.length>10000) throw new Error('Expected an array of mem0 records or { results: [...] }.');
  rows.forEach((row,index)=>{
    if (!row || typeof row.memory!=='string' || !row.memory.trim()) throw new Error(`Record ${index+1} is missing its memory text.`);
    const {memory,...original}=row;
    store.save({ title:typeof row.metadata?.title==='string'?row.metadata.title.slice(0,180):memory.trim().split('\n')[0].slice(0,100), content:`${memory}\n\nImported mem0 metadata:\n${JSON.stringify(original,null,2)}`, type:'semantic', namespace:values.namespace, source:`mem0 export · original record ${String(row.id??index+1).slice(0,300)}`, tags:['mem0','imported'], visibility:values.share?'agents':'private', confidence:50 });
  });
  mkdirSync(dirname(values.output),{recursive:true,mode:0o700});
  writeFileSync(values.output,JSON.stringify(store.export(),null,2),{flag:'wx',mode:0o600});
  console.log(`Converted ${rows.length} memories. ${values.share?'Available to permitted agents':'Private by default'}. Import the archive through ContextOS Settings.`);
} finally { store.close(); }
