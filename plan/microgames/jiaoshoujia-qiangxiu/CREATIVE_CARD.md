# CREATIVE_CARD: 脚手架抢修

- slug: `jiaoshoujia-qiangxiu`
- creative_line: 脚手架抢修
- target_runtime: web
- target_minutes: 20
- core_emotion: 风险热区 + 修复队列 + 连锁承压
- core_loop: 查看风险图 -> 选择修复点 -> 派工/用料 -> 风险传播 -> 下一秒
- failure_condition: 关键状态崩溃，或在本轮主循环中被系统淘汰
- success_condition: 在限定时长内完成主循环，并稳定进入至少一个可结算结局

## Intent

- 做一个 Babel 相关的单创意线微游戏
- 只保留一个主循环，不扩成大项目
- 让 Claude worker 能按固定 packet 稳定并行
