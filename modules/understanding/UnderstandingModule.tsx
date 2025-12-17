import React from 'react';
import { ContentBoard } from '../../components/ContentBoard';
import { ProjectData } from '../../types';

type Props = {
  data: ProjectData;
  onSelectEpisode: (index: number) => void;
};

export const UnderstandingModule: React.FC<Props> = ({ data, onSelectEpisode }) => {
  return <ContentBoard data={data} onSelectEpisode={onSelectEpisode} />;
};
