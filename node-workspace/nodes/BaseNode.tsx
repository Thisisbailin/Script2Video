import React from "react";
import { Handle, Position } from "@xyflow/react";
import { HandleType } from "../types";

type Props = {
  title: string;
  children?: React.ReactNode;
  inputs?: HandleType[];
  outputs?: HandleType[];
  selected?: boolean;
};

export const BaseNode: React.FC<Props> = ({ title, children, inputs = [], outputs = [], selected }) => {
  return (
    <div
      className={`relative group min-w-[220px] rounded-2xl transition-all duration-300 overflow-visible text-xs ${selected
          ? "bg-[#1e293b] shadow-[0_20px_50px_rgba(0,0,0,0.5)] scale-[1.02]"
          : "bg-[#111827] shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
        }`}
    >
      <div className="relative px-5 py-4 flex items-center justify-between">
        <span className={`font-bold tracking-tight uppercase text-[10px] ${selected ? 'text-white' : 'text-white/40'}`}>
          {title}
        </span>
        {selected && (
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
        )}
      </div>

      <div className="relative px-5 pb-5 space-y-4">
        {children}
      </div>

      {/* Handles */}
      <div className="absolute inset-y-0 -left-1.5 flex flex-col justify-center gap-4 py-12">
        {inputs.map((h, idx) => (
          <div key={`in-wrapper-${idx}`} className="relative h-4 flex items-center">
            <Handle
              type="target"
              position={Position.Left}
              id={h}
              className="!static !translate-y-0"
              data-handletype={h}
            />
          </div>
        ))}
      </div>

      <div className="absolute inset-y-0 -right-1.5 flex flex-col justify-center gap-4 py-12">
        {outputs.map((h, idx) => (
          <div key={`out-wrapper-${idx}`} className="relative h-4 flex items-center">
            <Handle
              type="source"
              position={Position.Right}
              id={h}
              className="!static !translate-y-0"
              data-handletype={h}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
