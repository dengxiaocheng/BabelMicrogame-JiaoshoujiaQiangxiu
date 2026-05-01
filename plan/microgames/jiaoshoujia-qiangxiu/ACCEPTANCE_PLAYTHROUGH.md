# ACCEPTANCE_PLAYTHROUGH: 脚手架抢修

## Starting State

```
time = 20
materials = { bolts: 8, planks: 6, cables: 4 }
collapsePressure = 0
repairQueue = []

hotspots:
  A1: risk=30, connections=[A2,B1],     repairCost={bolts:1, planks:1, cables:0}
  A2: risk=15, connections=[A1,A3,B2],  repairCost={bolts:0, planks:1, cables:1}
  A3: risk=45, connections=[A2,B3],     repairCost={bolts:1, planks:0, cables:1}
  B1: risk=20, connections=[A1,B2,C1],  repairCost={bolts:1, planks:1, cables:0}
  B2: risk=35, connections=[A2,B1,B3,C2], repairCost={bolts:1, planks:1, cables:1}
  B3: risk=50, connections=[A3,B2,C3],  repairCost={bolts:2, planks:0, cables:1}
  C1: risk=10, connections=[B1,C2],     repairCost={bolts:0, planks:1, cables:0}
  C2: risk=25, connections=[B2,C1,C3],  repairCost={bolts:1, planks:0, cables:1}
  C3: risk=40, connections=[B3,C2],     repairCost={bolts:1, planks:1, cables:0}
```

## Scripted Playthrough — Happy Path

### Tick 1: 修复 B3 (最高风险)

1. 玩家查看风险图 → B3 橙色(50), A3 橙色(45), C3 黄+橙(40)
2. 点击 B3 → 节点高亮，side panel 显示 cost={bolts:2, planks:0, cables:1}
3. 点击 "加入队列" → repairQueue = ["B3"]
4. 点击 "派工"

**Expected after Tick 1:**
- B3: isRepaired=true, riskLevel=0 → 蓝色 ✓
- materials: { bolts:6, planks:6, cables:3 }
- Risk propagation: floor(45*0.15)=6 → A2+=6→21; floor(35*0.15)=5 → A2+=5→26,A1+=5→35,B1+=5→25,B3(repaired skip),C2+=5→30
- All riskLevels stay < 80 → no collapse
- time=19, collapsePressure=0

### Tick 2: 修复 A3

1. 点击 A3 → 加入队列 → repairQueue = ["A3"]
2. 点击 "派工"

**Expected after Tick 2:**
- A3: isRepaired=true, riskLevel=0 → 蓝色 ✓
- materials: { bolts:5, planks:6, cables:2 }
- Risk propagation continues from remaining hotspots
- collapsePressure 仍为 0
- time=18

### Tick 3: 修复 B2

1. 点击 B2 → 加入队列 → 派工

**Expected after Tick 3:**
- B2: isRepaired=true → 蓝色 ✓
- materials 减少
- time=17

### Tick 4: 修复 C3

1. 点击 C3 → 加入队列 → 派工

**Expected after Tick 4:**
- C3: isRepaired=true → 蓝色 ✓
- time=16
- collapsePressure < 15 (无塌陷发生)

### Tick 5: 修复 A1

1. 点击 A1 → 加入队列 → 派工

**Expected after Tick 5:**
- A1: isRepaired=true → 蓝色 ✓
- 已修复 5 个热点，time=15
- 剩余热点风险仍在传播但增长缓慢（邻居多已修复）

### Mid-Game Check (Tick 10)

- 预期已修复 7+ 热点
- collapsePressure < 10
- materials 有剩余
- time=10

### Endgame (Tick 20)

- 所有 9 热点已修复或低风险
- collapsePressure < 20 → **成功结局**
- 显示结算面板：修复数/塌陷数/剩余材料/用时

---

## Scripted Playthrough — Failure Path

### Tick 1-3: 修低风险点（错误策略）

1. 玩家修复 C1 (risk=10), C2 (risk=25), A2 (risk=15)
2. 高风险点 B3(50), A3(45), C3(40) 持续传播风险

**Expected by Tick 3:**
- B3 risk 逐 tick 增长（邻居 B2, C3 传播进 + 自身传播出）
- A3 risk 持续增长
- collapsePressure 可能仍为 0（尚未超阈值）

### Tick 4-6: 连锁塌陷

1. B3 riskLevel 超过 80 → B3 塌陷
   - collapsePressure += 15
   - B3 此后 ×2 传播给 A3 和 C3
2. A3 riskLevel 急升 → A3 也塌陷
   - collapsePressure += 15 → total 30（高压预警）
3. 连锁继续 → collapsePressure 接近 60

### Tick 7+: 失败

1. collapsePressure >= 60 → **失败结局**
2. 显示结算面板：塌陷节点列表、连锁过程

---

## Direction Gate

- integration worker 必须让 Happy Path Tick 1-5 可完整试玩
- qa worker 必须用程序化测试验证每条 expected state 变化
- 如试玩要求需要偏离 Direction Lock，停止并回交 manager
- 测试只需覆盖确定性逻辑，不需要测动画/拖拽
