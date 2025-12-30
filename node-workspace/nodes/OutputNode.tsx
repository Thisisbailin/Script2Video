import React from "react";
import { BaseNode } from "./BaseNode";
import { OutputNodeData } from "../types";

type Props = {
  id: string;
  data: OutputNodeData;
};

export const OutputNode: React.FC<Props> = ({ data }) => {
  return (
    <BaseNode title="Final Asset" inputs={["image", "text"]}>
      <div className="space-y-4 flex-1 flex flex-col">
        {data.image && (
          <div className="relative overflow-hidden rounded-[20px] bg-[var(--node-textarea-bg)] shadow-md">
            <img
              src={data.image}
              alt="output"
              className="w-full h-32 object-cover transition-transform duration-700 hover:scale-105"
            />
          </div>
        )}
        {data.text && (
          <div className="node-textarea text-[11px] leading-relaxed font-bold p-3">
            <pre className="whitespace-pre-wrap">{data.text}</pre>
          </div>
        )}
      </div>
    </BaseNode>
  );
};
