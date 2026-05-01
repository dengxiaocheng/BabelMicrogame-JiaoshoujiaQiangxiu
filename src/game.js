// Game entry point — wires core loop: risk map -> select -> dispatch -> propagate -> tick
import {
  createInitialState, selectHotspot, addToRepairQueue,
  removeFromRepairQueue, reorderRepairQueue, dispatchRepair,
  propagateRisk, tick, settleRound
} from './state.js';
import { drawRiskMap, hitTestHotspot, renderRepairQueue } from './risk-map.js';
import { getChannelColor } from './content/events.js';

let state, canvas, ctx, queuePanel, tickTimer, propTimer, animFrame;
let hoveredHotspot = null;

export function init() {
  state = createInitialState();
  canvas = document.getElementById('risk-map');
  ctx = canvas.getContext('2d');
  queuePanel = document.getElementById('repair-queue');

  // Click on risk map nodes — primary scene interaction
  canvas.addEventListener('click', e => {
    if (state.phase !== 'playing') return;
    const hitId = canvasHitTest(e);
    if (hitId === null) return;
    if (state.selected_hotspot === hitId) {
      state = addToRepairQueue(state, hitId);
    } else {
      state = selectHotspot(state, hitId);
    }
    renderDOM();
  });

  // Hover tracking — shows node info preview
  canvas.addEventListener('mousemove', e => {
    const hitId = canvasHitTest(e);
    if (hitId !== hoveredHotspot) {
      hoveredHotspot = hitId;
      renderNodeInfo();
    }
  });
  canvas.addEventListener('mouseleave', () => {
    hoveredHotspot = null;
    renderNodeInfo();
  });

  // Dispatch button — consumes materials, repairs first queued node
  document.getElementById('btn-dispatch').addEventListener('click', () => {
    state = dispatchRepair(state);
    state = settleRound(state);
    renderDOM();
    if (state.phase !== 'playing') endGame();
  });

  // Core loop: tick every second (time + pressure), propagate every 5s (risk spread)
  tickTimer = setInterval(() => {
    state = tick(state);
    state = settleRound(state);
    renderDOM();
    if (state.phase !== 'playing') endGame();
  }, 1000);

  propTimer = setInterval(() => {
    state = propagateRisk(state);
    state = settleRound(state);
    renderDOM();
    if (state.phase !== 'playing') endGame();
  }, 5000);

  // Continuous canvas animation loop for pulsing/glow effects
  function animate(ts) {
    drawRiskMap(ctx, state, canvas.width, canvas.height, ts, hoveredHotspot);
    animFrame = requestAnimationFrame(animate);
  }
  animFrame = requestAnimationFrame(animate);

  renderDOM();
}

function canvasHitTest(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  return hitTestHotspot(state, x, y, canvas.width, canvas.height);
}

function renderDOM() {
  // Stats
  document.getElementById('stat-time').textContent = state.time;
  document.getElementById('stat-materials').textContent = state.materials;

  // Pressure gauge — core pressure visibility
  const p = state.collapse_pressure;
  const fill = document.getElementById('pressure-fill');
  fill.style.width = p + '%';
  fill.style.background = p >= 80 ? '#f44336' : p >= 50 ? '#ff9800' : p >= 25 ? '#ffc107' : '#4caf50';
  document.getElementById('pressure-text').textContent = `塌陷压力 ${p}%`;

  // Phase message
  const msg = document.getElementById('phase-msg');
  if (state.phase === 'lost') {
    msg.textContent = '结构坍塌！抢修失败';
    msg.style.color = '#f44336';
  } else if (state.phase === 'won') {
    msg.textContent = '抢修完成！';
    msg.style.color = '#4caf50';
  } else {
    msg.textContent = '脚手架抢修进行中';
    msg.style.color = '#ffc107';
  }

  // Dispatch button state
  const btn = document.getElementById('btn-dispatch');
  const canDispatch = state.repair_queue.length > 0 && state.materials > 0 && state.phase === 'playing';
  btn.disabled = !canDispatch;

  // Event log — show pending event messages
  if (state.pending_events && state.pending_events.length > 0) {
    const eventLog = document.getElementById('event-log');
    for (const evt of state.pending_events) {
      const el = document.createElement('div');
      el.className = 'event-msg';
      el.textContent = evt.text;
      el.style.color = getChannelColor(evt.channel);
      eventLog.prepend(el);
      while (eventLog.children.length > 8) {
        eventLog.removeChild(eventLog.lastChild);
      }
    }
  }

  updateStepIndicator();
  renderNodeInfo();

  // Repair queue panel
  renderRepairQueue(queuePanel, state, {
    removeFromQueue: hid => { state = removeFromRepairQueue(state, hid); renderDOM(); },
    reorderQueue: (from, to) => { state = reorderRepairQueue(state, from, to); renderDOM(); }
  });
}

function renderNodeInfo() {
  const panel = document.getElementById('node-info');
  const targetId = state.selected_hotspot !== null ? state.selected_hotspot : hoveredHotspot;

  if (targetId === null) {
    panel.innerHTML = '<span style="color:#555">点击或悬停节点查看详情</span>';
    return;
  }

  const hs = state.risk_hotspots.find(h => h.id === targetId);
  if (!hs) return;

  if (hs.repaired) {
    panel.innerHTML = `<span class="lbl">节点</span><span class="val">#${hs.id}</span> <span class="ok">已修复</span>`;
    return;
  }

  const cost = Math.ceil(hs.risk / 10);
  const rc = hs.risk >= 80 ? '#f44336' : hs.risk >= 60 ? '#ff9800' : hs.risk >= 40 ? '#ffc107' : '#4caf50';
  const unrepairedNbrs = hs.connections.filter(cid => !state.risk_hotspots[cid].repaired).length;
  const inQueue = state.repair_queue.includes(hs.id);
  const enoughMat = state.materials >= cost;

  let html =
    `<div><span class="lbl">节点</span><span class="val">#${hs.id}</span></div>` +
    `<div><span class="lbl">风险</span><span class="val" style="color:${rc}">${hs.risk}</span></div>` +
    `<div><span class="lbl">耗材</span><span class="val" style="color:${enoughMat ? '#2196f3' : '#f44336'}">${cost}</span>` +
    `<span class="lbl"> / 库存 ${state.materials}</span></div>` +
    `<div><span class="lbl">相邻未修</span><span class="val">${unrepairedNbrs} 个</span></div>`;

  if (!enoughMat) html += '<div class="warn">材料不足！</div>';
  if (inQueue) html += `<div style="color:#2196f3">队列第 ${state.repair_queue.indexOf(hs.id) + 1} 位</div>`;
  else if (state.selected_hotspot === targetId) html += '<div style="color:#888">再次点击加入队列</div>';

  panel.innerHTML = html;
}

function updateStepIndicator() {
  const ids = ['step-view', 'step-select', 'step-queue', 'step-dispatch', 'step-propagate'];
  let active = 0;

  if (state.selected_hotspot !== null) active = 1;
  if (state.repair_queue.length > 0) active = 2;
  if (state.repair_queue.length > 0 && state.materials > 0) active = 3;

  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    el.className = 'step';
    if (i < active) el.classList.add('done');
    if (i === active) el.classList.add('active');
  });
}

function endGame() {
  clearInterval(tickTimer);
  clearInterval(propTimer);
  cancelAnimationFrame(animFrame);

  // Show end overlay with stats
  const overlay = document.getElementById('end-overlay');
  const title = document.getElementById('end-title');
  const stats = document.getElementById('end-stats');

  const total = state.risk_hotspots.length;
  const repaired = state.risk_hotspots.filter(h => h.repaired).length;

  if (state.phase === 'won') {
    title.textContent = '抢修完成';
    title.style.color = '#4caf50';
  } else {
    title.textContent = '结构坍塌';
    title.style.color = '#f44336';
  }
  stats.innerHTML =
    `修复节点: ${repaired}/${total}<br>` +
    `剩余材料: ${state.materials}<br>` +
    `塌陷压力: ${state.collapse_pressure}%`;

  overlay.classList.add('show');
}

document.addEventListener('DOMContentLoaded', init);
