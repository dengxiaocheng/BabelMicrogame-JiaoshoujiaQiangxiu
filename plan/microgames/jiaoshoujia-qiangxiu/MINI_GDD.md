# MINI_GDD: 脚手架抢修

## Scope

- runtime: web
- duration: 20min
- project_line: 脚手架抢修
- single_core_loop: 查看风险图 -> 选择修复点 -> 派工/用料 -> 风险传播 -> 下一秒

## Core Loop
1. 执行核心循环：查看风险图 -> 选择修复点 -> 派工/用料 -> 风险传播 -> 下一秒
2. 按 20 分钟节奏推进：单点修 -> 连锁传播 -> 材料不足 -> 多点同时临界

## State

- resource
- pressure
- risk
- relation
- round

## UI

- 只保留主界面、结果反馈、结算入口
- 不加多余菜单和后台页

## Content

- 用小型事件池支撑主循环
- 一次只验证一条 Babel 创意线

## Constraints

- 总体规模目标控制在 5000 行以内
- 单个 worker 任务必须服从 packet budget
- 如需扩线，交回 manager 重新拆
