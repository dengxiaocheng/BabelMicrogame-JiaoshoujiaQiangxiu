# SCENE_INTERACTION_SPEC: 脚手架抢修

## Scene Objects

- 脚手架风险图
- 松动节点
- 修复材料
- 抢修队列
- 塌陷连线

## Player Input

- primary_input: 在脚手架风险图上点选修复点并排序抢修队列
- minimum_interaction: 玩家必须把有限 materials 分配到至少一个热点并调整 repair_queue 顺序，观察风险传播

## Feedback Channels

- 热点颜色
- materials 消耗
- 连锁塌陷预警
- time 倒计时

## Forbidden UI

- 不允许做城市维修
- 不允许只用“修 A/修 B”按钮

## Acceptance Rule

- 首屏必须让玩家看到至少一个可直接操作的场景对象
- 玩家操作必须产生即时可见反馈，且反馈能追溯到 Required State
- 不得只靠随机事件文本或普通选择按钮完成主循环
