/* ================================================================
   EcoWatt Connect — script.js
   Dynamic values, charts, gauge, and interactivity
================================================================ */

// ─── DATA ───────────────────────────────────────────────────────

const ROOMS = [
  { label: 'Living',  kwh: 4.2 },
  { label: 'Kitchen', kwh: 6.8 },
  { label: 'Master',  kwh: 2.1 },
  { label: 'Office',  kwh: 3.9 },
  { label: 'Laundry', kwh: 1.4 },
  { label: 'Garage',  kwh: 0.9 },
];

const CONSUMERS = [
  { name: 'Geyser',        watts: 2000, icon: 'geyser',   active: true  },
  { name: 'Air Conditioner',watts:1800, icon: 'ac',       active: false },
  { name: 'Washing Machine',watts: 900, icon: 'washer',   active: false },
  { name: 'Refrigerator',  watts: 380,  icon: 'fridge',   active: true  },
  { name: 'Smart TV',      watts: 120,  icon: 'tv',       active: true  },
];

const ALERTS = [
  { type: 'warn', title: 'High usage spike',    msg: 'Geyser running for over 2 hours.',         time: '2m ago'  },
  { type: 'warn', title: 'Budget threshold',    msg: 'Monthly budget at <strong>88%</strong>.',  time: '14m ago' },
  { type: 'info', title: 'Schedule applied',    msg: 'Night mode activated for AC.',              time: '32m ago' },
];

// ─── LIVE CLOCK ─────────────────────────────────────────────────

function updateClock() {
  const el = document.getElementById('liveClock');
  if (!el) return;
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
  el.textContent = `${h}:${m}:${s}`;
}
setInterval(updateClock, 1000);
updateClock();

// ─── GAUGE ──────────────────────────────────────────────────────

let currentKW  = 2.18;
let targetKW   = 2.18;
const MAX_KW   = 5;
const FULL_ARC = 251; // SVG arc length for a 270° arc at r=80

function arcOffset(kw) {
  const pct = Math.min(Math.max(kw / MAX_KW, 0), 1);
  return FULL_ARC - pct * FULL_ARC;
}

function updateGauge(kw) {
  const arc    = document.getElementById('gaugeArc');
  const valEl  = document.getElementById('gaugeValue');
  const pctEl  = document.getElementById('usagePercent');
  const fillEl = document.getElementById('usageBarFill');

  if (arc) arc.style.strokeDashoffset = arcOffset(kw);
  if (valEl) valEl.textContent = kw.toFixed(2);

  const pct = Math.round((kw / MAX_KW) * 100);
  if (pctEl)  pctEl.textContent  = pct + '%';
  if (fillEl) fillEl.style.width = pct + '%';

  // Update estimated cost
  const todayKWh = parseFloat(document.getElementById('todayUsage').textContent);
  const cost = (todayKWh * 6 + kw * 0.5).toFixed(2);
  const costEl = document.getElementById('estCost');
  if (costEl) costEl.textContent = '₹' + cost;
}

// Animate gauge on load
setTimeout(() => updateGauge(currentKW), 300);

// ─── SIMULATE LIVE POWER FLUCTUATION ────────────────────────────

function fluctuate() {
  targetKW = Math.max(0.5, Math.min(4.5, targetKW + (Math.random() - 0.48) * 0.18));
  currentKW += (targetKW - currentKW) * 0.2;
  updateGauge(currentKW);

  // Also update today usage slightly
  const todayEl = document.getElementById('todayUsage');
  if (todayEl) {
    let v = parseFloat(todayEl.textContent);
    v += 0.001;
    todayEl.textContent = v.toFixed(1) + ' kWh';
  }

  // Update active device count randomly
  const aEl = document.getElementById('activeDevices');
  if (aEl && Math.random() < 0.05) {
    const base = 6 + Math.floor(Math.random() * 3);
    aEl.textContent = base;
  }
}

setInterval(fluctuate, 1800);

// ─── BAR CHART ──────────────────────────────────────────────────

function buildBarChart() {
  const container = document.getElementById('barChart');
  if (!container) return;
  container.innerHTML = '';

  const max = Math.max(...ROOMS.map(r => r.kwh));

  ROOMS.forEach(room => {
    const pct = (room.kwh / max) * 100;
    const isTop = room.kwh === max;

    const group = document.createElement('div');
    group.className = 'bar-group';

    const val = document.createElement('div');
    val.className = 'bar-val' + (isTop ? ' active-val' : '');
    val.textContent = room.kwh + ' kWh';

    const bar = document.createElement('div');
    bar.className = 'bar' + (isTop ? ' active-bar' : '');
    bar.style.height = '0%';
    bar.title = `${room.label}: ${room.kwh} kWh`;
    bar.addEventListener('click', () => toggleBarHighlight(bar, val));

    const label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = room.label;

    group.append(val, bar, label);
    container.appendChild(group);

    // Animate bar in
    setTimeout(() => {
      bar.style.transition = 'height .8s cubic-bezier(.4,0,.2,1)';
      bar.style.height = pct + '%';
    }, 100 + ROOMS.indexOf(room) * 80);
  });
}

function toggleBarHighlight(bar, val) {
  const bars = document.querySelectorAll('.bar');
  const vals = document.querySelectorAll('.bar-val');
  bars.forEach(b => b.classList.remove('active-bar'));
  vals.forEach(v => v.classList.remove('active-val'));
  bar.classList.add('active-bar');
  val.classList.add('active-val');
}

buildBarChart();

// ─── LINE CHART (Canvas) ─────────────────────────────────────────

function buildLineChart() {
  const canvas = document.getElementById('lineChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W   = canvas.offsetWidth  || 400;
  const H   = canvas.offsetHeight || 180;
  canvas.width  = W;
  canvas.height = H;

  // Generate 24h data
  const raw = [];
  for (let i = 0; i < 25; i++) {
    const base = i >= 6 && i <= 22 ? 1.5 + Math.random() * 2.5 : 0.3 + Math.random() * 0.6;
    raw.push(base);
  }

  const pad   = { top: 18, right: 16, bottom: 28, left: 36 };
  const cW    = W - pad.left - pad.right;
  const cH    = H - pad.top  - pad.bottom;
  const maxV  = Math.max(...raw);
  const minV  = 0;

  function xOf(i)   { return pad.left + (i / (raw.length - 1)) * cW; }
  function yOf(val) { return pad.top  + cH - ((val - minV) / (maxV - minV)) * cH; }

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = '#222';
  ctx.lineWidth   = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (cH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
  }

  // X labels (every 6h)
  ctx.fillStyle = '#555';
  ctx.font      = '9px DM Sans, sans-serif';
  ctx.textAlign = 'center';
  ['0h','6h','12h','18h','24h'].forEach((lbl, i) => {
    const x = xOf(i * 6);
    ctx.fillText(lbl, x, H - 6);
  });

  // Y labels
  ctx.textAlign = 'right';
  for (let i = 0; i <= 2; i++) {
    const val = minV + ((maxV - minV) / 2) * i;
    const y   = yOf(val);
    ctx.fillText(val.toFixed(1), pad.left - 5, y + 4);
  }

  // Area gradient fill
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
  grad.addColorStop(0,   'rgba(255,122,0,.22)');
  grad.addColorStop(1,   'rgba(255,122,0,.00)');

  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(raw[0]));
  for (let i = 1; i < raw.length; i++) {
    const xm = (xOf(i - 1) + xOf(i)) / 2;
    ctx.bezierCurveTo(xm, yOf(raw[i-1]), xm, yOf(raw[i]), xOf(i), yOf(raw[i]));
  }
  ctx.lineTo(xOf(raw.length - 1), pad.top + cH);
  ctx.lineTo(xOf(0), pad.top + cH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Orange line
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(raw[0]));
  for (let i = 1; i < raw.length; i++) {
    const xm = (xOf(i - 1) + xOf(i)) / 2;
    ctx.bezierCurveTo(xm, yOf(raw[i-1]), xm, yOf(raw[i]), xOf(i), yOf(raw[i]));
  }
  ctx.strokeStyle = '#ff7a00';
  ctx.lineWidth   = 2;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // Current value dot
  const lastX = xOf(raw.length - 1);
  const lastY = yOf(raw[raw.length - 1]);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
  ctx.fillStyle   = '#ff7a00';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,122,0,.35)';
  ctx.lineWidth   = 6;
  ctx.stroke();
}

buildLineChart();
window.addEventListener('resize', buildLineChart);

// ─── CONSUMERS LIST ─────────────────────────────────────────────

function deviceIconSVG(type) {
  const icons = {
    geyser: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
      <path d="M12 8v4l3 3"/>
    </svg>`,
    ac: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <rect x="2" y="7" width="20" height="10" rx="2"/>
      <path d="M6 11h12M6 14h4"/>
    </svg>`,
    washer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="12" cy="13" r="4"/>
      <circle cx="7" cy="7" r="1" fill="currentColor"/>
    </svg>`,
    fridge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <rect x="5" y="2" width="14" height="20" rx="2"/>
      <line x1="5" y1="10" x2="19" y2="10"/>
      <line x1="10" y1="6" x2="10" y2="8"/>
      <line x1="10" y1="14" x2="10" y2="18"/>
    </svg>`,
    tv: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>`,
  };
  return icons[type] || icons.tv;
}

function buildConsumers() {
  const container = document.getElementById('consumersList');
  if (!container) return;
  container.innerHTML = '';

  const maxW = Math.max(...CONSUMERS.map(c => c.watts));

  CONSUMERS.forEach(c => {
    const item = document.createElement('div');
    item.className = 'consumer-item' + (c.active ? ' active-device' : '');

    item.innerHTML = `
      <div class="consumer-icon">${deviceIconSVG(c.icon)}</div>
      <div class="consumer-info">
        <div class="consumer-name">${c.name}</div>
        <div class="consumer-bar-track">
          <div class="consumer-bar-fill" style="width:0%" data-target="${(c.watts/maxW)*100}"></div>
        </div>
      </div>
      <div class="consumer-watt">${c.watts >= 1000 ? (c.watts/1000).toFixed(1)+'kW' : c.watts+'W'}</div>
    `;

    item.addEventListener('click', () => {
      document.querySelectorAll('.consumer-item').forEach(el => el.classList.remove('active-device'));
      item.classList.add('active-device');
    });

    container.appendChild(item);
  });

  // Animate bars in
  setTimeout(() => {
    document.querySelectorAll('.consumer-bar-fill').forEach(el => {
      el.style.transition = 'width .8s ease';
      el.style.width = el.dataset.target + '%';
    });
  }, 200);
}

buildConsumers();

// ─── ALERTS ─────────────────────────────────────────────────────

let alertData = [...ALERTS];

function buildAlerts() {
  const container = document.getElementById('alertsList');
  const countEl   = document.getElementById('alertCount');
  const navBadge  = document.querySelector('.nav-badge');
  const notifBadge = document.querySelector('.notif-badge');
  if (!container) return;

  container.innerHTML = '';

  if (alertData.length === 0) {
    container.innerHTML = '<div class="no-alerts">No active alerts ✓</div>';
  } else {
    alertData.forEach(a => {
      const item = document.createElement('div');
      item.className = `alert-item ${a.type}`;
      item.innerHTML = `
        <div class="alert-dot ${a.type}"></div>
        <div class="alert-msg"><strong>${a.title}.</strong> ${a.msg}</div>
        <div class="alert-time">${a.time}</div>
      `;
      container.appendChild(item);
    });
  }

  const n = alertData.length;
  if (countEl)   countEl.textContent  = n;
  if (navBadge)  navBadge.textContent  = n;
  if (notifBadge) notifBadge.textContent = n;

  if (n === 0) {
    if (navBadge)  navBadge.style.display  = 'none';
    if (notifBadge) notifBadge.style.display = 'none';
  }
}

buildAlerts();

document.getElementById('clearAlerts')?.addEventListener('click', () => {
  alertData = [];
  buildAlerts();
});

// ─── SIDEBAR TOGGLE ──────────────────────────────────────────────

const sidebar   = document.getElementById('sidebar');
const hamburger = document.getElementById('hamburger');
const overlay   = document.getElementById('overlay');

hamburger?.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  overlay.classList.toggle('show');
});

overlay?.addEventListener('click', () => {
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
});

// ─── NAV ITEM CLICKS ─────────────────────────────────────────────

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    // Close sidebar on mobile
    if (window.innerWidth <= 840) {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    }
  });
});

// ─── SAVINGS RING ANIMATE ────────────────────────────────────────

setTimeout(() => {
  const ring = document.getElementById('savingsRing');
  if (ring) {
    // 70% of 301.6 = 90.5 offset
    ring.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)';
    ring.style.strokeDashoffset = '90';
  }
}, 600);

// ─── PERIODIC ALERT INJECTION ────────────────────────────────────

setInterval(() => {
  if (Math.random() < 0.1 && alertData.length < 5) {
    const newAlert = {
      type: 'info',
      title: 'Auto-schedule triggered',
      msg: 'Washing machine queued for off-peak hours.',
      time: 'just now'
    };
    alertData.unshift(newAlert);
    buildAlerts();
  }
}, 30000);

// ─── ROOM CHART PERIOD CHANGE ────────────────────────────────────

document.getElementById('roomPeriod')?.addEventListener('change', function () {
  // Re-randomise data for demo
  ROOMS.forEach(r => {
    r.kwh = parseFloat((Math.random() * 8 + 0.5).toFixed(1));
  });
  buildBarChart();
});