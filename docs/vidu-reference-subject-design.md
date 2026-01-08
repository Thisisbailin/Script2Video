# Vidu 参考生视频主体设计与 Node Lab 落地方案

本文聚焦 Vidu `reference2video` 的“主体”能力，并与项目内的角色形态（CharacterForm）绑定，覆盖交互、数据与执行层改造。目标：在 Node Lab 中使用 `@` 引用角色形态，自动构建 Vidu `subjects[]`，并兼容音视频直出/纯视频两种模式。

## 官方接口要点
- 接口：`POST https://api.deyunai.com/ent/v2/reference2video`
- 请求体（音视频直出）：`model`、`subjects[]`（`id`、`images[]`、`voice_id`）、`prompt`、`duration`、`audio:true`
- 请求体（视频直出）：`images[]`、`prompt`、`duration`、`aspect_ratio`、`resolution`、`movement_amplitude`、`off_peak`、`seed`
- Prompt 内用 `@1`、`@2`… 绑定 `subjects` 顺序。

## 主体绑定模型
- 主体来源：角色形态（CharacterForm）。形态名 = 主体 id/显示名；形态的文本概述、形态图 = 主体描述与参考图。
- 形态占位：角色没有形态时自动建空形态，便于 `@` 选择。
- 参考图来源优先级：①形态绑定图（若有）②节点连线的图片参考③为空则留空并警告。
- 语音：默认 `voice_id = professional_host`，节点允许覆盖。

## 交互改造
1) **TextNode @ 引用**
   - 输入 `@` 弹出形态搜索列表（来自 `labContext.context.characters[].forms[]`）。
   - 选中后插入 `@形态名`，渲染为蓝色 pill；未匹配形态渲染为黄色警示 pill；悬浮预览形态文本+首图。
   - 全文扫描 `@`：写回 node data `atMentions`（形态名、状态、characterId）。

2) **图片节点绑定形态（可选轻量版）**
   - 在 ImageInput/ImageGen 输出添加“关联形态”选择，存储到 node data，用于填充对应主体的 `images[]`。

3) **Vidu 视频节点**
   - 新增/保留字段：`useCharacters`（默认 true）、`subjects` 可手动覆盖、`mode`（audioVideo/videoOnly）、`resolution`、`duration`、`movementAmplitude`、`offPeak`、`voiceId`。
   - 展示解析到的主体列表，支持编辑 voice_id/补图，缺失高亮。
   - 生成时：`useCharacters=true` 时按 @ 顺序组装 subjects 并将 prompt 中的 `@形态名` 重写为 `@1/@2/...`。

## 执行层（useLabExecutor.runViduVideoGen）改造
- 解析 prompt 中的 `@形态名`（去重保序）。
- 匹配 labContext.character.forms，构建 subjects：
  - `id = formName`，`voice_id` 节点配置或默认 `professional_host`。
  - `images`：形态绑定图或连线图片按顺序分配，空则 `[]`（允许但警告）。
- Prompt 重写：将 `@形态名` 替换为 `@1...` 按匹配顺序；若本身使用 `@1` 则保持。
- videoOnly 模式：不发送 subjects，沿用 images 列表。
- 轮询/错误处理沿用现有 Vidu 调用（`viduService.createReferenceVideo` + `fetchTaskResult`）。

## 演示组更新
- 默认演示 prompt 改为 `@Chef` / `@Guest` 等可匹配形态；演示组包含 3 个形态占位和对应图片节点，确保主体-图片-文本链路清晰。

## 落地顺序建议
1. 扩展 TextNode：@ 自动补全 + pill 渲染 + atMentions 写入。
2. Vidu 节点 UI：显示主体列表、缺失警告、useCharacters 开关。
3. Executor：按 atMentions + 形态数据构建 subjects，重写 prompt，调用 Vidu。
4. 演示组：替换为形态化的 prompt/图片连接，便于即开即用。
