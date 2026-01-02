import React from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import { HandleType } from "../types";

type Props = {
  title: string;
  onTitleChange?: (newTitle: string) => void;
  children?: React.ReactNode;
  inputs?: HandleType[];
  outputs?: HandleType[];
  selected?: boolean;
};

export const BaseNode: React.FC<Props> = ({ title, onTitleChange, children, inputs = [], outputs = [], selected }) => {
  return (
    <>
      <NodeResizer
        color="var(--node-accent)"
        isVisible={selected}
        minWidth={320}
        minHeight={160}
        handleClassName="custom-node-handle"
        lineClassName="custom-node-line"
      />
      <div
        className="node-card-base transition-shadow duration-300 overflow-visible text-xs flex flex-col h-full w-full"
        data-selected={!!selected}
      >
        <div className="node-card-header relative px-5 py-3 flex items-center justify-between">
          {onTitleChange ? (
            <input
              className={`node-title-input bg-transparent text-[10px] outline-none transition-colors w-full mr-4 ${selected ? "text-[var(--node-text-primary)]" : "text-[var(--node-text-secondary)]"
                }`}
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="NODE TITLE"
            />
          ) : (
            <span
              className={`node-title-input text-[10px] transition-colors ${selected ? "text-[var(--node-text-primary)]" : "text-[var(--node-text-secondary)]"
                }`}
            >
              {title}
            </span>
          )}
          {selected && (
            <div className="h-1.5 w-1.5 rounded-full bg-[var(--node-accent)] shadow-[0_0_8px_var(--node-accent)]" />
          )}
        </div>

        <div className="node-card-body relative px-5 py-4 space-y-4 flex-1 flex flex-col">
          {children}
        </div>

        {/* Handles */}
        <div className="absolute inset-y-0 -left-1 flex flex-col justify-center gap-4 py-12">
          {inputs.map((h, idx) => (
            <Handle
              key={`in-${h}-${idx}`}
              type="target"
              position={Position.Left}
              id={h}
              className="!w-2 !h-2 !border-0 !bg-[var(--node-text-secondary)]"
              data-handletype={h}
            />
          ))}
        </div>

        <div className="absolute inset-y-0 -right-1 flex flex-col justify-center gap-4 py-12">
          {outputs.map((h, idx) => (
            <Handle
              key={`out-${h}-${idx}`}
              type="source"
              position={Position.Right}
              id={h}
              className="!w-2 !h-2 !border-0 !bg-[var(--node-text-secondary)]"
              data-handletype={h}
            />
          ))}
        </div>
      </div>
    </>
  );
};
