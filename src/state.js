// State management for 脚手架抢修 core loop
// Required State: materials, risk_hotspots, repair_queue, collapse_pressure, time

import { resolveEvents } from './content/events.js';

const COLS = 5, ROWS = 4;

export function createInitialState() {
  const hotspots = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = r * COLS + c;
      hotspots.push({
        id,
        row: r,
        col: c,
        risk: Math.floor(Math.random() * 50) + 20,
        connections: [],
        repaired: false
      });
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = r * COLS + c;
      if (c < COLS - 1) hotspots[id].connections.push(id + 1);
      if (c > 0) hotspots[id].connections.push(id - 1);
      if (r < ROWS - 1) hotspots[id].connections.push(id + COLS);
      if (r > 0) hotspots[id].connections.push(id - COLS);
    }
  }
  return {
    materials: 30,
    risk_hotspots: hotspots,
    repair_queue: [],
    collapse_pressure: 0,
    time: 300,
    selected_hotspot: null,
    phase: 'playing',
    event_cooldowns: {},
    pending_events: []
  };
}

export function selectHotspot(state, hotspotId) {
  if (state.phase !== 'playing') return state;
  const hs = state.risk_hotspots.find(h => h.id === hotspotId);
  if (!hs || hs.repaired) return state;
  return { ...state, selected_hotspot: hotspotId };
}

export function addToRepairQueue(state, hotspotId) {
  if (state.phase !== 'playing') return state;
  if (state.repair_queue.includes(hotspotId)) return state;
  const hs = state.risk_hotspots.find(h => h.id === hotspotId);
  if (!hs || hs.repaired) return state;
  return { ...state, repair_queue: [...state.repair_queue, hotspotId] };
}

export function removeFromRepairQueue(state, hotspotId) {
  return { ...state, repair_queue: state.repair_queue.filter(id => id !== hotspotId) };
}

export function reorderRepairQueue(state, fromIndex, toIndex) {
  const queue = [...state.repair_queue];
  const [item] = queue.splice(fromIndex, 1);
  queue.splice(toIndex, 0, item);
  return { ...state, repair_queue: queue };
}

export function dispatchRepair(state) {
  if (state.phase !== 'playing' || state.repair_queue.length === 0 || state.materials <= 0) return state;
  const targetId = state.repair_queue[0];
  const hs = state.risk_hotspots.find(h => h.id === targetId);
  if (!hs) return state;

  const cost = Math.ceil(hs.risk / 10);
  if (state.materials < cost) return state;

  // State coupling: repair consumes materials (resource pressure)
  // AND creates chain stress on unrepaired neighbors (risk pressure)
  const newHotspots = state.risk_hotspots.map(h => {
    if (h.id === targetId) return { ...h, risk: 0, repaired: true };
    if (!h.repaired && hs.connections.includes(h.id)) {
      return { ...h, risk: Math.min(100, h.risk + 8) };
    }
    return h;
  });

  const pressureReduction = Math.floor(hs.risk / 3);
  const chainStress = hs.connections.filter(cid => !state.risk_hotspots[cid].repaired).length * 2;

  return {
    ...state,
    materials: state.materials - cost,
    risk_hotspots: newHotspots,
    repair_queue: state.repair_queue.slice(1),
    collapse_pressure: Math.max(0, Math.min(100, state.collapse_pressure - pressureReduction + chainStress)),
    selected_hotspot: null
  };
}

export function propagateRisk(state) {
  if (state.phase !== 'playing') return state;

  let totalPressure = 0;
  const newHotspots = state.risk_hotspots.map(hs => {
    if (hs.repaired) return hs;
    const neighborRisk = hs.connections.reduce((sum, cid) => {
      const neighbor = state.risk_hotspots[cid];
      return sum + (neighbor ? neighbor.risk : 0);
    }, 0);
    const propagation = Math.floor(neighborRisk / (hs.connections.length * 15));
    const newRisk = Math.min(100, hs.risk + propagation);
    totalPressure += newRisk >= 80 ? 5 : newRisk >= 60 ? 2 : 0;
    return { ...hs, risk: newRisk };
  });

  const newPressure = Math.min(100, state.collapse_pressure + Math.floor(totalPressure / 3));
  let result = {
    ...state,
    risk_hotspots: newHotspots,
    collapse_pressure: newPressure,
    phase: newPressure >= 100 ? 'lost' : state.phase
  };

  // Resolve content events after risk propagation
  const eventResult = resolveEvents(result);
  return { ...eventResult.state, pending_events: eventResult.messages };
}

export function tick(state) {
  if (state.phase !== 'playing') return state;
  const newTime = state.time - 1;

  // State coupling: time decreases (progress pressure)
  // AND collapse pressure rises from critical hotspots (risk pressure)
  const criticalCount = state.risk_hotspots.filter(h => !h.repaired && h.risk >= 70).length;
  const pressureIncrease = Math.floor(criticalCount / 3);
  const newPressure = Math.min(100, state.collapse_pressure + pressureIncrease);

  let phase = state.phase;
  if (newTime <= 0) {
    const repairedCount = state.risk_hotspots.filter(h => h.repaired).length;
    const repairRatio = repairedCount / state.risk_hotspots.length;
    phase = repairRatio >= 0.5 ? 'won' : 'lost';
  }
  if (newPressure >= 100) phase = 'lost';

  return { ...state, time: newTime, collapse_pressure: newPressure, phase, pending_events: [] };
}

// settleRound: evaluate state after one complete core loop cycle
export function settleRound(state) {
  if (state.phase !== 'playing') return state;

  const total = state.risk_hotspots.length;
  const repaired = state.risk_hotspots.filter(h => h.repaired).length;

  if (repaired === total) return { ...state, phase: 'won' };
  if (state.collapse_pressure >= 100) return { ...state, phase: 'lost' };

  return state;
}
