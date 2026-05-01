// Game entry point — wires core loop: risk map -> select -> dispatch -> propagate -> tick
import {
  createInitialState, selectHotspot, addToRepairQueue,
  removeFromRepairQueue, reorderRepairQueue, dispatchRepair,
  propagateRisk, tick, settleRound
} from './state.js';
import { drawRiskMap, hitTestHotspot, renderRepairQueue } from './risk-map.js';
import { getChannelColor, getHotspotLabel } from './content/events.js';

let state, canvas, ctx, queuePanel, tickTimer, propTimer, animFrame;
let hoveredHotspot = null;
let feedback = { propagatedIds: [], lastRepairId: null, lastRepairTime: 0 };

export function init() {
  state = createInitialState();
  canvas = document.getElementById('risk-map');
  ctx = canvas.getContext('2d');
  queuePanel = document.getElementById('repair-queue');

  // Inject urgency animation CSS
  injectUrgencyStyles();

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

  // Dispatch button — core loop: dispatch → propagate → settle
  document.getElementById('btn-dispatch').addEventListener('click', () => {
    const targetId = state.repair_queue.length > 0 ? state.repair_queue[0] : null;
    state = dispatchRepair(state);
    if (state.phase === 'playing') {
      // Close the core loop: propagate risk immediately after dispatch
      const oldRisks = state.risk_hotspots.map(h => h.risk);
      state = propagateRisk(state);
      const propagatedIds = [];
      for (let i = 0; i < state.risk_hotspots.length; i++) {
        if (state.risk_hotspots[i].risk > oldRisks[i]) propagatedIds.push(i);
      }
      if (propagatedIds.length > 0) {
        feedback = { ...feedback, propagatedIds };
        setTimeout(() => { feedback = { ...feedback, propagatedIds: [] }; }, 3000);
      }
    }
    state = settleRound(state);
    // Track repair burst feedback
    if (targetId !== null) {
      feedback = { ...feedback, lastRepairId: targetId, lastRepairTime: performance.now() };
    }
    // Briefly show step 4 (propagate) before render resets indicator
    feedback = { ...feedback, stepHighlight: 'propagate', stepHighlightTime: performance.now() };
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
    // Snapshot risks before propagation to detect which nodes changed
    const oldRisks = state.risk_hotspots.map(h => h.risk);
    state = propagateRisk(state);
    const propagatedIds = [];
    for (let i = 0; i < state.risk_hotspots.length; i++) {
      if (state.risk_hotspots[i].risk > oldRisks[i]) propagatedIds.push(i);
    }
    if (propagatedIds.length > 0) {
      feedback = { ...feedback, propagatedIds };
      // Auto-clear ripple after 3 seconds
      setTimeout(() => { feedback = { ...feedback, propagatedIds: [] }; }, 3000);
    }
    state = settleRound(state);
    renderDOM();
    if (state.phase !== 'playing') endGame();
  }, 5000);

  // Continuous canvas animation loop for pulsing/glow effects
  function animate(ts) {
    drawRiskMap(ctx, state, canvas.width, canvas.height, ts, hoveredHotspot, feedback);
    animFrame = requestAnimationFrame(animate);
  }
  animFrame = requestAnimationFrame(animate);

  renderDOM();
}

function injectUrgencyStyles() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes urgencyFlash {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    .stat-time.urgent span { animation: urgencyFlash 0.8s infinite; color: #f44336 !important; }
    .stat-mat.urgent span { animation: urgencyFlash 0.6s infinite; color: #f44336 !important; }
    #pressure-wrap.urgent { animation: urgencyFlash 1s infinite; }
  `;
  document.head.appendChild(style);
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

  // Repair progress — how close to winning
  const repaired = state.risk_hotspots.filter(h => h.repaired).length;
  const total = state.risk_hotspots.length;
  document.getElementById('stat-progress').textContent = `${repaired}/${total}`;

  // Pressure gauge — core pressure visibility with risk summary
  const p = state.collapse_pressure;
  const fill = document.getElementById('pressure-fill');
  fill.style.width = p + '%';
  fill.style.background = p >= 80 ? '#f44336' : p >= 50 ? '#ff9800' : p >= 25 ? '#ffc107' : '#4caf50';
  const critCount = state.risk_hotspots.filter(h => !h.repaired && h.risk >= 80).length;
  const highCount = state.risk_hotspots.filter(h => !h.repaired && h.risk >= 60 && h.risk < 80).length;
  document.getElementById('pressure-text').textContent = `塌陷压力 ${p}%  ·  ${critCount} 危急  ${highCount} 高危`;

  // Urgency classes: flash when critically low
  document.querySelector('.stat-time').classList.toggle('urgent', state.time <= 60 && state.phase === 'playing');
  document.querySelector('.stat-mat').classList.toggle('urgent', state.materials <= 5 && state.phase === 'playing');
  document.getElementById('pressure-wrap').classList.toggle('urgent', p >= 75 && state.phase === 'playing');

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

  // Event log — consume pending event messages (clear after display)
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
    state = { ...state, pending_events: [] };
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
    panel.innerHTML = `<span class="lbl">节点</span><span class="val">${getHotspotLabel(hs.id)}</span> <span class="ok">已修复</span>`;
    return;
  }

  const cost = Math.ceil(hs.risk / 10);
  const rc = hs.risk >= 80 ? '#f44336' : hs.risk >= 60 ? '#ff9800' : hs.risk >= 40 ? '#ffc107' : '#4caf50';
  const unrepairedNbrs = hs.connections.filter(cid => !state.risk_hotspots[cid].repaired).length;
  const inQueue = state.repair_queue.includes(hs.id);
  const enoughMat = state.materials >= cost;

  let html =
    `<div><span class="lbl">节点</span><span class="val">${getHotspotLabel(hs.id)}</span></div>` +
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

  // Dynamic hint guiding player through core loop
  const hints = [
    '点击脚手架节点查看风险详情',
    '再次点击将此节点加入抢修队列',
    '拖拽队列卡片调整抢修优先级，然后派工',
    '点击「派工抢修」消耗材料修复队首节点',
    '观察风险传播，准备下一轮抢修'
  ];
  document.getElementById('hint').textContent = hints[active];
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
