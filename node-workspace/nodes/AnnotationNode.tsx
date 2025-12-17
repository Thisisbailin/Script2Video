import React from "react";
import { BaseNode } from "./BaseNode";
import { AnnotationNodeData } from "../types";

type Props = {
  id: string;
  data: AnnotationNodeData;
};

export const AnnotationNode: React.FC<Props> = ({ data }) => {
  return (
    <BaseNode title="Annotation" inputs={["image"]} outputs={["image"]}>
      <div className="space-y-2">
        {data.outputImage ? (
          <img
            src={data.outputImage}
            alt="annotated"
            className="w-full h-24 object-cover rounded border border-gray-200 dark:border-gray-700"
          />
        ) : (
          <div className="text-[11px] text-gray-500">Pass-through image</div>
        )}
      </div>
    </BaseNode>
  );
};
