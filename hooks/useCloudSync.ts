import { useEffect, useRef } from "react";
import { ProjectData } from "../types";
import { dropFileReplacer, backupData, isProjectEmpty } from "../utils/persistence";
import { normalizeProjectData } from "../utils/projectData";

type UseCloudSyncOptions = {
  isSignedIn: boolean;
  isLoaded: boolean;
  getToken: () => Promise<string | null>;
  projectData: ProjectData;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
  setHasLoadedRemote: (val: boolean) => void;
  hasLoadedRemote: boolean;
  localBackupKey: string;
  remoteBackupKey: string;
  onError?: (err: unknown) => void;
  onConflictConfirm?: (opts: { remote: ProjectData; local: ProjectData }) => boolean;
  saveDebounceMs?: number;
};

const defaultConflictConfirm = () => true;

export const useCloudSync = ({
  isSignedIn,
  isLoaded,
  getToken,
  projectData,
  setProjectData,
  setHasLoadedRemote,
  hasLoadedRemote,
  localBackupKey,
  remoteBackupKey,
  onError,
  onConflictConfirm = defaultConflictConfirm,
  saveDebounceMs = 1200
}: UseCloudSyncOptions) => {
  const syncSaveTimeout = useRef<number | null>(null);
  const projectDataRef = useRef(projectData);
  const remoteUpdatedAtRef = useRef<number | null>(null);

  useEffect(() => {
    projectDataRef.current = projectData;
  }, [projectData]);

  // Reset loaded flag when sign-out
  useEffect(() => {
    if (!isSignedIn) setHasLoadedRemote(false);
  }, [isSignedIn, setHasLoadedRemote]);

  // Initial load
  useEffect(() => {
    if (!isSignedIn || !isLoaded || hasLoadedRemote) return;
    let cancelled = false;

    const loadRemote = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch("/api/project", {
          headers: { authorization: `Bearer ${token}` }
        });

        if (res.status === 404) {
          if (!cancelled) setHasLoadedRemote(true);
          return;
        }

        if (res.status === 401 || res.status === 403) {
          throw new Error("Unauthorized");
        }

        if (!res.ok) {
          throw new Error(`Load failed: ${res.status}`);
        }

        const data = await res.json();
        if (!cancelled && data.projectData) {
          const remotePayload = data.projectData.projectData ? data.projectData.projectData : data.projectData;
          const remote = normalizeProjectData(remotePayload);
          if (typeof data.updatedAt === "number") {
            remoteUpdatedAtRef.current = data.updatedAt;
          }
          const local = projectDataRef.current;
          const remoteHas = !isProjectEmpty(remote);
          const localHas = !isProjectEmpty(local);

          if (remoteHas && localHas) {
            const useRemote = onConflictConfirm({ remote, local });
            if (useRemote) {
              backupData(localBackupKey, local);
              setProjectData(remote);
            } else {
              backupData(remoteBackupKey, remote);
            }
          } else if (remoteHas) {
            setProjectData(remote);
          }
        }
        if (!cancelled) setHasLoadedRemote(true);
      } catch (e) {
        if (!cancelled) {
          onError?.(e);
          setHasLoadedRemote(true); // allow saves even if load failed
        }
      }
    };

    loadRemote();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isLoaded, hasLoadedRemote, getToken, onError, onConflictConfirm, localBackupKey, remoteBackupKey, setProjectData, setHasLoadedRemote]);

  // Save with debounce
  useEffect(() => {
    if (!isSignedIn || !isLoaded || !hasLoadedRemote) return;

    if (syncSaveTimeout.current) {
      clearTimeout(syncSaveTimeout.current);
    }

    syncSaveTimeout.current = window.setTimeout(async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const res = await fetch("/api/project", {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ projectData: projectDataRef.current, updatedAt: remoteUpdatedAtRef.current }, dropFileReplacer)
        });
        if (res.status === 409) {
          const data = await res.json();
          const remotePayload = data.projectData?.projectData ? data.projectData.projectData : data.projectData;
          if (remotePayload) {
            backupData(remoteBackupKey, projectDataRef.current);
            const normalized = normalizeProjectData(remotePayload);
            projectDataRef.current = normalized;
            setProjectData(normalized);
            if (typeof data.updatedAt === "number") {
              remoteUpdatedAtRef.current = data.updatedAt;
            }
          }
          return;
        }
        if (res.ok) {
          try {
            const data = await res.json();
            if (typeof data.updatedAt === "number") {
              remoteUpdatedAtRef.current = data.updatedAt;
            }
          } catch {
            // ignore parse errors
          }
        }
      } catch (e) {
        onError?.(e);
      }
    }, saveDebounceMs);

    return () => {
      if (syncSaveTimeout.current) {
        clearTimeout(syncSaveTimeout.current);
      }
    };
  }, [projectData, isSignedIn, isLoaded, hasLoadedRemote, getToken, onError, saveDebounceMs, remoteBackupKey, setProjectData]);
};
