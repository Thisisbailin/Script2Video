import { useCallback } from 'react';
import { AppConfig, ProjectData, WorkflowStep } from '../types';
import * as GeminiService from '../services/geminiService';

type ActiveTab = 'assets' | 'script' | 'understanding' | 'table' | 'visuals' | 'video' | 'stats';

type ShotGenParams = {
  projectDataRef: React.MutableRefObject<ProjectData>;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
  config: AppConfig;
  setStep: (step: WorkflowStep) => void;
  setCurrentEpIndex: (idx: number) => void;
  setProcessing: (processing: boolean, status?: string) => void;
  setStatus: (status: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  updateStats: (phase: 'context' | 'shotGen' | 'soraGen', success: boolean) => void;
  currentEpIndex: number;
};

export const useShotGeneration = ({
  projectDataRef,
  setProjectData,
  config,
  setStep,
  setCurrentEpIndex,
  setProcessing,
  setStatus,
  setActiveTab,
  updateStats,
  currentEpIndex,
}: ShotGenParams) => {
  const generateCurrentEpisodeShots = useCallback(async (index: number) => {
    const episodes = projectDataRef.current.episodes;

    if (index >= episodes.length) {
      setStep(WorkflowStep.GENERATE_SORA);
      alert("All episodes converted to Shot Lists! Ready for Sora Phase.");
      setCurrentEpIndex(0);
      setProcessing(false);
      return;
    }

    const episode = episodes[index];
    if (episode.shots.length > 0 && (episode.status === 'confirmed_shots' || episode.status === 'completed')) {
      const next = index + 1;
      setCurrentEpIndex(next);
      return generateCurrentEpisodeShots(next);
    }

    setProcessing(true, `Generating Shots for Episode ${episode.id}...`);

    setProjectData(prev => {
      const newEpisodes = [...prev.episodes];
      newEpisodes[index] = { ...newEpisodes[index], status: 'generating', errorMsg: undefined };
      const updated = { ...prev, episodes: newEpisodes };
      projectDataRef.current = updated;
      return updated;
    });

    try {
      const result = await GeminiService.generateEpisodeShots(
        config.textConfig,
        episode.title,
        episode.content,
        episode.summary,
        projectDataRef.current.context,
        projectDataRef.current.shotGuide,
        index,
        projectDataRef.current.globalStyleGuide
      );

      setProjectData(prev => {
        const newEpisodes = [...prev.episodes];
        newEpisodes[index] = {
          ...newEpisodes[index],
          shots: result.shots,
          shotGenUsage: result.usage,
          status: 'confirmed_shots'
        };
        const updated = { ...prev, episodes: newEpisodes };
        projectDataRef.current = updated;
        return updated;
      });

      updateStats('shotGen', true);
      setActiveTab('table');

      const nextIndex = index + 1;
      if (nextIndex < projectDataRef.current.episodes.length) {
        setCurrentEpIndex(nextIndex);
        return generateCurrentEpisodeShots(nextIndex);
      }

      setProcessing(false);
      alert("Phase 2 Complete! Please upload Sora Guide to proceed.");
      setStep(WorkflowStep.GENERATE_SORA);
      setCurrentEpIndex(0);
    } catch (e: any) {
      console.error(e);
      setProjectData(prev => {
        const newEpisodes = [...prev.episodes];
        newEpisodes[index] = {
          ...newEpisodes[index],
          status: 'error',
          errorMsg: e.message || "Unknown error"
        };
        const updated = { ...prev, episodes: newEpisodes };
        projectDataRef.current = updated;
        return updated;
      });
      setStatus(`Error on Episode ${episode.id}`);
      setProcessing(false);
      updateStats('shotGen', false);
    }
  }, [config, projectDataRef, setActiveTab, setCurrentEpIndex, setProcessing, setProjectData, setStatus, setStep, updateStats]);

  const startPhase2 = useCallback(() => {
    const data = projectDataRef.current;
    const allEpisodesHaveShots = data.episodes.every(ep => ep.shots.length > 0);

    if (allEpisodesHaveShots) {
      const confirmSkip = window.confirm(
        "Detected existing shot lists for all episodes (likely from import).\n\nDo you want to SKIP Shot Generation and proceed directly to Phase 3 (Sora Prompts)?"
      );
      if (confirmSkip) {
        setStep(WorkflowStep.GENERATE_SORA);
        return;
      }
    }

    setStep(WorkflowStep.GENERATE_SHOTS);
    setCurrentEpIndex(0);
    const firstPending = data.episodes.findIndex(ep => ep.shots.length === 0);
    const startIdx = firstPending >= 0 ? firstPending : 0;
    setCurrentEpIndex(startIdx);

    if (firstPending === -1 && !allEpisodesHaveShots) {
      generateCurrentEpisodeShots(0);
    } else if (firstPending >= 0) {
      generateCurrentEpisodeShots(startIdx);
    } else {
      generateCurrentEpisodeShots(0);
    }
  }, [generateCurrentEpisodeShots, projectDataRef, setCurrentEpIndex, setStep]);

  const confirmEpisodeShots = useCallback((targetIndex?: number) => {
    const index = typeof targetIndex === 'number' ? targetIndex : currentEpIndex;
    setProjectData(prev => {
      const newEpisodes = [...prev.episodes];
      newEpisodes[index].status = 'confirmed_shots';
      const updated = { ...prev, episodes: newEpisodes };
      projectDataRef.current = updated;
      return updated;
    });

    const nextIndex = index + 1;
    if (nextIndex < projectDataRef.current.episodes.length) {
      setCurrentEpIndex(nextIndex);
      generateCurrentEpisodeShots(nextIndex);
    } else {
      alert("Phase 2 Complete! Please upload Sora Guide to proceed.");
      setStep(WorkflowStep.GENERATE_SORA);
      setCurrentEpIndex(0);
    }
  }, [currentEpIndex, generateCurrentEpisodeShots, projectDataRef, setCurrentEpIndex, setProjectData, setStep]);

  return {
    startPhase2,
    confirmEpisodeShots,
    retryCurrentEpisodeShots: () => generateCurrentEpisodeShots(currentEpIndex)
  };
};
