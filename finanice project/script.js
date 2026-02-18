/* =============================================
   FINTRACK — Personal Finance Dashboard
   app.js — Fixed: toggle, data, currency symbol
   ============================================= */
'use strict';

const INCOME_CATS  = ['Salary','Freelance','Investment','Rental','Gift','Other Income'];
const EXPENSE_CATS = ['Food','Transport','Housing','Utilities','Entertainment','Health','Shopping','Education','Travel','Other'];
const PIE_COLORS   = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#be185d','#65a30d','#f97316','#6366f1'];
const ICONS = {
  income:  { Salary:'💼', Freelance:'💻', Investment:'📈', Rental:'🏠', Gift:'🎁', 'Other Income':'💰' },
  expense: { Food:'🍔', Transport:'🚗', Housing:'🏡', Utilities:'⚡', Entertainment:'🎬', Health:'💊', Shopping:'🛍️', Education:'📚', Travel:'✈️', Other:'📦' }
};

// Clear old keys to avoid conflicts
['ft_transactions'].forEach(k => {
  const old = localStorage.getItem(k);
  if (old) {
    try {
      const parsed = JSON.parse(old);
      if (Array.isArray(parsed) && parsed.length) {
        localStorage.setItem('ft_data', old);
      }
    } catch(e) {}
    localStorage.removeItem(k);
  }
});

// ── State ─────────────────────────────────────
let transactions = [];
try {
  const raw = localStorage.getItem('ft_data');
  if (raw) transactions = JSON.parse(raw);
  if (!Array.isArray(transactions)) transactions = [];
} catch(e) { transactions = []; }

let pieChart1, barChart1, pieChart2, barChart2;
let activeFilter = { dashboard:'all', transactions:'all', analytics:'all' };
let txTypeFilter = 'all';
let themeIsDark = false;

// ── Helpers ───────────────────────────────────
const fmt = n => 'Rs.' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });
const monthKey = d => d ? d.slice(0,7) : '';

function getMonthLabel(key) {
  if (!key || key === 'all') return 'All time';
  const [y,m] = key.split('-');
  return new Date(+y, +m-1, 1).toLocaleDateString('en-IN', { month:'short', year:'numeric' });
}

function uniqueMonths() {
  return [...new Set(transactions.map(t => monthKey(t.date)))].filter(Boolean).sort().reverse();
}

function filterTx(fm, type='all') {
  return transactions.filter(t => {
    const mOk = fm === 'all' || monthKey(t.date) === fm;
    const tOk = type === 'all' || t.type === type;
    return mOk && tOk;
  });
}

function catBreakdown(txList, type) {
  const map = {};
  txList.filter(t => t.type === type).forEach(t => {
    map[t.category] = (map[t.category]||0) + t.amount;
  });
  return map;
}

function save() {
  localStorage.setItem('ft_data', JSON.stringify(transactions));
}

// ── Month selects ─────────────────────────────
function populateMonths() {
  const months = uniqueMonths();
  ['monthFilter','txMonthFilter','analyticsMonthFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = '<option value="all">All time</option>';
    months.forEach(m => {
      const o = document.createElement('option');
      o.value = m; o.textContent = getMonthLabel(m);
      el.appendChild(o);
    });
    if (months.includes(cur)) el.value = cur;
  });
}

// ── Cards ─────────────────────────────────────
function updateCards(fm) {
  const tx  = filterTx(fm);
  const inc = tx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const exp = tx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const bal = inc - exp;

  countUp('totalBalance', bal);
  countUp('totalIncome',  inc);
  countUp('totalExpense', exp);
  document.getElementById('txCount').textContent = tx.length;

  const badge = document.getElementById('balanceTrend');
  if (bal > 0)      { badge.textContent = '▲ Positive'; badge.className = 'card-badge up'; }
  else if (bal < 0) { badge.textContent = '▼ Negative'; badge.className = 'card-badge down'; }
  else              { badge.textContent = '→ Break even'; badge.className = 'card-badge neutral'; }
}

function countUp(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const dur = 650, start = performance.now();
  const tick = now => {
    const p = Math.min((now-start)/dur, 1);
    const ease = 1 - Math.pow(1-p, 3);
    el.textContent = fmt(target * ease);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ── Transaction HTML ──────────────────────────
function txHTML(t) {
  const icon = (ICONS[t.type]||{})[t.category] || (t.type==='income'?'💰':'📦');
  const sign = t.type==='income' ? '+' : '-';
  const dateStr = new Date(t.date+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
  return `<div class="tx-item" data-id="${t.id}">
    <div class="tx-left">
      <div class="tx-icon ${t.type}">${icon}</div>
      <div>
        <div class="tx-desc">${t.description}</div>
        <div class="tx-meta">${t.category} &middot; ${dateStr}</div>
      </div>
    </div>
    <div class="tx-right">
      <span class="tx-amount ${t.type}">${sign}${fmt(t.amount)}</span>
      <button class="btn-delete" data-id="${t.id}" title="Delete">&#x2715;</button>
    </div>
  </div>`;
}

function renderRecent(fm) {
  const tx = filterTx(fm).slice(-5).reverse();
  const el = document.getElementById('recentList');
  if (!el) return;
  el.innerHTML = tx.length
    ? tx.map(txHTML).join('')
    : '<p class="empty-state">No transactions in this period.</p>';
}

function renderFull(fm, type) {
  const tx = filterTx(fm, type).reverse();
  const el = document.getElementById('fullTxList');
  const noTx = document.getElementById('noTx');
  if (el) el.innerHTML = tx.map(txHTML).join('');
  if (noTx) noTx.style.display = tx.length ? 'none' : 'block';
}

// ── Charts ────────────────────────────────────
function cColors() {
  return {
    text:   themeIsDark ? '#8a8898' : '#6b6860',
    grid:   themeIsDark ? '#2c2c36' : '#e2dfd7',
    border: themeIsDark ? '#17171b' : '#ffffff'
  };
}

function buildPieData(fm) {
  const bd = catBreakdown(filterTx(fm), 'expense');
  return { labels: Object.keys(bd), data: Object.values(bd) };
}

function buildBarData() {
  const months = uniqueMonths().slice(0,6).reverse();
  return {
    labels:   months.map(getMonthLabel),
    incomes:  months.map(m => filterTx(m).filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)),
    expenses: months.map(m => filterTx(m).filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0))
  };
}

function makePie(canvasId, legendId, fm) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const { labels, data } = buildPieData(fm);
  const c = cColors();
  const chart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: PIE_COLORS, borderWidth: 2, borderColor: c.border, hoverOffset: 8 }]
    },
    options: {
      cutout: '64%',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + ctx.label + ': ' + fmt(ctx.raw) } }
      },
      animation: { animateRotate: true, animateScale: true, duration: 800 }
    }
  });
  drawPieLegend(legendId, labels, data);
  return chart;
}

function makeBar(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const c = cColors();
  const { labels, incomes, expenses } = buildBarData();
  return new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'Income',  data:incomes,  backgroundColor:'rgba(5,150,105,.82)',  borderRadius:7, borderSkipped:false },
        { label:'Expense', data:expenses, backgroundColor:'rgba(220,38,38,.78)',  borderRadius:7, borderSkipped:false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color:c.text, boxWidth:13 } },
        tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmt(ctx.raw) } }
      },
      scales: {
        x: { ticks:{ color:c.text }, grid:{ color:c.grid } },
        y: { ticks:{ color:c.text, callback: v => 'Rs.'+v.toLocaleString('en-IN') }, grid:{ color:c.grid } }
      },
      animation: { duration: 700 }
    }
  });
}

function drawPieLegend(id, labels, data) {
  const el = document.getElementById(id);
  if (!el) return;
  const total = data.reduce((s,v)=>s+v,0);
  el.innerHTML = labels.map((l,i) =>
    `<div class="legend-item">
       <span class="legend-dot" style="background:${PIE_COLORS[i%PIE_COLORS.length]}"></span>
       ${l} (${total ? Math.round(data[i]/total*100) : 0}%)
     </div>`
  ).join('');
}

function updatePie(chart, legendId, fm) {
  if (!chart) return;
  const { labels, data } = buildPieData(fm);
  const c = cColors();
  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.data.datasets[0].borderColor = c.border;
  chart.update();
  drawPieLegend(legendId, labels, data);
}

function updateBar(chart) {
  if (!chart) return;
  const { labels, incomes, expenses } = buildBarData();
  const c = cColors();
  chart.data.labels = labels;
  chart.data.datasets[0].data = incomes;
  chart.data.datasets[1].data = expenses;
  chart.options.plugins.legend.labels.color = c.text;
  chart.options.scales.x.ticks.color = c.text;
  chart.options.scales.y.ticks.color = c.text;
  chart.options.scales.x.grid.color  = c.grid;
  chart.options.scales.y.grid.color  = c.grid;
  chart.update();
}

function destroyCharts() {
  [pieChart1,barChart1,pieChart2,barChart2].forEach(c => { if(c) c.destroy(); });
  pieChart1 = barChart1 = pieChart2 = barChart2 = null;
}

function initCharts() {
  pieChart1 = makePie('pieChart',  'pieLegend',  activeFilter.dashboard);
  barChart1 = makeBar('barChart');
  pieChart2 = makePie('pieChart2', 'pieLegend2', activeFilter.analytics);
  barChart2 = makeBar('barChart2');
}

// ── Category table ────────────────────────────
function renderCatTable(fm) {
  const el = document.getElementById('categoryTable');
  if (!el) return;
  const bd = catBreakdown(filterTx(fm, 'expense'), 'expense');
  const entries = Object.entries(bd).sort((a,b)=>b[1]-a[1]);
  if (!entries.length) { el.innerHTML = '<p class="empty-state">No expense data.</p>'; return; }
  const max = entries[0][1];
  const total = entries.reduce((s,[,v])=>s+v, 0);
  el.innerHTML = entries.map(([cat,amt],i) =>
    `<div class="cat-row" style="animation-delay:${i*.06}s">
       <span class="cat-name">${cat}</span>
       <div class="cat-bar-wrap">
         <div class="cat-bar" style="width:${(amt/max*100).toFixed(1)}%;background:${PIE_COLORS[i%PIE_COLORS.length]}"></div>
       </div>
       <span class="cat-amount">${fmt(amt)}</span>
       <span class="cat-pct">${Math.round(amt/total*100)}%</span>
     </div>`
  ).join('');
}

// ── Full render ───────────────────────────────
function renderAll() {
  populateMonths();
  updateCards(activeFilter.dashboard);
  renderRecent(activeFilter.dashboard);
  renderFull(activeFilter.transactions, txTypeFilter);
  renderCatTable(activeFilter.analytics);
  updatePie(pieChart1, 'pieLegend',  activeFilter.dashboard);
  updatePie(pieChart2, 'pieLegend2', activeFilter.analytics);
  updateBar(barChart1);
  updateBar(barChart2);
}

// ── Category select ───────────────────────────
function populateCatSelect(type) {
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
  const sel = document.getElementById('entryCategory');
  if (sel) sel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

// ── Views ─────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const view = document.getElementById('view-'+name);
  const nav  = document.querySelector(`.nav-item[data-view="${name}"]`);
  if (view) view.classList.add('active');
  if (nav)  nav.classList.add('active');
  closeSidebar();
}

// ── Sidebar ───────────────────────────────────
function closeSidebar() {
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sidebarBackdrop');
  if (sb) sb.classList.remove('open');
  if (bd) bd.classList.remove('open');
}

// ── Modal ─────────────────────────────────────
function openModal() {
  const overlay = document.getElementById('modalOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  const dateEl = document.getElementById('entryDate');
  if (dateEl) dateEl.valueAsDate = new Date();
  setTimeout(() => { const d = document.getElementById('entryDesc'); if(d) d.focus(); }, 120);
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('open');
  const form = document.getElementById('entryForm');
  if (form) form.reset();
  const et = document.getElementById('entryType');
  if (et) et.value = 'income';
  document.querySelectorAll('.type-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  populateCatSelect('income');
}

// ── Delete ────────────────────────────────────
function deleteTx(id) {
  const item = document.querySelector(`.tx-item[data-id="${id}"]`);
  if (item) {
    item.style.transition = 'opacity .22s ease, transform .22s ease';
    item.style.opacity = '0';
    item.style.transform = 'translateX(28px)';
    setTimeout(() => {
      transactions = transactions.filter(t => t.id !== id);
      save();
      renderAll();
    }, 240);
  } else {
    transactions = transactions.filter(t => t.id !== id);
    save();
    renderAll();
  }
}

// ── Theme ─────────────────────────────────────
function applyTheme(dark) {
  themeIsDark = dark;
  document.body.classList.toggle('dark', dark);
  localStorage.setItem('ft_theme', dark ? 'dark' : 'light');
  const label = document.getElementById('themeLabel');
  if (label) label.textContent = dark ? 'Dark Mode' : 'Light Mode';
}

function toggleTheme() {
  themeIsDark = !themeIsDark;
  applyTheme(themeIsDark);
  destroyCharts();
  initCharts();
  renderAll();
}

// ── Seed data ─────────────────────────────────
function seedData() {
  const today = new Date();
  const seed = [
    { type:'income',  description:'Monthly Salary',    amount:85000, category:'Salary',       daysAgo:1  },
    { type:'expense', description:'Rent',              amount:22000, category:'Housing',       daysAgo:2  },
    { type:'expense', description:'Grocery Shopping',  amount:4500,  category:'Food',          daysAgo:3  },
    { type:'income',  description:'Freelance Project', amount:15000, category:'Freelance',     daysAgo:5  },
    { type:'expense', description:'Netflix & Spotify', amount:999,   category:'Entertainment', daysAgo:6  },
    { type:'expense', description:'Electricity Bill',  amount:2200,  category:'Utilities',     daysAgo:8  },
    { type:'expense', description:'Gym Membership',    amount:1800,  category:'Health',        daysAgo:10 },
    { type:'expense', description:'Uber Rides',        amount:2300,  category:'Transport',     daysAgo:12 },
    { type:'income',  description:'Dividend Payout',   amount:3400,  category:'Investment',    daysAgo:14 },
    { type:'expense', description:'Online Courses',    amount:3999,  category:'Education',     daysAgo:15 },
  ];
  seed.forEach((s,i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - s.daysAgo);
    transactions.push({
      id: (Date.now()+i).toString(),
      description: s.description,
      amount: s.amount,
      date: d.toISOString().slice(0,10),
      type: s.type,
      category: s.category
    });
  });
  save();
}

// ── Boot ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {

  // Sidebar backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'sidebarBackdrop';
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', closeSidebar);

  // Mobile menu
  const menuBtn = document.getElementById('menuBtn');
  if (menuBtn) {
    menuBtn.addEventListener('click', function() {
      document.getElementById('sidebar').classList.toggle('open');
      backdrop.classList.toggle('open');
    });
  }

  // Nav items
  document.querySelectorAll('.nav-item').forEach(function(item) {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      showView(item.dataset.view);
    });
  });

  // View-all links
  document.querySelectorAll('.link-view-all').forEach(function(a) {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      showView(a.dataset.view);
    });
  });

  // Month filters
  var mf = document.getElementById('monthFilter');
  if (mf) mf.addEventListener('change', function(e) { activeFilter.dashboard = e.target.value; renderAll(); });

  var tmf = document.getElementById('txMonthFilter');
  if (tmf) tmf.addEventListener('change', function(e) { activeFilter.transactions = e.target.value; renderAll(); });

  var amf = document.getElementById('analyticsMonthFilter');
  if (amf) amf.addEventListener('change', function(e) { activeFilter.analytics = e.target.value; renderAll(); });

  var ttf = document.getElementById('txTypeFilter');
  if (ttf) ttf.addEventListener('change', function(e) { txTypeFilter = e.target.value; renderAll(); });

  // Modal open/close
  var ob1 = document.getElementById('openModalBtn');
  if (ob1) ob1.addEventListener('click', openModal);

  var ob2 = document.getElementById('openModalBtn2');
  if (ob2) ob2.addEventListener('click', openModal);

  var mc = document.getElementById('modalClose');
  if (mc) mc.addEventListener('click', closeModal);

  var mo = document.getElementById('modalOverlay');
  if (mo) mo.addEventListener('click', function(e) { if (e.target === mo) closeModal(); });

  // Type toggle buttons
  document.querySelectorAll('.type-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.type-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('entryType').value = btn.dataset.type;
      populateCatSelect(btn.dataset.type);
    });
  });

  // Form submit
  var form = document.getElementById('entryForm');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var desc   = document.getElementById('entryDesc').value.trim();
      var amount = parseFloat(document.getElementById('entryAmount').value);
      var date   = document.getElementById('entryDate').value;
      var type   = document.getElementById('entryType').value;
      var cat    = document.getElementById('entryCategory').value;
      if (!desc || !amount || !date || amount <= 0) return;
      transactions.push({ id: Date.now().toString(), description:desc, amount:amount, date:date, type:type, category:cat });
      save();
      closeModal();
      renderAll();
    });
  }

  // Delete (delegated)
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.btn-delete');
    if (btn && btn.dataset.id) deleteTx(btn.dataset.id);
  });

  // ── THEME: always light ──
  applyTheme(false);

  // Seed if no data
  if (transactions.length === 0) {
    seedData();
  }

  // Init
  populateCatSelect('income');
  initCharts();
  renderAll();
});