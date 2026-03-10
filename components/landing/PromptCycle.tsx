import React, { memo, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, Path, ReadCvLogo } from "@phosphor-icons/react";

type Props = {
  prompts: string[];
};

const labels = [
  { text: "inspect", Icon: ReadCvLogo },
  { text: "understand", Icon: Brain },
  { text: "operate", Icon: Path },
];

export const PromptCycle = memo(function PromptCycle({ prompts }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (prompts.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % prompts.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [prompts.length]);

  const activePrompt = prompts[index] || "";
  const activeLabel = labels[index % labels.length];

  return (
    <div className="rounded-[1.4rem] border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">current request</div>
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300">
          <activeLabel.Icon size={12} weight="duotone" />
          {activeLabel.text}
        </div>
      </div>

      <div
        className="mt-4 min-h-[112px] text-[14px] leading-8 text-zinc-800 dark:text-zinc-200"
        style={{ fontFamily: '"IBM Plex Mono", "SFMono-Regular", monospace' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activePrompt}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          >
            {activePrompt}
            <span className="ml-1 inline-block h-5 w-[1px] animate-pulse bg-current align-middle opacity-70" />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
});
