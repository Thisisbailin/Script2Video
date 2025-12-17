import React from 'react';
import { Episode, VideoParams } from '../../types';
import { VideoStudio } from '../../components/VideoStudio';

type Props = {
  episodes: Episode[];
  onGenerateVideo: (episodeId: number, shotId: string, params: VideoParams) => Promise<void>;
  onRemixVideo: (episodeId: number, shotId: string, originalVideoId: string, customPrompt: string) => Promise<void>;
};

export const VideoModule: React.FC<Props> = ({ episodes, onGenerateVideo, onRemixVideo }) => {
  return (
    <VideoStudio
      episodes={episodes}
      onGenerateVideo={onGenerateVideo}
      onRemixVideo={onRemixVideo}
    />
  );
};
