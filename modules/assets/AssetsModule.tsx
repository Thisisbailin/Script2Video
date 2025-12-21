import React from 'react';
import { AssetsBoard } from '../../components/AssetsBoard';
import { ProjectData } from '../../types';

type Props = {
  data: ProjectData;
  onAssetLoad: (type: 'script' | 'globalStyleGuide' | 'shotGuide' | 'soraGuide' | 'dramaGuide' | 'csvShots', content: string, fileName?: string) => void;
};

export const AssetsModule: React.FC<Props> = ({ data, onAssetLoad }) => {
  return <AssetsBoard data={data} onAssetLoad={onAssetLoad} />;
};
