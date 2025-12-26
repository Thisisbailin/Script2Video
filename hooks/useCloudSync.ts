import { useCallback, useEffect, useRef } from "react";
import { ProjectData, SyncStatus } from "../types";
import { dropFileReplacer, backupData, isProjectEmpty } from "../utils/persistence";
import { validateProjectData } from "../utils/validation";
import { applyProjectPatch, computeProjectPatch, ProjectPatch } from "../utils/patch";
import { normalizeProjectData } from "../utils/projectData";
import { getDeviceId } from "../utils/device";
import { mergeProjectData } from "../utils/merge";

type UseCloudSyncOptions = {
  isSignedIn: boolean;
  isLoaded: boolean;
  getToken: () => Promise<string | null>;
  projectData: ProjectData;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
  setHasLoadedRemote: (val: boolean) => void;
  hasLoadedRemote: boolean;
  refreshKey?: number;
  localBackupKey: string;
  remoteBackupKey: string;
  onError?: (err: unknown) => void;
  onConflictConfirm?: (opts: { remote: ProjectData; local: ProjectData }) => Promise<boolean> | boolean;
  onConflictNotice?: (opts: { remote: ProjectData; local: ProjectData; merged: ProjectData; conflicts: string[] }) => void;
  saveDebounceMs?: number;
  onStatusChange?: (status: SyncStatus, detail?: { lastSyncAt?: number; error?: string; pendingOps?: number; retryCount?: number; lastAttemptAt?: number }) => void;
};

const defaultConflictConfirm = async () => true;

export const useCloudSync = ({
  isSignedIn,
  isLoaded,
  getToken,
  projectData,
  setProjectData,
  setHasLoadedRemote,
  hasLoadedRemote,
  refreshKey,
  localBackupKey,
  remoteBackupKey,
  onError,
  onConflictConfirm = defaultConflictConfirm,
  onConflictNotice,
  saveDebounceMs = 1200,
  onStatusChange
}: UseCloudSyncOptions) => {
  const MAX_RETRIES = 10;
  const syncSaveTimeout = useRef<number | null>(null);
  const retryTimeout = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const projectDataRef = useRef(projectData);
  const remoteUpdatedAtRef = useRef<number | null>(null);
  const remoteHasDataRef = useRef<boolean | null>(null);
  const pendingOpRef = useRef<{ id: string; data: ProjectData; baseVersion: number; patch?: ProjectPatch } | null>(null);
  const isSavingRef = useRef(false);
  const saveRetryTimeout = useRef<number | null>(null);
  const saveRetryCountRef = useRef(0);
  const lastRefreshKeyRef = useRef<number | null>(null);
  const syncBlockedRef = useRef<string | null>(null);
  const lastSyncedRef = useRef<ProjectData | null>(null);
  const statusRef = useRef<SyncStatus>('idle');
  const deviceIdRef = useRef<string>(getDeviceId());
  const isLoadingRef = useRef(false);
  const onErrorRef = useRef(onError);
  const onStatusChangeRef = useRef(onStatusChange);
  const onConflictConfirmRef = useRef(onConflictConfirm);
  const onConflictNoticeRef = useRef(onConflictNotice);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onConflictConfirmRef.current = onConflictConfirm;
  }, [onConflictConfirm]);

  useEffect(() => {
    onConflictNoticeRef.current = onConflictNotice;
  }, [onConflictNotice]);

  const isPatchEmpty = (patch: ProjectPatch) =>
    Object.keys(patch.set).length === 0 && patch.unset.length === 0;

  const emitStatus = useCallback((status: SyncStatus, detail?: { lastSyncAt?: number; error?: string; pendingOps?: number; retryCount?: number; lastAttemptAt?: number }) => {
    statusRef.current = status;
    onStatusChangeRef.current?.(status, detail);
  }, []);

  const tryAutoMerge = (remote: ProjectData, local: ProjectData, updatedAt?: number, resetSaving = false) => {
    const result = mergeProjectData(remote, local);
    const conflictNotice = onConflictNoticeRef.current;
    if (result.conflicts.length > 0 && !conflictNotice) {
      return false;
    }
    const validation = validateProjectData(result.merged);
    const mergedData = validation.ok ? result.merged : remote;
    backupData(localBackupKey, local);
    backupData(remoteBackupKey, remote);
    projectDataRef.current = mergedData;
    setProjectData(mergedData);
    lastSyncedRef.current = remote;
    remoteHasDataRef.current = !isProjectEmpty(mergedData);
    if (typeof updatedAt === "number") {
      remoteUpdatedAtRef.current = updatedAt;
    }
    if (resetSaving) {
      isSavingRef.current = false;
    }
    const patch = computeProjectPatch(mergedData, remote);
    if (isPatchEmpty(patch)) {
      pendingOpRef.current = null;
      emitStatus('synced', { lastSyncAt: remoteUpdatedAtRef.current ?? undefined, pendingOps: 0, retryCount: saveRetryCountRef.current });
      if (result.conflicts.length > 0) {
        conflictNotice?.({ remote, local, merged: mergedData, conflicts: result.conflicts });
      }
      return true;
    }
    enqueueSave(mergedData, remoteUpdatedAtRef.current ?? 0);
    if (result.conflicts.length > 0) {
      conflictNotice?.({ remote, local, merged: mergedData, conflicts: result.conflicts });
    }
    return true;
  };

  useEffect(() => {
    projectDataRef.current = projectData;
  }, [projectData]);

  const createOpId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const flushSaveQueue = async () => {
    if (!isSignedIn || !isLoaded || !hasLoadedRemote) return;
    if (isSavingRef.current) return;
    const op = pendingOpRef.current;
    if (!op) return;
    if (saveRetryTimeout.current) {
      window.clearTimeout(saveRetryTimeout.current);
      saveRetryTimeout.current = null;
    }
    isSavingRef.current = true;
    const attemptAt = Date.now();
    emitStatus('syncing', { pendingOps: 1, retryCount: saveRetryCountRef.current, lastAttemptAt: attemptAt });

    try {
      const token = await getToken();
      if (!token) {
        isSavingRef.current = false;
        return;
      }
      const res = await fetch("/api/project", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "x-device-id": deviceIdRef.current
        },
        body: JSON.stringify(
          op.patch
            ? { patch: op.patch, updatedAt: op.baseVersion, opId: op.id }
            : { projectData: op.data, updatedAt: op.baseVersion, opId: op.id },
          dropFileReplacer
        )
      });

      if (res.status === 409) {
        emitStatus('conflict', { pendingOps: 1, retryCount: saveRetryCountRef.current, lastAttemptAt: attemptAt });
        const data = await res.json().catch(() => null);
        const remotePayload = data?.projectData?.projectData ? data.projectData.projectData : data?.projectData;
        if (remotePayload) {
          const normalized = normalizeProjectData(remotePayload);
          const local = projectDataRef.current;
          const baseVersion = typeof data?.updatedAt === "number" ? data.updatedAt : (remoteUpdatedAtRef.current ?? 0);
          if (tryAutoMerge(normalized, local, baseVersion, true)) {
            if (pendingOpRef.current?.id === op.id) pendingOpRef.current = null;
            if (pendingOpRef.current) {
              emitStatus('syncing', { pendingOps: 1, retryCount: saveRetryCountRef.current, lastAttemptAt: attemptAt });
            }
            return;
          }
          const useRemote = await Promise.resolve(onConflictConfirmRef.current({ remote: normalized, local }));
          if (useRemote) {
            backupData(localBackupKey, local);
            projectDataRef.current = normalized;
            setProjectData(normalized);
            if (pendingOpRef.current?.id === op.id) pendingOpRef.current = null;
            remoteHasDataRef.current = !isProjectEmpty(normalized);
            if (typeof data?.updatedAt === "number") {
              remoteUpdatedAtRef.current = data.updatedAt;
            }
            emitStatus('synced', { lastSyncAt: remoteUpdatedAtRef.current ?? undefined, pendingOps: pendingOpRef.current ? 1 : 0, retryCount: saveRetryCountRef.current });
          } else {
            backupData(remoteBackupKey, normalized);
            if (typeof data?.updatedAt === "number") {
              remoteUpdatedAtRef.current = data.updatedAt;
            }
            pendingOpRef.current = {
              id: createOpId(),
              data: local,
              baseVersion: remoteUpdatedAtRef.current ?? 0
            };
            emitStatus(statusRef.current, { pendingOps: 1, retryCount: saveRetryCountRef.current });
          }
        }
        isSavingRef.current = false;
        if (pendingOpRef.current) void flushSaveQueue();
        return;
      }

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => null);
        const detail = errorPayload?.detail || errorPayload?.error;
        if (detail) {
          throw new Error(`Save failed: ${detail}`);
        }
        throw new Error(`Save failed: ${res.status}`);
      }

      const data = await res.json().catch(() => null);
      if (typeof data?.updatedAt === "number") {
        remoteUpdatedAtRef.current = data.updatedAt;
      }
      remoteHasDataRef.current = !isProjectEmpty(op.data);
      lastSyncedRef.current = op.data;
      if (pendingOpRef.current?.id === op.id) pendingOpRef.current = null;
      saveRetryCountRef.current = 0;
      emitStatus('synced', { lastSyncAt: remoteUpdatedAtRef.current ?? undefined, pendingOps: pendingOpRef.current ? 1 : 0, retryCount: saveRetryCountRef.current });
      isSavingRef.current = false;
      if (pendingOpRef.current) void flushSaveQueue();
    } catch (e) {
      onErrorRef.current?.(e);
      const message = e instanceof Error ? e.message : "Failed to save project";
      emitStatus('error', { error: message, pendingOps: pendingOpRef.current ? 1 : 0, retryCount: saveRetryCountRef.current, lastAttemptAt: Date.now() });
      isSavingRef.current = false;
      if (saveRetryCountRef.current >= MAX_RETRIES) {
        const error = "Sync failed after 10 retries. Please sign in again or check your Clerk JWT template.";
        syncBlockedRef.current = error;
        emitStatus('error', { error, pendingOps: pendingOpRef.current ? 1 : 0, retryCount: saveRetryCountRef.current, lastAttemptAt: Date.now() });
        return;
      }
      const delay = Math.min(1000 * Math.pow(2, saveRetryCountRef.current), 15000);
      saveRetryCountRef.current += 1;
      if (saveRetryTimeout.current) window.clearTimeout(saveRetryTimeout.current);
      saveRetryTimeout.current = window.setTimeout(() => {
        void flushSaveQueue();
      }, delay);
    }
  };

  const enqueueSave = (data: ProjectData, baseVersion?: number | null) => {
    if (syncBlockedRef.current) {
      emitStatus('error', { error: syncBlockedRef.current, pendingOps: pendingOpRef.current ? 1 : 0, retryCount: saveRetryCountRef.current });
      return;
    }
    const validation = validateProjectData(data);
    if (!validation.ok) {
      emitStatus('error', { error: validation.error, pendingOps: pendingOpRef.current ? 1 : 0, retryCount: saveRetryCountRef.current });
      return;
    }
    const patch = computeProjectPatch(data, lastSyncedRef.current);
    pendingOpRef.current = {
      id: createOpId(),
      data,
      baseVersion: typeof baseVersion === "number" ? baseVersion : (remoteUpdatedAtRef.current ?? 0),
      patch
    };
    if (saveRetryTimeout.current) {
      window.clearTimeout(saveRetryTimeout.current);
      saveRetryTimeout.current = null;
      saveRetryCountRef.current = 0;
    }
    emitStatus(statusRef.current, { pendingOps: 1, retryCount: saveRetryCountRef.current });
    void flushSaveQueue();
  };

  // Reset loaded flag when sign-out
  useEffect(() => {
    if (!isSignedIn) {
      setHasLoadedRemote(false);
      pendingOpRef.current = null;
      isSavingRef.current = false;
      syncBlockedRef.current = null;
      if (saveRetryTimeout.current) {
        window.clearTimeout(saveRetryTimeout.current);
        saveRetryTimeout.current = null;
      }
      saveRetryCountRef.current = 0;
    }
  }, [isSignedIn, setHasLoadedRemote]);

  useEffect(() => {
    if (hasLoadedRemote && pendingOpRef.current) {
      void flushSaveQueue();
    }
  }, [hasLoadedRemote]);

  useEffect(() => {
    return () => {
      if (saveRetryTimeout.current) {
        window.clearTimeout(saveRetryTimeout.current);
      }
    };
  }, []);

  // Initial load
  useEffect(() => {
    if (!isSignedIn || !isLoaded) return;
    const refreshChanged = typeof refreshKey === "number" && refreshKey !== lastRefreshKeyRef.current;
    if (hasLoadedRemote && !refreshChanged) return;
    if (refreshChanged) lastRefreshKeyRef.current = refreshKey ?? null;
    let cancelled = false;
    emitStatus('loading', { retryCount: retryCountRef.current, pendingOps: pendingOpRef.current ? 1 : 0 });

    const scheduleRetry = (loadFn: () => void) => {
      if (cancelled || hasLoadedRemote) return;
      if (retryCountRef.current >= MAX_RETRIES) {
        const error = "Sync failed after 10 retries. Please sign in again or check your Clerk JWT template.";
        syncBlockedRef.current = error;
        emitStatus('error', { error, retryCount: retryCountRef.current, pendingOps: pendingOpRef.current ? 1 : 0 });
        if (!cancelled) setHasLoadedRemote(true);
        return;
      }
      if (retryTimeout.current) window.clearTimeout(retryTimeout.current);
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 15000);
      retryCountRef.current += 1;
      emitStatus('loading', { retryCount: retryCountRef.current, pendingOps: pendingOpRef.current ? 1 : 0 });
      retryTimeout.current = window.setTimeout(loadFn, delay);
    };

    const saveNow = async (data: ProjectData, updatedAt?: number | null) => {
      enqueueSave(data, updatedAt ?? remoteUpdatedAtRef.current);
    };

    const loadRemote = async () => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      try {
        const token = await getToken();
        if (!token) {
          scheduleRetry(loadRemote);
          return;
        }

        const localDirty = lastSyncedRef.current
          ? !isPatchEmpty(computeProjectPatch(projectDataRef.current, lastSyncedRef.current))
          : true;
        const canUseDelta = refreshChanged && hasLoadedRemote && !!remoteUpdatedAtRef.current && !localDirty && !pendingOpRef.current && !isSavingRef.current;
        if (canUseDelta) {
          emitStatus('syncing', { pendingOps: pendingOpRef.current ? 1 : 0, retryCount: retryCountRef.current });
          let cursor = remoteUpdatedAtRef.current ?? 0;
          let next = lastSyncedRef.current ?? projectDataRef.current;
          let sawChanges = false;
          let latestVersion = remoteUpdatedAtRef.current ?? 0;
          let hasMore = true;
          let guard = 0;

          while (hasMore && guard < 5) {
            const deltaRes = await fetch(`/api/project-changes?since=${cursor}`, {
              headers: {
                authorization: `Bearer ${token}`,
                "x-device-id": deviceIdRef.current
              }
            });
            if (deltaRes.status === 403) {
              emitStatus('error', { error: "Sync disabled for this account.", pendingOps: pendingOpRef.current ? 1 : 0, retryCount: retryCountRef.current });
              if (!cancelled) setHasLoadedRemote(true);
              return;
            }
            if (!deltaRes.ok) break;

            const deltaData = await deltaRes.json().catch(() => null);
            const changes = Array.isArray(deltaData?.changes) ? deltaData.changes : [];
            for (const change of changes) {
              if (change && typeof change === "object" && change.patch) {
                next = applyProjectPatch(next, change.patch);
                if (typeof change.version === "number") {
                  cursor = change.version;
                }
                sawChanges = true;
              }
            }
            if (typeof deltaData?.latestVersion === "number") {
              latestVersion = deltaData.latestVersion;
            }
            hasMore = !!deltaData?.hasMore && changes.length > 0;
            guard += 1;
            if (changes.length === 0) break;
          }

          if (guard > 0 && !hasMore) {
            const normalized = normalizeProjectData(next);
            const validation = validateProjectData(normalized);
            if (!validation.ok) {
              syncBlockedRef.current = `Remote delta invalid: ${validation.error}`;
              emitStatus('error', { error: syncBlockedRef.current, pendingOps: pendingOpRef.current ? 1 : 0, retryCount: retryCountRef.current });
              if (!cancelled) setHasLoadedRemote(true);
              return;
            }
            syncBlockedRef.current = null;
            if (sawChanges) {
              setProjectData(normalized);
              lastSyncedRef.current = normalized;
              remoteHasDataRef.current = !isProjectEmpty(normalized);
            }
            remoteUpdatedAtRef.current = latestVersion;
            retryCountRef.current = 0;
            emitStatus('synced', { lastSyncAt: remoteUpdatedAtRef.current ?? undefined, pendingOps: pendingOpRef.current ? 1 : 0, retryCount: retryCountRef.current });
            if (!cancelled) setHasLoadedRemote(true);
            return;
          }
        }
        const res = await fetch("/api/project", {
          headers: {
            authorization: `Bearer ${token}`,
            "x-device-id": deviceIdRef.current
          }
        });

        if (res.status === 404) {
          remoteHasDataRef.current = false;
          remoteUpdatedAtRef.current = 0;
          retryCountRef.current = 0;
          emitStatus('synced', { lastSyncAt: 0, pendingOps: pendingOpRef.current ? 1 : 0, retryCount: retryCountRef.current });
          if (!cancelled) setHasLoadedRemote(true);
          return;
        }

        if (res.status === 401 || res.status === 403) {
          throw new Error("Unauthorized");
        }

        if (!res.ok) {
          const errorPayload = await res.json().catch(() => null);
          const detail = errorPayload?.detail || errorPayload?.error;
          if (detail) {
            throw new Error(`Load failed: ${detail}`);
          }
          throw new Error(`Load failed: ${res.status}`);
        }

        const data = await res.json();
        if (!cancelled && data.projectData) {
          const remotePayload = data.projectData.projectData ? data.projectData.projectData : data.projectData;
          const remote = normalizeProjectData(remotePayload);
          const validation = validateProjectData(remote);
          if (!validation.ok) {
            syncBlockedRef.current = `Remote data invalid: ${validation.error}`;
            emitStatus('error', { error: syncBlockedRef.current, pendingOps: pendingOpRef.current ? 1 : 0, retryCount: retryCountRef.current });
            if (!cancelled) setHasLoadedRemote(true);
            return;
          }
          syncBlockedRef.current = null;
          if (typeof data.updatedAt === "number") {
            remoteUpdatedAtRef.current = data.updatedAt;
          }
          const local = projectDataRef.current;
          const remoteHas = !isProjectEmpty(remote);
          const localHas = !isProjectEmpty(local);
          remoteHasDataRef.current = remoteHas;

          if (remoteHas && localHas) {
            emitStatus('conflict', { pendingOps: pendingOpRef.current ? 1 : 0, retryCount: retryCountRef.current });
            const baseVersion = typeof data.updatedAt === "number" ? data.updatedAt : (remoteUpdatedAtRef.current ?? 0);
            if (tryAutoMerge(remote, local, baseVersion)) {
              retryCountRef.current = 0;
              if (pendingOpRef.current) {
                emitStatus('syncing', { pendingOps: 1, retryCount: retryCountRef.current });
              }
              if (!cancelled) setHasLoadedRemote(true);
              return;
            }
            const useRemote = await Promise.resolve(onConflictConfirmRef.current({ remote, local }));
            if (useRemote) {
              backupData(localBackupKey, local);
              setProjectData(remote);
              lastSyncedRef.current = remote;
              emitStatus('synced', { lastSyncAt: remoteUpdatedAtRef.current ?? undefined, pendingOps: pendingOpRef.current ? 1 : 0, retryCount: retryCountRef.current });
            } else {
              backupData(remoteBackupKey, remote);
              remoteUpdatedAtRef.current = data.updatedAt ?? remoteUpdatedAtRef.current;
              await saveNow(local, data.updatedAt ?? remoteUpdatedAtRef.current);
            }
          } else if (remoteHas) {
            setProjectData(remote);
            lastSyncedRef.current = remote;
            emitStatus('synced', { lastSyncAt: remoteUpdatedAtRef.current ?? undefined, pendingOps: pendingOpRef.current ? 1 : 0, retryCount: retryCountRef.current });
          }
        }
        retryCountRef.current = 0;
        emitStatus('synced', { lastSyncAt: remoteUpdatedAtRef.current ?? undefined, pendingOps: pendingOpRef.current ? 1 : 0, retryCount: retryCountRef.current });
        if (!cancelled) setHasLoadedRemote(true);
      } catch (e) {
        if (!cancelled) {
          onErrorRef.current?.(e);
          const message = e instanceof Error ? e.message : "Failed to load cloud project data";
          emitStatus('error', { error: message, retryCount: retryCountRef.current, pendingOps: pendingOpRef.current ? 1 : 0 });
          scheduleRetry(loadRemote);
        }
      } finally {
        isLoadingRef.current = false;
      }
    };

    loadRemote();
    return () => {
      cancelled = true;
      if (retryTimeout.current) window.clearTimeout(retryTimeout.current);
    };
  }, [isSignedIn, isLoaded, hasLoadedRemote, refreshKey, getToken, localBackupKey, remoteBackupKey, setProjectData, setHasLoadedRemote]);

  // Save with debounce
  useEffect(() => {
    if (!isSignedIn || !isLoaded || !hasLoadedRemote) return;

    if (syncSaveTimeout.current) {
      clearTimeout(syncSaveTimeout.current);
    }

    syncSaveTimeout.current = window.setTimeout(() => {
      if (remoteHasDataRef.current && isProjectEmpty(projectDataRef.current)) {
        onErrorRef.current?.(new Error("Refusing to overwrite non-empty remote with empty local state."));
        emitStatus('error', { error: "Local data empty; refusing to overwrite cloud.", pendingOps: pendingOpRef.current ? 1 : 0, retryCount: retryCountRef.current });
        return;
      }
      const baseVersion = typeof remoteUpdatedAtRef.current === "number" ? remoteUpdatedAtRef.current : 0;
      enqueueSave(projectDataRef.current, baseVersion);
    }, saveDebounceMs);

    return () => {
      if (syncSaveTimeout.current) {
        clearTimeout(syncSaveTimeout.current);
      }
    };
  }, [projectData, isSignedIn, isLoaded, hasLoadedRemote, saveDebounceMs]);
};
