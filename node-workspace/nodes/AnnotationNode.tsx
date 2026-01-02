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
      <div className="space-y-4 flex-1 flex flex-col">
        {data.outputImage ? (
          <div className="node-surface relative overflow-hidden rounded-[20px] shadow-[0_18px_40px_rgba(0,0,0,0.4)]">
            <img
              src={data.outputImage}
              alt="annotated"
              className="w-full h-32 object-cover transition-transform duration-700 hover:scale-105"
            />
          </div>
        ) : (
          <div className="node-surface node-surface--dashed w-full py-6 rounded-[20px] flex flex-col items-center justify-center">
            <span className="text-[10px] opacity-40 uppercase tracking-[0.2em] font-black italic">No Overlay</span>
          </div>
        )}
      </div>
    </BaseNode>
  );
};
