# TASK_BREAKDOWN: 脚手架抢修

## Standard Worker Bundle

1. `jiaoshoujia-qiangxiu-foundation`
   - lane: foundation
   - level: M
   - goal: 建立只服务「查看风险图 -> 选择修复点 -> 派工/用料 -> 风险传播 -> 下一秒」的可运行骨架

2. `jiaoshoujia-qiangxiu-state`
   - lane: logic
   - level: M
   - goal: 实现 Direction Lock 状态的一次分配/操作结算

3. `jiaoshoujia-qiangxiu-content`
   - lane: content
   - level: M
   - goal: 用事件池强化「风险热区 + 修复队列 + 连锁承压」

4. `jiaoshoujia-qiangxiu-ui`
   - lane: ui
   - level: M
   - goal: 让玩家看见核心压力、可选操作和后果反馈

5. `jiaoshoujia-qiangxiu-integration`
   - lane: integration
   - level: M
   - goal: 把已有 state/content/ui 接成单一主循环

6. `jiaoshoujia-qiangxiu-qa`
   - lane: qa
   - level: S
   - goal: 用测试和 scripted playthrough 确认方向没跑偏
