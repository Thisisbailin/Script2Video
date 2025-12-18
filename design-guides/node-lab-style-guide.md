# Node Lab 视觉风格规范（Draft v0.1）

> 目标：提炼 Node Lab 的简洁深色风格，逐步拓展到全局，使 Script2Video 视觉统一。

## 1. 色彩系统
- **背景**
  - 画布/主背景：`#0a0a0a`
  - 面板/浮层：`#0f0f0f` 或 `#0e0e10`（80–90% 不透明度可加 `backdrop-blur`）
- **文字**
  - 主文字：`#f8fafc` / `#e5e7eb`
  - 次级文字：`#9ca3af`
- **边框/分隔**
  - 细线：`#1f2937`（透明度 70–90%）
- **高亮/主色**
  - 运行/确认：`#059669`~`#10b981`（emerald）
  - 连接/强调：`#0ea5e9` / `#38bdf8`（cyan/blue）
- **提示背景**
  - 浅灰蒙层：`rgba(255,255,255,0.04~0.08)`

## 2. 排版
- 字体：系统无衬线（`system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto`）
- 字号：正文 14px；次级/标签 12px；标题 16–18px 以内保持克制
- 字重：正文 400–500；标题/按钮 600

## 3. 形状与圆角
- 按钮/输入：圆角 8–12px，常用 pill 样式
- 卡片/浮层/工具面板：圆角 12–16px
- 控件（小图标按钮）：正方 36–40px，圆角 12–14px

## 4. 边框与阴影
- 边框：1px，`#1f2937` 左右；主按钮可去边框
- 阴影：柔和暗影，如 `0 12px 30px rgba(0,0,0,0.35)`；避免锐利高对比

## 5. 透明与玻璃
- 面板/弹层可用半透明暗底 + 轻量 `backdrop-blur-sm`
- Hover 提亮：背景透明度略升，或边框颜色微亮

## 6. 按钮/控件规范
- **尺寸**：紧凑，内边距 `px-3 py-1.5` 左右；图标+短文案
- **层级**：
  - 主按钮（Run/确认）：绿色填充，文字浅色
  - 次级按钮：深灰填充，浅灰文字，hover 轻亮
  - 纯图标按钮：深灰背景，圆角足够，hover 边框提亮
- **状态**：禁用用透明度处理，不用强色块

## 7. 浮动栏与弹窗
- 样式参考 Node Lab 底部浮动栏与小地图卡片：暗底、圆角、细边框、阴影轻
- 弹窗/菜单宽度控制在 280–360px，内部留足 `12–16px` 间距
- 弹层背景可用渐变 `from #141414 to #0a0a0a`（极弱渐变）

## 8. 布局与密度
- 保持紧凑：按钮群、工具条间距 8–12px
- 画布/内容优先：减少厚重顶部/侧栏；信息收纳到 pill/弹层
- 默认不使用大留白卡片；用暗底分区+细线分隔

## 9. Icon 与交互
- 图标：lucide-react，线性风格；尺寸 14–18px
.- Hover：颜色微亮或背景轻微高亮；点击态可轻微缩放/暗化
- 状态反馈：Toast/提示沿用深色底 + 浅文字

## 10. 组件参考（Node Lab已有）
- `node-workspace/components/FloatingActionBar.tsx`：底部托盘、主色按钮、暗色 pill、弹出菜单。
- `node-workspace/components/NodeLab.tsx` + `styles/nodelab.css`：画布背景、最小化线条、控件重写（React Flow controls、MiniMap）。
- MiniMap 样式：深色卡片、圆角 14px、细边框、柔和阴影，maskColor 低透明。
- Tooltip/弹层：背景暗+圆角+轻边框，文本小型，内边距适中。

## 11. 颜色/尺寸 Token 建议
```
:root {
  --bg-base: #0a0a0a;
  --bg-panel: #0f0f0f;
  --border-subtle: #1f2937;
  --text-primary: #f8fafc;
  --text-secondary: #9ca3af;
  --accent-green: #10b981;
  --accent-blue: #0ea5e9;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --shadow-soft: 0 12px 30px rgba(0,0,0,0.35);
}
```
Tailwind 用户可将以上映射到 theme.extend（colors/borderRadius/boxShadow）。

## 12. 推广路径（建议迭代顺序）
1) **基础底色统一**：将 AppShell 顶栏/背景改用深色+细边框+透明玻璃态；文字色改为浅灰；按钮统一 pill 化。
2) **工具条/菜单统一**：顶栏、下拉菜单、右侧浮层按 Node Lab 弹层样式重做（暗底、圆角、细边框、轻阴影）。
3) **卡片/表格/面板**：各模块的卡片底色改为暗面板色；分隔线用 `--border-subtle`；按钮使用统一尺寸与配色。
4) **特殊组件**：图表、表格 header/footer 做深色适配；表单控件用深灰背景和浅色文本。
5) **全局 Token 化**：提炼到全局 CSS 变量/Tailwind config，避免重复写色值与圆角。

## 13. 适配注意
- 保持对比度可读性，浅文字配暗背景，按钮 hover 需明显但不过亮。
- 动画克制：淡入/缩放 120–160ms，阴影变化轻微。
- 移动端：浮动栏与弹层保持 44px 触控友好高度；标题/工具条保持紧凑但可点击。

---
后续：在 AppShell 顶栏、主要模块卡片上先落地底色/按钮统一，再逐步替换各模块的卡片与表单样式。
