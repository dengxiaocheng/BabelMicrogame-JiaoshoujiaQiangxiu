# MECHANIC_SPEC: 脚手架抢修

## Primary Mechanic

- mechanic: 风险热区 + 修复队列 + 连锁承压
- primary_input: 在脚手架风险图上点选修复点并排序抢修队列
- minimum_interaction: 玩家必须把有限 materials 分配到至少一个热点并调整 repair_queue 顺序，观察风险传播

## State Schema

### GameState

| 字段 | 类型 | 初始值 | 说明 |
|------|------|--------|------|
| time | number | 20 | 倒计时 tick，每派工 -1 |
| materials.bolts | number | 8 | 螺栓 |
| materials.planks | number | 6 | 木板 |
| materials.cables | number | 4 | 钢缆 |
| collapsePressure | number | 0 | 全局承压 0-100 |
| hotspots | Hotspot[] | (见 content worker 定义) | 风险节点数组 |
| repairQueue | string[] | [] | 修复队列（hotspot ID 有序列表） |

### Hotspot

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 (如 "A1") |
| x | number | Canvas X 坐标 |
| y | number | Canvas Y 坐标 |
| riskLevel | number | 风险值 0-100 |
| connections | string[] | 相邻热点 ID 列表 |
| repairCost | { bolts: number, planks: number, cables: number } | 修复所需材料 |
| isCollapsed | boolean | 是否已塌陷 |
| isRepaired | boolean | 是否已修复 |

## Per-Tick Pipeline

每次玩家点击"派工"按钮，按以下顺序执行：

### Step 1: Dequeue Repair
- 若 repairQueue 非空，弹出队首 hotspot ID
- 检查 materials 是否 >= 该 hotspot.repairCost
  - 足够 → 扣除 materials，hotspot.isRepaired = true，hotspot.riskLevel = 0
  - 不足 → 跳过本次修复，弹出该热点，向 UI 返回"材料不足"消息
- 若 repairQueue 为空 → 跳过

### Step 2: Risk Propagation
对每个 `!isRepaired && !isCollapsed` 的 hotspot：
- spreadAmount = floor(riskLevel * RISK_SPREAD_FACTOR)
- 对每个 connection 邻居（同样 !isRepaired && !isCollapsed）：
  - neighbor.riskLevel = min(100, neighbor.riskLevel + spreadAmount)

对每个 `isCollapsed` 的 hotspot：
- spreadAmount = floor(riskLevel * RISK_SPREAD_FACTOR * COLLAPSED_SPREAD_MULTIPLIER)
- 对每个 !isRepaired && !isCollapsed 的邻居：同上累加

### Step 3: Collapse Check
对每个 `!isCollapsed && !isRepaired` 的 hotspot：
- 若 riskLevel > COLLAPSE_THRESHOLD：
  - isCollapsed = true
  - collapsePressure += COLLAPSE_PENALTY
  - 触发塌陷反馈动画

### Step 4: Time Tick
- time -= 1

### Step 5: Pressure Gate
- 若 collapsePressure >= PRESSURE_FAIL → 立即结算（失败）
- 若 collapsePressure >= PRESSURE_WARN → UI 高压警告
- 若 time == 0 → 进入结算

## Config Constants

| 常量 | 值 | 说明 |
|------|-----|------|
| RISK_SPREAD_FACTOR | 0.15 | 风险传播系数 |
| COLLAPSE_THRESHOLD | 80 | 塌陷风险阈值 |
| COLLAPSE_PENALTY | 15 | 每次塌陷增加的承压 |
| COLLAPSED_SPREAD_MULTIPLIER | 2 | 塌陷节点传播倍率 |
| PRESSURE_FAIL | 60 | 失败承压阈值 |
| PRESSURE_WARN | 30 | 预警承压阈值 |
| WIN_PRESSURE | 20 | 成功结算承压上限 |
| TOTAL_TICKS | 20 | 总回合数 |

## Win/Lose Conditions

| 条件 | 结果 |
|------|------|
| collapsePressure >= PRESSURE_FAIL | 失败：关键结构崩溃 |
| time == 0 且 collapsePressure < WIN_PRESSURE | 成功：稳定修复 |
| time == 0 且 WIN_PRESSURE <= collapsePressure < PRESSURE_FAIL | 部分成功：勉强支撑 |

## State Coupling

每次有效操作必须同时推动两类后果：
- 资源/进度压力：materials 减少 / time 减少
- 风险/秩序压力：riskLevel 变化 / collapsePressure 变化

## Not A Choice List

- 不能只展示 2-4 个文字按钮让玩家选择
- UI worker 必须把 primary input 映射到场景对象操作（点击 map 节点）
- integration worker 必须让操作进入 Per-Tick Pipeline 状态结算
- 不允许随机数：risk 传播必须确定性计算
