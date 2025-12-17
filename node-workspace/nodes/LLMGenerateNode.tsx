import React from "react";
import { BaseNode } from "./BaseNode";
import { LLMGenerateNodeData } from "../types";

type Props = {
  id: string;
  data: LLMGenerateNodeData;
};

export const LLMGenerateNode: React.FC<Props> = ({ data }) => {
  return (
    <BaseNode title="LLM" inputs={["text"]} outputs={["text"]}>
      <div className="space-y-2">
        <div className="text-xs text-gray-500">Status: {data.status}</div>
        <textarea
          className="w-full h-20 text-xs bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-2"
          value={data.outputText || ""}
          onChange={(e) => (data.outputText = e.target.value)}
          placeholder="LLM output"
        />
        {data.error && <div className="text-xs text-red-500">{data.error}</div>}
      </div>
    </BaseNode>
  );
};
