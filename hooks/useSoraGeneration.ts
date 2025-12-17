import { useCallback } from 'react';
import { AppConfig, ProjectData, TokenUsage, WorkflowStep } from '../types';
import * as GeminiService from '../services/geminiService';
import { findNextSoraIndex, isEpisodeSoraComplete } from '../utils/episodes';
import { Shot } from '../types';

type ActiveTab = 'assets' | 'script' | 'understanding' | 'table' | 'visuals' | 'video' | 'stats';

type SoraGenParams = {
  projectDataRef: React.MutableRefObject<ProjectData>;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
  config: AppConfig;
  setStep: (step: WorkflowStep) => void;
  setCurrentEpIndex: (idx: number) => void;
  setProcessing: (processing: boolean, status?: string) => void;
  setStatus: (status: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  updateStats: (phase: 'context' | 'shotGen' | 'soraGen', success: boolean) => void;
  isProcessing: boolean;
  currentEpIndex: number;
};

export const useSoraGeneration = ({
  projectDataRef,
  setProjectData,
  config,
  setStep,
  setCurrentEpIndex,
  setProcessing,
  setStatus,
  setActiveTab,
  updateStats,
  isProcessing,
  currentEpIndex
}: SoraGenParams) => {
  const generateCurrentEpisodeSora = useCallback(async (index: number, autoAdvance = false, forceRegenerate = false) => {
    const episodesList = projectDataRef.current.episodes || [];
    if (index >= episodesList.length) {
      setStep(WorkflowStep.COMPLETED);
      alert("All Prompts Generated! Workflow is ready for Video Studio.");
      setCurrentEpIndex(0);
      setProcessing(false);
      return;
    }

    const episode = episodesList[index];
    if (!episode) return;

    if (episode.shots.length === 0 || isEpisodeSoraComplete(episode)) {
      const nextIndex = findNextSoraIndex(projectDataRef.current.episodes || [], index + 1);
      if (nextIndex === -1) {
        setStep(WorkflowStep.COMPLETED);
        alert("All Prompts Generated! Workflow is ready for Video Studio.");
        setCurrentEpIndex(0);
        setProcessing(false);
        return;
      }
      setCurrentEpIndex(nextIndex);
      return generateCurrentEpisodeSora(nextIndex);
    }

    const shouldResume = episode.status === 'error';
    setProcessing(true, `Generating Sora Prompts for Episode ${episode.id}...`);

    setProjectData(prev => {
      const newEpisodes = [...prev.episodes];
      newEpisodes[index] = { ...newEpisodes[index], status: 'generating_sora', errorMsg: undefined };
      const updated = { ...prev, episodes: newEpisodes };
      projectDataRef.current = updated;
      return updated;
    });

    try {
      const chunksMap = new Map<string, Shot[]>();
      episode.shots.forEach(shot => {
        const parts = shot.id.split('-');
        let sceneKey = 'default';
        if (parts.length > 1) {
          const prefixParts = parts.slice(0, parts.length - 1);
          sceneKey = prefixParts.join('-');
        }
        if (!chunksMap.has(sceneKey)) chunksMap.set(sceneKey, []);
        chunksMap.get(sceneKey)?.push(shot);
      });
      const shotChunks: Shot[][] = Array.from(chunksMap.values());
      const { context, soraGuide, globalStyleGuide } = projectDataRef.current;

      let currentTotalUsage: TokenUsage = shouldResume && episode.soraGenUsage
        ? episode.soraGenUsage
        : { promptTokens: 0, responseTokens: 0, totalTokens: 0 };

      for (let i = 0; i < shotChunks.length; i++) {
        const chunk = shotChunks[i];
        const sceneId = chunk[0].id.split('-').slice(0, -1).join('-');
        const isChunkComplete = chunk.every(s => s.soraPrompt && s.soraPrompt.trim().length > 0);
        if (shouldResume && isChunkComplete && !forceRegenerate) {
          setStatus(`Skipping completed Scene ${sceneId} (${i + 1}/${shotChunks.length})...`);
          await new Promise(r => setTimeout(r, 100));
          continue;
        }

        setStatus(`Episode ${episode.id}: Processing Scene ${sceneId} (${i + 1}/${shotChunks.length})...`);

        const result = await GeminiService.generateSoraPrompts(
          config.textConfig,
          chunk,
          context,
          soraGuide,
          globalStyleGuide
        );

        currentTotalUsage = GeminiService.addUsage(currentTotalUsage, result.usage);

        setProjectData(prev => {
          const newEpisodes = [...prev.episodes];
          const currentEp = newEpisodes[index];
          const mergedShots = currentEp.shots.map(originalShot => {
            const foundNew = result.partialShots.find(ns => ns.id === originalShot.id);
            if (foundNew) {
              return { ...originalShot, soraPrompt: foundNew.soraPrompt };
            }
            return originalShot;
          });

          newEpisodes[index] = {
            ...currentEp,
            shots: mergedShots,
            soraGenUsage: currentTotalUsage
          };
          const updated = { ...prev, episodes: newEpisodes };
          projectDataRef.current = updated;
          return updated;
        });
        await new Promise(r => setTimeout(r, 500));
      }

      setProjectData(prev => {
        const newEpisodes = [...prev.episodes];
        newEpisodes[index] = {
          ...newEpisodes[index],
          soraGenUsage: currentTotalUsage,
          status: 'review_sora'
        };
        const updated = { ...prev, episodes: newEpisodes };
        projectDataRef.current = updated;
        return updated;
      });

      updateStats('soraGen', true);
      setActiveTab('table');
      setProcessing(false);
      setCurrentEpIndex(index);

      const remaining = findNextSoraIndex(projectDataRef.current.episodes || [], 0);
      if (remaining === -1) {
        setStep(WorkflowStep.COMPLETED);
        alert("All Prompts Generated! Workflow is ready for Video Studio.");
        setCurrentEpIndex(0);
        return;
      }

      if (autoAdvance) {
        setCurrentEpIndex(remaining);
        return generateCurrentEpisodeSora(remaining, true);
      }
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
      updateStats('soraGen', false);
    }
  }, [config, projectDataRef, setActiveTab, setCurrentEpIndex, setProcessing, setProjectData, setStatus, setStep, updateStats]);

  const startPhase3 = useCallback(() => {
    const data = projectDataRef.current;
    if (!data.soraGuide) {
      alert("Please upload Sora Prompt Guidelines.");
      return;
    }
    if (data.episodes.every(ep => ep.shots.length === 0)) {
      alert("No shots found to generate prompts for. Please complete Phase 2 or Import a Shot List CSV.");
      return;
    }
    const pendingFromCurrent = findNextSoraIndex(projectDataRef.current.episodes || [], currentEpIndex);
    const startIndex = pendingFromCurrent !== -1 ? pendingFromCurrent : findNextSoraIndex(projectDataRef.current.episodes || [], 0);
    if (startIndex === -1) {
      alert("All Prompts Generated! Workflow is ready for Video Studio.");
      setStep(WorkflowStep.COMPLETED);
      setCurrentEpIndex(0);
      return;
    }
    setStep(WorkflowStep.GENERATE_SORA);
    setCurrentEpIndex(startIndex);
    generateCurrentEpisodeSora(startIndex, false);
  }, [currentEpIndex, generateCurrentEpisodeSora, projectDataRef, setCurrentEpIndex, setStep]);

  const continueNextEpisodeSora = useCallback(() => {
    if (isProcessing) return;
    const nextIndex = findNextSoraIndex(projectDataRef.current.episodes || [], currentEpIndex + 1);
    if (nextIndex === -1) {
      alert("All Prompts Generated! Workflow is ready for Video Studio.");
      setStep(WorkflowStep.COMPLETED);
      setCurrentEpIndex(0);
      return;
    }
    setCurrentEpIndex(nextIndex);
    generateCurrentEpisodeSora(nextIndex, false);
  }, [currentEpIndex, generateCurrentEpisodeSora, isProcessing, projectDataRef, setCurrentEpIndex, setStep]);

  const retryCurrentEpisodeSora = useCallback(() => {
    if (isProcessing) return;
    const idx = currentEpIndex;
    const targetEp = projectDataRef.current.episodes[idx];
    if (!targetEp) return;

    setProjectData(prev => {
      const newEpisodes = [...prev.episodes];
      const ep = newEpisodes[idx];
      if (ep) {
        const clearedShots = ep.shots.map(s => ({ ...s, soraPrompt: '' }));
        newEpisodes[idx] = { ...ep, shots: clearedShots, soraGenUsage: undefined, status: 'pending' as any };
      }
      const updated = { ...prev, episodes: newEpisodes };
      projectDataRef.current = updated;
      return updated;
    });
    generateCurrentEpisodeSora(idx, false, true);
  }, [currentEpIndex, generateCurrentEpisodeSora, isProcessing, projectDataRef, setProjectData]);

  return {
    startPhase3,
    continueNextEpisodeSora,
    retryCurrentEpisodeSora
  };
};
