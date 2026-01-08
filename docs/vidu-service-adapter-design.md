# Vidu Service 接入设计（按官方 API 章节）

本文为 Vidu 聚合平台 API 的适配方案，覆盖文档全部能力，并对接现有视频生成模块。默认仍使用当前视频模型，新设“Vidu 服务商”定制项以按需启用。API Key 通过 Cloudflare Pages 环境变量注入（推荐 `VIDU_API_KEY`），HTTP 鉴权统一使用 `Authorization: Bearer <API_KEY>` 与 `Content-Type: application/json`。

## 总览与通用策略
- **基础 URL**：`https://api.deyunai.com/ent/v2/`
- **任务模型**：所有生成接口返回 `task_id` 与状态，需轮询任务查询接口获取成果；少数同步成功直接携带结果。
- **设置集成**：
  - 视频生成设置中新增“Vidu 服务商”开关/下拉：关=沿用现有模型；开=使用 Vidu，允许选择模型/分辨率/时长/动效等。
  - 通过服务模块集中封装：`viduClient`（HTTP）、`viduService`（业务编排）、`viduSettings`（配置/默认值）。
- **错误与幂等**：捕获 4xx/5xx，记录 `trace_id`（若有），暴露明确的用户提示；可重复提交同一 payload 时使用外部幂等键（若需要）。
- **Vidu 体验提示与演示**：当用户切换到“Vidu 服务商”时，显示功能说明悬浮窗（或预置演示卡片组）：
  - 说明点：Vidu 参考生视频支持主体参考（多主体、多图）、音视频直出/纯视频模式、长时长、高分辨率、错峰模式。
  - 预置演示（可直接一键提交）：模式默认“音视频直出”，模型用最强档（文档示例 `viduq2-pro`），时长取支持的最大值（UI 用上限输入，若未知则预填 10s 并可编辑），分辨率预设最高（1080p），错峰 `off_peak=true` 默认勾选；主体示例 3 组，每组 3 张参考图 + 语音占位，附带 1 套场景参考图（用于纯视频模式切换）。

## 一、创建视频任务
1) **图生视频** `POST img2video`  
   - 核心参数：`model`（如 `viduq2-pro`）、`images[]`、`prompt`、`duration`、`resolution`、`movement_amplitude`、`seed`、`audio`、`voice_id`、`off_peak`。  
   - 响应：`task_id`、`state`、镜像请求体字段、`credits`。  
   - UI/SDK：单图/多图上传，语音开关+声音选择，动效幅度选择（auto/low/high）。

2) **参考生视频** `POST reference2video`  
   - **音视频直出**：`subjects[]`（id、images[]、voice_id）、`prompt`、`duration`、`audio:true`。主体编号可在 prompt 中用 `@1 @2 …`。  
   - **视频直出**：`images[]`（场景参考）、`prompt`、`duration`、`aspect_ratio`、`resolution`、`movement_amplitude`、`off_peak`。  
   - **主体参考说明**：每个主体可带多张参考图与 voice_id，prompt 内用 `@序号` 绑定（示例有 3 个主体，每个 3 张图）。UI 需支持主体列表增删、图组上传、语音选择。  
   - UI：主体管理（上传多图、可选语音），模式切换：音视频/纯视频，错峰模式默认开启，分辨率默认最高档，时长默认上限（未知上限时默认 10s 可编辑），模型默认最强（如 `viduq2-pro`）。

3) **首尾帧生视频** `POST start-end2video`  
   - 参数：`model`、`images[0]=首帧`、`images[1]=尾帧`、`prompt`、`duration`、`resolution`、`movement_amplitude`、`seed`、`off_peak`。  
   - 用途：镜头过渡/故事分镜。

4) **文生视频** `POST text2video`  
   - 参数：`model`、`style`（如 general）、`prompt`、`duration`、`aspect_ratio`、`resolution`、`movement_amplitude`、`seed`、`off_peak`。  
   - UI：风格预设、比例、分辨率选择。

5) **特效场景模板** `POST template`  
   - 参数：`template`（如 `hugging`）、`images[]`、`prompt`（可含“Motion Level”要求）、`seed`。  
   - 适配：模板下拉 + 示例图展示。

6) **模板成片** `POST template-story`  
   - 参数：`story`（枚举故事模板）、`images[]`。  
   - 适配：故事模板库 + 批量图上传。

## 二、创建图像任务
1) **参考生图** `POST reference2image`  
   - 参数：`model`（如 `viduq1`）、`images[]`、`prompt`、`seed`、`aspect_ratio`、`payload`。  
   - 响应含 `task_id`、`credits`；同样走任务查询。

## 三、创建音频任务
1) **文生音频** `POST text2audio`  
   - 参数：`model: audio1.0`、`prompt`、`duration`、`seed`。  
   - 产出音效/BGM。

2) **可控文生音效** `POST timing2audio`  
   - 参数：`model`、`duration`、`timing_prompts[]`（from/to/prompt）、`seed`。  
   - UI：时间线事件编辑器。

3) **语音合成 (TTS)** `POST audio-tts`  
   - 参数：`text`、`voice_setting_voice_id`（语速/音量/情绪在服务端配置）。  
   - 响应：`file_url`，`state` 直接可为 `success`。

4) **声音复刻** `POST audio-clone`  
   - 参数：`audio_url`、`voice_id`、`text`。  
   - 响应：`voice_id`、`demo_audio`。  
   - 注意：复刻音色 168 小时内需在 TTS 中调用一次，否则删除且不退款积分。UI 需提示并提供“一键生成试听+保存”。

## 四、创建其他任务
1) **智能多帧** `POST multiframe`  
   - 参数：`model`、`start_image`、`image_settings[]`（key_image/prompt/duration）、`resolution`、水印参数。  
   - 用途：多关键帧控制的视频生成。

2) **视频延长** `POST extend`  
   - 参数：`model`、`video_url`、`images[]`（同视频）或提示图、`prompt`、`duration`、`resolution`。  
   - UI：上传原视频，设置续拍时长与提示。

3) **对口型 (Lip Sync)** `POST lip-sync`  
   - 两种驱动：音频驱动（video_url + audio_url）或文本驱动（video_url + text + voice_id）。  
   - 用途：口型对齐替换音轨。

4) **数字人** `POST digital-human`  
   - 参数：`model`、`image`（人像）或 `prompt`、`audio_url`、`resolution`、`payload`。  
   - 用途：驱动静态人像说话。

5) **视频替换** `POST replace`  
   - 参数：`video_url`、`object`（被替换物体描述）、`image`（替换目标图）、`prompt`、`start_from`、`payload`。  
   - 用途：局部替换。

6) **推荐提示词** `POST img2video-prompt-recommendation`  
   - 参数：`images[]`、`type[]`（如 img2video/template）、`count`。  
   - 响应：候选 prompt 列表，包含模板/类型/分辨率；可用于智能提示。

7) **智能超清-尊享** `POST upscale-new`  
   - 参数：`video_url`、`upscale_resolution`（如 1080p）。  
   - 输出高清版。

## 五、任务管理
1) **查询任务** `GET tasks/{id}/creations`  
   - 返回 `state`、`err_code`、`credits`、`creations[]`（url/cover/watermarked_url）。  
   - 轮询策略：指数退避至成功/失败，最长等待可配置；失败返回消息提示重试/联系客服。

2) **取消任务** `POST tasks/{id}/cancel`  
   - 成功返回 `{}`；失败含 code/reason/message/trace_id。  
   - UI：排队/进行中时提供“取消”，失败时展示原因。

3) **错误码**  
   - 文档未列具体表，可在客户端按 HTTP 状态 + message 兜底；日志记录 trace_id。

## 配置与实现细节
- **配置**：`VIDU_API_KEY`（必填），可扩展 `VIDU_BASE_URL`、`VIDU_DEFAULT_MODEL`。  
- **服务封装**：统一 `POST/GET` 方法，附默认头；请求体按各接口 DTO 定义，所有可选字段仅在有值时发送。  
- **模型/参数默认**：保持现有“视频生成模型”为默认；切换 Vidu 时，预填推荐模型（视频 `viduq2/viduq2-pro`，音频 `audio1.0`），分辨率默认 540p/720p/1080p，动效 `auto`。  
- **存储与回调**：若需二次加工，使用任务查询的 `url/cover/watermarked_url`；本阶段未定义回调，采用轮询。  
- **安全**：不在前端暴露 API Key；Cloudflare Pages 环境变量注入至后端或 Edge 函数；上传资源需先获得可访问的公共 URL（或借助现有上传服务）。

## 后续接入步骤（建议）
1) 定义 `services/viduClient.ts`（含认证头、基础 URL、错误包装）、`services/viduService.ts`（业务函数），DTO 放在 `types/vidu.ts`。  
2) 在“视频生成设置”增加“Vidu 服务商”切换与参数面板，默认沿用现有模型；切换时呈现 Vidu 参数。  
3) 为主要接口（img2video、reference2video、text2video、lip-sync、upscale-new）添加集成测试/录制示例；轮询封装统一复用。  
4) 提示用户在 Cloudflare Pages 配置 `VIDU_API_KEY`；启动时校验缺失则禁用 Vidu 选项并给出指引。
