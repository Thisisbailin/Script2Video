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
  variant?: "default" | "text";
};

export const BaseNode: React.FC<Props> = ({ children, inputs = [], outputs = [], selected, variant = "default" }) => {
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
        className="node-card-base transition-shadow duration-300 overflow-visible text-xs flex flex-col"
        data-selected={!!selected}
        data-variant={variant}
      >
        <div className="node-card-body relative px-5 py-4 space-y-4 flex-1 flex flex-col">{children}</div>

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
