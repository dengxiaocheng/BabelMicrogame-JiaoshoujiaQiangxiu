// Event pool for 脚手架抢修 — serves core emotion: risk hotspots + repair queue + chain pressure
// All events operate on Required State (materials, risk_hotspots, repair_queue, collapse_pressure, time)
// and feed back through Scene Objects and Feedback Channels

/**
 * Each event:
 *  id          — unique string
 *  trigger(s)  — (state) => bool, whether this event can fire
 *  apply(s)    — (state) => { state, messages: [{text, channel}] }
 *  cooldown    — minimum ticks between firings (tracked in state.event_cooldowns)
 *  weight      — priority when multiple events eligible (higher = more likely)
 */

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export const EVENT_POOL = [
  // ── Risk Spike: sudden gust hits vulnerable nodes ──
  {
    id: 'gust_spike',
    weight: 8,
    cooldown: 30,
    trigger(state) {
      return state.risk_hotspots.filter(h => !h.repaired && h.risk >= 40).length >= 2;
    },
    apply(state) {
      const candidates = state.risk_hotspots.filter(h => !h.repaired && h.risk >= 40);
      const targets = pickRandom(candidates, 2 + Math.floor(Math.random() * 2));
      if (!targets.length) return { state, messages: [] };

      const boost = 12 + Math.floor(Math.random() * 12);
      const newHotspots = state.risk_hotspots.map(h => {
        if (targets.some(t => t.id === h.id)) {
          return { ...h, risk: Math.min(100, h.risk + boost) };
        }
        return h;
      });
      const ids = targets.map(t => t.id).join('、');
      return {
        state: { ...state, risk_hotspots: newHotspots },
        messages: [{ text: `阵风冲击！节点 ${ids} 松动加剧！`, channel: 'risk' }]
      };
    }
  },

  // ── Chain Cascade: a critical node drags neighbors closer to collapse ──
  {
    id: 'chain_cascade',
    weight: 10,
    cooldown: 20,
    trigger(state) {
      return state.risk_hotspots.some(h => !h.repaired && h.risk >= 85);
    },
    apply(state) {
      const critical = state.risk_hotspots.filter(h => !h.repaired && h.risk >= 85);
      let newHotspots = [...state.risk_hotspots];
      const affected = [];

      for (const node of critical) {
        newHotspots = newHotspots.map(h => {
          if (node.connections.includes(h.id) && !h.repaired) {
            affected.push(h.id);
            return { ...h, risk: Math.min(100, h.risk + 10) };
          }
          return h;
        });
      }
      const uniqueAffected = [...new Set(affected)];
      if (!uniqueAffected.length) return { state, messages: [] };

      const pressureJump = critical.length * 4;
      const newPressure = Math.min(100, state.collapse_pressure + pressureJump);
      const ids = uniqueAffected.slice(0, 4).join('、');
      return {
        state: { ...state, risk_hotspots: newHotspots, collapse_pressure: newPressure },
        messages: [{
          text: `连锁承压！节点 ${ids} 受到波及，塌陷压力 +${pressureJump}`,
          channel: 'collapse'
        }]
      };
    }
  },

  // ── Material Scavenge: workers find scraps when supplies are low ──
  {
    id: 'material_scavenge',
    weight: 4,
    cooldown: 45,
    trigger(state) {
      return state.materials < 12 && state.materials > 0;
    },
    apply(state) {
      const gain = 3 + Math.floor(Math.random() * 5);
      return {
        state: { ...state, materials: state.materials + gain },
        messages: [{ text: `工人在废料堆找到可用材料！+${gain}`, channel: 'materials' }]
      };
    }
  },

  // ── Structural Shift: repair redirects load to neighbors ──
  {
    id: 'structural_shift',
    weight: 7,
    cooldown: 25,
    trigger(state) {
      const repaired = state.risk_hotspots.filter(h => h.repaired);
      if (!repaired.length) return false;
      const lastRepaired = repaired[repaired.length - 1];
      const unrepairedNeighbors = lastRepaired.connections.filter(
        cid => !state.risk_hotspots[cid].repaired
      );
      return unrepairedNeighbors.length >= 3;
    },
    apply(state) {
      const repaired = state.risk_hotspots.filter(h => h.repaired);
      const lastRepaired = repaired[repaired.length - 1];
      const affected = lastRepaired.connections.filter(
        cid => !state.risk_hotspots[cid].repaired
      );

      const newHotspots = state.risk_hotspots.map(h => {
        if (affected.includes(h.id)) {
          return { ...h, risk: Math.min(100, h.risk + 8) };
        }
        return h;
      });

      const ids = affected.join('、');
      return {
        state: { ...state, risk_hotspots: newHotspots },
        messages: [{
          text: `结构重心偏移！节点 ${ids} 承压增加！`,
          channel: 'risk'
        }]
      };
    }
  },

  // ── Emergency Supplies: critical delivery at high cost ──
  {
    id: 'emergency_supplies',
    weight: 6,
    cooldown: 60,
    trigger(state) {
      return state.materials <= 3 && state.collapse_pressure >= 30;
    },
    apply(state) {
      return {
        state: {
          ...state,
          materials: state.materials + 8,
          collapse_pressure: Math.min(100, state.collapse_pressure + 8)
        },
        messages: [{
          text: '紧急物资到达！+8 材料，但运输加重结构负担！',
          channel: 'materials'
        }]
      };
    }
  },

  // ── Imminent Collapse Warning: pressure zone escalation ──
  {
    id: 'collapse_warning',
    weight: 9,
    cooldown: 35,
    trigger(state) {
      return state.collapse_pressure >= 55 && state.collapse_pressure < 85;
    },
    apply(state) {
      const hotCount = state.risk_hotspots.filter(h => !h.repaired && h.risk >= 70).length;
      const newPressure = Math.min(100, state.collapse_pressure + hotCount * 2);
      return {
        state: { ...state, collapse_pressure: newPressure },
        messages: [{
          text: `塌陷预警升级！${hotCount} 个高危节点持续施压！`,
          channel: 'collapse'
        }]
      };
    }
  },

  // ── Rush Job Bonus: successfully repairing a critical node stabilizes area ──
  {
    id: 'rush_job_bonus',
    weight: 5,
    cooldown: 40,
    trigger(state) {
      const repaired = state.risk_hotspots.filter(h => h.repaired);
      const recentlyHigh = repaired.filter(h => {
        // Can't see original risk, but if it had many unrepaired neighbors it was probably critical
        return h.connections.filter(cid => !state.risk_hotspots[cid].repaired).length <= 2
          && h.connections.filter(cid => state.risk_hotspots[cid].repaired).length >= 2;
      });
      return recentlyHigh.length >= 1 && state.collapse_pressure > 10;
    },
    apply(state) {
      const pressureRelief = 6 + Math.floor(Math.random() * 5);
      const newPressure = Math.max(0, state.collapse_pressure - pressureRelief);

      // Also slightly reduce risk on neighbors of repaired nodes
      const newHotspots = state.risk_hotspots.map(h => {
        if (h.repaired) return h;
        const repairedNeighbors = h.connections.filter(
          cid => state.risk_hotspots[cid].repaired
        );
        if (repairedNeighbors.length >= 2) {
          return { ...h, risk: Math.max(0, h.risk - 4) };
        }
        return h;
      });

      return {
        state: { ...state, collapse_pressure: newPressure, risk_hotspots: newHotspots },
        messages: [{
          text: `关键节点修复效果显著！周围承压下降，塌陷压力 -${pressureRelief}`,
          channel: 'collapse'
        }]
      };
    }
  },

  // ── Time Crunch: final minute, everything accelerates ──
  {
    id: 'time_crunch',
    weight: 12,
    cooldown: 0,
    trigger(state) {
      return state.time <= 60 && state.time > 0 && state.time % 15 === 0;
    },
    apply(state) {
      const unrepaired = state.risk_hotspots.filter(h => !h.repaired);
      if (!unrepaired.length) return { state, messages: [] };

      const newHotspots = state.risk_hotspots.map(h => {
        if (!h.repaired) return { ...h, risk: Math.min(100, h.risk + 5) };
        return h;
      });
      const newPressure = Math.min(100, state.collapse_pressure + 3);

      return {
        state: { ...state, risk_hotspots: newHotspots, collapse_pressure: newPressure },
        messages: [{
          text: `最后 ${state.time} 秒！结构加速恶化！`,
          channel: 'time'
        }]
      };
    }
  },

  // ── Loose Bolt: a single node suddenly worsens ──
  {
    id: 'loose_bolt',
    weight: 6,
    cooldown: 20,
    trigger(state) {
      return state.risk_hotspots.filter(h => !h.repaired && h.risk >= 50 && h.risk < 80).length >= 1;
    },
    apply(state) {
      const candidates = state.risk_hotspots.filter(
        h => !h.repaired && h.risk >= 50 && h.risk < 80
      );
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      if (!target) return { state, messages: [] };

      const newHotspots = state.risk_hotspots.map(h => {
        if (h.id === target.id) {
          return { ...h, risk: Math.min(100, h.risk + 18) };
        }
        return h;
      });

      return {
        state: { ...state, risk_hotspots: newHotspots },
        messages: [{
          text: `节点 ${target.id} 螺栓松动！风险骤升至 ${Math.min(100, target.risk + 18)}！`,
          channel: 'risk'
        }]
      };
    }
  }
];

// ── Event Resolver ──

const CHANNEL_COLORS = {
  risk: '#ff9800',
  collapse: '#f44336',
  materials: '#2196f3',
  time: '#ffc107'
};

export function getChannelColor(channel) {
  return CHANNEL_COLORS[channel] || '#fff';
}

/**
 * Resolve events for the current tick.
 * Returns { state, messages } — only fires at most one event per call.
 * Respects cooldowns tracked in state.event_cooldowns.
 */
export function resolveEvents(state) {
  if (state.phase !== 'playing') return { state, messages: [] };

  // Decrement all cooldowns
  const cooldowns = { ...(state.event_cooldowns || {}) };
  for (const key of Object.keys(cooldowns)) {
    cooldowns[key] = Math.max(0, cooldowns[key] - 1);
  }

  // Find eligible events (trigger met, not on cooldown)
  const eligible = EVENT_POOL.filter(ev => {
    if (cooldowns[ev.id] > 0) return false;
    try { return ev.trigger(state); } catch { return false; }
  });

  if (!eligible.length) return { state: { ...state, event_cooldowns: cooldowns }, messages: [] };

  // Pick highest weight, break ties randomly
  eligible.sort((a, b) => b.weight - a.weight || (Math.random() - 0.5));
  const chosen = eligible[0];

  // Apply
  const result = chosen.apply(state);
  cooldowns[chosen.id] = chosen.cooldown;

  return {
    state: { ...result.state, event_cooldowns: cooldowns },
    messages: result.messages
  };
}
