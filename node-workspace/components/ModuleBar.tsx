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
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/12 bg-[#0b0d10]/95 px-3 py-2 shadow-[0_18px_40px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
      {modules.map((mod) => {
        const Icon = mod.icon;
        return (
          <button
            key={mod.key}
            type="button"
            onClick={() => onOpen(mod.key)}
            className="group flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/5 transition border border-white/8 hover:border-white/30"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-white/80 group-hover:text-white">
              <Icon size={16} />
            </span>
            <span className="hidden sm:inline">{mod.label}</span>
          </button>
        );
      })}
    </div>
  );
};
