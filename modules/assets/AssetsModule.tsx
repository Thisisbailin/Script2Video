import React from 'react';
import { AssetsBoard } from '../../components/AssetsBoard';
import { ProjectData } from '../../types';

type Props = {
  data: ProjectData;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
  onAssetLoad: (
    type: 'script' | 'globalStyleGuide' | 'shotGuide' | 'soraGuide' | 'dramaGuide' | 'csvShots' | 'understandingJson',
    content: string,
    fileName?: string
  ) => void;
};

export const AssetsModule: React.FC<Props> = ({ data, setProjectData, onAssetLoad }) => {
  return <AssetsBoard data={data} setProjectData={setProjectData} onAssetLoad={onAssetLoad} />;
};
