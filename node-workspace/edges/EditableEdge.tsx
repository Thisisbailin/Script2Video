import React, { useState } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import { WorkflowEdge } from "../types";

type Props = {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: any;
  targetPosition: any;
  data?: WorkflowEdge["data"];
  markerEnd?: string;
};

export const EditableEdge: React.FC<Props> = (props) => {
  const [edgePath, labelX, labelY] = getBezierPath(props);
  const [hover, setHover] = useState(false);

  return (
    <>
      <BaseEdge id={props.id} path={edgePath} markerEnd={props.markerEnd} style={{ strokeWidth: hover ? 2 : 1 }} />
      <EdgeLabelRenderer>
        <div
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow px-2 py-1 text-[10px]"
        >
          <div className="flex items-center gap-2">
            <span>{props.data?.hasPause ? "Pause" : "Flow"}</span>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
