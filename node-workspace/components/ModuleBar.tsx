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
    <div className="flex items-center gap-2 rounded-full border border-white/12 bg-[#0b0d10]/90 px-2 py-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
      {modules.map((mod) => {
        const Icon = mod.icon;
        return (
          <button
            key={mod.key}
            type="button"
            onClick={() => onOpen(mod.key)}
            className="group h-11 w-11 flex items-center justify-center rounded-full border border-white/12 text-white/85 hover:border-white/30 hover:bg-white/8 transition"
          >
            <Icon size={18} />
          </button>
        );
      })}
    </div>
  );
};
