/* ══════════════════════════════════════
   FlowDesk — app.js
   Created by Yogesh Gadekar
   ══════════════════════════════════════ */

/* ══ DATA ══ */
const LS_KEY = 'flowdesk_v1';
let tasks = [];
let editingId = null;
let activeFilters = { priority: 'all', category: 'all', due: 'all' };
let searchQuery = '';
let analyticsTab = 'daily';

/* charts */
let donutC, catC, trendC, prioC, catPerfC, sbRingC;

function loadTasks() {
  try { const s = localStorage.getItem(LS_KEY); tasks = s ? JSON.parse(s) : []; }
  catch(e) { tasks = []; }
}
function saveTasks() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(tasks)); } catch(e) {}
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

/* ══ ADD TASK ══ */
function _addTask(nameEl, catEl, prioEl, dueEl) {
  const name = nameEl.value.trim();
  if (!name) { showToast('Please enter a task name', 'danger'); nameEl.focus(); return; }
  const task = {
    id: uid(), name,
    category: catEl.value,
    priority: prioEl.value,
    due: dueEl.value || null,
    done: false,
    createdAt: new Date().toISOString(),
    completedAt: null
  };
  tasks.unshift(task);
  saveTasks();
  nameEl.value = '';
  dueEl.value = '';
  renderAll();
  showToast('Task added!', 'success');
}
function addTask()  { _addTask(document.getElementById('add-name'),  document.getElementById('add-cat'),  document.getElementById('add-prio'),  document.getElementById('add-due')); }
function addTask2() { _addTask(document.getElementById('add-name2'), document.getElementById('add-cat2'), document.getElementById('add-prio2'), document.getElementById('add-due2')); }

/* ══ TOGGLE DONE ══ */
function toggleDone(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.done = !t.done;
  t.completedAt = t.done ? new Date().toISOString() : null;
  saveTasks();
  renderAll();
  showToast(t.done ? '✅ Task completed!' : 'Task reopened', t.done ? 'success' : 'neu');
}

/* ══ DELETE ══ */
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderAll();
  showToast('Task deleted', 'danger');
}

/* ══ EDIT ══ */
function openEdit(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  editingId = id;
  document.getElementById('edit-name').value = t.name;
  document.getElementById('edit-cat').value  = t.category;
  document.getElementById('edit-prio').value = t.priority;
  document.getElementById('edit-due').value  = t.due || '';
  document.getElementById('edit-modal').classList.add('open');
}
function closeModal() {
  document.getElementById('edit-modal').classList.remove('open');
  editingId = null;
}
function saveEdit() {
  const name = document.getElementById('edit-name').value.trim();
  if (!name) { showToast('Task name required', 'danger'); return; }
  const t = tasks.find(t => t.id === editingId);
  if (!t) return;
  t.name     = name;
  t.category = document.getElementById('edit-cat').value;
  t.priority = document.getElementById('edit-prio').value;
  t.due      = document.getElementById('edit-due').value || null;
  saveTasks();
  closeModal();
  renderAll();
  showToast('Task updated', 'success');
}

/* ══ CONFIRM ══ */
let confirmCb = null;
function confirmClearCompleted() {
  const n = tasks.filter(t => t.done).length;
  if (!n) { showToast('No completed tasks to clear', 'neu'); return; }
  showConfirm('Clear Completed Tasks', `Remove all ${n} completed task${n>1?'s':''}? This cannot be undone.`, () => {
    tasks = tasks.filter(t => !t.done);
    saveTasks(); renderAll();
    showToast(`Cleared ${n} completed task${n>1?'s':''}`, 'success');
  });
}
function confirmReset() {
  showConfirm('Reset Dashboard', 'This will permanently delete ALL tasks and reset the dashboard. Are you absolutely sure?', () => {
    tasks = []; saveTasks(); renderAll();
    showToast('Dashboard reset', 'danger');
  });
}
function showConfirm(title, msg, cb) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = msg;
  confirmCb = cb;
  document.getElementById('confirm-modal').classList.add('open');
}
function closeConfirm() { document.getElementById('confirm-modal').classList.remove('open'); confirmCb = null; }
document.getElementById('confirm-ok').onclick = () => { if (confirmCb) confirmCb(); closeConfirm(); };

/* ══ FILTER & SEARCH ══ */
function handleSearch() { searchQuery = document.getElementById('search-input').value.toLowerCase(); renderAll(); }
function toggleFilter() {
  const bar = document.getElementById('filter-bar');
  const btn = document.getElementById('filter-toggle-btn');
  bar.classList.toggle('open');
  btn.classList.toggle('active');
}
function setFilter(type, val, el) {
  activeFilters[type] = val;
  document.querySelectorAll(`[data-filter-type="${type}"]`).forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderAll();
}
function applyFilters(list) {
  const today = new Date(); today.setHours(0,0,0,0);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
  return list.filter(t => {
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery)) return false;
    if (activeFilters.priority !== 'all' && t.priority !== activeFilters.priority) return false;
    if (activeFilters.category !== 'all' && t.category !== activeFilters.category) return false;
    if (activeFilters.due !== 'all') {
      if (!t.due) return false;
      const d = new Date(t.due); d.setHours(0,0,0,0);
      if (activeFilters.due === 'overdue' && (d >= today || t.done)) return false;
      if (activeFilters.due === 'today'   && d.getTime() !== today.getTime()) return false;
      if (activeFilters.due === 'week'    && (d < today || d > weekEnd)) return false;
    }
    return true;
  });
}

/* ══ RENDER TASK ITEM ══ */
function dueMeta(due, done) {
  if (!due) return '';
  const d = new Date(due); d.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((d - today) / 86400000);
  let cls = 'task-date', label = '';
  if (!done) {
    if (diff < 0)   { cls += ' task-due-overdue'; label = `⚠ Overdue (${Math.abs(diff)}d)`; }
    else if (diff === 0) { cls += ' task-due-soon'; label = '📅 Due today'; }
    else if (diff <= 3)  { cls += ' task-due-soon'; label = `📅 Due in ${diff}d`; }
    else { label = `📅 ${d.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`; }
  } else {
    label = `📅 ${d.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`;
  }
  return `<span class="${cls}">${label}</span>`;
}
function taskHTML(t) {
  const createdFmt = new Date(t.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
  const compFmt    = t.completedAt ? new Date(t.completedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '';
  return `
  <div class="task-item ${t.done?'done':''}" id="ti-${t.id}">
    <div class="task-check ${t.done?'checked':''}" onclick="toggleDone('${t.id}')"></div>
    <div class="task-body">
      <div class="task-name">${escHtml(t.name)}</div>
      <div class="task-meta">
        <span class="tag tag-${t.category}">${t.category}</span>
        <span class="tag prio-${t.priority}">${t.priority}</span>
        ${dueMeta(t.due, t.done)}
        ${t.done && compFmt ? `<span class="task-date">✓ Completed ${compFmt}</span>` : `<span class="task-date">Added ${createdFmt}</span>`}
      </div>
    </div>
    <div class="task-actions">
      <button class="icon-btn edit" onclick="openEdit('${t.id}')" title="Edit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="icon-btn del" onclick="deleteTask('${t.id}')" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
      </button>
    </div>
  </div>`;
}
function emptyHTML(msg) {
  return `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9S3 16.97 3 12 7.03 3 12 3s9 4.03 9 9z"/></svg>${msg}</div>`;
}
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ══ RENDER ALL ══ */
function renderAll() {
  const filtered = applyFilters(tasks);
  const pending   = filtered.filter(t => !t.done);
  const completed = filtered.filter(t =>  t.done);

  const pl = document.getElementById('pending-list');
  pl.innerHTML = pending.length ? pending.map(taskHTML).join('') : emptyHTML('No pending tasks 🎉');
  document.getElementById('pending-count').textContent = pending.length;

  const cl = document.getElementById('completed-list');
  cl.innerHTML = completed.length ? completed.map(taskHTML).join('') : emptyHTML('Nothing completed yet');
  document.getElementById('completed-count').textContent = completed.length;

  const al = document.getElementById('all-list');
  al.innerHTML = filtered.length ? filtered.map(taskHTML).join('') : emptyHTML('No tasks match your filters');
  document.getElementById('all-count').textContent = filtered.length;

  const total = tasks.length, comp = tasks.filter(t => t.done).length, pend = total - comp;
  const pct = total ? Math.round(comp / total * 100) : 0;
  document.getElementById('kpi-total').textContent = total;
  document.getElementById('kpi-comp').textContent  = comp;
  document.getElementById('kpi-pend').textContent  = pend;
  document.getElementById('kpi-pct').textContent   = pct + '%';
  document.getElementById('kpi-comp-trend').textContent  = comp  ? `${comp} task${comp>1?'s':''} done` : 'None yet';
  document.getElementById('kpi-pend-trend').textContent  = pend  ? `${pend} remaining` : 'All clear!';
  document.getElementById('kpi-pct-trend').textContent   = pct >= 80 ? '🔥 Great progress!' : pct >= 50 ? 'Keep going!' : 'Just getting started';
  document.getElementById('kpi-pct-trend').className     = 'kpi-trend ' + (pct >= 80 ? 'up' : pct >= 50 ? 'neu' : 'down');

  document.getElementById('sb-total').textContent = total;
  document.getElementById('sb-comp').textContent  = comp;
  document.getElementById('sb-pend').textContent  = pend;
  document.getElementById('sb-pct').textContent   = pct + '%';
  document.getElementById('sb-pending-count').textContent = pend;

  updateCharts();
  updateSbRing(pct);
  renderAnalytics();
}

/* ══ CHARTS ══ */
const CCAT = { work:'#2563eb', personal:'#7c3aed', health:'#059669', study:'#d97706', finance:'#db2777', other:'#64748b' };
const CPRIO = { high:'#dc2626', medium:'#d97706', low:'#059669' };

function updateCharts() {
  const comp  = tasks.filter(t => t.done).length;
  const pend  = tasks.length - comp;

  const donutData = { labels:['Completed','Pending'], datasets:[{ data:[comp,pend], backgroundColor:['#059669','#e2e8f0'], borderWidth:0, hoverOffset:6 }] };
  if (donutC) { donutC.data = donutData; donutC.update(); }
  else donutC = new Chart(document.getElementById('donutChart'), { type:'doughnut', data:donutData, options:{ cutout:'70%', responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ font:{ family:'Times New Roman' }, padding:16, usePointStyle:true } } } } });

  const cats = Object.keys(CCAT);
  const catCounts = cats.map(c => tasks.filter(t => t.category === c).length);
  const catData = { labels: cats.map(c => c[0].toUpperCase()+c.slice(1)), datasets:[{ data:catCounts, backgroundColor:cats.map(c=>CCAT[c]), borderRadius:6, borderWidth:0 }] };
  if (catC) { catC.data = catData; catC.update(); }
  else catC = new Chart(document.getElementById('catChart'), { type:'bar', data:catData, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} }, scales:{ x:{ grid:{display:false}, ticks:{font:{family:'Times New Roman',size:11}} }, y:{ grid:{color:'rgba(0,0,0,0.05)'}, ticks:{stepSize:1,font:{family:'Times New Roman',size:11}} } } } });
}

function updateSbRing(pct) {
  const ctx = document.getElementById('sbRing').getContext('2d');
  if (sbRingC) sbRingC.destroy();
  sbRingC = new Chart(ctx, { type:'doughnut', data:{ datasets:[{ data:[pct, 100-pct], backgroundColor:['#2563eb','rgba(0,0,0,0.06)'], borderWidth:0 }] }, options:{ cutout:'72%', responsive:false, plugins:{ legend:{display:false}, tooltip:{enabled:false} } } });
}

/* ══ ANALYTICS ══ */
function setAnalyticsTab(tab, el) {
  analyticsTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderAnalytics();
}

function getLast(n, unit) {
  const days = [];
  for (let i = n-1; i >= 0; i--) {
    const d = new Date(); d.setHours(0,0,0,0);
    if (unit === 'day')   d.setDate(d.getDate() - i);
    else if (unit === 'week')  { d.setDate(d.getDate() - i*7); }
    else if (unit === 'month') { d.setMonth(d.getMonth() - i); }
    days.push(d);
  }
  return days;
}

function renderAnalytics() {
  const aKpis = document.getElementById('analytics-kpis');
  const now = new Date(); now.setHours(0,0,0,0);

  let dates, labels, titleStr, subStr;
  if (analyticsTab === 'daily') {
    dates = getLast(7, 'day');
    labels = dates.map(d => d.toLocaleDateString('en-IN',{weekday:'short'}));
    titleStr = 'Daily Completion (Last 7 Days)'; subStr = 'Tasks completed each day';
  } else if (analyticsTab === 'weekly') {
    dates = getLast(8, 'week');
    labels = dates.map((d,i) => i === dates.length-1 ? 'This Wk' : `W-${dates.length-1-i}`);
    titleStr = 'Weekly Completion (Last 8 Weeks)'; subStr = 'Tasks completed per week';
  } else {
    dates = getLast(6, 'month');
    labels = dates.map(d => d.toLocaleDateString('en-IN',{month:'short'}));
    titleStr = 'Monthly Completion (Last 6 Months)'; subStr = 'Tasks completed per month';
  }
  document.getElementById('trend-title').textContent = titleStr;
  document.getElementById('trend-sub').textContent   = subStr;

  function tasksBetween(start, end) {
    return tasks.filter(t => {
      if (!t.completedAt) return false;
      const c = new Date(t.completedAt); c.setHours(0,0,0,0);
      return c >= start && c < end;
    }).length;
  }
  function nextDate(d, unit) {
    const n = new Date(d);
    if (unit === 'day')   n.setDate(n.getDate()+1);
    else if (unit === 'week')  n.setDate(n.getDate()+7);
    else if (unit === 'month') n.setMonth(n.getMonth()+1);
    return n;
  }
  const unit = analyticsTab === 'daily' ? 'day' : analyticsTab === 'weekly' ? 'week' : 'month';
  const counts = dates.map(d => tasksBetween(d, nextDate(d, unit)));

  const todayComp = tasksBetween(now, nextDate(now,'day'));
  const total = tasks.length, comp = tasks.filter(t=>t.done).length;
  const overdue = tasks.filter(t => !t.done && t.due && new Date(t.due).setHours(0,0,0,0) < now).length;
  aKpis.innerHTML = `
    <div class="kpi-card k-green"><div class="kpi-icon">🗓</div><div class="kpi-val">${todayComp}</div><div class="kpi-label">Completed Today</div></div>
    <div class="kpi-card k-blue"><div class="kpi-icon">📊</div><div class="kpi-val">${total?Math.round(comp/total*100):0}%</div><div class="kpi-label">Overall Rate</div></div>
    <div class="kpi-card k-amber"><div class="kpi-icon">⚠️</div><div class="kpi-val">${overdue}</div><div class="kpi-label">Overdue Tasks</div></div>
    <div class="kpi-card k-purple"><div class="kpi-icon">🔥</div><div class="kpi-val">${counts.reduce((a,b)=>a+b,0)}</div><div class="kpi-label">Period Total</div></div>`;

  const trendData = { labels, datasets:[{ label:'Completed', data:counts, borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,0.08)', tension:.42, fill:true, pointBackgroundColor:'#2563eb', pointRadius:5, pointHoverRadius:7, borderWidth:2.5 }] };
  const trendOpts = { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} }, scales:{ x:{ grid:{display:false}, ticks:{font:{family:'Times New Roman',size:11}} }, y:{ min:0, grid:{color:'rgba(0,0,0,0.05)'}, ticks:{stepSize:1, font:{family:'Times New Roman',size:11}} } } };
  if (trendC) { trendC.data = trendData; trendC.update(); }
  else trendC = new Chart(document.getElementById('trendChart'), { type:'line', data:trendData, options:trendOpts });

  const prios = ['high','medium','low'];
  const prioData = { labels:['High','Medium','Low'], datasets:[{ data:prios.map(p=>tasks.filter(t=>t.priority===p).length), backgroundColor:prios.map(p=>CPRIO[p]), borderWidth:0, hoverOffset:6 }] };
  if (prioC) { prioC.data = prioData; prioC.update(); }
  else prioC = new Chart(document.getElementById('prioChart'), { type:'doughnut', data:prioData, options:{ cutout:'60%', responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ font:{family:'Times New Roman'}, padding:12, usePointStyle:true } } } } });

  const cats = Object.keys(CCAT);
  const catPerf = cats.map(c => {
    const ct = tasks.filter(t => t.category===c);
    return ct.length ? Math.round(ct.filter(t=>t.done).length / ct.length * 100) : 0;
  });
  const catPerfData = { labels: cats.map(c=>c[0].toUpperCase()+c.slice(1)), datasets:[{ label:'% Done', data:catPerf, backgroundColor:cats.map(c=>CCAT[c]+'bb'), borderRadius:6, borderWidth:0 }] };
  const catPerfOpts = { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} }, scales:{ x:{ grid:{display:false}, ticks:{font:{family:'Times New Roman',size:11}} }, y:{ min:0, max:100, grid:{color:'rgba(0,0,0,0.05)'}, ticks:{ callback:v=>v+'%', font:{family:'Times New Roman',size:11} } } } };
  if (catPerfC) { catPerfC.data = catPerfData; catPerfC.update(); }
  else catPerfC = new Chart(document.getElementById('catPerfChart'), { type:'bar', data:catPerfData, options:catPerfOpts });
}

/* ══ NAVIGATION ══ */
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  const titles = { dashboard:'Dashboard', tasks:'All Tasks', analytics:'Analytics', settings:'Settings' };
  document.getElementById('topbar-title').textContent = titles[id] || id;
  if (id === 'analytics') renderAnalytics();
}

/* ══ TOAST ══ */
let toastTimer;
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  const icons = { success:'✓', danger:'✕', neu:'ℹ' };
  document.getElementById('toast-msg').textContent  = msg;
  document.getElementById('toast-icon').textContent = icons[type] || '✓';
  t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ══ TOPBAR DATE ══ */
function setTopbarDate() {
  document.getElementById('topbar-date').textContent =
    new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}

/* ══ CLOSE MODALS ON OVERLAY CLICK ══ */
document.getElementById('edit-modal').addEventListener('click', e => { if (e.target === document.getElementById('edit-modal')) closeModal(); });
document.getElementById('confirm-modal').addEventListener('click', e => { if (e.target === document.getElementById('confirm-modal')) closeConfirm(); });

/* ══ INIT ══ */
loadTasks();
setTopbarDate();
renderAll();
