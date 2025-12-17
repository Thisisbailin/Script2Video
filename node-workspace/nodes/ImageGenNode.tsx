import React from "react";
import { BaseNode } from "./BaseNode";
import { ImageGenNodeData } from "../types";

type Props = {
  id: string;
  data: ImageGenNodeData;
};

export const ImageGenNode: React.FC<Props> = ({ data }) => {
  return (
    <BaseNode title="Image Gen" inputs={["image", "text"]} outputs={["image"]}>
      <div className="space-y-2">
        <div className="text-xs text-gray-500">Status: {data.status}</div>
        {data.outputImage && (
          <img
            src={data.outputImage}
            alt="generated"
            className="w-full h-24 object-cover rounded border border-gray-200 dark:border-gray-700"
          />
        )}
        {data.error && <div className="text-xs text-red-500">{data.error}</div>}
        <div className="text-[11px] text-gray-500">Inputs: image + text</div>
      </div>
    </BaseNode>
  );
};
