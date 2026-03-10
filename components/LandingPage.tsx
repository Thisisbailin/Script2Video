import React, { useCallback } from "react";
import {
  ArrowRight,
  Brain,
  CirclesThree,
  ClockCountdown,
  CursorClick,
  Database,
  FileMagnifyingGlass,
  Graph,
  Notebook,
  Path,
  PenNib,
  ReadCvLogo,
  Sparkle,
  SquaresFour,
  TreeStructure,
  Waveform,
} from "@phosphor-icons/react";
import { MagneticButton } from "./landing/MagneticButton";
import { PromptCycle } from "./landing/PromptCycle";

type Props = {
  isDarkMode?: boolean;
  onEnterApp: () => void;
};

const capabilityBlocks = [
  {
    eyebrow: "Inspect",
    title: "按集、按场、按角色读取项目证据",
    statement: "Qalam 先查证据，再回答。",
    description:
      "它不是凭空生成一段听起来像答案的文字，而是优先读取 episode、scene、character、location 与 project data，再决定如何继续。",
    tools: ["get_episode_script", "get_scene_script", "read_project_data", "search_script_data"],
    Icon: FileMagnifyingGlass,
  },
  {
    eyebrow: "Understand",
    title: "把理解写回项目知识层，而不是只留在聊天里",
    statement: "角色可带 forms，场景可带 zones。",
    description:
      "角色与场景不是一次性摘要。Qalam 可以把人物形态、场景分区、项目摘要和剧集摘要持续写回项目事实层，供后续检索和生成复用。",
    tools: ["upsert_character", "upsert_location", "edit_understanding_resource", "write_project_summary"],
    Icon: Database,
  },
  {
    eyebrow: "Operate",
    title: "把理解继续变成 NodeLab 里的真实工作流",
    statement: "不是建议，而是落图。",
    description:
      "当请求进入操作态，Qalam 可以创建 text node、多节点 workflow scaffold、typed edges 与 pause edges，把想法落成可执行的 NodeLab 结构。",
    tools: ["create_text_node", "create_node_workflow", "operate_project_workflow", "connect_workflow_nodes"],
    Icon: TreeStructure,
  },
];

const runtimeFacts = [
  {
    label: "Dual Runtime",
    value: "Browser + Edge",
    detail: "问答和流式响应可走 Edge，涉及 NodeLab 实体操作时自动切换到 browser runtime。",
    Icon: CirclesThree,
  },
  {
    label: "Session Memory",
    value: "user / assistant / tool",
    detail: "会话历史保留最近有效记忆，但长期事实留在 ProjectData，而不是沉没在聊天滚动里。",
    Icon: ClockCountdown,
  },
  {
    label: "Trace Events",
    value: "run_started → tool_called → tool_completed",
    detail: "前端消费的是归一化 runtime event，而不是直接拼接底层 provider 响应。",
    Icon: Waveform,
  },
  {
    label: "Local Skills",
    value: "overlayed prompts",
    detail: "技能以本地 SKILL.md 形式加载，给 agent 叠加专业行为与约束，而不是把所有规则硬编码进 UI。",
    Icon: Sparkle,
  },
];

const knowledgeRows = [
  {
    title: "Project Summary",
    detail: "项目级理解摘要，可被后续理解、规划与生成继续引用。",
  },
  {
    title: "Episode Summary",
    detail: "每一集的剧情摘要和拆解结果，形成可检索的中间事实层。",
  },
  {
    title: "Character Profile + Forms",
    detail: "角色不是一张平面卡。Qalam 支持多形态、身份状态、episode range 与 visual tags。",
  },
  {
    title: "Scene Profile + Zones",
    detail: "场景支持 core / secondary、visuals，以及继续细分为 zones 和布局注释。",
  },
];

const workflowNodes = [
  "text",
  "shot",
  "annotation",
  "imageGen",
  "wanImageGen",
  "soraVideoGen",
  "wanVideoGen",
  "viduVideoGen",
];

const eventRail = [
  { stage: "run_started", detail: "接收请求并解析 outcome" },
  { stage: "tool_called", detail: "读取剧本或项目事实" },
  { stage: "tool_completed", detail: "写回理解层或创建节点" },
  { stage: "message_completed", detail: "返回带证据的回答或产物摘要" },
];

export const LandingPage: React.FC<Props> = ({ isDarkMode = true, onEnterApp }) => {
  const scrollToSection = useCallback((id: string) => {
    if (typeof document === "undefined") return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div
      className={`${isDarkMode ? "dark" : ""} relative min-h-[100dvh] overflow-x-hidden bg-[#efe8dc] text-zinc-950 dark:bg-[#101311] dark:text-zinc-50`}
      style={{ fontFamily: '"Outfit", "Avenir Next", "Segoe UI", sans-serif' }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="landing-orb landing-orb--emerald absolute left-[-10%] top-[-4%] h-[30rem] w-[30rem] rounded-full bg-emerald-500/14 blur-3xl dark:bg-emerald-400/14" />
        <div className="landing-orb landing-orb--sand absolute right-[-8%] top-[14%] h-[26rem] w-[26rem] rounded-full bg-stone-500/16 blur-3xl dark:bg-stone-300/10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.55),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.12),transparent_26%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.10),transparent_24%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:84px_84px] opacity-40 dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] dark:opacity-20" />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-4 pb-20 pt-5 sm:px-6 md:px-8 md:pb-28 md:pt-8">
        <header className="landing-reveal flex flex-col gap-4 border-b border-black/10 pb-6 dark:border-white/10 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">
              Standalone Landing
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-black/10 bg-white/55 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
                <PenNib size={18} weight="duotone" className="text-emerald-700 dark:text-emerald-300" />
              </div>
              <div>
                <div className="text-xl font-semibold tracking-[-0.04em]">QALAM</div>
                <div className="text-[12px] text-zinc-600 dark:text-zinc-400">Qalam / قلم / pen</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => scrollToSection("capabilities")}
              className="rounded-full border border-black/10 bg-white/55 px-4 py-2 text-zinc-700 backdrop-blur-xl transition hover:border-black/20 hover:text-zinc-950 active:translate-y-px dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:text-white"
            >
              Agent 能力
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("runtime")}
              className="rounded-full border border-black/10 bg-white/55 px-4 py-2 text-zinc-700 backdrop-blur-xl transition hover:border-black/20 hover:text-zinc-950 active:translate-y-px dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:text-white"
            >
              Runtime
            </button>
            <MagneticButton
              type="button"
              onClick={onEnterApp}
              className="bg-zinc-950 px-5 py-2.5 text-[11px] font-semibold text-white shadow-[0_18px_50px_-24px_rgba(15,23,42,0.55)] dark:bg-white dark:text-zinc-950"
              icon={<ArrowRight size={15} weight="bold" />}
            >
              立即体验
            </MagneticButton>
          </div>
        </header>

        <section className="grid min-h-[calc(100dvh-7rem)] grid-cols-1 gap-10 py-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(440px,1.05fr)] lg:gap-14 lg:py-16">
          <div className="flex flex-col justify-center">
            <div className="landing-reveal text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-700 dark:text-emerald-300">
              Agent-first creative operating surface
            </div>
            <h1
              className="landing-reveal mt-5 max-w-[11ch] text-5xl font-semibold leading-[0.92] tracking-[-0.07em] md:text-7xl"
              style={{ animationDelay: "100ms" }}
            >
              一支会读项目、会写知识、会搭工作流的 Agent 之笔。
            </h1>
            <p
              className="landing-reveal mt-6 max-w-[62ch] text-base leading-8 text-zinc-700 dark:text-zinc-300"
              style={{ animationDelay: "180ms" }}
            >
              “Qalam” 在阿拉伯语里是“笔”。这个名字不该只停留在品牌层。对 Script2Video 来说，Qalam 代表的是一个真正参与创作过程的 agent:
              它读取剧本与项目证据，沉淀长期事实，再把理解继续变成 NodeLab 中可执行的工作流结构。
            </p>

            <div
              className="landing-reveal mt-8 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
              style={{ animationDelay: "260ms" }}
            >
              {[
                {
                  label: "Evidence-first",
                  value: "先取证，再生成",
                  detail: "读取 episode、scene、character、location 与 project data。",
                },
                {
                  label: "Tool-mediated",
                  value: "状态变更必须经由 tools",
                  detail: "理解与操作不会绕过 bridge 直接改界面状态。",
                },
                {
                  label: "Durable knowledge",
                  value: "知识层是长期真相",
                  detail: "project summary、episode summary、character profile、scene profile 可持续复用。",
                },
                {
                  label: "Executable graph",
                  value: "回答能继续落成节点图",
                  detail: "从 text node 到 multi-node workflow scaffold，直接进入 NodeLab。",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[1.75rem] border border-black/10 bg-white/58 p-4 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.35)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">{item.label}</div>
                  <div className="mt-3 text-[18px] font-semibold tracking-[-0.03em]">{item.value}</div>
                  <p className="mt-2 text-[13px] leading-7 text-zinc-700 dark:text-zinc-300">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="landing-reveal mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center" style={{ animationDelay: "340ms" }}>
              <MagneticButton
                type="button"
                onClick={onEnterApp}
                className="bg-zinc-950 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_-24px_rgba(15,23,42,0.55)] dark:bg-white dark:text-zinc-950"
                icon={<ArrowRight size={16} weight="bold" />}
              >
                立即体验
              </MagneticButton>
              <div className="flex items-center gap-2 text-[13px] text-zinc-600 dark:text-zinc-400">
                <CursorClick size={16} weight="duotone" />
                直接进入主页面，不需要登录
              </div>
            </div>
          </div>

          <div className="landing-reveal relative" style={{ animationDelay: "140ms" }}>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.12fr)_220px]">
              <div className="rounded-[2.25rem] border border-black/10 bg-white/62 p-6 shadow-[0_32px_90px_-54px_rgba(15,23,42,0.42)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">QALAM SIGNAL</div>
                    <div className="mt-2 text-[26px] font-semibold tracking-[-0.05em]">Qalam / قلم</div>
                  </div>
                  <div className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-[11px] text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300">
                    pen as agent
                  </div>
                </div>

                <div className="mt-8 rounded-[1.75rem] border border-black/10 bg-[#f7f2ea] p-4 dark:border-white/10 dark:bg-[#171b18]">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                    <span>Prompt intake</span>
                    <span className="inline-flex items-center gap-2">
                      <span className="landing-pulse-dot h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-300" />
                      live
                    </span>
                  </div>
                  <div className="mt-4">
                    <PromptCycle
                      prompts={[
                        "读取第 3 集，找出人物关系最紧张的场景，并给出证据。",
                        "把主角形态写回角色库，补充 visual tags 与 episode range。",
                        "根据当前分镜意图，生成一个 text -> imageGen 的 NodeLab 工作流。",
                        "搜索项目知识层，找出最适合做预告片的场景和对应角色状态。",
                      ]}
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="rounded-[1.5rem] border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">Capability</div>
                    <div className="mt-4 space-y-4">
                      {[
                        { value: "04", label: "Inspect tools" },
                        { value: "04", label: "Knowledge writes" },
                        { value: "04", label: "Workflow actions" },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="font-mono text-[24px] font-semibold tracking-[-0.05em]">{item.value}</div>
                          <div className="text-[11px] text-zinc-600 dark:text-zinc-400">{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">Runtime Event Rail</div>
                    <div className="mt-4 space-y-3">
                      {eventRail.map((item, index) => (
                        <div key={item.stage} className="relative rounded-[1.25rem] border border-black/10 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                          {index === 1 && (
                            <div className="landing-beam absolute inset-y-0 left-[-25%] w-20 bg-gradient-to-r from-transparent via-emerald-300/18 to-transparent" />
                          )}
                          <div className="relative text-[10px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">{item.stage}</div>
                          <div className="relative mt-2 text-[13px] leading-6 text-zinc-700 dark:text-zinc-300">{item.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[2rem] border border-black/10 bg-white/58 p-5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">Meaning</div>
                  <div className="mt-4 text-[28px] font-semibold tracking-[-0.06em]">Qalam</div>
                  <div className="mt-1 text-[19px] text-zinc-500 dark:text-zinc-400">قلم</div>
                  <p className="mt-4 text-[13px] leading-7 text-zinc-700 dark:text-zinc-300">
                    一支笔，不只是书写文本，也负责记录事实、组织结构、把想法转成可以继续执行的图。
                  </p>
                </div>

                <div className="rounded-[2rem] border border-black/10 bg-white/58 p-5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">Surface</div>
                  <div className="mt-4 space-y-4">
                    {[
                      "Info 进入",
                      "Landing 浏览",
                      "主页面立即体验",
                      "NodeLab 继续工作",
                    ].map((item, index) => (
                      <div key={item} className="flex items-center gap-3 text-[13px] text-zinc-700 dark:text-zinc-300">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-black/[0.03] text-[11px] font-medium dark:border-white/10 dark:bg-white/[0.04]">
                          0{index + 1}
                        </div>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-white/58 py-4 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="landing-marquee flex min-w-max items-center gap-4 px-4 text-[11px] uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                    {["script", "evidence", "memory", "node", "workflow", "character", "scene", "runtime"]
                      .concat(["script", "evidence", "memory", "node", "workflow", "character", "scene", "runtime"])
                      .map((item, index) => (
                        <div key={`${item}-${index}`} className="inline-flex items-center gap-4">
                          <Sparkle size={12} weight="duotone" className="text-emerald-700 dark:text-emerald-300" />
                          <span>{item}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="capabilities" className="grid grid-cols-1 gap-5 py-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-10">
          <div className="landing-reveal">
            <div className="sticky top-8">
              <div className="text-[10px] uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Capability Taxonomy</div>
              <div className="mt-4 text-3xl font-semibold tracking-[-0.05em] md:text-4xl">
                真实能力，不是抽象宣传语。
              </div>
              <p className="mt-4 max-w-[26ch] text-[14px] leading-7 text-zinc-700 dark:text-zinc-300">
                这里不写泛化词。每一层都直接对应当前项目里的 tool schema、bridge contract 和 NodeLab 实体能力。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {capabilityBlocks.map(({ eyebrow, title, statement, description, tools, Icon }, index) => (
              <div
                key={eyebrow}
                className={`landing-reveal grid grid-cols-1 gap-5 rounded-[2rem] border border-black/10 bg-white/60 p-6 shadow-[0_26px_70px_-52px_rgba(15,23,42,0.35)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04] md:grid-cols-[220px_minmax(0,1fr)] ${index === 1 ? "md:-ml-8" : ""} ${index === 2 ? "md:ml-8" : ""}`}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="border-b border-black/10 pb-4 md:border-b-0 md:border-r md:pb-0 md:pr-5 dark:border-white/10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.04]">
                    <Icon size={20} weight="duotone" className="text-emerald-700 dark:text-emerald-300" />
                  </div>
                  <div className="mt-4 text-[10px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">{eyebrow}</div>
                  <div className="mt-2 text-[20px] font-semibold tracking-[-0.04em]">{statement}</div>
                </div>

                <div>
                  <div className="text-[24px] font-semibold leading-tight tracking-[-0.05em]">{title}</div>
                  <p className="mt-4 max-w-[70ch] text-[14px] leading-8 text-zinc-700 dark:text-zinc-300">{description}</p>

                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    {tools.map((tool) => (
                      <div
                        key={tool}
                        className="rounded-[1.25rem] border border-black/10 bg-black/[0.02] px-4 py-3 text-[13px] text-zinc-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300"
                        style={{ fontFamily: '"IBM Plex Mono", "SFMono-Regular", monospace' }}
                      >
                        {tool}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="runtime" className="grid grid-cols-1 gap-6 py-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.9fr)]">
          <div className="rounded-[2.25rem] border border-black/10 bg-white/60 p-6 shadow-[0_26px_70px_-52px_rgba(15,23,42,0.35)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]">
            <div className="text-[10px] uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">Runtime Architecture</div>
            <div className="mt-4 text-3xl font-semibold tracking-[-0.05em] md:text-4xl">
              一个会流式思考、会保留记忆、也会严格受约束的 runtime。
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {runtimeFacts.map(({ label, value, detail, Icon }) => (
                <div
                  key={label}
                  className="rounded-[1.6rem] border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                    <Icon size={14} weight="duotone" className="text-emerald-700 dark:text-emerald-300" />
                    {label}
                  </div>
                  <div className="mt-3 text-[18px] font-semibold tracking-[-0.03em]">{value}</div>
                  <p className="mt-2 text-[13px] leading-7 text-zinc-700 dark:text-zinc-300">{detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[1.75rem] border border-black/10 bg-[#f7f2ea] p-5 dark:border-white/10 dark:bg-[#171b18]">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                <Graph size={14} weight="duotone" />
                Execution Principle
              </div>
              <p className="mt-3 max-w-[74ch] text-[14px] leading-8 text-zinc-700 dark:text-zinc-300">
                Qalam 的关键点不在于“它会回答”。真正重要的是：当状态需要变化时，它必须经过 tools、guardrails、bridge 和 runtime event，
                让读取、沉淀、操作变成一条可见、可追踪、可继续编辑的链路。
              </p>
            </div>
          </div>

          <div className="grid gap-5">
            <div className="rounded-[2.25rem] border border-black/10 bg-white/60 p-6 shadow-[0_26px_70px_-52px_rgba(15,23,42,0.35)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                <SquaresFour size={14} weight="duotone" />
                NodeLab Workflow Surface
              </div>
              <div className="mt-4 text-[24px] font-semibold tracking-[-0.04em]">工作流不是结果页，是下一步工作的入口。</div>
              <p className="mt-3 text-[14px] leading-8 text-zinc-700 dark:text-zinc-300">
                `create_node_workflow` 不只创建单个备注，而是支持 group、多节点、typed edges 与 pause edges。换句话说，Qalam 可以把“理解”
                直接变成一张还可继续执行和调整的图。
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {workflowNodes.map((node) => (
                  <div
                    key={node}
                    className="rounded-[1.2rem] border border-black/10 bg-black/[0.02] px-4 py-3 text-[12px] text-zinc-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300"
                    style={{ fontFamily: '"IBM Plex Mono", "SFMono-Regular", monospace' }}
                  >
                    {node}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2.25rem] border border-black/10 bg-white/60 p-6 shadow-[0_26px_70px_-52px_rgba(15,23,42,0.35)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                <ReadCvLogo size={14} weight="duotone" />
                Knowledge Layer
              </div>
              <div className="mt-4 space-y-3">
                {knowledgeRows.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[1.2rem] border border-black/10 bg-black/[0.02] px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <div className="text-[14px] font-semibold tracking-[-0.02em]">{item.title}</div>
                    <div className="mt-2 text-[13px] leading-7 text-zinc-700 dark:text-zinc-300">{item.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-10">
          <div className="rounded-[2.5rem] border border-black/10 bg-zinc-950 px-6 py-8 text-white shadow-[0_40px_90px_-48px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-[#171918] md:px-8 md:py-10">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_240px] md:items-end">
              <div>
                <div className="text-[10px] uppercase tracking-[0.32em] text-white/50">QALAM / قلم</div>
                <div className="mt-4 max-w-[13ch] text-4xl font-semibold leading-none tracking-[-0.06em] md:text-5xl">
                  让 agent 进入创作面，而不是停在聊天框里。
                </div>
                <p className="mt-5 max-w-[66ch] text-[14px] leading-8 text-white/65">
                  进入主页面后，你会直接回到 NodeLab 工作台。无需登录，直接体验 Qalam 作为 agent 如何读取项目、沉淀知识、并继续生成可执行 workflow。
                </p>
              </div>

              <div className="flex flex-col items-start gap-3 md:items-end">
                <MagneticButton
                  type="button"
                  onClick={onEnterApp}
                  className="bg-white px-6 py-3 text-sm font-semibold text-zinc-950"
                  icon={<ArrowRight size={16} weight="bold" />}
                >
                  立即体验
                </MagneticButton>
                <div className="flex items-center gap-2 text-[12px] text-white/55">
                  <Notebook size={14} weight="duotone" />
                  主页面将继续保留当前工作流上下文
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
