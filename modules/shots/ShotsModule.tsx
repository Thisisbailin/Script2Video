import React from 'react';
import { Shot } from '../../types';
import { ShotTable } from '../../components/ShotTable';

type Props = {
  shots: Shot[];
  showSora: boolean;
};

export const ShotsModule: React.FC<Props> = ({ shots, showSora }) => {
  return <ShotTable shots={shots} showSora={showSora} />;
};
