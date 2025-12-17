import React from "react";
import { BaseNode } from "./BaseNode";
import { OutputNodeData } from "../types";

type Props = {
  id: string;
  data: OutputNodeData;
};

export const OutputNode: React.FC<Props> = ({ data }) => {
  return (
    <BaseNode title="Output" inputs={["image"]}>
      <div className="space-y-2">
        {data.image && (
          <img src={data.image} alt="output" className="w-full h-24 object-cover rounded border border-gray-200 dark:border-gray-700" />
        )}
        {data.text && <pre className="text-xs whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 rounded p-2">{data.text}</pre>}
      </div>
    </BaseNode>
  );
};
