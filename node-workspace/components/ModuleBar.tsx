import React from "react";
import type { LucideIcon } from "lucide-react";

export type ModuleKey = "assets" | "script" | "shots";

type ModuleItem = {
  key: ModuleKey;
  label: string;
  icon: LucideIcon;
};

type Props = {
  modules: ModuleItem[];
  onOpen: (key: ModuleKey) => void;
};

export const ModuleBar: React.FC<Props> = ({ modules, onOpen }) => {
  const accent: Record<ModuleKey, string> = {
    assets: "#38bdf8",
    script: "#a78bfa",
    shots: "#34d399",
  };

  return (
    <div className="flex h-12 items-center gap-2 rounded-full border border-white/12 bg-[#0b0d10]/90 px-3 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
      {modules.map((mod) => {
        const Icon = mod.icon;
        return (
          <button
            key={mod.key}
            type="button"
            onClick={() => onOpen(mod.key)}
            className="group h-10 w-10 flex items-center justify-center rounded-full border border-white/10 bg-white/6 text-white/85 shadow-[0_6px_18px_rgba(0,0,0,0.28)] hover:border-white/25 hover:bg-white/12 transition"
          >
            <Icon size={18} style={{ color: accent[mod.key] }} />
          </button>
        );
      })}
    </div>
  );
};
