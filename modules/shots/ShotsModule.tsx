import React from 'react';
import { Shot } from '../../types';
import { ShotTable } from '../../components/ShotTable';

type Props = {
  shots: Shot[];
  showSora: boolean;
  showStoryboard: boolean;
};

export const ShotsModule: React.FC<Props> = ({ shots, showSora, showStoryboard }) => {
  return <ShotTable shots={shots} showSora={showSora} showStoryboard={showStoryboard} />;
};
