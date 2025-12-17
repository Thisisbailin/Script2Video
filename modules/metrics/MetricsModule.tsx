import React from 'react';
import { Dashboard } from '../../components/Dashboard';
import { ProjectData } from '../../types';

type Props = {
  data: ProjectData;
  isDarkMode: boolean;
};

export const MetricsModule: React.FC<Props> = ({ data, isDarkMode }) => {
  return <Dashboard data={data} isDarkMode={isDarkMode} />;
};
