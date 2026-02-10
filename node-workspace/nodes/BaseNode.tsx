import React, { useCallback, useRef, useState } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import { HandleType } from "../types";

type Props = {
  title: string;
  onTitleChange?: (newTitle: string) => void;
  children?: React.ReactNode;
  inputs?: HandleType[];
  outputs?: HandleType[];
  selected?: boolean;
  variant?: "default" | "text" | "media";
  resizerKeepAspect?: boolean;
};

export const BaseNode: React.FC<Props> = ({
  children,
  inputs = [],
  outputs = [],
  selected,
  variant = "default",
  resizerKeepAspect,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showResizer, setShowResizer] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const minHeight = variant === "text" ? 256 : 160;
  const keepAspectRatio = resizerKeepAspect ?? variant === "media";

  const updateResizerVisibility = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isResizing) return;
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) return;
      const threshold = 26;
      const x = event.clientX;
      const y = event.clientY;
      const nearLeft = x - rect.left <= threshold;
      const nearRight = rect.right - x <= threshold;
      const nearTop = y - rect.top <= threshold;
      const nearBottom = rect.bottom - y <= threshold;
      const next = (nearLeft || nearRight) && (nearTop || nearBottom);
      if (next !== showResizer) setShowResizer(next);
    },
    [isResizing, showResizer]
  );

  const clearResizer = useCallback(() => {
    if (!isResizing) setShowResizer(false);
  }, [isResizing]);

  const handleResizeStart = useCallback(() => {
    setIsResizing(true);
    setShowResizer(true);
  }, []);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setShowResizer(false);
  }, []);

  return (
    <div
      ref={cardRef}
      className="node-card-base transition-shadow duration-300 overflow-visible text-xs flex flex-col"
      data-selected={!!selected}
      data-variant={variant}
      data-resizer-visible={showResizer || isResizing}
      data-resizing={isResizing}
      onMouseMove={updateResizerVisibility}
      onMouseLeave={clearResizer}
    >
      <NodeResizer
        color="var(--node-accent)"
        isVisible
        minWidth={320}
        minHeight={minHeight}
        keepAspectRatio={keepAspectRatio}
        handleClassName="custom-node-handle"
        lineClassName="custom-node-line"
        onResizeStart={handleResizeStart}
        onResizeEnd={handleResizeEnd}
      />
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
  );
};
