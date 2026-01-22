import React from "react";
import { ProjectData } from "../types";

interface Props {
  data: ProjectData;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
}

export const AssetsBoard: React.FC<Props> = ({ data: _data, setProjectData: _setProjectData }) => {
  return (
    <div className="h-full overflow-y-auto px-8 pt-20 pb-12 bg-transparent text-[var(--text-primary)] transition-colors">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)]/70 p-6 text-[var(--text-secondary)]">
          Project assets have moved to the Project menu.
        </div>
      </div>
    </div>
  );
};
