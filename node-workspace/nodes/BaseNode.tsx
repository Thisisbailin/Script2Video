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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden text-xs">
      <div className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
        <span>{title}</span>
      </div>
      <div className="p-3 space-y-2 text-gray-700 dark:text-gray-200">{children}</div>
      {inputs.map((h, idx) => (
        <Handle
          key={`in-${idx}`}
          type="target"
          position={Position.Left}
          id={h}
          className={`${handleColor(h)} w-2.5 h-2.5`}
          style={{ top: 24 + idx * 16 }}
        />
      ))}
      {outputs.map((h, idx) => (
        <Handle
          key={`out-${idx}`}
          type="source"
          position={Position.Right}
          id={h}
          className={`${handleColor(h)} w-2.5 h-2.5`}
          style={{ top: 24 + idx * 16 }}
        />
      ))}
    </div>
  );
};
