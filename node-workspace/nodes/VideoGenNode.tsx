import React from "react";
import { BaseNode } from "./BaseNode";
import { VideoGenNodeData } from "../types";

type Props = {
  id: string;
  data: VideoGenNodeData;
};

export const VideoGenNode: React.FC<Props> = ({ data }) => {
  return (
    <BaseNode title="Video Gen" inputs={["image", "text"]}>
      <div className="space-y-2">
        <div className="text-xs text-gray-500">Status: {data.status}</div>
        {data.videoUrl && (
          <video controls className="w-full h-24 rounded border border-gray-200 dark:border-gray-700">
            <source src={data.videoUrl} />
          </video>
        )}
        {data.error && <div className="text-xs text-red-500">{data.error}</div>}
        <div className="text-[11px] text-gray-500">Inputs: image + text</div>
      </div>
    </BaseNode>
  );
};
