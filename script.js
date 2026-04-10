/* ============================================================
   EcoWatt Connect Dashboard — script.js
   Handles: gauge animation, bar chart, line chart,
   devices, data simulation, alerts panel, sidebar toggle
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────
   1. CONFIG & STATE
────────────────────────────────────────────── */
const CONFIG = {
  maxKW: 5,          // Maximum kW for gauge
  gaugeCircum: 502,  // 2π × 80 (radius)
  updateInterval: 3000, // ms between data refreshes
};

const state = {
  powerKW: 2.18,
  loadA:   9.4,
  voltageV: 231,
  savingsINR: 34.20,
  pf: 0.92,
};

/* ──────────────────────────────────────────────
   2. DOM REFERENCES
────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const gaugeArc    = $('gaugeArc');
const gaugeGlow   = $('gaugeGlow');
const gaugeValue  = $('gaugeValue');
const statLoad    = $('statLoad');
const statVoltage = $('statVoltage');
const statSavings = $('statSavings');
const statPF      = $('statPF');
const barChart    = $('barChart');
const devicesGrid = $('devicesGrid');
const alertsPanel = $('alertsPanel');
const alertsToggle = $('alertsToggle');
const alertsClose  = $('alertsClose');
const sidebar      = $('sidebar');
const hamburger    = $('hamburger');
const overlay      = $('overlay');
const headerDate   = $('headerDate');
const lineCanvas   = $('lineCanvas');

/* ──────────────────────────────────────────────
   3. INJECT SVG GRADIENT
────────────────────────────────────────────── */
function injectSVGDefs() {
  const svg = document.getElementById('gaugeSvg');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#0d9488"/>
      <stop offset="100%" stop-color="#0ea5e9"/>
    </linearGradient>
  `;
  svg.prepend(defs);
}

/* ──────────────────────────────────────────────
   4. DATE / TIME HEADER
────────────────────────────────────────────── */
function updateDateTime() {
  const now = new Date();
  const opts = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  headerDate.textContent = now.toLocaleDateString('en-IN', opts);
}

/* ──────────────────────────────────────────────
   5. GAUGE UPDATE
────────────────────────────────────────────── */
function updateGauge(kw) {
  const pct = Math.min(kw / CONFIG.maxKW, 1);
  const offset = CONFIG.gaugeCircum - pct * CONFIG.gaugeCircum;
  gaugeArc.setAttribute('stroke-dashoffset', offset.toFixed(1));
  gaugeGlow.setAttribute('stroke-dashoffset', offset.toFixed(1));
  gaugeValue.textContent = kw.toFixed(2);
}

/* ──────────────────────────────────────────────
   6. ROOM BAR CHART (horizontal bars)
────────────────────────────────────────────── */
const roomData = [
  { name: 'Living Room',     kw: 0.82, pct: 82, alt: false },
  { name: 'Master Bedroom',  kw: 0.54, pct: 54, alt: false },
  { name: 'Kitchen',         kw: 0.71, pct: 71, alt: true  },
  { name: 'Office',          kw: 0.38, pct: 38, alt: false },
  { name: 'Guest Room',      kw: 0.12, pct: 12, alt: true  },
  { name: 'Garage',          kw: 0.09, pct: 9,  alt: true  },
];

function renderBarChart() {
  barChart.innerHTML = '';
  roomData.forEach(room => {
    const cls = room.alt ? 'bar-fill--dim' : '';
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <div class="bar-room">${room.name}</div>
      <div class="bar-track">
        <div class="bar-fill ${cls}" data-pct="${room.pct}"></div>
      </div>
      <div class="bar-val">${room.kw.toFixed(2)} kW</div>
    `;
    barChart.appendChild(row);
  });

  // Animate bars after short delay
  requestAnimationFrame(() => {
    setTimeout(() => {
      document.querySelectorAll('.bar-fill').forEach(el => {
        el.style.width = el.dataset.pct + '%';
      });
    }, 100);
  });
}

/* ──────────────────────────────────────────────
   7. LINE CHART (canvas-based, no library)
────────────────────────────────────────────── */
// 24-hour power usage data (kWh per hour)
const lineData = [
  0.3, 0.2, 0.15, 0.1, 0.12, 0.4,
  0.9, 1.6, 2.1, 1.8, 1.4, 1.9,
  2.3, 2.0, 1.7, 1.5, 1.8, 2.4,
  2.8, 2.2, 1.9, 1.5, 1.0, 0.5,
];
const lineLabels = ['0','2','4','6','8','10','12','14','16','18','20','22','24'];

function drawLineChart() {
  const canvas = lineCanvas;
  const wrap   = canvas.parentElement;
  const dpr    = window.devicePixelRatio || 1;
  const W      = wrap.clientWidth  || 400;
  const H      = wrap.clientHeight || 160;

  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const padL = 36, padR = 16, padT = 16, padB = 30;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const maxVal = Math.max(...lineData) * 1.15;

  /* Grid lines */
  ctx.strokeStyle = 'rgba(255,255,255,.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (cH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + cW, y);
    ctx.stroke();
  }

  /* X axis labels */
  ctx.fillStyle = 'rgba(148,163,184,.55)';
  ctx.font = '10px DM Sans, sans-serif';
  ctx.textAlign = 'center';
  lineLabels.forEach((lbl, i) => {
    const x = padL + (i / (lineLabels.length - 1)) * cW;
    ctx.fillText(lbl, x, H - 8);
  });

  /* Y axis labels */
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = ((maxVal / 4) * (4 - i)).toFixed(1);
    const y = padT + (cH / 4) * i;
    ctx.fillText(val, padL - 6, y + 4);
  }

  /* Map data to canvas coords */
  const pts = lineData.map((v, i) => ({
    x: padL + (i / (lineData.length - 1)) * cW,
    y: padT + cH - (v / maxVal) * cH,
  }));

  /* Gradient fill under curve */
  const grad = ctx.createLinearGradient(0, padT, 0, padT + cH);
  grad.addColorStop(0,   'rgba(13,148,136,.35)');
  grad.addColorStop(.6,  'rgba(13,148,136,.1)');
  grad.addColorStop(1,   'rgba(13,148,136,.0)');

  ctx.beginPath();
  ctx.moveTo(pts[0].x, padT + cH);
  ctx.lineTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i-1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(cx, pts[i-1].y, cx, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.lineTo(pts[pts.length-1].x, padT + cH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  /* Line stroke */
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i-1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(cx, pts[i-1].y, cx, pts[i].y, pts[i].x, pts[i].y);
  }
  const lineGrad = ctx.createLinearGradient(padL, 0, padL + cW, 0);
  lineGrad.addColorStop(0, '#0d9488');
  lineGrad.addColorStop(1, '#0ea5e9');
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  /* Peak dots */
  const peakIndices = lineData.reduce((acc, v, i) => {
    if (i > 0 && i < lineData.length - 1 &&
        lineData[i] > lineData[i-1] && lineData[i] > lineData[i+1]) {
      acc.push(i);
    }
    return acc;
  }, []);

  peakIndices.forEach(i => {
    const p = pts[i];
    // Outer glow
    const radGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 10);
    radGrad.addColorStop(0, 'rgba(45,212,191,.4)');
    radGrad.addColorStop(1, 'rgba(45,212,191,0)');
    ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = radGrad; ctx.fill();
    // Dot
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#2dd4bf'; ctx.fill();
    ctx.strokeStyle = '#0b0f1a'; ctx.lineWidth = 2; ctx.stroke();
  });
}

/* ──────────────────────────────────────────────
   8. TOP DEVICES
────────────────────────────────────────────── */
const devices = [
  { name: 'AC',            emoji: '❄️',  watt: '1.5 kW', on: true,  active: false },
  { name: 'Refrigerator',  emoji: '🧊',  watt: '0.2 kW', on: true,  active: false },
  { name: 'Geyser',        emoji: '🔥',  watt: '2.0 kW', on: true,  active: true  },
  { name: 'TV',            emoji: '📺',  watt: '0.1 kW', on: false, active: false },
  { name: 'Washing M.',    emoji: '👕',  watt: '0.5 kW', on: false, active: false },
  { name: 'Microwave',     emoji: '📡',  watt: '0.9 kW', on: false, active: false },
];

function renderDevices() {
  devicesGrid.innerHTML = '';
  const runningCount = devices.filter(d => d.on).length;
  $('runningCount').textContent = runningCount;

  devices.forEach((dev, idx) => {
    const card = document.createElement('div');
    card.className = 'device-card' + (dev.active ? ' active' : '');
    card.title = dev.name;
    card.innerHTML = `
      <div class="device-icon-wrap">${dev.emoji}</div>
      <div class="device-name">${dev.name}</div>
      <div class="device-watt">${dev.watt}</div>
      <div class="device-status ${dev.on ? 'device-status--on' : 'device-status--off'}">
        ${dev.on ? 'ON' : 'OFF'}
      </div>
    `;
    card.addEventListener('click', () => toggleDevice(idx));
    devicesGrid.appendChild(card);
  });
}

function toggleDevice(idx) {
  devices[idx].on = !devices[idx].on;
  devices[idx].active = devices[idx].on;
  renderDevices();
}

/* ──────────────────────────────────────────────
   9. SIMULATE LIVE DATA UPDATES
────────────────────────────────────────────── */
function randomNear(base, spread) {
  return +(base + (Math.random() - 0.5) * spread).toFixed(2);
}

function updateLiveData() {
  state.powerKW   = randomNear(2.18, 0.6);
  state.loadA     = randomNear(9.4,  1.2);
  state.voltageV  = Math.round(randomNear(231, 4));
  state.savingsINR = randomNear(34.2, 5);
  state.pf        = randomNear(0.92, 0.04);

  updateGauge(state.powerKW);
  statLoad.textContent    = state.loadA.toFixed(1) + ' A';
  statVoltage.textContent = state.voltageV + ' V';
  statSavings.textContent = '₹' + state.savingsINR.toFixed(2);
  statPF.textContent      = Math.max(0.85, Math.min(0.99, state.pf)).toFixed(2);
}

/* ──────────────────────────────────────────────
   10. ALERTS PANEL TOGGLE
────────────────────────────────────────────── */
function initAlertsPanel() {
  alertsToggle.addEventListener('click', () => {
    alertsPanel.classList.toggle('visible');
  });
  alertsClose.addEventListener('click', () => {
    alertsPanel.classList.remove('visible');
  });
  // Close on outside click
  document.addEventListener('click', e => {
    if (!alertsPanel.contains(e.target) && !alertsToggle.contains(e.target)) {
      alertsPanel.classList.remove('visible');
    }
  });
}

/* ──────────────────────────────────────────────
   11. SIDEBAR TOGGLE (mobile)
────────────────────────────────────────────── */
function initSidebar() {
  hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });

  // Nav item click
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      // Close sidebar on mobile after nav
      if (window.innerWidth <= 860) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
      }
    });
  });
}

/* ──────────────────────────────────────────────
   12. RESIZE HANDLER
────────────────────────────────────────────── */
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    drawLineChart();
  }, 200);
});

/* ──────────────────────────────────────────────
   13. INIT
────────────────────────────────────────────── */
function init() {
  injectSVGDefs();
  updateDateTime();
  setInterval(updateDateTime, 60_000);

  // Initial gauge render
  updateGauge(state.powerKW);

  // Charts & components
  renderBarChart();
  renderDevices();

  // Line chart draws after layout is stable
  setTimeout(() => {
    drawLineChart();
  }, 150);

  // Alerts
  initAlertsPanel();

  // Sidebar
  initSidebar();

  // Live data simulation
  setTimeout(() => {
    updateLiveData();
    setInterval(updateLiveData, CONFIG.updateInterval);
  }, 2000);
}

document.addEventListener('DOMContentLoaded', init);