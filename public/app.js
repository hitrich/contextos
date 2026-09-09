import { icon } from './icons.js';
import { shell, memoryResults, eventResults, searchMatch, esc, types, typeIcons, typeIcon, cap, badge, agentName, agentLogo, relative, dateLabel, active, empty } from './views.js';

const state = { appearance: 'system', data: null, page: 'overview', type: 'all', namespace: 'all', query: '', sort: 'updated', view: 'list', eventAction: 'all', eventQuery: '', chartDays: 7 };
try { state.appearance = localStorage.getItem('contextos-appearance') || 'system'; } catch {}
document.documentElement.dataset.theme = state.appearance;
const app = document.querySelector('#app'), modal = document.querySelector('#modal'), inspector = document.querySelector('#inspector');
let selected = null, selectedTab = 'content', configAgent = null, configCode = '', toastTimeout;
async function api(path, method = 'GET', data) {
  const response = await fetch(`/api${path}`, { method, headers: data === undefined ? {} : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}
function toast(message, error = false) {
  const element = document.querySelector('#toast'); clearTimeout(toastTimeout);
  element.textContent = message; element.className = `toast visible ${error ? 'error' : ''}`;
  toastTimeout = setTimeout(() => element.classList.remove('visible'), error ? 6500 : 3500);
}
function route(page) { if (state.page === page) render(); else location.hash = `/${page}`; }
function render() { if (state.data) { app.innerHTML = shell(state); document.title = `ContextOS — ${state.page === 'overview' ? 'Your context, connected' : cap(state.page)}`; } }
async function refresh(renderPage = true) { state.data = await api('/state'); if (renderPage) render(); }
function modalHead(title, subtitle = '') { return `<header class="modal-head"><div><h2 id="modal-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('x',18)}</button></header>`; }
function openModal(content, wide = false) { modal.className = `modal ${wide ? 'wide' : ''}`; modal.innerHTML = content; modal.setAttribute('aria-labelledby','modal-title'); if (!modal.open) modal.showModal(); }
const formError = () => '<div class="form-error" role="alert"></div>';
const closeFooter = (label='Save memory') => `<footer class="modal-footer"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">${label}</button></footer>`;
const options = (values, current, labels = cap) => values.map(v => `<option value="${esc(v)}" ${v===current?'selected':''}>${esc(labels(v))}</option>`).join('');
const dateInput = value => value ? new Date(value).toISOString().slice(0,10) : '';

function memoryForm(memory = null) {
  const m = memory || { title:'',content:'',type:'semantic',namespace:state.namespace==='all'?'project':state.namespace,source:'',tags:[],confidence:95,visibility:'agents',related:[] };
  const field = (label,name,control,full=false) => `<div class="field ${full?'full':''}"><label for="field-${name}">${label}</label>${control}</div>`;
  inspector.close();
  openModal(`<form id="memory-form" data-id="${esc(memory?.id || '')}">${modalHead(memory?'Edit memory':'New memory',memory?'Every edit leaves a version you can come back to.':'Save useful context with a source your next agent can verify.')}<div class="modal-body">${formError()}<div class="form-grid">
    ${field('Title','title',`<input id="field-title" name="title" value="${esc(m.title)}" placeholder="What should your agents remember?" required maxlength="180" autofocus>`,true)}
    ${field('Memory','content',`<textarea id="field-content" name="content" placeholder="Capture the fact, experience, or steps worth keeping…" required maxlength="100000">${esc(m.content)}</textarea>`,true)}
    ${field('Memory type','type',`<select id="field-type" name="type">${options(types,m.type)}</select>`)}
    ${field('Namespace','namespace',`<select id="field-namespace" name="namespace" ${memory?'disabled':''}>${options(['project','user','team'],m.namespace)}</select>`)}
    ${field('Source / provenance','source',`<input id="field-source" name="source" value="${esc(m.source)}" placeholder="A discussion, file, session, or observation" required maxlength="500">`,true)}
    ${field('Tags <span class="optional">· comma separated</span>','tags',`<input id="field-tags" name="tags" value="${esc(m.tags.join(', '))}" placeholder="architecture, decisions">`)}
    ${field('Confidence · %','confidence',`<input id="field-confidence" name="confidence" type="number" min="0" max="100" value="${m.confidence}" required>`)}
    ${field('Visibility','visibility',`<select id="field-visibility" name="visibility">${options(['agents','private'],m.visibility,v=>v==='agents'?'Available to permitted agents':'Private · only you')}</select>`)}
    ${field('Review on <span class="optional">· optional</span>','due_at',`<input id="field-due_at" name="due_at" type="date" value="${dateInput(m.due_at)}">`)}
    ${field('Expires on <span class="optional">· optional</span>','expires_at',`<input id="field-expires_at" name="expires_at" type="date" value="${dateInput(m.expires_at)}"><small>Hidden from agents after this date; retained for inspection.</small>`)}
    ${field('Related memories <span class="optional">· optional</span>','related',`<select id="field-related" name="related" multiple aria-describedby="related-hint">${state.data.memories.filter(r=>r.id!==m.id).map(r=>`<option value="${esc(r.id)}" ${m.related.includes(r.id)?'selected':''}>${esc(r.title)}</option>`).join('')}</select><small id="related-hint">Hold ⌘ or Ctrl to select multiple memories.</small>`)}
    </div></div>${closeFooter(memory?'Save new version':'Save memory')}</form>`,true);
  modal.querySelector('#memory-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, data = new FormData(form);
    const input = { ...(memory||{}), title:data.get('title'), content:data.get('content'), type:data.get('type'), namespace:memory?.namespace || data.get('namespace'), source:data.get('source'), tags:data.get('tags').split(',').map(s=>s.trim()).filter(Boolean), confidence:Number(data.get('confidence')), visibility:data.get('visibility'), due_at:data.get('due_at') || null, expires_at:data.get('expires_at') || null, related:data.getAll('related') };
    await submit(form, async()=>{ const result = await api(memory?`/memories/${encodeURIComponent(memory.id)}`:'/memories',memory?'PUT':'POST',input); modal.close(); await refresh(); toast(memory?'New version saved. Your history is intact.':'Memory saved.'); await openMemory(result.id); });
  });
}
async function submit(form, work) {
  const button = form.querySelector('button[type="submit"]') || form.querySelector('button.primary');
  if (button) button.disabled = true;
  const error = form.querySelector('.form-error'); if (error) error.textContent = '';
  try { await work(); } catch (e) { if (error) error.textContent = e.message; else toast(e.message,true); }
  finally { if (button) button.disabled = false; }
}
async function openMemory(id) {
  selected = await api(`/memories/${encodeURIComponent(id)}`); selectedTab = 'content';
  modal.close(); renderInspector();
  if (!inspector.open) inspector.showModal();
  else inspector.querySelector('[data-action="close-inspector"]').focus();
}
function renderInspector() {
  const {memory:m,versions,events} = selected;
  const related = state.data.memories.filter(r => m.related.includes(r.id));
  const content = selectedTab === 'content' ? `<section class="content-section"><div class="memory-content">${esc(m.content)}</div></section><section class="content-section"><h3>Source and provenance</h3><div class="source-box">${icon('git-branch',18)}<div><strong>${esc(m.source)}</strong><small>Recorded by ${esc(agentName(m.agent))} · ${dateLabel(m.updated_at)}</small></div></div></section><section class="content-section"><h3>Memory path</h3><span class="storage-path mono">${esc(m.path)}</span><button class="text-link" data-action="copy-path">${icon('copy',12)} Copy memory path</button></section>${related.length?`<section class="content-section"><h3>Related memories</h3>${related.map(r=>`<button class="command-result" data-open="${esc(r.id)}">${typeIcon(r.type)}<strong>${esc(r.title)}</strong>${icon('arrow-up-right',13)}</button>`).join('')}</section>`:''}${m.due_at?`<div class="review-banner">${icon('bell',15)}<span>Review ${dateLabel(m.due_at)}</span>${!m.locked?'<button class="text-link" data-action="reviewed">Mark reviewed</button>':''}</div>`:''}${m.expires_at?`<p class="help-text">${active(m)?'Available to agents until':'Expired on'} ${dateLabel(m.expires_at)}.</p>`:''}` : selectedTab === 'versions' ? versions.map(v=>`<article class="version"><header><strong>Version ${v.version} ${v.version===m.version?'· Current':''}</strong><small>${dateLabel(v.updated_at)}</small></header><p>${esc(v.content)}</p><div class="help-text">${esc(v.source)} · ${v.confidence}% confidence ${v.locked?'· Locked':''}</div>${v.version!==m.version?`<button class="btn small" data-restore="${v.version}" ${m.locked?'disabled':''}>${icon('history',12)} Restore as a new version</button>`:''}</article>`).join('') : events.map(e=>`<article class="event"><span class="event-indicator">${icon('git-branch',13)}</span><div class="event-main"><span class="event-title">${esc(cap(e.action))} by ${esc(agentName(e.actor))}</span><div class="event-meta">${dateLabel(e.timestamp)} · ${e.snapshot?`v${e.snapshot.version}`:''}</div><p class="help-text">${esc(e.snapshot?.source || '')}</p></div></article>`).join('');
  inspector.setAttribute('aria-labelledby','memory-title');
  inspector.innerHTML = `<div class="inspector-top"><span>${icon('file-text',14)} Memory inspector</span><button class="icon-button" data-action="close-inspector" aria-label="Close memory inspector" autofocus>${icon('x',18)}</button></div><div class="inspector-body">${typeIcon(m.type)}<h2 id="memory-title">${esc(m.title)}</h2><div class="inspector-tags">${badge(m.type)}<span class="tag neutral">${esc(cap(m.namespace))}</span>${m.locked?'<span class="tag neutral">'+icon('lock-keyhole',10)+' Locked</span>':''}${!active(m)?'<span class="tag neutral">Expired</span>':''}${m.tags.map(t=>`<span class="tag neutral">${esc(t)}</span>`).join('')}</div><div class="inspector-meta"><div><small>Confidence</small><span>${m.confidence}% ${icon('shield-check',12)}</span></div><div><small>Current version</small><span>v${m.version} · ${versions.length} retained</span></div><div><small>Visibility</small><span>${m.visibility==='private'?'Private · only you':'Permitted agents'}</span></div><div><small>Last updated</small><span>${dateLabel(m.updated_at)}</span></div></div><div class="tabs" aria-label="Memory details">${[['content','Memory'],['versions',`Versions (${versions.length})`],['provenance','Provenance']].map(([v,label])=>`<button class="tab ${selectedTab===v?'active':''}" data-inspector-tab="${v}" aria-pressed="${selectedTab===v}">${label}</button>`).join('')}</div>${content}<div class="inspector-actions"><button class="btn primary" data-action="edit-memory" ${m.locked?'disabled':''}>${icon('pencil',13)} Edit memory</button><button class="btn" data-action="lock-memory">${icon(m.locked?'unlock-keyhole':'lock-keyhole',13)} ${m.locked?'Unlock':'Lock'}</button><button class="btn delete" data-action="delete-memory" ${m.locked?'disabled':''} aria-label="Delete memory">${icon('trash-2',13)}</button></div>${m.locked?'<p class="help-text">Locked memories are protected from edits and deletion. You can unlock this memory at any time.</p>':''}</div>`;
}

async function agentConfig(id) {
  configAgent = state.data.agents.find(a=>a.id===id); const config = await api(`/agents/${id}/config`); configCode = config.code;
  openModal(`${modalHead(`A shared memory for ${configAgent.name}`, 'Connect your agent. Keep ownership of your context.')}<form id="agent-form"><div class="modal-body">${formError()}<div class="field-label">1. Choose what this agent can access</div><div class="permission-options">${['project','user','team'].map(n=>`<label><input type="checkbox" name="namespaces" value="${n}" ${configAgent.namespaces.includes(n)?'checked':''}>${cap(n)}</label>`).join('')}<label><input type="checkbox" name="write" ${configAgent.write?'checked':''}>Allow writes</label></div><p class="help-text">Private memories stay private. Locked memories cannot be edited.</p><div class="field-label">2. Merge this into <code>${esc(config.file)}</code></div><pre class="code-box" id="agent-code">${esc(config.code)}</pre><button type="button" class="btn small" data-action="copy-config">${icon('copy',12)} Copy configuration</button><p class="help-text">Save permissions below, then copy the updated configuration. Merge it with your existing file and restart your agent. Approve the MCP server when prompted. Never replace unrelated configuration.</p></div>${closeFooter('Save permissions')}</form>`,true);
  modal.querySelector('#agent-form').addEventListener('submit',async event=>{
    event.preventDefault(); const form = event.currentTarget, data = new FormData(form);
    await submit(form,async()=>{ await api(`/agents/${id}`,'PUT',{namespaces:data.getAll('namespaces'),write:data.has('write')}); await refresh(); await agentConfig(id); toast('Agent permissions saved. Copy the updated configuration.'); });
  });
}
function handoffForm() {
  const target = state.data.agents[1];
  const choices = agent => state.data.memories.filter(m=>active(m)&&m.visibility==='agents'&&agent.namespaces.includes(m.namespace));
  const choiceMarkup = agent => choices(agent).map(m=>`<label class="handoff-choice"><input type="checkbox" name="memory_ids" value="${esc(m.id)}"><span>${esc(m.title)}</span>${badge(m.type)}</label>`).join('') || '<p class="help-text handoff-empty">This agent has no eligible memories. Add project memories or adjust its permissions in Agents.</p>';
  openModal(`<form id="handoff-form">${modalHead('Create a handoff', 'Package the context your next agent needs to get going.')}<div class="modal-body">${formError()}<div class="form-grid"><div class="field full"><label for="handoff-title">Current goal</label><input id="handoff-title" name="title" required maxlength="180" placeholder="What are we picking up next?" autofocus></div><div class="field full"><label for="handoff-target">Continue with</label><select id="handoff-target" name="target">${options(['claude','codex','opencode'],'codex',agentName)}</select></div><div class="field full"><label for="handoff-notes">Next steps and constraints <span class="optional">· optional</span></label><textarea id="handoff-notes" name="notes" maxlength="20000" placeholder="What is done? What comes next? What should stay the same?"></textarea></div><div class="field full"><div class="handoff-select-label"><span class="field-label">Choose the memories to carry over</span><button type="button" class="text-link" data-action="select-memories">Select all</button></div><div id="handoff-choices" class="handoff-memories">${choiceMarkup(target)}</div><small>Only active memories this agent can access are shown.</small></div></div></div>${closeFooter('Create handoff')}</form>`,true);
  modal.querySelector('#handoff-target').addEventListener('change',event=>{ modal.querySelector('#handoff-choices').innerHTML = choiceMarkup(state.data.agents.find(a=>a.id===event.target.value)); });
  modal.querySelector('#handoff-form').addEventListener('submit',async event=>{
    event.preventDefault(); const form = event.currentTarget, data = new FormData(form);
    await submit(form,async()=>{ const packet = await api('/handoffs','POST',{title:data.get('title'),target:data.get('target'),notes:data.get('notes'),memory_ids:data.getAll('memory_ids')}); await refresh(); showHandoff(packet); toast('Handoff created. Review it, then take it with you.'); });
  });
}
function showHandoff(h) {
  openModal(`${modalHead(esc(h.title),`${h.memories.length} memories · Ready for ${agentName(h.target)}`)}<div class="modal-body">${h.notes?`<div class="content-section"><h3 class="field-label">Next steps and constraints</h3><p class="memory-content">${esc(h.notes)}</p></div>`:''}<div class="field-label">Retained context</div>${h.memories.map(m=>`<article class="version handoff-context"><header><strong>${esc(m.title)}</strong>${badge(m.type)}</header><p>${esc(m.content)}</p><small>v${m.version} · ${m.confidence}% confidence · ${esc(m.source)}</small></article>`).join('')}<p class="help-text">Your handoff is stored locally. Download it and provide it to your next agent when you are ready.</p></div><footer class="modal-footer"><a class="btn" href="/api/handoffs/${encodeURIComponent(h.id)}.json" download>${icon('download',13)} JSON</a><a class="btn primary" href="/api/handoffs/${encodeURIComponent(h.id)}.md" download>${icon('download',13)} Download Markdown</a></footer>`,true);
}
function searchDialog() {
  openModal(`<div class="command-search">${icon('search',21)}<input id="command-input" aria-label="Search all memories" placeholder="Search memories, sources, or tags…" maxlength="1000" autofocus><button class="icon-button" data-action="close-modal" aria-label="Close search">${icon('x',17)}</button></div><h2 id="modal-title" class="visually-hidden">Search your memory</h2><div id="command-results" class="search-results"></div><div class="panel-footer"><span>Try type:semantic, agent:claude, or a phrase in quotes</span><span>Esc to close</span></div>`,true);
  updateSearch('');
  modal.querySelector('#command-input').addEventListener('input',event=>updateSearch(event.target.value));
  modal.querySelector('#command-input').addEventListener('keydown',event=>{ if (event.key==='ArrowDown') { event.preventDefault(); modal.querySelector('.command-result')?.focus(); } });
}
function updateSearch(query) {
  const found = state.data.memories.filter(m=>searchMatch(m,query)).slice(0,12);
  modal.querySelector('#command-results').innerHTML = found.length ? found.map(m=>`<button class="command-result" data-open="${esc(m.id)}">${typeIcon(m.type)}<span><strong>${esc(m.title)}</strong><small>${esc(m.namespace)} · ${esc(agentName(m.agent))} · ${relative(m.updated_at)}</small></span></button>`).join('') : empty('No matching memories','Try a broader term. Older content lives in the Event log.');
}
function reminders() {
  const due = state.data.memories.filter(m=>active(m)&&m.due_at&&new Date(m.due_at)<=new Date());
  openModal(`${modalHead('Review reminders',state.data.workspace.reminders?'Keep your context as current as your thinking.':'Review reminders are disabled in Settings.')}<div class="modal-body">${due.length ? due.map(m=>`<button class="command-result" data-open="${esc(m.id)}">${typeIcon(m.type)}<span><strong>${esc(m.title)}</strong><small>Review was due ${dateLabel(m.due_at)}</small></span>${icon('arrow-right',13)}</button>`).join('') : empty('All caught up','Set a review date on a memory and it will appear here when it is time.')}</div>`);
}
function importDialog() {
  openModal(`<form id="import-form">${modalHead('Import archive', 'Restore a ContextOS JSON archive, including its history.')}<div class="modal-body">${formError()}<div class="field"><label for="archive-file">ContextOS archive</label><input id="archive-file" type="file" accept="application/json,.json" required></div><p class="help-text">Import adds new memories and preserves versions and provenance. Existing IDs or paths are never overwritten. An invalid or conflicting archive leaves your workspace unchanged. Maximum size: 12 MiB.</p></div>${closeFooter('Import archive')}</form>`);
  modal.querySelector('#import-form').addEventListener('submit',async event=>{ event.preventDefault(); const form = event.currentTarget; await submit(form,async()=>{ const file = form.querySelector('input').files[0]; if (file.size>12*1024*1024) throw new Error('Choose an archive smaller than 12 MiB.'); let archive; try { archive=JSON.parse(await file.text()); } catch { throw new Error('This file is not valid JSON.'); } const result = await api('/import','POST',archive); modal.close(); await refresh(); toast(`${result.imported} memories imported with their history.`); }); });
}
async function copy(text, success) { try { await navigator.clipboard.writeText(text); toast(success); } catch { toast('Clipboard is unavailable. Select and copy the visible text.',true); } }

document.addEventListener('click',async event=>{
  const sidebar = document.querySelector('.sidebar');
  if (sidebar?.classList.contains('open') && event.clientX > sidebar.getBoundingClientRect().right) {
    sidebar.classList.remove('open'); document.querySelector('.mobile-menu')?.setAttribute('aria-expanded','false');
  }
  const element = event.target.closest('button,a,[role="button"]'); if (!element) return;
  try {
    if (element.dataset.open) return await openMemory(element.dataset.open);
    if (element.dataset.agent) return await agentConfig(element.dataset.agent);
    if (element.dataset.handoff) return showHandoff(state.data.handoffs.find(h=>h.id===element.dataset.handoff));
    if (element.dataset.inspectorTab) { selectedTab=element.dataset.inspectorTab; renderInspector(); inspector.querySelector(`[data-inspector-tab="${selectedTab}"]`).focus(); return; }
    if (element.dataset.restore) { const version = selected.versions.find(v=>v.version===Number(element.dataset.restore)); await api(`/memories/${encodeURIComponent(selected.memory.id)}`,'PUT',{...version,version:selected.memory.version}); await refresh(); await openMemory(selected.memory.id); toast('Earlier context restored as a new version.'); return; }
    switch (element.dataset.action) {
      case 'new-memory': memoryForm(); break;
      case 'edit-memory': memoryForm(selected.memory); break;
      case 'close-modal': modal.close(); break;
      case 'close-inspector': inspector.close(); break;
      case 'workspace': modal.close(); inspector.close(); route('settings'); break;
      case 'menu': { const opened=document.querySelector('#sidebar').classList.toggle('open'); element.setAttribute('aria-expanded',String(opened)); break; }
      case 'search': searchDialog(); break;
      case 'reminders': reminders(); break;
      case 'refresh': await refresh(); toast('Workspace refreshed.'); break;
      case 'type': state.type=element.dataset.type; render(); break;
      case 'filter-type': state.type=element.dataset.type; route('memories'); break;
      case 'clear-filters': state.type='all';state.namespace='all';state.query='';render(); break;
      case 'view': state.view=state.view==='list'?'grid':'list';render();break;
      case 'event-filter': state.eventAction=element.dataset.filter;render();break;
      case 'copy-path': await copy(selected.memory.path,'Memory path copied.');break;
      case 'copy-config': await copy(configCode,'Agent configuration copied.');break;
      case 'lock-memory': await api(`/memories/${encodeURIComponent(selected.memory.id)}/lock`,'POST',{locked:!selected.memory.locked}); await refresh(); await openMemory(selected.memory.id); toast(selected.memory.locked?'Memory locked. Your decision is protected.':'Memory unlocked.'); break;
      case 'reviewed': await api(`/memories/${encodeURIComponent(selected.memory.id)}`,'PUT',{...selected.memory,due_at:null}); await refresh(); await openMemory(selected.memory.id); toast('Review complete.'); break;
      case 'delete-memory': { const m = selected.memory; inspector.close(); openModal(`${modalHead('Delete this memory?', 'This permanently removes its content, versions, and retained copies.')}<div class="modal-body"><p class="memory-content">${esc(m.title)}</p><p class="help-text">Links and saved handoffs are updated too. Previously downloaded files and external backups are outside ContextOS and cannot be recalled.</p>${formError()}</div><footer class="modal-footer"><button class="btn" data-action="close-modal">Keep memory</button><button class="btn danger" id="confirm-delete">${icon('trash-2',13)} Delete permanently</button></footer>`); modal.querySelector('#confirm-delete').addEventListener('click',async e=>{ e.currentTarget.disabled=true; try { await api(`/memories/${encodeURIComponent(m.id)}`,'DELETE',{}); modal.close(); await refresh(); toast('Memory and retained copies deleted.'); } catch (err) {modal.querySelector('.form-error').textContent=err.message;modal.querySelector('#confirm-delete').disabled=false;} }); break; }
      case 'new-handoff': handoffForm();break;
      case 'select-memories': { const boxes=[...modal.querySelectorAll('[name="memory_ids"]')], check=boxes.some(b=>!b.checked);boxes.forEach(b=>b.checked=check);element.textContent=check?'Deselect all':'Select all';break; }
      case 'import': importDialog();break;
    }
  } catch (error) { toast(error.message,true); }
});
document.addEventListener('input',event=>{
  if (event.target.id==='memory-search') {state.query=event.target.value; document.querySelector('#memory-results').innerHTML=memoryResults(state);}
  if (event.target.id==='event-search') {state.eventQuery=event.target.value; document.querySelector('#event-results').innerHTML=eventResults(state);}
});
document.addEventListener('change',event=>{
  if (event.target.id==='appearance') { state.appearance=event.target.value; document.documentElement.dataset.theme=state.appearance; try { localStorage.setItem('contextos-appearance',state.appearance); } catch { toast('Appearance changed for this session. Browser storage is unavailable.',true); } }
  if (event.target.id==='namespace-filter') {state.namespace=event.target.value;document.querySelector('#memory-results').innerHTML=memoryResults(state);}
  if (event.target.id==='sort-memories') {state.sort=event.target.value;document.querySelector('#memory-results').innerHTML=memoryResults(state);}
  if (event.target.id==='chart-days') {state.chartDays=Number(event.target.value);render();}
});
document.addEventListener('submit',async event=>{
  if (event.target.id!=='settings-form') return;
  event.preventDefault(); const form=event.target,data=new FormData(form);
  await submit(form,async()=>{ await api('/settings','PUT',{name:data.get('name'),reminders:data.has('reminders')});await refresh();toast('Workspace preferences saved.'); });
});
document.addEventListener('keydown',event=>{
  if ((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k' && state.data) { event.preventDefault(); inspector.close();searchDialog(); }
  if (event.target.matches('.graph-node')&&['Enter',' '].includes(event.key)) {event.preventDefault();openMemory(event.target.dataset.open).catch(e=>toast(e.message,true));}
  if (event.target.matches('.command-result')&&['ArrowDown','ArrowUp'].includes(event.key)) {event.preventDefault(); const items=[...modal.querySelectorAll('.command-result')],index=items.indexOf(event.target);items[(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}
  if (event.key==='Escape') document.querySelector('#sidebar')?.classList.remove('open');
});
for (const dialog of [modal,inspector]) {
  dialog.addEventListener('click',event=>{ if (event.target===dialog) {const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();} });
  dialog.addEventListener('close',()=>{ if(document.activeElement===document.body&&!modal.open&&!inspector.open)document.querySelector('#main')?.focus(); });
}
window.addEventListener('hashchange',()=>{const page=location.hash.replace(/^#\/?/,'').split('/')[0];state.page=['overview','memories','graph','events','agents','handoffs','settings','docs'].includes(page)?page:'overview';render();window.scrollTo(0,0);});
const canAutoRefresh = () => state.data && !modal.open && !inspector.open && state.page !== 'settings' && !document.activeElement?.matches('input,textarea,select');
window.addEventListener('focus',()=>{ if (canAutoRefresh()) refresh().catch(()=>{}); });
// Refresh reminders and agent activity while visible; never replace an in-progress form.
setInterval(()=>{if(!document.hidden&&canAutoRefresh())refresh().catch(()=>{});},60000);
try { state.page=location.hash.replace(/^#\/?/,'').split('/')[0]||'overview';if(!['overview','memories','graph','events','agents','handoffs','settings','docs'].includes(state.page))state.page='overview';await refresh(); }
catch (error) { app.innerHTML=`<main class="loading-screen"><div class="empty">${icon('database',32)}<h1>Could not open your workspace.</h1><p>${esc(error.message)}</p><button class="btn" id="retry-start">Try again</button></div></main>`;document.querySelector('#retry-start').addEventListener('click',()=>location.reload()); }
