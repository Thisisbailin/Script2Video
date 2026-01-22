import React from 'react';
import { AssetsBoard } from '../../components/AssetsBoard';
import { ProjectData } from '../../types';

type Props = {
  data: ProjectData;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
};

export const AssetsModule: React.FC<Props> = ({ data, setProjectData }) => {
  return <AssetsBoard data={data} setProjectData={setProjectData} />;
};
