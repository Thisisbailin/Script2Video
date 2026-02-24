
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, type Variants } from 'framer-motion';
import {
  ArrowRight,
  ChartLineUp,
  CircleNotch,
  Command,
  FilmSlate,
  Pulse,
  Sparkle,
  WarningCircle,
} from '@phosphor-icons/react';
import { ProjectData, RequestStats } from '../types';

interface Props {
  data: ProjectData;
  isDarkMode?: boolean;
}

interface QueueItem {
  id: string;
  title: string;
  statusLabel: string;
  shotCount: number;
  tokenCount: number;
}

interface StageTokenUsage {
  label: string;
  value: number;
}

const STAGGER_CONTAINER: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.04,
    },
  },
};

const RISE_IN: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 100, damping: 20 },
  },
};

const toRate = (stats: RequestStats): number => {
  if (!stats.total) return 0;
  return Math.round((stats.success / stats.total) * 100);
};

const compactNumber = (value: number): string =>
  value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString();

const statusLabelMap: Record<string, string> = {
  pending: '待处理',
  generating: '生成中',
  review_shots: '审查镜头',
  confirmed_shots: '镜头确认',
  generating_storyboard: '分镜生成',
  review_storyboard: '分镜审查',
  generating_sora: '提示词生成',
  review_sora: '提示词审查',
  completed: '已完成',
  error: '异常',
};

const MagneticActionButton = memo(function MagneticActionButton({
  label,
  Icon,
  isBusy = false,
  type = 'button',
  ...props
}: {
  label: string;
  Icon: React.ElementType;
  isBusy?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 100, damping: 20 });
  const springY = useSpring(y, { stiffness: 100, damping: 20 });

  const handlePointerMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    x.set(dx * 0.15);
    y.set(dy * 0.15);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      type={type}
      ref={buttonRef}
      style={{ x: springX, y: springY }}
      onMouseMove={handlePointerMove}
      onMouseLeave={reset}
      whileTap={{ scale: 0.98, y: 1 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500/90 px-5 py-3 text-sm font-semibold tracking-wide text-white transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-emerald-500 active:-translate-y-[1px] disabled:opacity-70"
      {...props}
    >
      {isBusy ? <CircleNotch size={18} className="animate-spin" /> : <Icon size={18} weight="bold" />}
      <span>{label}</span>
    </motion.button>
  );
});

const BreathingIndicator = memo(function BreathingIndicator({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
      <motion.span
        className={`h-2.5 w-2.5 rounded-full ${isDarkMode ? 'bg-emerald-300' : 'bg-emerald-600'}`}
        animate={{ scale: [1, 1.32, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className={isDarkMode ? 'text-emerald-200' : 'text-emerald-800'}>系统稳态运行</span>
    </div>
  );
});

const TypewriterPrompt = memo(function TypewriterPrompt({ isDarkMode }: { isDarkMode: boolean }) {
  const prompts = useMemo(
    () => ['为第 7 集生成夜景镜头表', '同步角色道具与分区素材', '评估本轮生成失败请求并重排'],
    []
  );
  const [promptIndex, setPromptIndex] = useState(0);
  const [visibleChars, setVisibleChars] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const activePrompt = prompts[promptIndex];
    if (visibleChars < activePrompt.length) {
      const typeTimer = window.setTimeout(() => setVisibleChars((value) => value + 1), 45);
      return () => window.clearTimeout(typeTimer);
    }

    const processingTimer = window.setTimeout(() => setIsProcessing(true), 700);
    const nextTimer = window.setTimeout(() => {
      setIsProcessing(false);
      setVisibleChars(0);
      setPromptIndex((value) => (value + 1) % prompts.length);
    }, 2350);

    return () => {
      window.clearTimeout(processingTimer);
      window.clearTimeout(nextTimer);
    };
  }, [promptIndex, prompts, visibleChars]);

  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        isDarkMode ? 'border-white/10 bg-slate-900/55' : 'border-slate-200 bg-white/70'
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.2em]">
        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Command Input</span>
        <span className={isDarkMode ? 'text-emerald-300/80' : 'text-emerald-700'}>队列轮询</span>
      </div>
      <div className={`font-mono text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
        {prompts[promptIndex].slice(0, visibleChars)}
        <motion.span
          className="ml-0.5 inline-block h-4 w-0.5 bg-emerald-400"
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <motion.div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-500/20"
        animate={isProcessing ? { opacity: 1 } : { opacity: 0.35 }}
      >
        <motion.div
          className="h-full w-1/3 bg-emerald-400/85"
          animate={{ x: ['-120%', '360%'] }}
          transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
        />
      </motion.div>
    </div>
  );
});

const CommandComposer = memo(function CommandComposer({ isDarkMode }: { isDarkMode: boolean }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = input.trim();
    if (normalized.length < 8) {
      setError('请输入至少 8 个字符的指令。');
      setSubmitted(false);
      return;
    }
    setError('');
    setSubmitted(true);
    window.setTimeout(() => setSubmitted(false), 1600);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-2">
      <label
        htmlFor="dashboard-command-input"
        className={`text-xs font-semibold uppercase tracking-[0.18em] ${
          isDarkMode ? 'text-slate-400' : 'text-slate-500'
        }`}
      >
        调度指令
      </label>
      <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        例如：重试第 3 集分镜生成，并保留角色风格约束。
      </p>
      <input
        id="dashboard-command-input"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="输入指令"
        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 ${
          isDarkMode
            ? 'border-slate-700 bg-slate-900/70 text-slate-100 placeholder:text-slate-500'
            : 'border-slate-200 bg-white/80 text-slate-900 placeholder:text-slate-400'
        }`}
      />
      <p className={`text-xs ${error ? 'text-red-500' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {error || (submitted ? '指令已进入排队通道。' : '按 Enter 或点击按钮提交。')}
      </p>
      <div className="pt-1">
        <MagneticActionButton type="submit" label="提交调度" Icon={Command} isBusy={submitted} />
      </div>
    </form>
  );
});

const IntelligentQueue = memo(function IntelligentQueue({
  items,
  isDarkMode,
}: {
  items: QueueItem[];
  isDarkMode: boolean;
}) {
  const [orderedItems, setOrderedItems] = useState(items);

  useEffect(() => {
    setOrderedItems(items);
  }, [items]);

  useEffect(() => {
    if (orderedItems.length < 2) return;
    const intervalId = window.setInterval(() => {
      setOrderedItems((previous) => {
        if (previous.length < 2) return previous;
        const [first, ...rest] = previous;
        return [...rest, first];
      });
    }, 3200);
    return () => window.clearInterval(intervalId);
  }, [orderedItems.length]);

  return (
    <motion.ul variants={STAGGER_CONTAINER} initial="hidden" animate="visible" className="space-y-2">
      <AnimatePresence mode="popLayout" initial={false}>
        {orderedItems.map((item) => (
          <motion.li
            key={item.id}
            layout
            layoutId={`queue-item-${item.id}`}
            variants={RISE_IN}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
            className={`rounded-2xl border px-4 py-3 ${
              isDarkMode ? 'border-slate-800 bg-slate-950/45' : 'border-slate-200 bg-white/65'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                  {item.title}
                </p>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{item.statusLabel}</p>
              </div>
              <div className="text-right">
                <p className={`font-mono text-sm ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  {item.shotCount} 镜头
                </p>
                <p className={`font-mono text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {compactNumber(item.tokenCount)} tokens
                </p>
              </div>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
});

const WideDataStream = memo(function WideDataStream({
  items,
  isDarkMode,
}: {
  items: StageTokenUsage[];
  isDarkMode: boolean;
}) {
  const railItems = useMemo(() => [...items, ...items], [items]);
  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-500/25 bg-emerald-500/10">
      <motion.div
        className="flex w-max gap-3 px-3 py-3"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 18, ease: 'linear', repeat: Infinity }}
      >
        {railItems.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className={`min-w-[170px] rounded-xl border px-3 py-2 ${
              isDarkMode ? 'border-slate-700 bg-slate-900/75' : 'border-slate-200 bg-white/85'
            }`}
          >
            <p className={`text-xs uppercase tracking-[0.15em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {item.label}
            </p>
            <p className={`mt-1 font-mono text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              {compactNumber(item.value)} tokens
            </p>
          </div>
        ))}
      </motion.div>
    </div>
  );
});

const FocusModePreview = memo(function FocusModePreview({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.5rem] border p-4 ${
        isDarkMode ? 'border-slate-800 bg-slate-950/45' : 'border-slate-200 bg-white/70'
      }`}
    >
      <motion.div
        className="absolute left-4 right-4 top-[47%] h-6 rounded-md bg-emerald-500/15"
        animate={{ opacity: [0.35, 0.78, 0.35], y: [0, 1, 0] }}
        transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity }}
      />
      <div className="space-y-2">
        {[78, 82, 74, 80, 68].map((width, index) => (
          <motion.div
            key={width}
            className={`h-2 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}
            style={{ width: `${width}%` }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: [0.35, 1, 0.35], x: 0 }}
            transition={{
              delay: index * 0.12,
              duration: 2.4,
              repeat: Infinity,
              repeatDelay: 0.2,
              type: 'spring',
              stiffness: 100,
              damping: 20,
            }}
          />
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.35 }}
        className={`absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 ${
          isDarkMode ? 'border-slate-700 bg-slate-900/90' : 'border-slate-200 bg-white/90'
        }`}
      >
        <Sparkle size={14} className={isDarkMode ? 'text-emerald-300' : 'text-emerald-700'} />
        <FilmSlate size={14} className={isDarkMode ? 'text-slate-200' : 'text-slate-700'} />
        <Pulse size={14} className={isDarkMode ? 'text-slate-200' : 'text-slate-700'} />
      </motion.div>
    </div>
  );
});

const DashboardLoadingState = memo(function DashboardLoadingState({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className={`relative min-h-[100dvh] overflow-y-auto ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
        <div className={`grid gap-6 lg:grid-cols-12 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
          <div className="lg:col-span-7 space-y-4">
            <div className={`h-6 w-48 animate-pulse rounded ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <div className={`h-16 w-full animate-pulse rounded-2xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`} />
            <div className={`h-16 w-4/5 animate-pulse rounded-2xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`} />
          </div>
          <div className={`lg:col-span-5 h-[280px] animate-pulse rounded-[2rem] ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`} />
        </div>
      </div>
    </div>
  );
});

const DashboardErrorState = memo(function DashboardErrorState({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className={`min-h-[100dvh] px-4 py-8 md:px-8 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div
        className={`mx-auto max-w-[820px] rounded-[2rem] border p-8 ${
          isDarkMode ? 'border-slate-800 bg-slate-900/80 text-slate-100' : 'border-slate-200 bg-white/90 text-slate-900'
        }`}
      >
        <div className="flex items-start gap-3">
          <WarningCircle size={24} className="mt-0.5 text-red-500" />
          <div>
            <h3 className="text-xl font-semibold tracking-tight">仪表盘数据结构异常</h3>
            <p className={`mt-2 text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              当前无法完成可视化渲染。请检查项目数据是否包含 `episodes`、`stats` 与 `phase1Usage` 字段。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

const DashboardEmptyState = memo(function DashboardEmptyState({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className={`min-h-[100dvh] px-4 py-8 md:px-8 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div
        className={`mx-auto grid max-w-[1200px] grid-cols-1 gap-6 rounded-[2.5rem] border p-6 md:grid-cols-12 md:p-10 ${
          isDarkMode ? 'border-slate-800 bg-slate-900/70 text-slate-100' : 'border-slate-200 bg-white/85 text-slate-900'
        }`}
      >
        <div className="md:col-span-7">
          <p className={`text-xs uppercase tracking-[0.24em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Dashboard Empty
          </p>
          <h2 className="mt-3 text-4xl leading-none tracking-tighter md:text-5xl">先导入剧本，再进入镜头调度与成本追踪。</h2>
          <p className={`mt-4 max-w-[65ch] text-base leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            当前项目尚无集数据。建议先在脚本模块粘贴内容并执行解析，再回到此处查看队列、成功率和 token 流量。
          </p>
          <div className="mt-6">
            <MagneticActionButton label="前往脚本模块" Icon={ArrowRight} />
          </div>
        </div>
        <div className="md:col-span-5">
          <div
            className={`h-full rounded-[2rem] border p-5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${
              isDarkMode ? 'border-white/10 bg-slate-900/50' : 'border-white/80 bg-white/65'
            }`}
          >
            <TypewriterPrompt isDarkMode={isDarkMode} />
          </div>
        </div>
      </div>
    </div>
  );
});

export const Dashboard: React.FC<Props> = ({ data, isDarkMode = true }) => {
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    const bootTimer = window.setTimeout(() => setIsBooting(false), 520);
    return () => window.clearTimeout(bootTimer);
  }, [data.fileName]);

  const hasInvalidData =
    !data ||
    !Array.isArray(data.episodes) ||
    !data.stats ||
    !data.phase1Usage ||
    !data.phase1Usage.projectSummary;

  const episodes = data.episodes || [];

  const totals = useMemo(() => {
    const totalEpisodes = episodes.length;
    const completedEpisodes = episodes.filter((episode) => episode.status === 'completed').length;
    const totalShots = episodes.reduce((acc, episode) => acc + (episode.shots?.length || 0), 0);
    const completionRate = totalEpisodes ? Math.round((completedEpisodes / totalEpisodes) * 100) : 0;

    const contextTokens = data.contextUsage?.totalTokens || 0;
    const totalShotGenTokens = episodes.reduce((acc, episode) => acc + (episode.shotGenUsage?.totalTokens || 0), 0);
    const totalSoraTokens = episodes.reduce((acc, episode) => acc + (episode.soraGenUsage?.totalTokens || 0), 0);
    const totalStoryboardTokens = episodes.reduce(
      (acc, episode) => acc + (episode.storyboardGenUsage?.totalTokens || 0),
      0
    );
    const totalPhase4Tokens = data.phase4Usage?.totalTokens || 0;
    const totalPhase5Tokens = data.phase5Usage?.totalTokens || 0;

    const grandTotalTokens =
      contextTokens + totalShotGenTokens + totalSoraTokens + totalStoryboardTokens + totalPhase4Tokens + totalPhase5Tokens;

    return {
      totalEpisodes,
      completedEpisodes,
      totalShots,
      completionRate,
      grandTotalTokens,
      averageShots: totalEpisodes ? (totalShots / totalEpisodes).toFixed(1) : '0.0',
      averageTokens: totalEpisodes ? Math.round(grandTotalTokens / totalEpisodes) : 0,
      stages: [
        { label: 'Context', value: contextTokens },
        { label: 'Shot Gen', value: totalShotGenTokens },
        { label: 'Sora Gen', value: totalSoraTokens },
        { label: 'Storyboard', value: totalStoryboardTokens },
        { label: 'Visual', value: totalPhase4Tokens },
        { label: 'Video', value: totalPhase5Tokens },
      ] as StageTokenUsage[],
    };
  }, [data.contextUsage?.totalTokens, data.phase4Usage?.totalTokens, data.phase5Usage?.totalTokens, episodes]);

  const pipelineStats = useMemo(
    () => [
      { label: '语境分析', stats: data.stats.context },
      { label: '镜头生成', stats: data.stats.shotGen },
      { label: 'Sora Prompt', stats: data.stats.soraGen },
      { label: '分镜 Prompt', stats: data.stats.storyboardGen },
    ],
    [data.stats.context, data.stats.shotGen, data.stats.soraGen, data.stats.storyboardGen]
  );

  const queueItems = useMemo<QueueItem[]>(
    () =>
      episodes
        .map((episode) => ({
          id: `${episode.id}`,
          title: `Episode ${episode.id} · ${episode.title || '未命名章节'}`,
          statusLabel: statusLabelMap[episode.status] || '状态未知',
          shotCount: episode.shots?.length || 0,
          tokenCount:
            (episode.shotGenUsage?.totalTokens || 0) +
            (episode.soraGenUsage?.totalTokens || 0) +
            (episode.storyboardGenUsage?.totalTokens || 0),
        }))
        .sort((a, b) => b.shotCount - a.shotCount)
        .slice(0, 6),
    [episodes]
  );

  const sectionTone = {
    shell: isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900',
    card: isDarkMode
      ? 'border-slate-800/80 bg-slate-900/70 text-slate-100'
      : 'border-slate-200/80 bg-white/85 text-slate-900',
    muted: isDarkMode ? 'text-slate-400' : 'text-slate-600',
    glass: isDarkMode
      ? 'border-white/10 bg-slate-900/45 text-slate-100'
      : 'border-white/80 bg-white/70 text-slate-900',
    subPanel: isDarkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-100/70',
  };

  if (hasInvalidData) return <DashboardErrorState isDarkMode={isDarkMode} />;
  if (isBooting) return <DashboardLoadingState isDarkMode={isDarkMode} />;
  if (!totals.totalEpisodes) return <DashboardEmptyState isDarkMode={isDarkMode} />;

  return (
    <div className={`relative min-h-[100dvh] overflow-y-auto ${sectionTone.shell}`}>
      <div
        className="pointer-events-none fixed inset-0 opacity-90"
        style={{
          background: isDarkMode
            ? 'radial-gradient(circle at 16% 10%, rgba(16,185,129,0.16), transparent 42%), radial-gradient(circle at 88% 12%, rgba(15,23,42,0.55), transparent 40%)'
            : 'radial-gradient(circle at 16% 10%, rgba(5,150,105,0.14), transparent 42%), radial-gradient(circle at 88% 12%, rgba(148,163,184,0.18), transparent 40%)',
        }}
      />
      <div className="relative mx-auto max-w-[1400px] px-4 py-8 md:px-8 md:py-10">
        <motion.section
          variants={STAGGER_CONTAINER}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-6 lg:grid-cols-12"
        >
          <motion.div variants={RISE_IN} className="space-y-5 lg:col-span-7">
            <p className={`text-xs uppercase tracking-[0.24em] ${sectionTone.muted}`}>Motion Dashboard</p>
            <h2 className="text-4xl leading-none tracking-tighter md:text-6xl">
              用更清晰的节奏管理脚本到视频的执行路径。
            </h2>
            <p className={`max-w-[65ch] text-base leading-relaxed ${sectionTone.muted}`}>
              左侧聚焦任务决策，右侧保留实时调度入口。界面使用单一强调色与连续微动效，保证信息密度与交互反馈同时成立。
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className={`rounded-2xl border px-4 py-3 ${sectionTone.subPanel}`}>
                <p className={`text-xs uppercase tracking-[0.14em] ${sectionTone.muted}`}>完成率</p>
                <p className="mt-1 font-mono text-2xl">{totals.completionRate}%</p>
                <p className={`text-xs ${sectionTone.muted}`}>{totals.completedEpisodes} / {totals.totalEpisodes} Episodes</p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 ${sectionTone.subPanel}`}>
                <p className={`text-xs uppercase tracking-[0.14em] ${sectionTone.muted}`}>平均负载</p>
                <p className="mt-1 font-mono text-2xl">{totals.averageShots} Shots</p>
                <p className={`text-xs ${sectionTone.muted}`}>{compactNumber(totals.averageTokens)} tokens / Ep</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <MagneticActionButton label="生成新一轮镜头" Icon={FilmSlate} />
              <MagneticActionButton label="查看性能趋势" Icon={ChartLineUp} />
            </div>
          </motion.div>

          <motion.div
            variants={RISE_IN}
            style={{ boxShadow: '0 20px 40px -15px rgba(2,6,23,0.35), inset 0 1px 0 rgba(255,255,255,0.1)' }}
            className={`rounded-[2rem] border p-6 backdrop-blur-xl lg:col-span-5 ${sectionTone.glass}`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-xs uppercase tracking-[0.2em] ${sectionTone.muted}`}>实时调度</p>
              <BreathingIndicator isDarkMode={isDarkMode} />
            </div>
            <div className="mt-4">
              <TypewriterPrompt isDarkMode={isDarkMode} />
              <CommandComposer isDarkMode={isDarkMode} />
            </div>
          </motion.div>
        </motion.section>

        <motion.section
          variants={STAGGER_CONTAINER}
          initial="hidden"
          animate="visible"
          className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-12"
        >
          <motion.div variants={RISE_IN} className="space-y-3 md:col-span-7">
            <article className={`rounded-[2rem] border p-5 ${sectionTone.card}`}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight">智能任务列表</h3>
                <p className={`text-xs uppercase tracking-[0.2em] ${sectionTone.muted}`}>Auto Sort</p>
              </div>
              <IntelligentQueue items={queueItems} isDarkMode={isDarkMode} />
            </article>
            <p className={`px-1 text-xs uppercase tracking-[0.18em] ${sectionTone.muted}`}>
              列表使用 `layoutId` 连续重排，优先队列保持可读性
            </p>
          </motion.div>

          <motion.div variants={RISE_IN} className="space-y-3 md:col-span-5">
            <article className={`rounded-[2rem] border p-5 ${sectionTone.card}`}>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight">流水线健康</h3>
                <Pulse size={18} className="text-emerald-400" />
              </div>
              <div className="space-y-4">
                {pipelineStats.map((item) => {
                  const successRate = toRate(item.stats);
                  const errorRate = item.stats.total ? Math.round((item.stats.error / item.stats.total) * 100) : 0;
                  return (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className={sectionTone.muted}>{item.label}</span>
                        <span className="font-mono">
                          {item.stats.success}/{item.stats.total} · {successRate}%
                        </span>
                      </div>
                      <div className={`h-2 overflow-hidden rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                        <div className="flex h-full">
                          <motion.div
                            className="bg-emerald-500/90"
                            initial={{ width: 0 }}
                            animate={{ width: `${successRate}%` }}
                            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                          />
                          {!!errorRate && (
                            <motion.div
                              className="bg-red-500/90"
                              initial={{ width: 0 }}
                              animate={{ width: `${errorRate}%` }}
                              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
            <p className={`px-1 text-xs uppercase tracking-[0.18em] ${sectionTone.muted}`}>
              成功与异常占比拆分显示，避免状态被平均值掩盖
            </p>
          </motion.div>

          <motion.div variants={RISE_IN} className="space-y-3 md:col-span-8">
            <article className={`rounded-[2rem] border p-5 ${sectionTone.card}`}>
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">宽幅数据流</h3>
                  <p className={`mt-1 text-sm ${sectionTone.muted}`}>全链路 token 流量持续滚动，便于定位异常峰值。</p>
                </div>
                <p className={`font-mono text-xs ${sectionTone.muted}`}>Total {compactNumber(totals.grandTotalTokens)}</p>
              </div>
              <WideDataStream items={totals.stages} isDarkMode={isDarkMode} />
            </article>
            <p className={`px-1 text-xs uppercase tracking-[0.18em] ${sectionTone.muted}`}>
              无间断横向轮播，保持低干预态信息可见
            </p>
          </motion.div>

          <motion.div variants={RISE_IN} className="space-y-3 md:col-span-4">
            <article className={`rounded-[2rem] border p-5 ${sectionTone.card}`}>
              <h3 className="text-lg font-semibold tracking-tight">聚焦模式预览</h3>
              <p className={`mt-1 text-sm ${sectionTone.muted}`}>高亮段与浮动工具条分层出现，减少编辑中断。</p>
              <div className="mt-4">
                <FocusModePreview isDarkMode={isDarkMode} />
              </div>
            </article>
            <p className={`px-1 text-xs uppercase tracking-[0.18em] ${sectionTone.muted}`}>
              文本高亮与工具栏采用独立微动效组件
            </p>
          </motion.div>
        </motion.section>
      </div>
    </div>
  );
};
