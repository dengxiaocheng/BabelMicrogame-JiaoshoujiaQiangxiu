import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, selectHotspot, addToRepairQueue,
  removeFromRepairQueue, reorderRepairQueue, dispatchRepair,
  propagateRisk, tick, settleRound, settleGame
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

  it('creates chain stress on unrepaired neighbors', () => {
    let s = createInitialState();
    // Force known risk values so we can assert changes
    s = {
      ...s,
      repair_queue: [6], // center-ish node (row 1, col 1) with 4 connections: [1,5,7,11]
      materials: 99,
      risk_hotspots: s.risk_hotspots.map(h => {
        if (h.id === 6) return { ...h, risk: 50 };
        if ([1, 5, 7, 11].includes(h.id)) return { ...h, risk: 20 };
        return h;
      })
    };
    const next = dispatchRepair(s);
    // Neighbors should have increased risk from chain stress
    [1, 5, 7, 11].forEach(nid => {
      assert.ok(next.risk_hotspots[nid].risk >= 20 + 8,
        `neighbor ${nid} should have chain stress risk >= 28, got ${next.risk_hotspots[nid].risk}`);
    });
    // Target should be repaired
    assert.ok(next.risk_hotspots[6].repaired);
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

  it('wins when time reaches zero with sufficient repairs', () => {
    let s = createInitialState();
    s = {
      ...s, time: 1,
      risk_hotspots: s.risk_hotspots.map((h, i) => i < 10 ? { ...h, repaired: true, risk: 0 } : h)
    };
    const next = tick(s);
    assert.equal(next.time, 0);
    assert.equal(next.phase, 'won');
  });

  it('loses when time reaches zero without sufficient repairs', () => {
    const s = { ...createInitialState(), time: 1 };
    const next = tick(s);
    assert.equal(next.time, 0);
    assert.equal(next.phase, 'lost');
  });

  it('increases pressure from critical hotspots', () => {
    let s = createInitialState();
    s = {
      ...s, collapse_pressure: 0,
      risk_hotspots: s.risk_hotspots.map((h, i) => i < 6 ? { ...h, risk: 80, repaired: false } : h)
    };
    const next = tick(s);
    assert.ok(next.collapse_pressure > 0, 'pressure should increase from critical hotspots');
  });

  it('does not tick after game ends', () => {
    const s = { ...createInitialState(), time: 50, phase: 'lost' };
    assert.equal(tick(s).time, 50);
  });
});

describe('settleRound', () => {
  it('continues playing when no end condition met', () => {
    const next = settleRound(createInitialState());
    assert.equal(next.phase, 'playing');
  });

  it('wins when all hotspots repaired', () => {
    let s = createInitialState();
    s = { ...s, risk_hotspots: s.risk_hotspots.map(h => ({ ...h, repaired: true, risk: 0 })) };
    assert.equal(settleRound(s).phase, 'won');
  });

  it('loses when collapse pressure at 100', () => {
    const s = { ...createInitialState(), collapse_pressure: 100 };
    assert.equal(settleRound(s).phase, 'lost');
  });

  it('no-ops after game ended', () => {
    const s = { ...createInitialState(), phase: 'lost' };
    assert.equal(settleRound(s).phase, 'lost');
  });
});

describe('state coupling', () => {
  it('dispatchRepair pushes both resource and risk pressure', () => {
    let s = createInitialState();
    s = {
      ...s,
      repair_queue: [6],
      materials: 30,
      collapse_pressure: 20,
      risk_hotspots: s.risk_hotspots.map(h => {
        if (h.id === 6) return { ...h, risk: 50 };
        return h;
      })
    };
    const next = dispatchRepair(s);
    // Resource pressure: materials decreased
    assert.ok(next.materials < 30, 'materials should decrease');
    // Risk pressure: collapse pressure changed (reduced by repair but increased by chain stress)
    assert.ok(next.collapse_pressure !== s.collapse_pressure, 'collapse pressure should change');
    // Risk pressure: at least one neighbor's risk increased
    const origNeighbors = s.risk_hotspots[6].connections.map(cid => s.risk_hotspots[cid].risk);
    const newNeighbors = s.risk_hotspots[6].connections.map(cid => next.risk_hotspots[cid].risk);
    assert.ok(newNeighbors.some((r, i) => r > origNeighbors[i]), 'neighbor risk should increase from chain stress');
  });

  it('tick pushes both progress and risk pressure when critical hotspots exist', () => {
    let s = createInitialState();
    s = {
      ...s, time: 100, collapse_pressure: 10,
      risk_hotspots: s.risk_hotspots.map((h, i) => i < 9 ? { ...h, risk: 80, repaired: false } : h)
    };
    const next = tick(s);
    // Progress pressure: time decreased
    assert.equal(next.time, 99);
    // Risk pressure: collapse pressure increased
    assert.ok(next.collapse_pressure > 10, 'pressure should increase from critical hotspots');
  });
});

// ── ACCEPTANCE PLAYTHROUGH: scripted core loop verification ──
describe('ACCEPTANCE_PLAYTHROUGH', () => {
  it('full core loop: view -> select -> queue -> dispatch -> propagate -> tick', () => {
    let s = createInitialState();
    // Step 1: View risk map — state has risk_hotspots with risk values
    assert.ok(s.risk_hotspots.length > 0, 'risk map must show hotspots');
    assert.ok(s.risk_hotspots.every(h => typeof h.risk === 'number'), 'each hotspot has risk');

    // Step 2: Select a hotspot (primary input on scene object)
    s = selectHotspot(s, 6);
    assert.equal(s.selected_hotspot, 6, 'player selected hotspot 6');

    // Step 3: Add to repair queue (minimum interaction: allocate materials to hotspot)
    s = addToRepairQueue(s, 6);
    assert.deepEqual(s.repair_queue, [6], 'hotspot 6 queued for repair');

    // Record pre-dispatch state for delta verification
    const preMaterials = s.materials;
    const prePressure = s.collapse_pressure;
    const preRisk6 = s.risk_hotspots[6].risk;

    // Step 4: Dispatch — consume materials, repair node, chain stress neighbors
    s = dispatchRepair(s);
    assert.ok(s.risk_hotspots[6].repaired, 'hotspot 6 is now repaired');
    assert.ok(s.materials < preMaterials, 'materials consumed (resource pressure delta)');
    assert.equal(s.repair_queue.length, 0, 'queue cleared after dispatch');

    // Step 5: Propagate risk — neighbors feel chain stress
    const preNeighborRisks = s.risk_hotspots[6].connections.map(cid => s.risk_hotspots[cid].risk);
    s = propagateRisk(s);
    // At least one neighbor should have risk change from propagation
    const postNeighborRisks = s.risk_hotspots[6].connections.map(cid => s.risk_hotspots[cid].risk);
    assert.ok(
      postNeighborRisks.some((r, i) => r !== preNeighborRisks[i]),
      'risk propagation changed at least one neighbor (risk pressure delta)'
    );

    // Step 6: Tick — time advances, pressure may rise
    const preTime = s.time;
    s = tick(s);
    assert.ok(s.time < preTime, 'time decremented (progress pressure)');
    assert.equal(s.phase, 'playing', 'game still playing after one cycle');
  });

  it('settleGame produces grades for different outcomes', () => {
    // Win scenario: all repaired
    let s = createInitialState();
    s = { ...s, risk_hotspots: s.risk_hotspots.map(h => ({ ...h, repaired: true, risk: 0 })), phase: 'won' };
    let result = settleGame(s);
    assert.ok(['S', 'A', 'B'].includes(result.grade), `win grade should be S/A/B, got ${result.grade}`);
    assert.ok(result.repaired === result.total);

    // Loss scenario
    s = createInitialState();
    s = { ...s, collapse_pressure: 100, phase: 'lost' };
    result = settleGame(s);
    assert.equal(result.grade, 'F');
    assert.equal(result.verdict, '结构坍塌');

    // Partial win: decent repair ratio
    s = createInitialState();
    const half = Math.floor(s.risk_hotspots.length / 2);
    s = {
      ...s, phase: 'won', collapse_pressure: 40,
      risk_hotspots: s.risk_hotspots.map((h, i) => i < half ? { ...h, repaired: true, risk: 0 } : h)
    };
    result = settleGame(s);
    assert.ok(result.repairRatio >= 40, `repair ratio should be >=40%, got ${result.repairRatio}%`);
  });
});
