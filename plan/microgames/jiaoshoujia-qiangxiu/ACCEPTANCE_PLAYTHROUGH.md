# ACCEPTANCE_PLAYTHROUGH: 脚手架抢修

## Scripted Playthrough
1. 开局显示 materials(30) / risk_hotspots(20节点) / repair_queue(空) / collapse_pressure(0) / time(300s)
2. 玩家点击脚手架风险图上的节点 → 节点高亮，侧面板显示节点详情（风险值、耗材、相邻未修节点数）
3. 玩家再次点击已选节点 → 节点加入修复队列，侧面板队列区显示排队卡片
4. 玩家拖拽队列卡片调整抢修优先级
5. 玩家点击「派工抢修」→ 消耗材料修复队首节点 → 触发风险传播 → settleRound 检查胜负
6. 系统反馈：修复节点变绿打勾、相邻未修节点风险 +8（连锁承压）、collapse_pressure 变化
7. 每 5 秒自动风险传播：未修节点从邻居吸收风险，高压节点推高 collapse_pressure
8. 事件系统在传播后触发：阵风冲击、连锁承压、材料搜刮、结构偏移等事件驱动状态变化
9. 重复步骤 2-8 直到触发结算条件

## Settlement (结算入口)
- **胜利条件**: 所有节点修复 (phase='won') 或 时间耗尽且修复率 ≥50%
- **失败条件**: collapse_pressure ≥100 (phase='lost') 或 时间耗尽且修复率 <50%
- **结算显示**: grade (S/A/B/C/F) + verdict + 修复率 + 剩余材料 + 塌陷压力 + 剩余时间
- **Grade 规则**:
  - S: 修复率 ≥90%, 压力 <30%, 时间 >60s
  - A: 修复率 ≥75%, 压力 <50%
  - B: 压力 <70%
  - C: 其余胜利情况
  - F: 结构坍塌
- **可重新开始**: 结算界面提供「重新开始」按钮

## Direction Gate
- 核心循环完整: 查看风险图 → 选择修复点 → 派工/用料 → 风险传播 → 下一秒 ✓
- Primary input 真实驱动状态结算 (点击节点 → selectHotspot → addToRepairQueue → dispatchRepair → propagateRisk → settleRound → settleGame) ✓
- 每次有效操作同时推动资源压力(材料消耗)和风险压力(连锁承压) ✓
- 不依赖文字按钮列表，操作映射到场景对象(脚手架节点) ✓
- 如试玩要求需要偏离 Direction Lock，停止并回交 manager

## Test Verification
- `npm test` 25/25 passing
- State coupling tests verify dispatchRepair pushes both resource AND risk pressure
- tick pushes both progress AND risk pressure when critical hotspots exist
