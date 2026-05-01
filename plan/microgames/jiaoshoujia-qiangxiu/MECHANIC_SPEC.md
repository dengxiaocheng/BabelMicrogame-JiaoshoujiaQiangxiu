# MECHANIC_SPEC: 脚手架抢修

## Primary Mechanic

- mechanic: 风险热区 + 修复队列 + 连锁承压
- primary_input: 在脚手架风险图上点选修复点并排序抢修队列
- minimum_interaction: 玩家必须把有限 materials 分配到至少一个热点并调整 repair_queue 顺序，观察风险传播

## Mechanic Steps

1. 查看 risk_hotspots
2. 选择修复点
3. 排序 repair_queue
4. 推进 time 并传播 collapse_pressure

## State Coupling

每次有效操作必须同时推动两类后果：

- 生存/资源/进度压力：从 Required State 中选择至少一个直接变化
- 关系/风险/秩序压力：从 Required State 中选择至少一个直接变化

## Not A Choice List

- 不能只展示 2-4 个文字按钮让玩家选择
- UI worker 必须把 primary input 映射到场景对象操作
- integration worker 必须让这个操作进入状态结算，而不是只写叙事反馈
