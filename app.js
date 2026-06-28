/* Quiet — calm, local-first todo PWA. Zero dependencies, zero network.
 * Architecture: a thin Store interface over IndexedDB. To add encryption later,
 * implement an EncryptedStore with the same async surface and swap STORE below.
 * Nothing else in the app touches persistence directly. */

'use strict';

/* ============================================================
 * Store — the single persistence boundary (swappable)
 * ============================================================ */
const Store = (() => {
  const DB = 'quiet', VER = 1, TASKS = 'tasks', META = 'meta';
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, VER);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(TASKS)) db.createObjectStore(TASKS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'k' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  function tx(store, mode) {
    return open().then(db => {
      const t = db.transaction(store, mode);
      return { os: t.objectStore(store), done: new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }) };
    });
  }
  const wrap = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  return {
    async all() { const { os } = await tx(TASKS, 'readonly'); return wrap(os.getAll()); },
    async put(task) { const { os, done } = await tx(TASKS, 'readwrite'); os.put(task); await done; return task; },
    async putMany(tasks) { const { os, done } = await tx(TASKS, 'readwrite'); tasks.forEach(t => os.put(t)); await done; },
    async del(id) { const { os, done } = await tx(TASKS, 'readwrite'); os.delete(id); await done; },
    async clear() { const { os, done } = await tx(TASKS, 'readwrite'); os.clear(); await done; },
    async getMeta(k) { const { os } = await tx(META, 'readonly'); const r = await wrap(os.get(k)); return r ? r.v : undefined; },
    async setMeta(k, v) { const { os, done } = await tx(META, 'readwrite'); os.put({ k, v }); await done; },
  };
})();
const STORE = Store; // swap point for a future EncryptedStore

/* ============================================================
 * Natural-language parser — dates + #tags from one line
 * ============================================================ */
const Parse = (() => {
  const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const DAY_ABBR = { sun:0, mon:1, tue:2, tues:2, wed:3, weds:3, thu:4, thur:4, thurs:5-1, fri:5, sat:6 };
  DAY_ABBR.thu = 4; DAY_ABBR.thurs = 4; DAY_ABBR.thur = 4;
  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const startOfDay = d => { const x = new Date(d); x.setHours(0,0,0,0); return x; };

  function applyTime(date, h, m, pm) {
    if (h == null) return date;
    let hr = h % 24;
    if (pm === true && hr < 12) hr += 12;
    if (pm === false && hr === 12) hr = 0;
    date.setHours(hr, m || 0, 0, 0);
    return date;
  }

  // returns { title, tags:[], due:Date|null, hasTime:bool, matched:[strings] }
  function parse(raw) {
    let text = ' ' + raw.trim() + ' ';
    const now = new Date();
    const matched = [];
    let due = null, hasTime = false;

    // --- tags ---
    const tags = [];
    text = text.replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (m, sp, tag) => { tags.push(tag.toLowerCase()); return sp; });

    // --- time (3pm, 3:30pm, 15:00, at 9) ---
    let th=null, tm=null, tpm=null;
    text = text.replace(/(?:\bat\s+)?\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i, (m, h, mm, ap) => {
      th = +h; tm = mm!=null?+mm:0; tpm = /pm/i.test(ap); hasTime = true; matched.push(m.trim()); return ' ';
    });
    if (th == null) text = text.replace(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/i, (m, h, mm) => {
      th = +h; tm = mm!=null?+mm:0; hasTime = true; matched.push(m.trim()); return ' ';
    });
    if (th == null) text = text.replace(/\b(\d{1,2}):(\d{2})\b/, (m, h, mm) => {
      th = +h; tm = +mm; hasTime = true; matched.push(m); return ' ';
    });

    const set = d => { due = startOfDay(d); };

    // --- explicit keywords (order matters) ---
    const tests = [
      [/\btoday\b/i, () => set(now)],
      [/\b(?:tomorrow|tmrw|tmw|tom)\b/i, () => { const d=new Date(now); d.setDate(d.getDate()+1); set(d); }],
      [/\byesterday\b/i, () => { const d=new Date(now); d.setDate(d.getDate()-1); set(d); }],
      [/\bnext week\b/i, () => { const d=new Date(now); d.setDate(d.getDate()+7); set(d); }],
      [/\bthis weekend\b/i, () => { const d=new Date(now); d.setDate(d.getDate()+((6-d.getDay()+7)%7||6)); set(d); }],
      [/\btonight\b/i, () => { set(now); if(th==null){th=20;tm=0;hasTime=true;} }],
      [/\bin (\d{1,3}) (day|days|week|weeks|month|months)\b/i, (m,n,u)=>{ const d=new Date(now); n=+n; if(/day/.test(u))d.setDate(d.getDate()+n); else if(/week/.test(u))d.setDate(d.getDate()+n*7); else d.setMonth(d.getMonth()+n); set(d); }],
      [/\bnext (mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)[a-z]*\b/i, (m,dn)=>{ const t=DAY_ABBR[dn.toLowerCase()]; const d=new Date(now); let diff=(t-d.getDay()+7)%7; diff=diff===0?7:diff; diff+=7; d.setDate(d.getDate()+diff); set(d); }],
      [/\b(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)[a-z]*\b/i, (m,dn)=>{ const t=DAY_ABBR[dn.toLowerCase()]; if(t==null)return; const d=new Date(now); let diff=(t-d.getDay()+7)%7; if(diff===0)diff=7; d.setDate(d.getDate()+diff); set(d); }],
      // "jun 30", "june 30", "30 jun"
      [new RegExp('\\b('+MONTHS.join('|')+')[a-z]*\\.?\\s+(\\d{1,2})\\b','i'), (m,mon,day)=>{ const mi=MONTHS.indexOf(mon.slice(0,3).toLowerCase()); const d=new Date(now.getFullYear(),mi,+day); if(d<startOfDay(now))d.setFullYear(d.getFullYear()+1); set(d); }],
      [new RegExp('\\b(\\d{1,2})\\s+('+MONTHS.join('|')+')[a-z]*\\b','i'), (m,day,mon)=>{ const mi=MONTHS.indexOf(mon.slice(0,3).toLowerCase()); const d=new Date(now.getFullYear(),mi,+day); if(d<startOfDay(now))d.setFullYear(d.getFullYear()+1); set(d); }],
    ];
    for (const [re, fn] of tests) {
      const m = text.match(re);
      if (m) { fn(...m); matched.push(m[0].trim()); text = text.replace(re, ' '); break; }
    }
    // weekday-only inside the loop handled; also handle full day names not caught by abbr
    if (!due) {
      for (let i=0;i<DAYS.length;i++){ const re=new RegExp('\\b'+DAYS[i]+'\\b','i'); if(re.test(text)){ const d=new Date(now); let diff=(i-d.getDay()+7)%7; if(diff===0)diff=7; d.setDate(d.getDate()+diff); set(d); matched.push(DAYS[i]); text=text.replace(re,' '); break; } }
    }

    if (due && hasTime) applyTime(due, th, tm, tpm);
    else if (due && th!=null) applyTime(due, th, tm, tpm);

    // cleanup title — remove filler prepositions left dangling by date/time extraction
    let title = text.replace(/\s+/g, ' ').trim();
    title = title.replace(/\s+,/g, ',');
    if (due != null || hasTime) {
      // drop trailing/leading connector words: "... by", "... on", "due ...", "... at"
      title = title.replace(/\s+\b(by|on|due|at|for|this|next)\b\s*$/i, '');
      title = title.replace(/^\s*\b(due|by|on)\b\s+/i, '');
      title = title.replace(/\s{2,}/g, ' ').trim();
    }
    return { title, tags: [...new Set(tags)], due: due ? due.getTime() : null, hasTime, matched };
  }
  return { parse };
})();

/* ============================================================
 * Date helpers + bucketing
 * ============================================================ */
const Dates = (() => {
  const DAY = 86400000;
  const sod = d => { const x = new Date(d); x.setHours(0,0,0,0); return x.getTime(); };
  function bucketOf(due) {
    if (due == null) return 'someday';
    const today = sod(Date.now());
    const d = sod(due);
    if (d < today) return 'overdue';
    if (d === today) return 'today';
    if (d <= today + 6*DAY) return 'week';
    return 'later';
  }
  function relLabel(due, hasTime) {
    if (due == null) return '';
    const today = sod(Date.now()), d = sod(due);
    const diff = Math.round((d - today) / DAY);
    let s;
    if (diff === 0) s = 'Today';
    else if (diff === 1) s = 'Tomorrow';
    else if (diff === -1) s = 'Yesterday';
    else if (diff < -1) s = `${-diff} days ago`;
    else if (diff > 1 && diff <= 6) s = new Date(due).toLocaleDateString(undefined, { weekday: 'long' });
    else s = new Date(due).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (hasTime) {
      const t = new Date(due).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(':00','');
      s += ` · ${t}`;
    }
    return s;
  }
  function urgency(due) {
    if (due == null) return '';
    const today = sod(Date.now()), d = sod(due);
    if (d < today) return 'late';
    if (d <= today + 2*86400000) return 'soon';
    return '';
  }
  return { bucketOf, relLabel, urgency, sod };
})();

const BUCKETS = [
  { id: 'overdue', label: 'Overdue', cls: 'overdue' },
  { id: 'today',   label: 'Today' },
  { id: 'week',    label: 'This Week' },
  { id: 'later',   label: 'Later' },
  { id: 'someday', label: 'Someday' },
];

/* ============================================================
 * Fuzzy search — subsequence match + scoring (no deps)
 * ============================================================ */
function fuzzy(query, text) {
  query = query.toLowerCase(); text = text.toLowerCase();
  if (!query) return 0;
  let qi = 0, score = 0, streak = 0, prevIdx = -1;
  for (let i = 0; i < text.length && qi < query.length; i++) {
    if (text[i] === query[qi]) {
      streak++;
      score += streak * 2;
      if (i === 0 || /\s|#/.test(text[i-1])) score += 8; // word-boundary bonus
      if (prevIdx === i-1) score += 3;
      prevIdx = i; qi++;
    } else { streak = 0; }
  }
  return qi === query.length ? score - text.length * 0.05 : -1;
}

/* ============================================================
 * App state + rendering
 * ============================================================ */
const $ = s => document.querySelector(s);
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

let tasks = [];           // full list
let view = [];            // flattened rendered task ids in order (for j/k)
let sel = -1;             // selected index into view
let query = '';
let tagFilter = null;
let editingId = null;

const ICON = {
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></svg>',
};

function esc(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function matches(t) {
  if (tagFilter && !t.tags.includes(tagFilter)) return false;
  if (!query) return true;
  const hay = t.title + ' ' + t.tags.map(x => '#' + x).join(' ') + ' ' + (t.notes || '');
  return fuzzy(query, hay) > -1;
}
function searchScore(t) {
  const hay = t.title + ' ' + t.tags.map(x => '#' + x).join(' ');
  return fuzzy(query, hay);
}

function render() {
  const list = $('#list');
  list.innerHTML = '';
  view = [];

  let pool = tasks.filter(matches);

  // active filter chip
  const af = $('#activeFilter');
  if (tagFilter) {
    af.className = 'activefilter on';
    af.innerHTML = `Filtering by <span class="chip">#${esc(tagFilter)} <button id="clearTag" aria-label="Clear filter">${ICON.x}</button></span>`;
    $('#clearTag').onclick = () => { tagFilter = null; sel = -1; render(); };
  } else { af.className = 'activefilter'; af.innerHTML = ''; }

  // status counts (computed on full set)
  const open = tasks.filter(t => !t.done).length;
  $('#statOpen').textContent = `${open} open`;
  $('#hdrCount').textContent = tasks.length ? `· ${open} open` : '';

  if (!pool.length) {
    list.appendChild(emptyState());
    syncBadge();
    return;
  }

  if (query) {
    // search mode: flat, ranked, no buckets
    pool = pool.map(t => ({ t, s: searchScore(t) })).sort((a,b) => b.s - a.s).map(x => x.t);
    const head = el('div', 'bucket');
    head.appendChild(bucketHead(`${pool.length} result${pool.length>1?'s':''}`, '', ''));
    pool.forEach(t => { head.appendChild(taskRow(t)); view.push(t.id); });
    list.appendChild(head);
  } else {
    // bucket mode
    const groups = {}; BUCKETS.forEach(b => groups[b.id] = []);
    pool.forEach(t => groups[Dates.bucketOf(t.due)].push(t));
    // within a bucket: incomplete first, then by due asc, then created desc
    const cmp = (a,b) => (a.done-b.done) || ((a.due??Infinity)-(b.due??Infinity)) || (b.created-a.created);
    BUCKETS.forEach(b => {
      const items = groups[b.id].sort(cmp);
      if (!items.length) return;
      const sec = el('div', 'bucket' + (b.cls ? ' ' + b.cls : ''));
      sec.appendChild(bucketHead(b.label, items.length));
      items.forEach(t => { sec.appendChild(taskRow(t)); view.push(t.id); });
      list.appendChild(sec);
    });
  }
  if (sel >= view.length) sel = view.length - 1;
  paintSel();
  syncBadge();
}

function bucketHead(label, count) {
  const h = el('div', 'bucket-head');
  h.innerHTML = `<span>${esc(String(label))}</span>${count!==''?`<span class="count">${count}</span>`:''}<span class="rule"></span>`;
  return h;
}

function taskRow(t) {
  const row = el('div', 'task' + (t.done ? ' done' : ''));
  row.dataset.id = t.id;

  const check = el('input', 'check');
  check.type = 'checkbox'; check.checked = t.done;
  check.setAttribute('aria-label', t.done ? 'Mark incomplete' : 'Complete task');
  check.onchange = () => toggle(t.id);
  row.appendChild(check);

  const body = el('div', 'task-body');
  if (editingId === t.id) {
    const inp = el('input', 'task-edit');
    inp.value = t.raw || t.title; inp.setAttribute('aria-label', 'Edit task');
    inp.onkeydown = e => {
      if (e.key === 'Enter') { commitEdit(t.id, inp.value); }
      else if (e.key === 'Escape') { editingId = null; render(); }
    };
    inp.onblur = () => { if (editingId === t.id) commitEdit(t.id, inp.value); };
    body.appendChild(inp);
    row.appendChild(body);
    requestAnimationFrame(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); });
    return row;
  }

  const title = el('div', 'task-title'); title.textContent = t.title || '(untitled)';
  body.appendChild(title);

  const meta = el('div', 'task-meta');
  if (t.due != null) {
    const u = Dates.urgency(t.due);
    const due = el('span', 'due' + (u ? ' ' + u : ''), ICON.clock + `<span>${esc(Dates.relLabel(t.due, t.hasTime))}</span>`);
    meta.appendChild(due);
  }
  t.tags.forEach(tag => {
    const chip = el('span', 'tag', '#' + esc(tag));
    chip.onclick = () => { tagFilter = tag; query = ''; $('#search').value=''; sel = -1; render(); };
    meta.appendChild(chip);
  });
  body.appendChild(meta);
  row.appendChild(body);

  const actions = el('div', 'row-actions');
  const eb = el('button', '', ICON.edit); eb.title = 'Edit (e)'; eb.setAttribute('aria-label','Edit'); eb.onclick = () => startEdit(t.id);
  const db = el('button', 'del', ICON.del); db.title = 'Delete'; db.setAttribute('aria-label','Delete'); db.onclick = () => removeTask(t.id);
  actions.append(eb, db);
  row.appendChild(actions);

  row.onclick = e => { if (e.target.closest('button,.check,.tag')) return; const i = view.indexOf(t.id); if (i>=0){ sel=i; paintSel(); } };
  return row;
}

function emptyState() {
  const e = el('div', 'empty');
  if (query) e.innerHTML = `<div class="ring">${ICON.leaf}</div><h3>No matches</h3><p>Nothing matches “${esc(query)}”. Try fewer letters.</p>`;
  else if (tagFilter) e.innerHTML = `<div class="ring">${ICON.leaf}</div><h3>Nothing tagged #${esc(tagFilter)}</h3><p>Clear the filter to see everything.</p>`;
  else e.innerHTML = `<div class="ring">${ICON.leaf}</div><h3>A clear mind</h3><p>No tasks yet. Type one above — dates and #tags are parsed automatically.</p>`;
  return e;
}

function paintSel() {
  document.querySelectorAll('.task.sel').forEach(n => n.classList.remove('sel'));
  if (sel < 0 || sel >= view.length) return;
  const node = document.querySelector(`.task[data-id="${view[sel]}"]`);
  if (node) { node.classList.add('sel'); node.scrollIntoView({ block: 'nearest' }); }
}

/* ============================================================
 * Mutations
 * ============================================================ */
async function addFromInput(raw) {
  raw = raw.trim(); if (!raw) return;
  const p = Parse.parse(raw);
  const t = { id: uid(), title: p.title || raw, raw, tags: p.tags, due: p.due, hasTime: p.hasTime, done: false, created: Date.now() };
  tasks.push(t);
  await STORE.put(t);
  $('#add').value = ''; updateHint('');
  query = ''; $('#search').value = '';
  render(); afterChange();
}
async function toggle(id) {
  const t = tasks.find(x => x.id === id); if (!t) return;
  t.done = !t.done; t.completedAt = t.done ? Date.now() : null;
  await STORE.put(t); render(); afterChange();
  if (t.done) maybeCelebrate();
}
function startEdit(id) { editingId = id; render(); }
async function commitEdit(id, raw) {
  const t = tasks.find(x => x.id === id); if (!t) { editingId = null; return render(); }
  raw = raw.trim();
  if (!raw) { editingId = null; return removeTask(id); }
  const p = Parse.parse(raw);
  t.title = p.title || raw; t.raw = raw; t.tags = p.tags; t.due = p.due; t.hasTime = p.hasTime;
  editingId = null;
  await STORE.put(t); render(); afterChange();
}
async function removeTask(id) {
  const idx = tasks.findIndex(x => x.id === id); if (idx < 0) return;
  const [removed] = tasks.splice(idx, 1);
  await STORE.del(id);
  render(); afterChange();
  toast('Task deleted', 'Undo', async () => {
    tasks.push(removed); await STORE.put(removed); render(); afterChange();
  });
}

/* ============================================================
 * Toast (with optional undo)
 * ============================================================ */
let toastTimer = null;
function toast(msg, actionLabel, action) {
  const t = $('#toast'); $('#toastTxt').textContent = msg;
  const old = t.querySelector('button'); if (old) old.remove();
  if (actionLabel) {
    const b = el('button', '', actionLabel);
    b.onclick = () => { hideToast(); action && action(); };
    t.appendChild(b);
  }
  t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 5000);
}
function hideToast() { $('#toast').classList.remove('on'); }

let confettiShown = 0;
function maybeCelebrate() {
  const open = tasks.filter(t => !t.done).length;
  if (open === 0 && tasks.length > 0 && Date.now() - confettiShown > 4000) {
    confettiShown = Date.now(); confetti();
  }
}

/* ============================================================
 * Sync badge + auto-backup hook
 * ============================================================ */
let lastSaved = Date.now();
function syncBadge() {
  lastSaved = Date.now();
  const txt = $('#syncTxt'); if (txt) txt.textContent = 'saved';
}
async function afterChange() {
  syncBadge();
  await Backup.autoWrite().catch(()=>{});
}

/* ============================================================
 * Backup module — export/import + File System Access rotation
 * ============================================================ */
const Backup = (() => {
  const KEEP = 10;
  let dirHandle = null;
  let supported = 'showDirectoryPicker' in window;

  function snapshot() {
    return { app: 'quiet', version: 1, exportedAt: new Date().toISOString(), count: tasks.length, tasks };
  }
  function stamp() {
    const d = new Date(), p = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }
  function download() {
    const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `quiet-backup_${stamp()}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importFile(file, mode, cb) {
    const r = new FileReader();
    r.onload = async () => {
      try {
        const data = JSON.parse(r.result);
        const incoming = Array.isArray(data) ? data : data.tasks;
        if (!Array.isArray(incoming)) throw new Error('Not a Quiet backup');
        // normalize
        const norm = incoming.map(t => ({
          id: t.id || uid(), title: t.title || '', raw: t.raw || t.title || '',
          tags: Array.isArray(t.tags) ? t.tags : [], due: t.due ?? null,
          hasTime: !!t.hasTime, done: !!t.done, created: t.created || Date.now(), completedAt: t.completedAt ?? null,
        }));
        if (mode === 'replace') { await STORE.clear(); tasks = norm; }
        else { // merge by id
          const byId = new Map(tasks.map(t => [t.id, t]));
          norm.forEach(t => byId.set(t.id, t));
          tasks = [...byId.values()];
        }
        await STORE.putMany(tasks);
        cb(null, norm.length);
      } catch (e) { cb(e); }
    };
    r.onerror = () => cb(r.error);
    r.readAsText(file);
  }

  // --- File System Access folder auto-backup ---
  async function restoreHandle() {
    if (!supported) return;
    try {
      const h = await STORE.getMeta('fsaHandle');
      if (h && await verifyPerm(h)) { dirHandle = h; }
    } catch {}
  }
  async function verifyPerm(h) {
    try {
      const opts = { mode: 'readwrite' };
      if ((await h.queryPermission(opts)) === 'granted') return true;
      return (await h.requestPermission(opts)) === 'granted';
    } catch { return false; }
  }
  async function chooseFolder() {
    if (!supported) throw new Error('unsupported');
    const h = await window.showDirectoryPicker({ id: 'quiet-backup', mode: 'readwrite' });
    if (!(await verifyPerm(h))) throw new Error('permission denied');
    dirHandle = h;
    await STORE.setMeta('fsaHandle', h);
    await autoWrite(true);
  }
  async function forgetFolder() { dirHandle = null; await STORE.setMeta('fsaHandle', null); }
  async function autoWrite(force) {
    if (!dirHandle) return;
    try {
      if ((await dirHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') return;
      const name = `quiet-backup_${stamp()}.json`;
      const fh = await dirHandle.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(JSON.stringify(snapshot(), null, 2)); await w.close();
      // rotation: keep newest KEEP
      const files = [];
      for await (const [n, handle] of dirHandle.entries()) {
        if (handle.kind === 'file' && /^quiet-backup_.*\.json$/.test(n)) files.push(n);
      }
      files.sort();
      while (files.length > KEEP) { const old = files.shift(); try { await dirHandle.removeEntry(old); } catch {} }
    } catch {}
  }
  function isOn() { return !!dirHandle; }
  function folderName() { return dirHandle ? dirHandle.name : ''; }

  return { download, importFile, chooseFolder, forgetFolder, autoWrite, restoreHandle, isOn, folderName, supported };
})();

/* ============================================================
 * Confetti — restrained, one-time celebration (no deps)
 * ============================================================ */
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60';
  c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
  const ctx = c.getContext('2d');
  const colors = ['#2f7d86','#7fb7be','#d6a85a','#b5483a','#5d6168'];
  const N = 90, parts = Array.from({length:N}, () => ({
    x: innerWidth/2 + (Math.random()-.5)*120, y: innerHeight*0.4,
    vx: (Math.random()-.5)*9, vy: -Math.random()*12-4,
    r: Math.random()*5+3, c: colors[(Math.random()*colors.length)|0],
    rot: Math.random()*6, vr: (Math.random()-.5)*0.4, life: 1,
  }));
  let t0 = performance.now();
  (function frame(now) {
    const dt = Math.min(40, now - t0) / 16; t0 = now;
    ctx.clearRect(0,0,c.width,c.height);
    let alive = false;
    parts.forEach(p => {
      p.vy += 0.4*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.rot += p.vr*dt; p.life -= 0.008*dt;
      if (p.life > 0 && p.y < c.height + 20) { alive = true;
        ctx.save(); ctx.globalAlpha = Math.max(0,p.life); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.6); ctx.restore();
      }
    });
    if (alive) requestAnimationFrame(frame); else c.remove();
  })(t0);
}

/* ============================================================
 * Quick-add live hint
 * ============================================================ */
function updateHint(raw) {
  const h = $('#hint');
  if (!raw.trim()) { h.innerHTML = '<span style="opacity:.7">Tip: dates &amp; #tags are detected as you type.</span>'; return; }
  const p = Parse.parse(raw);
  const bits = [];
  if (p.due != null) bits.push(`due <b>${esc(Dates.relLabel(p.due, p.hasTime))}</b>`);
  p.tags.forEach(t => bits.push(`<b>#${esc(t)}</b>`));
  h.innerHTML = bits.length ? `→ ${esc(p.title || '(task)')} &nbsp;·&nbsp; ${bits.join(', ')}` : `→ ${esc(p.title)}`;
}

/* ============================================================
 * Sheets / modals
 * ============================================================ */
function openSheet(id) {
  $('#scrim').classList.add('on');
  const s = $('#' + id); s.classList.add('on'); s.setAttribute('aria-hidden','false');
  if (id === 'backupSheet') refreshBackupUI();
}
function closeSheets() {
  $('#scrim').classList.remove('on');
  document.querySelectorAll('.sheet.on').forEach(s => { s.classList.remove('on'); s.setAttribute('aria-hidden','true'); });
  $('#bkStatus').className = 'statusline'; $('#bkStatus').textContent = '';
}
function refreshBackupUI() {
  const g = $('#fsaGroup');
  if (!Backup.supported) { g.style.display = 'none'; return; }
  g.style.display = '';
  const on = Backup.isOn();
  $('#fsaLabel').textContent = on ? `Backing up to “${Backup.folderName()}”` : 'Grant a backup folder';
  $('#fsaSub').textContent = on ? 'Rotating snapshots written after every change. Keeps last 10.' : 'App writes rotating snapshots after every change. Keeps last 10.';
  $('#bkFolder').textContent = on ? 'Change folder…' : 'Choose folder…';
  $('#fsaOffRow').style.display = on ? '' : 'none';
}

/* ============================================================
 * Keyboard layer
 * ============================================================ */
function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
document.addEventListener('keydown', e => {
  // global escape
  if (e.key === 'Escape') {
    if (document.querySelector('.sheet.on')) { closeSheets(); return; }
    if (editingId) { editingId = null; render(); return; }
    if (query || tagFilter) { query=''; tagFilter=null; $('#search').value=''; render(); $('#search').blur(); return; }
    if (document.activeElement === $('#search') || document.activeElement === $('#add')) document.activeElement.blur();
    return;
  }
  if (isTyping(e)) return; // don't hijack typing
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  switch (e.key) {
    case '/': e.preventDefault(); $('#search').focus(); break;
    case 'n': e.preventDefault(); $('#add').focus(); break;
    case 'j': e.preventDefault(); if (view.length){ sel = Math.min(view.length-1, sel+1); if(sel<0)sel=0; paintSel(); } break;
    case 'k': e.preventDefault(); if (view.length){ sel = Math.max(0, sel-1); paintSel(); } break;
    case 'x': case ' ': if (sel>=0){ e.preventDefault(); toggle(view[sel]); } break;
    case 'e': if (sel>=0){ e.preventDefault(); startEdit(view[sel]); } break;
    case 'Backspace': case 'Delete': if (sel>=0){ e.preventDefault(); removeTask(view[sel]); } break;
    case '?': e.preventDefault(); openSheet('helpSheet'); break;
    case 'g': if(view.length){ sel=0; paintSel(); } break;
    case 'G': if(view.length){ sel=view.length-1; paintSel(); } break;
  }
});

/* ============================================================
 * Wire up DOM
 * ============================================================ */
function wire() {
  const add = $('#add');
  add.addEventListener('input', () => updateHint(add.value));
  add.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addFromInput(add.value); } });
  $('#addBtn').onclick = () => addFromInput(add.value);
  updateHint('');

  const search = $('#search');
  let st;
  search.addEventListener('input', () => { query = search.value.trim(); clearTimeout(st); st = setTimeout(() => { sel=-1; render(); }, 70); });

  $('#btnBackup').onclick = () => openSheet('backupSheet');
  $('#lnkBackup').onclick = () => openSheet('backupSheet');
  $('#btnHelp').onclick = () => openSheet('helpSheet');
  $('#scrim').onclick = closeSheets;
  $('#bkClose').onclick = closeSheets;
  $('#hpClose').onclick = closeSheets;

  // backup actions
  $('#bkExport').onclick = () => { Backup.download(); status('Snapshot downloaded.', 'ok'); };
  $('#bkImport').onclick = () => $('#bkFile').click();
  $('#bkFile').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const mode = confirm('Replace all current tasks with this backup?\n\nOK = Replace everything\nCancel = Merge into current tasks') ? 'replace' : 'merge';
    Backup.importFile(f, mode, (err, n) => {
      if (err) { status('Could not read that file — ' + err.message, 'err'); return; }
      render(); afterChange();
      status(`${mode === 'replace' ? 'Replaced' : 'Merged'} — ${n} task${n!==1?'s':''} loaded.`, 'ok');
    });
    e.target.value = '';
  };
  $('#bkFolder').onclick = async () => {
    try { await Backup.chooseFolder(); refreshBackupUI(); status('Auto-backup on. First snapshot written.', 'ok'); }
    catch (err) { if (err && err.name === 'AbortError') return; status('Could not set folder — ' + (err.message||err), 'err'); }
  };
  $('#bkFolderOff').onclick = async () => { await Backup.forgetFolder(); refreshBackupUI(); status('Auto-backup turned off.', 'ok'); };
  $('#bkClear').onclick = async () => {
    if (!confirm('Delete ALL tasks on this device? This cannot be undone.')) return;
    await STORE.clear(); tasks = []; sel = -1; render(); status('All tasks cleared.', 'ok');
  };
}
function status(msg, kind) { const s = $('#bkStatus'); s.className = 'statusline ' + (kind||''); s.textContent = msg; }

/* ============================================================
 * Boot
 * ============================================================ */
async function boot() {
  wire();
  try {
    tasks = await STORE.all();
  } catch (e) {
    tasks = [];
    $('#hint').innerHTML = '<span style="color:var(--danger)">Storage is unavailable in this browser context (private mode?). Tasks won’t persist.</span>';
  }
  // seed first-run example if empty & never seeded
  if (!tasks.length && !(await STORE.getMeta('seeded'))) {
    await STORE.setMeta('seeded', true);
  }
  await Backup.restoreHandle();
  render();
}
boot();

// register service worker for offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
