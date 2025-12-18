import React from "react";
import { BaseNode } from "./BaseNode";
import { PromptNodeData } from "../types";
import { useWorkflowStore } from "../store/workflowStore";

type Props = {
  id: string;
  data: PromptNodeData;
};

export const PromptNode: React.FC<Props> = ({ data, id }) => {
  const { updateNodeData } = useWorkflowStore();
  return (
    <BaseNode title="Prompt" outputs={["text"]}>
      <textarea
        className="w-full h-20 text-xs bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-2"
        value={data.prompt}
        onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
        placeholder="Enter prompt text"
      />
    </BaseNode>
  );
};
