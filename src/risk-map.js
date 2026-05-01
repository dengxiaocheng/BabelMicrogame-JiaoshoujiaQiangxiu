// Risk map canvas rendering with animated scene-object interaction
import { getHotspotLabel } from './content/events.js';
// Primary input: click hotspots on scaffolding risk map to build repair queue

const COLS = 5, ROWS = 4, NODE_RADIUS = 18;

function nodePos(hs, w, h) {
  const px = 70, py = 55;
  return {
    x: px + hs.col * ((w - px * 2) / (COLS - 1)),
    y: py + hs.row * ((h - py * 2) / (ROWS - 1))
  };
}

function riskColor(risk) {
  if (risk >= 80) return '#f44336';
  if (risk >= 60) return '#ff9800';
  if (risk >= 40) return '#ffc107';
  if (risk >= 20) return '#8bc34a';
  return '#4caf50';
}

// ── Cascade danger preview: animated chain-reaction paths from selected node ──
function drawCascadePreview(ctx, state, selectedId, w, h, ts) {
  if (selectedId === null) return;
  const hs = state.risk_hotspots[selectedId];
  if (!hs || hs.repaired) return;

  const visited = new Set([selectedId]);
  const frontier = [{ id: selectedId, depth: 0 }];

  while (frontier.length > 0) {
    const { id, depth } = frontier.shift();
    if (depth >= 2) continue;
    const node = state.risk_hotspots[id];
    if (!node) continue;
    const np = nodePos(node, w, h);

    for (const cid of node.connections) {
      if (visited.has(cid)) continue;
      visited.add(cid);
      const nb = state.risk_hotspots[cid];
      if (nb.repaired) continue;
      const npp = nodePos(nb, w, h);

      // Animated danger line flowing outward
      const alpha = 0.2 + Math.sin(ts / 350 + cid * 0.5) * 0.1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = depth === 0 ? '#f44336' : '#ff9800';
      ctx.lineWidth = 2.5 - depth * 0.8;
      ctx.setLineDash([6 + depth * 2, 3 + depth]);
      ctx.lineDashOffset = -ts / (80 + depth * 40);
      ctx.beginPath();
      ctx.moveTo(np.x, np.y);
      ctx.lineTo(npp.x, npp.y);
      ctx.stroke();
      ctx.restore();

      // Cascade impact badge on first-level connections
      if (depth === 0) {
        const impact = Math.ceil(nb.risk * 0.12);
        const mx = (np.x + npp.x) / 2;
        const my = (np.y + npp.y) / 2;
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ff5252';
        ctx.fillText('+' + impact, mx, my - 7);
        ctx.restore();
      }

      frontier.push({ id: cid, depth: depth + 1 });
    }
  }
}

// ── Propagation ripple: visual feedback on nodes hit by risk spread ──
function drawPropagationRipple(ctx, hotspots, propagatedIds, w, h, ts) {
  if (!propagatedIds || !propagatedIds.length) return;
  for (const id of propagatedIds) {
    const hs = hotspots[id];
    if (!hs || hs.repaired) continue;
    const p = nodePos(hs, w, h);

    // Expanding ring
    const rr = NODE_RADIUS + 10 + Math.sin(ts / 200 + id) * 5;
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(ts / 250) * 0.1;
    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ── Repair burst: expanding green ring when a node is repaired ──
function drawRepairBurst(ctx, hotspots, repairedId, repairTime, w, h, ts) {
  if (repairedId === null || !repairTime) return;
  const elapsed = ts - repairTime;
  if (elapsed < 0 || elapsed > 2000) return;
  const hs = hotspots[repairedId];
  if (!hs) return;
  const p = nodePos(hs, w, h);

  const progress = elapsed / 2000;
  const burstR = NODE_RADIUS + progress * 30;
  const alpha = (1 - progress) * 0.6;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#4caf50';
  ctx.lineWidth = 3 * (1 - progress);
  ctx.beginPath();
  ctx.arc(p.x, p.y, burstR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawRiskMap(ctx, state, w, h, timestamp, hoveredId, feedback) {
  const ts = timestamp || 0;
  const fb = feedback || {};
  ctx.clearRect(0, 0, w, h);

  // Scaffold frame outline
  ctx.strokeStyle = '#1a3355';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(35, 25, w - 70, h - 50);
  ctx.setLineDash([]);

  // Scaffold structure labels — rows = scaffolding parts, columns = sectors
  const spx = 70, spy = 55;
  ctx.font = '11px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#445';
  ['横杆', '立柱', '连接件', '平台板'].forEach((label, r) => {
    const y = spy + r * ((h - spy * 2) / (ROWS - 1));
    ctx.fillText(label, spx - 12, y);
  });
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'center';
  ['A区', 'B区', 'C区', 'D区', 'E区'].forEach((label, c) => {
    const x = spx + c * ((w - spx * 2) / (COLS - 1));
    ctx.fillText(label, x, spy - 10);
  });

  // Draw connections (scaffolding beams)
  state.risk_hotspots.forEach(hs => {
    const p = nodePos(hs, w, h);
    hs.connections.forEach(cid => {
      if (cid > hs.id) {
        const nb = state.risk_hotspots[cid];
        const np = nodePos(nb, w, h);
        const avg = (hs.risk + nb.risk) / 2;

        // Base beam
        ctx.strokeStyle = riskColor(avg);
        ctx.lineWidth = 3 + avg / 25;
        ctx.globalAlpha = 0.5 + avg / 300;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(np.x, np.y);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Danger pulse on high-risk connections
        if (avg >= 70) {
          const pulse = Math.sin(ts / 300) * 0.25 + 0.5;
          ctx.globalAlpha = pulse;
          ctx.strokeStyle = '#f44336';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(np.x, np.y);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    });
  });

  // Cascade danger preview from selected node
  drawCascadePreview(ctx, state, state.selected_hotspot, w, h, ts);
  // Propagation ripple on recently affected nodes
  drawPropagationRipple(ctx, state.risk_hotspots, fb.propagatedIds, w, h, ts);
  // Repair burst animation
  drawRepairBurst(ctx, state.risk_hotspots, fb.lastRepairId, fb.lastRepairTime, w, h, ts);

  // Draw hotspot nodes
  state.risk_hotspots.forEach(hs => {
    const p = nodePos(hs, w, h);
    const inQueue = state.repair_queue.includes(hs.id);
    const isSelected = state.selected_hotspot === hs.id;
    const isHovered = hoveredId === hs.id;

    // Dynamic radius: critical nodes pulse
    let radius = NODE_RADIUS;
    if (!hs.repaired && hs.risk >= 80) {
      radius = NODE_RADIUS + Math.sin(ts / 200) * 3;
    }

    // Glow for high-risk unrepaired nodes
    if (!hs.repaired && hs.risk >= 65) {
      const glowAlpha = Math.sin(ts / 500 + hs.id * 0.7) * 0.15 + 0.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 6, 0, Math.PI * 2);
      ctx.fillStyle = riskColor(hs.risk);
      ctx.globalAlpha = glowAlpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Critical danger zone: pulsing red aura for risk >= 90
    if (!hs.repaired && hs.risk >= 90) {
      const dp = Math.sin(ts / 150) * 0.3 + 0.35;
      ctx.save();
      ctx.globalAlpha = dp;
      ctx.fillStyle = '#f44336';
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Selection ring (animated dash)
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 7, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.lineDashOffset = -ts / 80;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }

    // Hover ring
    if (isHovered && !isSelected && !hs.repaired) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Node body
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = hs.repaired ? '#2a2a3e' : riskColor(hs.risk);
    ctx.fill();
    ctx.strokeStyle = inQueue ? '#2196f3' : isSelected ? '#fff' : '#444';
    ctx.lineWidth = inQueue ? 3 : isSelected ? 2 : 1;
    ctx.stroke();

    // Node label
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (hs.repaired) {
      ctx.strokeStyle = '#4caf50';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - 5, p.y);
      ctx.lineTo(p.x - 1, p.y + 4);
      ctx.lineTo(p.x + 6, p.y - 4);
      ctx.stroke();
    } else if (inQueue) {
      ctx.font = 'bold 13px monospace';
      ctx.fillText('' + (state.repair_queue.indexOf(hs.id) + 1), p.x, p.y);
    } else {
      ctx.font = '11px monospace';
      ctx.fillText('' + hs.risk, p.x, p.y);
    }

    // Part label on hover/select — shows scaffolding context
    if ((isSelected || isHovered) && !hs.repaired) {
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#ddd';
      ctx.fillText(getHotspotLabel(hs.id), p.x, p.y - radius - 8);
    }

    // Cost badge on selected node
    if (isSelected && !hs.repaired) {
      const cost = Math.ceil(hs.risk / 10);
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = state.materials >= cost ? '#2196f3' : '#f44336';
      ctx.fillText('\u2212' + cost, p.x, p.y + radius + 13);
    }
  });

  // Risk color legend
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  const ly = h - 8;
  const levels = [
    { t: '安全', c: '#4caf50' }, { t: '低危', c: '#8bc34a' },
    { t: '中危', c: '#ffc107' }, { t: '高危', c: '#ff9800' },
    { t: '危急', c: '#f44336' }
  ];
  let lx = 12;
  for (const lv of levels) {
    ctx.fillStyle = lv.c;
    ctx.fillRect(lx, ly - 8, 8, 8);
    ctx.fillStyle = '#888';
    ctx.fillText(lv.t, lx + 10, ly);
    lx += 52;
  }
}

export function hitTestHotspot(state, cx, cy, w, h) {
  for (const hs of state.risk_hotspots) {
    if (hs.repaired) continue;
    const p = nodePos(hs, w, h);
    const dx = cx - p.x, dy = cy - p.y;
    const r = NODE_RADIUS + 5;
    if (dx * dx + dy * dy <= r * r) return hs.id;
  }
  return null;
}

export function renderRepairQueue(container, state, callbacks) {
  container.innerHTML = '';
  if (state.repair_queue.length === 0) {
    container.textContent = '点击节点选择 \u2192 再次点击加入队列';
    container.style.color = '#555';
    return;
  }
  container.style.color = '';

  state.repair_queue.forEach((hid, idx) => {
    const hs = state.risk_hotspots.find(n => n.id === hid);
    if (!hs) return;
    const cost = Math.ceil(hs.risk / 10);
    const card = document.createElement('div');
    card.className = 'queue-card';
    card.draggable = true;
    card.dataset.index = idx;
    card.innerHTML =
      `<span class="queue-num">${idx + 1}</span>` +
      `<span class="queue-label">${getHotspotLabel(hid)}</span>` +
      `<span class="queue-risk" style="color:${riskColor(hs.risk)}">${hs.risk}</span>` +
      `<span class="queue-cost">-${cost}</span>` +
      `<span class="queue-remove">\u00d7</span>`;

    card.querySelector('.queue-remove').addEventListener('click', e => {
      e.stopPropagation();
      callbacks.removeFromQueue(hid);
    });
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', '' + idx);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', e => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const from = parseInt(e.dataTransfer.getData('text/plain'));
      if (from !== idx) callbacks.reorderQueue(from, idx);
    });

    container.appendChild(card);
  });
}
