// Risk map canvas rendering and scene-object interaction
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

export function drawRiskMap(ctx, state, w, h) {
  ctx.clearRect(0, 0, w, h);

  // Draw scaffolding beams (connections)
  state.risk_hotspots.forEach(hs => {
    const p = nodePos(hs, w, h);
    hs.connections.forEach(cid => {
      if (cid > hs.id) {
        const nb = state.risk_hotspots[cid];
        const np = nodePos(nb, w, h);
        const avg = (hs.risk + nb.risk) / 2;
        ctx.strokeStyle = riskColor(avg);
        ctx.lineWidth = 3 + avg / 25;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(np.x, np.y);
        ctx.stroke();
      }
    });
  });

  // Draw hotspot nodes
  state.risk_hotspots.forEach(hs => {
    const p = nodePos(hs, w, h);
    const inQueue = state.repair_queue.includes(hs.id);

    // Selection highlight
    if (state.selected_hotspot === hs.id) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, NODE_RADIUS + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Node body
    ctx.beginPath();
    ctx.arc(p.x, p.y, NODE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = hs.repaired ? '#555' : riskColor(hs.risk);
    ctx.fill();
    ctx.strokeStyle = inQueue ? '#2196f3' : '#333';
    ctx.lineWidth = inQueue ? 3 : 1;
    ctx.stroke();

    // Label: queue number or risk value
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (inQueue) {
      ctx.fillText('' + (state.repair_queue.indexOf(hs.id) + 1), p.x, p.y);
    } else if (!hs.repaired) {
      ctx.font = '11px monospace';
      ctx.fillText('' + hs.risk, p.x, p.y);
    } else {
      ctx.fillText('OK', p.x, p.y);
    }
  });
}

export function hitTestHotspot(state, cx, cy, w, h) {
  for (const hs of state.risk_hotspots) {
    if (hs.repaired) continue;
    const p = nodePos(hs, w, h);
    const dx = cx - p.x, dy = cy - p.y;
    if (dx * dx + dy * dy <= NODE_RADIUS * NODE_RADIUS) return hs.id;
  }
  return null;
}

export function renderRepairQueue(container, state, callbacks) {
  container.innerHTML = '';
  if (state.repair_queue.length === 0) {
    container.textContent = '点击风险图节点添加修复点';
    container.style.color = '#888';
    return;
  }
  container.style.color = '';

  state.repair_queue.forEach((hid, idx) => {
    const hs = state.risk_hotspots.find(n => n.id === hid);
    const card = document.createElement('div');
    card.className = 'queue-card';
    card.draggable = true;
    card.dataset.index = idx;
    card.innerHTML =
      `<span class="queue-num">${idx + 1}</span>` +
      `<span class="queue-label">节点${hid}</span>` +
      `<span class="queue-risk" style="color:${riskColor(hs.risk)}">风险${hs.risk}</span>` +
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
