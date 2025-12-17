import { useEffect } from "react";
import { Episode, VideoServiceConfig } from "../types";
import * as VideoService from "../services/videoService";

type UseVideoPollingOptions = {
  episodes: Episode[];
  videoConfig: VideoServiceConfig;
  onUpdate: (updater: (prev: { episodes: Episode[] }) => { episodes: Episode[] }) => void;
  intervalMs?: number;
  onError?: (err: unknown) => void;
};

/**
 * useVideoPolling
 * Polls video tasks and updates episode/shot status. Marks errors on failure.
 */
export const useVideoPolling = ({
  episodes,
  videoConfig,
  onUpdate,
  intervalMs = 5000,
  onError,
}: UseVideoPollingOptions) => {
  useEffect(() => {
    const intervalId = setInterval(async () => {
      // Identify shots that need checking
      const tasksToCheck: { epId: number; shotId: string; taskId: string }[] = [];

      episodes.forEach((ep) => {
        ep.shots.forEach((s) => {
          if ((s.videoStatus === "queued" || s.videoStatus === "generating") && s.videoId) {
            tasksToCheck.push({ epId: ep.id, shotId: s.id, taskId: s.videoId });
          }
        });
      });

      if (tasksToCheck.length === 0) return;
      if (!videoConfig.baseUrl || !videoConfig.apiKey) return;

      for (const task of tasksToCheck) {
        try {
          const result = await VideoService.checkTaskStatus(task.taskId, videoConfig);

          // Completed or failed
          if (result.status !== "processing" && result.status !== "queued") {
            onUpdate((prev) => {
              const newEpisodes = prev.episodes.map((e) => {
                if (e.id === task.epId) {
                  return {
                    ...e,
                    shots: e.shots.map((s) =>
                      s.id === task.shotId
                        ? {
                            ...s,
                            videoStatus: result.status === "succeeded" ? "completed" : "error",
                            videoUrl: result.url,
                            videoErrorMsg: result.errorMsg,
                          }
                        : s
                    ),
                  };
                }
                return e;
              });
              return { ...prev, episodes: newEpisodes };
            });
          }
          // Moved to processing
          else if (result.status === "processing") {
            onUpdate((prev) => {
              const newEpisodes = prev.episodes.map((e) => {
                if (e.id === task.epId) {
                  return {
                    ...e,
                    shots: e.shots.map((s) =>
                      s.id === task.shotId && s.videoStatus === "queued"
                        ? { ...s, videoStatus: "generating" }
                        : s
                    ),
                  };
                }
                return e;
              });
              return { ...prev, episodes: newEpisodes };
            });
          }
        } catch (e) {
          onError?.(e);
          // Mark as error to avoid endless queue if API consistently fails
          onUpdate((prev) => {
            const newEpisodes = prev.episodes.map((ep) => {
              if (ep.id === task.epId) {
                return {
                  ...ep,
                  shots: ep.shots.map((s) =>
                    s.id === task.shotId
                      ? {
                          ...s,
                          videoStatus: "error",
                          videoErrorMsg: (e as any)?.message || "Polling error",
                        }
                      : s
                  ),
                };
              }
              return ep;
            });
            return { ...prev, episodes: newEpisodes };
          });
        }
      }
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [episodes, videoConfig, onUpdate, intervalMs, onError]);
};
