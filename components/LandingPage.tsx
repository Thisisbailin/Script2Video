import React from "react";
import {
  ArrowRight,
  CursorClick,
  FilmSlate,
  Path,
  Sparkle,
  StackSimple,
} from "@phosphor-icons/react";
import { MagneticButton } from "./landing/MagneticButton";

type Props = {
  isDarkMode?: boolean;
  onEnterApp: () => void;
};

const signals = [
  {
    title: "Script In",
    copy: "读入剧本、角色和场景，不再在多个工具之间搬运上下文。",
    Icon: StackSimple,
  },
  {
    title: "Node Flow",
    copy: "把理解、资产、镜头和生成流程放进一张持续可编辑的工作面。",
    Icon: Path,
  },
  {
    title: "Motion Out",
    copy: "从视觉概念到视频输出，保持同一条叙事链路，不需要重开一次项目。",
    Icon: FilmSlate,
  },
];

const phrases = [
  "Script",
  "Character",
  "Scene",
  "Asset",
  "Shot",
  "Motion",
  "NodeLab",
  "Qalam",
];

export const LandingPage: React.FC<Props> = ({ isDarkMode = true, onEnterApp }) => {
  return (
    <div
      className={`${isDarkMode ? "dark" : ""} relative min-h-[100dvh] overflow-hidden bg-[#efeae1] text-zinc-950 dark:bg-[#0f1110] dark:text-zinc-50`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="landing-orb landing-orb--emerald absolute left-[-8%] top-[-6%] h-[24rem] w-[24rem] rounded-full bg-emerald-500/16 blur-3xl dark:bg-emerald-400/18" />
        <div className="landing-orb landing-orb--sand absolute bottom-[-14%] right-[-4%] h-[28rem] w-[28rem] rounded-full bg-stone-400/22 blur-3xl dark:bg-stone-300/10" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30 dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] dark:opacity-20" />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] max-w-[1400px] flex-col px-4 py-5 sm:px-6 md:px-8 md:py-8">
        <header className="landing-reveal flex items-center justify-between border-b border-black/10 pb-5 dark:border-white/10">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">
              Script2Video
            </div>
            <div
              className="mt-2"
              style={{ fontFamily: '"Outfit", "SF Pro Display", "Segoe UI", sans-serif' }}
            >
              <div className="text-lg font-semibold tracking-[-0.03em]">Qalam Landing</div>
              <div className="text-[12px] text-zinc-600 dark:text-zinc-400">
                Open surface, no sign-in wall.
              </div>
            </div>
          </div>
          <div className="rounded-full border border-black/10 bg-white/55 px-4 py-2 text-[11px] font-medium text-zinc-600 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
            Node-first creative operating surface
          </div>
        </header>

        <main className="flex flex-1 items-center py-10 md:py-12">
          <div className="grid w-full grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:gap-14">
            <section className="flex flex-col justify-center">
              <div className="landing-reveal text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-700 dark:text-emerald-300">
                Account · Info · Landing
              </div>
              <h1
                className="landing-reveal mt-5 max-w-[10ch] text-5xl font-semibold leading-none tracking-[-0.06em] md:text-7xl"
                style={{
                  animationDelay: "120ms",
                  fontFamily: '"Outfit", "SF Pro Display", "Segoe UI", sans-serif',
                }}
              >
                把剧本、镜头、资产与生成，收进同一块工作面。
              </h1>
              <p
                className="landing-reveal mt-6 max-w-[58ch] text-base leading-8 text-zinc-700 dark:text-zinc-300"
                style={{ animationDelay: "220ms" }}
              >
                这不是一张要求先登录的门面页。它更像项目的序章：打开即可浏览、搭建、生成，并在同一条创作链路里继续推进。
              </p>

              <div
                className="landing-reveal mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
                style={{ animationDelay: "320ms" }}
              >
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
                  直接进入主页面，无需登录
                </div>
              </div>

              <div
                className="landing-reveal mt-10 border-t border-black/10 pt-5 dark:border-white/10"
                style={{ animationDelay: "420ms" }}
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  {signals.map(({ title, copy, Icon }) => (
                    <div key={title} className="border-b border-black/10 pb-4 last:border-b-0 md:last:border-b dark:border-white/10">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                        <Icon size={14} weight="duotone" className="text-emerald-700 dark:text-emerald-300" />
                        {title}
                      </div>
                      <p className="mt-3 max-w-[34ch] text-sm leading-7 text-zinc-700 dark:text-zinc-300">
                        {copy}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="landing-reveal relative" style={{ animationDelay: "180ms" }}>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_220px]">
                <div className="rounded-[2rem] border border-black/10 bg-white/60 p-6 shadow-[0_30px_80px_-46px_rgba(15,23,42,0.45)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_30px_90px_-50px_rgba(0,0,0,0.55)]">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                    <span>Creative Surface</span>
                    <span className="inline-flex items-center gap-2">
                      <span className="landing-pulse-dot h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-300" />
                      open
                    </span>
                  </div>

                  <div className="mt-8 space-y-3">
                    {[
                      "剧本进入后，角色和场景随即成为可持续编辑的事实层。",
                      "NodeLab 把理解、生成、回看与调整放在一张持续发光的工作面里。",
                      "从概念图到视频输出，项目不再被拆散成零碎窗口。",
                    ].map((line, index) => (
                      <div
                        key={line}
                        className="rounded-[1.5rem] border border-black/10 bg-black/[0.02] px-4 py-4 text-sm leading-7 text-zinc-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300"
                        style={{ animationDelay: `${index * 110 + 280}ms` }}
                      >
                        {line}
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 grid gap-4 border-t border-black/10 pt-5 md:grid-cols-[minmax(0,1fr)_140px] dark:border-white/10">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                        Flow
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                        <span>Script</span>
                        <span className="h-px w-8 bg-emerald-600/50 dark:bg-emerald-300/50" />
                        <span>Assets</span>
                        <span className="h-px w-8 bg-emerald-600/50 dark:bg-emerald-300/50" />
                        <span>Shots</span>
                        <span className="h-px w-8 bg-emerald-600/50 dark:bg-emerald-300/50" />
                        <span>Video</span>
                      </div>
                    </div>
                    <div className="relative overflow-hidden rounded-[1.5rem] border border-black/10 bg-zinc-950 px-4 py-4 text-white dark:border-white/10 dark:bg-[#171918]">
                      <div className="landing-beam absolute inset-y-0 left-[-35%] w-24 bg-gradient-to-r from-transparent via-emerald-300/18 to-transparent" />
                      <div className="relative text-[10px] uppercase tracking-[0.28em] text-white/55">Status</div>
                      <div className="relative mt-3 text-[15px] font-semibold tracking-[-0.03em]">Ready to enter</div>
                      <div className="relative mt-2 text-[12px] leading-6 text-white/60">One click back to the main workspace.</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[2rem] border border-black/10 bg-white/50 p-5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="text-[11px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                      Detail
                    </div>
                    <div className="mt-4 space-y-4">
                      {[
                        "Info 面板进入",
                        "Landing 浏览",
                        "主页面立即体验",
                      ].map((item, index) => (
                        <div key={item} className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-black/[0.03] text-[12px] font-medium dark:border-white/10 dark:bg-white/[0.04]">
                            0{index + 1}
                          </div>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-white/50 py-4 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="landing-marquee flex min-w-max items-center gap-3 px-4 text-[11px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                      {phrases.concat(phrases).map((phrase, index) => (
                        <div key={`${phrase}-${index}`} className="inline-flex items-center gap-3">
                          <Sparkle size={12} weight="duotone" className="text-emerald-700 dark:text-emerald-300" />
                          <span>{phrase}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};
