import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, selectHotspot, addToRepairQueue,
  removeFromRepairQueue, reorderRepairQueue, dispatchRepair,
  propagateRisk, tick
} from './state.js';

describe('createInitialState', () => {
  it('creates state with all required fields', () => {
    const s = createInitialState();
    assert.equal(typeof s.materials, 'number');
    assert.ok(Array.isArray(s.risk_hotspots));
    assert.equal(s.risk_hotspots.length, 20);
    assert.ok(Array.isArray(s.repair_queue));
    assert.equal(s.repair_queue.length, 0);
    assert.equal(typeof s.collapse_pressure, 'number');
    assert.equal(s.time, 300);
    assert.equal(s.phase, 'playing');
  });

  it('hotspots have grid connections and risk', () => {
    const s = createInitialState();
    s.risk_hotspots.forEach(hs => {
      assert.ok(hs.connections.length > 0);
      assert.ok(hs.risk >= 0 && hs.risk <= 100);
    });
  });
});

describe('selectHotspot', () => {
  it('selects a hotspot', () => {
    const next = selectHotspot(createInitialState(), 0);
    assert.equal(next.selected_hotspot, 0);
  });

  it('ignores repaired hotspots', () => {
    let s = createInitialState();
    s = { ...s, risk_hotspots: s.risk_hotspots.map(h => h.id === 0 ? { ...h, repaired: true } : h) };
    assert.equal(selectHotspot(s, 0).selected_hotspot, null);
  });
});

describe('repair queue', () => {
  it('adds to queue', () => {
    const next = addToRepairQueue(createInitialState(), 0);
    assert.deepEqual(next.repair_queue, [0]);
  });

  it('rejects duplicates', () => {
    const next = addToRepairQueue(addToRepairQueue(createInitialState(), 0), 0);
    assert.deepEqual(next.repair_queue, [0]);
  });

  it('removes from queue', () => {
    const s = { ...createInitialState(), repair_queue: [0, 1, 2] };
    assert.deepEqual(removeFromRepairQueue(s, 1).repair_queue, [0, 2]);
  });

  it('reorders queue', () => {
    const s = { ...createInitialState(), repair_queue: [0, 1, 2] };
    assert.deepEqual(reorderRepairQueue(s, 0, 2).repair_queue, [1, 2, 0]);
  });
});

describe('dispatchRepair', () => {
  it('repairs first queued hotspot', () => {
    let s = createInitialState();
    s = { ...s, repair_queue: [0], materials: 99 };
    const next = dispatchRepair(s);
    assert.ok(next.risk_hotspots[0].repaired);
    assert.equal(next.repair_queue.length, 0);
    assert.ok(next.materials < 99);
  });

  it('no-ops on empty queue', () => {
    const s = createInitialState();
    assert.equal(dispatchRepair(s).materials, s.materials);
  });

  it('no-ops on zero materials', () => {
    const s = { ...createInitialState(), repair_queue: [0], materials: 0 };
    assert.equal(dispatchRepair(s).risk_hotspots[0].repaired, false);
  });
});

describe('propagateRisk', () => {
  it('spreads risk to neighbors', () => {
    let s = createInitialState();
    // Make node 6 (row 1 col 1, center-ish) high risk
    s = { ...s, risk_hotspots: s.risk_hotspots.map(h => h.id === 6 ? { ...h, risk: 90 } : h) };
    const next = propagateRisk(s);
    s.risk_hotspots[6].connections.forEach(nid => {
      assert.ok(next.risk_hotspots[nid].risk >= s.risk_hotspots[nid].risk);
    });
  });

  it('ends game when collapse pressure hits 100', () => {
    let s = createInitialState();
    s = { ...s, collapse_pressure: 99, risk_hotspots: s.risk_hotspots.map(h => ({ ...h, risk: 100, repaired: false })) };
    assert.equal(propagateRisk(s).phase, 'lost');
  });
});

describe('tick', () => {
  it('decrements time', () => {
    assert.equal(tick(createInitialState()).time, 299);
  });

  it('wins when time reaches zero', () => {
    const s = { ...createInitialState(), time: 1 };
    const next = tick(s);
    assert.equal(next.time, 0);
    assert.equal(next.phase, 'won');
  });

  it('does not tick after game ends', () => {
    const s = { ...createInitialState(), time: 50, phase: 'lost' };
    assert.equal(tick(s).time, 50);
  });
});
