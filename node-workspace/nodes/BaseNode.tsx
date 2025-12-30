import React from "react";
import { Handle, Position } from "@xyflow/react";
import { HandleType } from "../types";

type Props = {
  title: string;
  children?: React.ReactNode;
  inputs?: HandleType[];
  outputs?: HandleType[];
};

const handleColor = (type: HandleType) => (type === "image" ? "bg-green-500" : "bg-blue-500");

export const BaseNode: React.FC<Props> = ({ title, children, inputs = [], outputs = [] }) => {
  return (
    <div className="relative group min-w-[200px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]/80 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:shadow-[var(--shadow-strong)] hover:border-[var(--border-strong)]/50 overflow-visible text-xs">
      {/* Glow effect on hover */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <div className="relative px-4 py-3 border-b border-[var(--border-subtle)]/50 flex items-center justify-between">
        <span className="font-semibold tracking-tight text-[var(--text-primary)]">{title}</span>
        <div className="h-1.5 w-1.5 rounded-full bg-blue-500/50 animate-pulse" />
      </div>

      <div className="relative p-4 space-y-3 text-[var(--text-secondary)]">
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
