# SCENE_INTERACTION_SPEC: 脚手架抢修

## Layout

```
+----------------------------------------------------+
|  Header: time=XX  collapsePressure=[===-----] XX   |
+----------------------------------------------------+
|                         |                          |
|   Risk Map (Canvas)     |   Side Panel             |
|   ~70% width            |   ~30% width             |
|                         |                          |
|   [A1]----[A2]----[A3]  |   Materials              |
|    |  \  / |  \  / |    |    Bolts: 8              |
|   [B1]----[B2]----[B3]  |    Planks: 6             |
|    |  /  \ |  /  \ |    |    Cables: 4             |
|   [C1]----[C2]----[C3]  |                          |
|                         |   Repair Queue           |
|   Click node to select  |    1. B3  [x]            |
|                         |    2. A3  [x]            |
|                         |                          |
|                         |   [派工/Dispatch]        |
+----------------------------------------------------+
|  Footer: Status messages / collapse warnings        |
+----------------------------------------------------+
```

## Scene Objects

### 1. Risk Map (主画布)

- 占据左侧 ~70% 区域，Canvas 渲染
- 背景：简笔脚手架骨架线
- 节点：圆形 hotspot，半径 24px
  - 颜色映射按 riskLevel：
    - 0-25 → 绿 (#4CAF50)
    - 26-50 → 黄 (#FFC107)
    - 51-80 → 橙 (#FF9800)
    - 81-100 → 红 (#F44336)
  - 已修复：蓝 (#2196F3)，显示 ✓ 标记
  - 已塌陷：灰 (#9E9E9E)，显示 ✕ 标记
- 连线：相邻 hotspot 间画线
  - 线宽 = 1 + avgRisk / 50（随风险增大）
  - 塌陷节点连线 → 红色虚线

### 2. Side Panel (侧边栏)

占据右侧 ~30%，纯 DOM 元素：

#### Materials Display
- 三种材料行：螺栓 / 木板 / 钢缆
- 选中 hotspot 时，高亮显示该 hotspot 的 repairCost 对比当前库存

#### Repair Queue
- 垂直列表，每项显示序号 + hotspot ID + [×] 移除按钮
- 原生 HTML5 drag-and-drop 支持拖拽排序
- 点击列表项 → 高亮对应 map 节点
- 队列为空时显示 "点击地图热点加入队列"

#### Dispatch Button
- "派工" 按钮，宽度 100%
- 队列为空时灰色不可用 (disabled)
- 点击后触发一次 Per-Tick Pipeline

### 3. Header

- time: 数字显示，格式 "剩余 XX 回合"
- collapsePressure: 水平进度条 + 数字
  - 0-29 绿色, 30-59 黄色, >= 60 红色

### 4. Footer

- 状态消息行：显示最近一次操作结果（"B3 修复完成" / "材料不足" / "B3 塌陷！"）
- 预警行：当任何 hotspot riskLevel > 60 时显示 "⚠ 风险预警：X 节点濒临塌陷"

## Interaction Flow

1. **View**: 页面加载 → 渲染完整风险图，所有节点按初始 riskLevel 着色
2. **Select**: 点击 map 上的 hotspot 节点 → 节点放大 + 边框高亮，side panel 显示该节点信息
3. **Enqueue**: 点击 "加入队列" 按钮 → hotspot ID 加入 repairQueue 尾部，map 节点显示队列序号
4. **Reorder**: 拖拽 queue 列表项调整执行顺序
5. **Remove**: 点击列表项 [×] 按钮 → 从 queue 中移除
6. **Dispatch**: 点击 "派工" → 触发 Per-Tick Pipeline
7. **Observe**: 所有视觉反馈更新（颜色变化、动画、数值刷新）
8. **Repeat**: 回到步骤 2，直到 time=0 或 collapsePressure >= 60

## Feedback Channels

| 事件 | 视觉反馈 |
|------|----------|
| 选中 hotspot | 节点放大 1.3x + 白色边框 |
| 加入队列 | 节点上显示序号，queue 列表新增行 |
| 派工-修复成功 | 节点蓝色闪光，材料数减少动画 |
| 派工-材料不足 | Footer 显示红色提示，queue 项移除 |
| Risk propagation | 连线脉冲动画，节点颜色渐变 |
| Hotspot 塌陷 | 节点碎裂动画 + screen shake 200ms |
| 高压预警 | pressure 条变红闪烁 |
| time 减少 | 数字更新 |
| 游戏结束 | 全屏结算面板覆盖 |

## Forbidden UI

- 不允许做城市维修大地图
- 不允许只用"修 A/修 B"文字按钮列表
- 不允许纯文字选项模拟核心互动
- 必须在场景对象上操作（点击 map 节点 + 拖拽 queue）
- 不使用 alert/confirm/prompt

## Acceptance Rule

- 首屏必须让玩家看到完整风险图（所有 9 个 hotspot 节点）和可操作区域
- 玩家操作必须产生即时可见反馈，反馈能追溯到 Required State 变化
- 不得只靠随机事件文本或普通选择按钮完成主循环
- 所有交互必须围绕 primary input：点选节点 + 排序队列
