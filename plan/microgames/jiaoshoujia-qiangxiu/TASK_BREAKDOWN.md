# TASK_BREAKDOWN: 脚手架抢修

## Worker Execution Order

```
foundation → state ──┐
                      ├→ ui → integration → qa
           content ──┘
```

state 和 content 可并行。ui 依赖 state 类型定义。integration 依赖全部。qa 最后。

---

## 1. jiaoshoujia-qiangxiu-foundation

- lane: foundation
- level: M
- goal: 建立可运行的游戏骨架，包含 Canvas、渲染循环、初始 state 类型定义

### Must Create

- `index.html`: 游戏页面，含 Canvas 元素和 side panel 容器
- `src/main.ts`: 入口文件，初始化 Canvas 2D context + requestAnimationFrame 渲染循环
- `src/state.ts`: GameState 和 Hotspot 类型定义 + `createInitialState(): GameState` 工厂函数

### Output Contract

- 打开 index.html 看到 Canvas 区域 + side panel 骨架（无报错）
- GameState 类型与 MECHANIC_SPEC State Schema 字段完全一致
- 渲染循环运行但不绘制任何游戏元素

### Acceptance

- `npm run dev` 或直接打开 index.html 无 console 报错
- `createInitialState()` 返回完整 GameState 对象（hotspots 可为空数组）

### Anti-Patterns

- 不实现任何游戏逻辑（propagation、repair 等）
- 不引入 UI 框架（React/Vue），纯 Canvas 2D + DOM
- 不硬编码 hotspot 数据（留给 content worker）
- 不引入构建工具以外的依赖

---

## 2. jiaoshoujia-qiangxiu-state

- lane: logic
- level: M
- goal: 实现 MECHANIC_SPEC 的 Per-Tick Pipeline 全部函数

### Must Create/Modify

- `src/state.ts`: 在 foundation 基础上添加
  - `dequeueRepair(state: GameState): GameState` — 弹出队首执行修复
  - `propagateRisk(state: GameState): GameState` — 风险传播（用 config 常量）
  - `checkCollapse(state: GameState): GameState` — 塌陷检测
  - `tickTime(state: GameState): GameState` — time -= 1
  - `runTick(state: GameState): GameState` — 组合以上 4 步按序执行
  - `checkWinLose(state: GameState): 'win' | 'partial' | 'lose' | null`
  - `enqueueHotspot(state: GameState, hotspotId: string): GameState`
  - `removeFromQueue(state: GameState, hotspotId: string): GameState`
  - `reorderQueue(state: GameState, fromIndex: number, toIndex: number): GameState`

### Input Dependencies

- foundation worker 的 GameState 类型定义

### Output Contract

- 所有函数为纯函数：输入 state，返回新 state，无副作用
- risk propagation 公式严格匹配 MECHANIC_SPEC（floor(riskLevel * 0.15)）
- 无随机数，确定性计算

### Acceptance

- 单元测试覆盖：正常修复、材料不足跳过、塌陷触发、win/partial/lose 判定
- 给定 ACCEPTANCE_PLAYTHROUGH Starting State + repairQueue=["B3"] → runTick 输出可手算验证

### Anti-Patterns

- 不引入随机数（Math.random）
- 不修改 UI 相关代码
- 不引入外部状态管理库
- 不引入 I/O 或网络

---

## 3. jiaoshoujia-qiangxiu-content

- lane: content
- level: M
- goal: 定义 hotspot 地图数据、材料定义、游戏配置常量

### Must Create

- `src/content/hotspots.ts`: 9 个 hotspot 数组定义
  - A1-C3, 3×3 网格布局
  - x/y 坐标、初始 riskLevel、connections、repairCost
  - 数值严格匹配 ACCEPTANCE_PLAYTHROUGH Starting State
- `src/content/materials.ts`: Materials 类型 + 初始值 { bolts:8, planks:6, cables:4 }
- `src/content/config.ts`: 游戏配置常量（见 MECHANIC_SPEC Config Constants 表格）

### Output Contract

- export 的数据结构与 MECHANIC_SPEC Schema 一致
- 所有数值常量可被 state worker 直接 import
- 无逻辑代码，只有类型定义、数据数组、常量

### Acceptance

- TypeScript import 无报错
- hotspots 数组长度 = 9
- 每对 connection 双向一致（A1→A2 则 A2→A1）

### Anti-Patterns

- 不实现游戏逻辑
- 不硬编码 UI 渲染参数（颜色、字号等留给 UI worker）
- 不引入外部数据源

---

## 4. jiaoshoujia-qiangxiu-ui

- lane: ui
- level: M
- goal: 渲染风险图、侧边栏、反馈动画

### Must Create

- `src/ui/renderer.ts`: Canvas 渲染
  - `drawMap(ctx, state, selectedId)` — 绘制所有 hotspot 节点和连线
  - 节点颜色映射：0-25 绿, 26-50 黄, 51-80 橙, 81-100 红, 修复蓝, 塌陷灰
  - `hitTest(x, y, state): string | null` — 点击坐标 → hotspot ID
- `src/ui/sidebar.ts`: DOM 侧边栏
  - `renderMaterials(materials, selectedCost)` — 材料数量
  - `renderQueue(queue, hotspots)` — 修复队列列表（HTML5 drag-and-drop 排序）
  - `renderHeader(time, pressure)` — time + pressure 进度条
  - `renderFooter(message, warning)` — 状态消息 + 预警
- `src/ui/feedback.ts`: 动画效果
  - `repairFlash(ctx, hotspot)` — 修复闪光
  - `collapseShake(ctx, hotspot)` — 塌陷 screen shake
  - `pressurePulse(element)` — 高压预警闪烁

### Input Dependencies

- foundation worker 的 Canvas 初始化
- GameState 类型

### Output Contract

- renderer 接受 (ctx, state, selectedId) 参数
- hitTest 返回被点击的 hotspot ID 或 null
- sidebar 回调：onSelect(id), onEnqueue(), onRemove(id), onReorder(from,to), onDispatch()
- 颜色映射严格匹配 SCENE_INTERACTION_SPEC

### Acceptance

- 给定 mock state → Canvas 正确绘制 9 个着色节点 + 连线
- hitTest 在节点半径内 → 返回正确 ID
- sidebar 回调正确触发

### Anti-Patterns

- 不引入 React/Vue/Svelte
- 不实现 state transition
- 不硬编码 hotspot 数据
- 不使用 alert/confirm/prompt

---

## 5. jiaoshoujia-qiangxiu-integration

- lane: integration
- level: M
- goal: 接线 state + content + ui → 可运行主循环

### Must Modify

- `src/main.ts`: 接入事件处理和游戏循环
  - Canvas click → hitTest → ui.sidebar.onSelect(id)
  - "加入队列" → state.enqueueHotspot
  - queue 拖拽排序 → state.reorderQueue
  - queue 移除 → state.removeFromQueue
  - "派工" → state.runTick → checkWinLose → 重新渲染
  - 结算 → 显示结局面板 (win/partial/lose)

### Input Dependencies

- state worker 的 runTick / checkWinLose / enqueueHotspot / reorderQueue
- content worker 的 hotspots 数据 + config 常量
- ui worker 的 renderer / sidebar / feedback

### Output Contract

- ACCEPTANCE_PLAYTHROUGH Happy Path Tick 1-5 可完整走通
- 每次派工后所有 UI 元素即时更新
- 结局面板正确显示

### Acceptance

- 手动执行 Happy Path Tick 1：点击 B3 → 加入队列 → 派工 → B3 变蓝，time=19
- 手动执行 Failure Path：连续修低风险 → 触发塌陷 → 失败面板

### Anti-Patterns

- 不新增游戏机制（不修改 propagation 公式、不新增 state 字段）
- 不修改 state transition 逻辑
- 不修改 content 数据
- 不重新实现 UI 渲染

---

## 6. jiaoshoujia-qiangxiu-qa

- lane: qa
- level: S
- goal: 验证核心循环和 acceptance playthrough

### Must Create

- `tests/tick.test.ts`:
  - runTick 输出与 MECHANIC_SPEC 手算结果一致
  - win / partial / lose 三种判定正确
  - 材料不足时跳过修复
  - 塌陷后 ×2 传播
- `tests/acceptance.test.ts`:
  - 程序化执行 Happy Path 前 3 tick，断言每个 tick 后的 state 关键字段

### Input Dependencies

- state worker 的所有函数
- content worker 的初始数据

### Output Contract

- 所有测试通过
- 测试代码只用 state 纯函数，不依赖 DOM/Canvas

### Acceptance

- `npm test` 全部通过
- 覆盖 win / partial / lose 三种结局路径

### Anti-Patterns

- 不修改游戏实现代码来让测试通过
- 不 mock state transition（必须用真实纯函数）
- 不引入 e2e/浏览器测试框架
