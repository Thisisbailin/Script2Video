import React from 'react';
import { ProjectData, AppConfig, TokenUsage } from '../../types';
import { VisualAssets } from '../../components/VisualAssets';

type Props = {
  data: ProjectData;
  config: AppConfig;
  onUpdateUsage: (usage: TokenUsage) => void;
};

export const VisualsModule: React.FC<Props> = ({ data, config, onUpdateUsage }) => {
  return (
    <VisualAssets
      data={data}
      config={config}
      onUpdateUsage={onUpdateUsage}
    />
  );
};
