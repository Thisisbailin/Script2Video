import React from "react";
import { BaseNode } from "./BaseNode";
import { AnnotationNodeData } from "../types";

type Props = {
  id: string;
  data: AnnotationNodeData;
};

export const AnnotationNode: React.FC<Props & { selected?: boolean }> = ({ data, selected }) => {
  return (
    <BaseNode title="Annotation Overlay" inputs={["image"]} outputs={["image"]} selected={selected}>
      <div className="space-y-3">
        {data.outputImage ? (
          <img
            src={data.outputImage}
            alt="annotated"
            className="w-full h-32 object-cover rounded-xl bg-black/40"
          />
        ) : (
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/20 py-2">Pass-through ready</div>
        )}
      </div>
    </BaseNode>
  );
};
