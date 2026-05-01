# 脚手架抢修

脚手架多处松动，玩家要按风险优先级抢修，修错位置会引发连锁塌陷。

## 在线试玩

👉 [https://dengxiaocheng.github.io/BabelMicrogame-JiaoshoujiaQiangxiu/](https://dengxiaocheng.github.io/BabelMicrogame-JiaoshoujiaQiangxiu/)

## 玩法

核心循环：**查看风险图 → 选择修复点 → 派工/用料 → 风险传播 → 下一秒**

1. 点击脚手架节点查看风险详情
2. 再次点击将节点加入抢修队列
3. 拖拽队列卡片调整优先级
4. 点击「派工抢修」消耗材料修复队首节点
5. 观察风险传播，准备下一轮

## 本地运行

```bash
npm start   # 启动本地服务器 (npx serve .)
npm test    # 运行测试
```

## 技术栈

纯 HTML / CSS / ES Module，无构建步骤。
