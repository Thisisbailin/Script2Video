import React from "react";
import { Plus, Play } from "lucide-react";

type Props = {
  onAddPrompt: () => void;
  onAddImage: () => void;
  onAddLLM: () => void;
  onAddImageGen: () => void;
  onAddVideoGen: () => void;
  onAddOutput: () => void;
  onRun: () => void;
};

export const FloatingActionBar: React.FC<Props> = ({
  onAddPrompt,
  onAddImage,
  onAddLLM,
  onAddImageGen,
  onAddVideoGen,
  onAddOutput,
  onRun,
}) => {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#0f0f0f] text-white px-3 py-2 rounded-full border border-gray-700 shadow-lg">
      <button onClick={onRun} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 rounded-full text-sm font-semibold">
        <Play size={14} /> Run
      </button>
      <div className="h-6 w-px bg-gray-700" />
      <button onClick={onAddPrompt} className="px-2 py-1 bg-gray-800 rounded-full text-xs flex items-center gap-1">
        <Plus size={12} /> Prompt
      </button>
      <button onClick={onAddImage} className="px-2 py-1 bg-gray-800 rounded-full text-xs flex items-center gap-1">
        <Plus size={12} /> Image
      </button>
      <button onClick={onAddLLM} className="px-2 py-1 bg-gray-800 rounded-full text-xs flex items-center gap-1">
        <Plus size={12} /> LLM
      </button>
      <button onClick={onAddImageGen} className="px-2 py-1 bg-gray-800 rounded-full text-xs flex items-center gap-1">
        <Plus size={12} /> Img Gen
      </button>
      <button onClick={onAddVideoGen} className="px-2 py-1 bg-gray-800 rounded-full text-xs flex items-center gap-1">
        <Plus size={12} /> Video
      </button>
      <button onClick={onAddOutput} className="px-2 py-1 bg-gray-800 rounded-full text-xs flex items-center gap-1">
        <Plus size={12} /> Output
      </button>
    </div>
  );
};
