// Game entry point — wires core loop: risk map -> select -> dispatch -> propagate -> tick
import {
  createInitialState, selectHotspot, addToRepairQueue,
  removeFromRepairQueue, reorderRepairQueue, dispatchRepair,
  propagateRisk, tick
} from './state.js';
import { drawRiskMap, hitTestHotspot, renderRepairQueue } from './risk-map.js';

let state, canvas, ctx, queuePanel, tickTimer, propTimer;

export function init() {
  state = createInitialState();
  canvas = document.getElementById('risk-map');
  ctx = canvas.getContext('2d');
  queuePanel = document.getElementById('repair-queue');

  // Scene interaction: click hotspots on risk map
  canvas.addEventListener('click', e => {
    if (state.phase !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const hitId = hitTestHotspot(state, x, y, canvas.width, canvas.height);
    if (hitId === null) return;

    // Click selected node again -> add to queue; otherwise select it
    if (state.selected_hotspot === hitId) {
      state = addToRepairQueue(state, hitId);
    } else {
      state = selectHotspot(state, hitId);
    }
    render();
  });

  // Dispatch: consume materials to repair first queued hotspot
  document.getElementById('btn-dispatch').addEventListener('click', () => {
    state = dispatchRepair(state);
    render();
  });

  // Core loop timers
  tickTimer = setInterval(() => {
    state = tick(state);
    render();
    if (state.phase !== 'playing') endGame();
  }, 1000);

  propTimer = setInterval(() => {
    state = propagateRisk(state);
    render();
    if (state.phase !== 'playing') endGame();
  }, 5000);

  render();
}

function render() {
  document.getElementById('stat-time').textContent = state.time;
  document.getElementById('stat-materials').textContent = state.materials;
  document.getElementById('stat-pressure').textContent = state.collapse_pressure;

  const msg = document.getElementById('phase-msg');
  if (state.phase === 'lost') { msg.textContent = '结构坍塌！抢修失败'; msg.style.color = '#f44336'; }
  else if (state.phase === 'won') { msg.textContent = '时间到！抢修完成'; msg.style.color = '#4caf50'; }

  drawRiskMap(ctx, state, canvas.width, canvas.height);
  renderRepairQueue(queuePanel, state, {
    removeFromQueue: hid => { state = removeFromRepairQueue(state, hid); render(); },
    reorderQueue: (from, to) => { state = reorderRepairQueue(state, from, to); render(); }
  });
}

function endGame() {
  clearInterval(tickTimer);
  clearInterval(propTimer);
}

document.addEventListener('DOMContentLoaded', init);
