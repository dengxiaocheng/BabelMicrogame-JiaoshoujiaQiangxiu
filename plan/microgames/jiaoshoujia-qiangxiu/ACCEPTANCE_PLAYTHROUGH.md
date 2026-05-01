# ACCEPTANCE_PLAYTHROUGH: 脚手架抢修

## Scripted Playthrough
1. 开局显示 materials / risk_hotspots / repair_queue / collapse_pressure / time
2. 玩家执行一次核心操作：查看风险图 -> 选择修复点 -> 派工/用料 -> 风险传播 -> 下一秒
3. 系统必须反馈一个资源或身体压力变化
4. 系统必须反馈一个关系或风险变化

## Direction Gate
- integration worker 必须让这个流程可试玩
- qa worker 必须用测试或手工记录验证这个流程
- 如试玩要求需要偏离 Direction Lock，停止并回交 manager
