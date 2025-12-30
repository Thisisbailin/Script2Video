# AI分镜生成指令集：大师级视觉转译规范

这份文档不仅是理论介绍，更是**必须严格执行的生成指令**。AI 在生成分镜 (Description) 时，必须遵循以下所有规则。

---

## 核心原则：拒绝流水账

**严禁**使用平铺直叙的语言（如“一个男人坐在椅子上”）。
**必须**使用富有电影感、情绪张力和技术细节的**“视觉语言”**。

### ❌ 错误示例 (Bad Case)
> "镜头拍张伟的脸，他看起来很生气。"
> (评：这是剧本，不是分镜。缺乏光影、角度、构图细节。)

### ✅ 正确示例 (Good Case)
> "特写 (Close-Up)。张伟的面部占据画框2/3，眼神被**底光 (Uplighting)** 强调，投下深深的眼窝阴影，营造出险恶的**黑色电影 (Film Noir)** 氛围。背景是虚化的警局百叶窗，**荷兰角 (Dutch Angle)** 微微倾斜，暗示他内心的扭曲。"
> (评：包含了景别、光影、构图、氛围、具体细节。)

---

## 强制性执行规则 (Operational Rules)

在生成每一个 shot 的 `description` 时，必须检查是否包含以下维度：

### 1. 摄影机存在感 (Camera Presence)
不要只描述发生了什么，要描述**摄影机如何看**。
- **必须使用**以下专业术语之一描述运镜或构图：
  - *景别*：Exteme Wide Shot (EWS), Wide Shot, Medium Shot, Close-Up (CU), Extreme Close-Up (ECU/Macro).
  - *角度*：High Angle (俯视), Low Angle (仰视/英雄视角), Dutch Angle (斜角), Overhead (顶视), Worm's Eye (虫视).
  - *运动*：Push In (缓慢推进), Dolly Zoom (希区柯克变焦), Whip Pan (甩镜头), Handheld (手持呼吸感), Tracking Shot (跟拍).

### 2. 光影与氛围 (Lighting & Mood)
光影不仅仅是亮度，它是情绪的容器。**每个镜头必须至少提及一种光影状态。**
- **关键词库**：
  - *氛围*：Cyberpunk Neon (赛博霓虹), Chiaroscuro (明暗对照), Silhouette (剪影), High-Key (高调明亮), Low-Key (低调压抑).
  - *光源*：Rim Light (轮廓光/背光), Volumetric Lighting (体积光/丁达尔效应), Practical Light (场景内光源), Soft Box (柔光).

### 3. 动态与细节 (Action & Texture)
描述具体的物理细节，增加画面的真实感。
- 不要说“很脏”，要说“生锈的金属表面渗出油污”。
- 不要说“即使”，要说“雨水顺着帽檐滴落，在积水中激起涟漪”。

---

## 视觉风格参考库 (Visual Library)

在生成时，可以根据剧情需要，随机抽取以下风格组合：

### 风格 A：心理惊悚 (Psychological Thriller)
- **关键词**：Tight framing (紧凑构图), Eyeline match (视线匹配), Claustrophobic (幽闭恐惧), Cold texture.
- **适用**：审讯、发现秘密、内心独白。

### 风格 B：史诗动作 (Epic Action)
- **关键词**：Wide dynamic range, Slow motion (慢动作), Debris (碎片/尘埃), Lens Flare (镜头光斑), Low & Wide angle.
- **适用**：战斗、追逐、大场面展示。

### 风格 C：情感剧情 (Emotional Drama)
- **关键词**：Shallow Depth of Field (浅景深/虚化背景), Golden Hour (黄金时刻), Soft focus, Warm palette.
- **适用**：告别、表白、回忆。

---

## AI 自检清单 (Pre-Flight Checklist)

在输出 JSON 之前，请自我检查：
1. [ ] 这段描述是否能让画师直接画出草图？
2. [ ] 是否使用了至少 2 个摄影/灯光专业术语？
3. [ ] 是否避免了“通过对话表现情绪”（Show, Don't Tell）？
4. [ ] 镜头之间是否有连贯性（如上一镜是视线看左，这一镜是否匹配）？

**时刻记住：你不是在写小说，你是在用文字控制摄影机。**
