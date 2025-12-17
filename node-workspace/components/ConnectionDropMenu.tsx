import React from "react";
import { NodeType } from "../types";

type Props = {
  position: { x: number; y: number };
  onCreate: (type: NodeType) => void;
  onClose: () => void;
};

export const ConnectionDropMenu: React.FC<Props> = ({ position, onCreate, onClose }) => {
  const options: { label: string; type: NodeType }[] = [
    { label: "Prompt", type: "prompt" },
    { label: "Image Input", type: "imageInput" },
    { label: "LLM", type: "llmGenerate" },
    { label: "Image Gen", type: "imageGen" },
    { label: "Video Gen", type: "videoGen" },
    { label: "Output", type: "output" },
    { label: "Annotation", type: "annotation" },
  ];

  return (
    <div
      className="absolute z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow-lg w-48"
      style={{ left: position.x, top: position.y }}
    >
      <div className="px-3 py-2 text-xs text-gray-500">Create node</div>
      <div className="divide-y divide-gray-200 dark:divide-gray-800">
        {options.map((opt) => (
          <button
            key={opt.type}
            className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
            onClick={() => {
              onCreate(opt.type);
              onClose();
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="w-full text-center text-xs text-gray-500 py-1 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        Cancel
      </button>
    </div>
  );
};
