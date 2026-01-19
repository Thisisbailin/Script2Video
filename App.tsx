
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { FolderOpen, FileText, List, Palette, MonitorPlay, Sparkles, BarChart2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useUser, useClerk, useAuth } from '@clerk/clerk-react';
import { ProjectData, AppConfig, WorkflowStep, Episode, Shot, TokenUsage, AnalysisSubStep, VideoParams, ActiveTab, SyncState, SyncStatus, Character } from './types';
import { INITIAL_PROJECT_DATA, INITIAL_VIDEO_CONFIG, INITIAL_TEXT_CONFIG, INITIAL_MULTIMODAL_CONFIG } from './constants';
import {
  parseScriptToEpisodes,
  exportToCSV,
  exportToXLS,
  parseCSVToShots,
  exportUnderstandingToJSON,
  parseUnderstandingJSON
} from './utils/parser';
import { normalizeProjectData } from './utils/projectData';
import { dropFileReplacer, isProjectEmpty, backupData, FORCE_CLOUD_CLEAR_KEY } from './utils/persistence';
import { getDeviceId } from './utils/device';
import { hashToBucket, isInRollout, normalizeRolloutPercent } from './utils/rollout';
import { buildApiUrl } from './utils/api';
import { usePersistedState } from './hooks/usePersistedState';
import { useCloudSync } from './hooks/useCloudSync';
import { useVideoPolling } from './hooks/useVideoPolling';
import { useConfig } from './hooks/useConfig';
import { useTheme } from './hooks/useTheme';
import { useWorkflowEngine } from './hooks/useWorkflowEngine';
import { useSecretsSync } from './hooks/useSecretsSync';
import { useShotGeneration } from './hooks/useShotGeneration';
import { useSoraGeneration } from './hooks/useSoraGeneration';
import { AppShell } from './components/layout/AppShell';
import { Header, WorkflowCard } from './components/layout/Header';
import { SettingsModal } from './components/SettingsModal';
import { ConflictModal } from './components/ConflictModal';
import { SyncStatusBanner } from './components/SyncStatusBanner';
import { AssetsModule } from './modules/assets/AssetsModule';
import { ScriptViewer } from './modules/script/ScriptViewer';
import { ShotsModule } from './modules/shots/ShotsModule';
import { VideoModule } from './modules/video/VideoModule';
import { NodeLab } from './node-workspace/components/NodeLab';
import { Dashboard } from './components/Dashboard';
import type { ModuleKey } from './node-workspace/components/ModuleBar';
import { FloatingPanelShell } from './node-workspace/components/FloatingPanelShell';
import * as GeminiService from './services/geminiService';
import * as VideoService from './services/videoService';
import { useWorkflowStore } from './node-workspace/store/workflowStore';

// --- Helpers: Character stats derived from parsed episodes ---
const buildCharacterStats = (episodes: Episode[]) => {
  const stats = new Map<
    string,
    {
      count: number;
      episodeIds: Set<number>;
    }
  >();

  episodes.forEach((ep) => {
    (ep.characters || []).forEach((rawName) => {
      const name = rawName.trim();
      if (!name) return;
      if (!stats.has(name)) {
        stats.set(name, { count: 0, episodeIds: new Set<number>() });
      }
      const entry = stats.get(name)!;
      entry.count += 1;
      entry.episodeIds.add(ep.id);
    });
  });

  return stats;
};

const formatEpisodeUsage = (episodeIds: Set<number>) => {
  const sorted = Array.from(episodeIds).sort((a, b) => a - b);
  if (!sorted.length) return "";
  return sorted.map((id) => `Ep${id}`).join(", ");
};

const PROJECT_STORAGE_KEY = 'script2video_project_v1';
const CONFIG_STORAGE_KEY = 'script2video_config_v1';
const UI_STATE_STORAGE_KEY = 'script2video_ui_state_v1';
const THEME_STORAGE_KEY = 'script2video_theme_v1';
const LOCAL_BACKUP_KEY = 'script2video_local_backup';
const REMOTE_BACKUP_KEY = 'script2video_remote_backup';

const App: React.FC = () => {
  // Clerk Auth Hooks
  const { isSignedIn: userSignedIn, user, isLoaded: isUserLoaded } = useUser();
  const { openSignIn, signOut } = useClerk();
  const { getToken, isLoaded: isAuthLoaded, isSignedIn: authSignedIn } = useAuth();
  const getAuthToken = useCallback(async () => {
    try {
      return await getToken({ template: "default" });
    } catch {
      return null;
    }
  }, [getToken]);
  const projectDataRef = useRef<ProjectData>(INITIAL_PROJECT_DATA);

  // Initialize state with Persisted hooks
  const [projectData, setProjectData] = usePersistedState<ProjectData>({
    key: PROJECT_STORAGE_KEY,
    initialValue: INITIAL_PROJECT_DATA,
    deserialize: (value) => normalizeProjectData(JSON.parse(value)),
    serialize: (value) => JSON.stringify(value),
  });

  const { config, setConfig } = useConfig(CONFIG_STORAGE_KEY);

  const { isDarkMode, setIsDarkMode, toggleTheme } = useTheme(THEME_STORAGE_KEY, true);
  const setAppConfigStore = useWorkflowStore(state => state.setAppConfig);

  useEffect(() => {
    setAppConfigStore(config);
  }, [config, setAppConfigStore]);

  // Sync global theme classes for both Tailwind dark styles and CSS variable themes
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const themeClass = isDarkMode ? "theme-dark" : "theme-light";

    root.classList.remove("theme-light", "theme-dark");
    body.classList.remove("theme-light", "theme-dark");
    root.classList.add(themeClass);
    body.classList.add(themeClass);

    if (isDarkMode) {
      root.classList.add("dark");
      body.classList.add("dark");
    } else {
      root.classList.remove("dark");
      body.classList.remove("dark");
    }
  }, [isDarkMode]);

  const [uiState, setUiState] = usePersistedState<{
    step: WorkflowStep;
    analysisStep: AnalysisSubStep;
    currentEpIndex: number;
    activeTab: ActiveTab;
  }>({
    key: UI_STATE_STORAGE_KEY,
    initialValue: { step: WorkflowStep.IDLE, analysisStep: AnalysisSubStep.IDLE, currentEpIndex: 0, activeTab: 'assets' },
    deserialize: (value) => {
      const parsed = JSON.parse(value);
      return {
        step: parsed.step ?? WorkflowStep.IDLE,
        analysisStep: parsed.analysisStep ?? AnalysisSubStep.IDLE,
        currentEpIndex: parsed.currentEpIndex ?? 0,
        activeTab: parsed.activeTab ?? 'assets'
      };
    },
    serialize: (value) => JSON.stringify(value)
  });

  const workflow = useWorkflowEngine({
    step: uiState.step,
    analysisStep: uiState.analysisStep,
    currentEpIndex: uiState.currentEpIndex,
    activeTab: uiState.activeTab
  });

  const { state: wfState, setStep, setAnalysisStep, setCurrentEpIndex, setActiveTab, setProcessing, setStatus, setQueue, shiftQueue, resetWorkflow } = workflow;
  const { step, analysisStep, currentEpIndex, activeTab, isProcessing, processingStatus, analysisQueue, analysisTotal } = wfState;
  const [analysisError, setAnalysisError] = useState<{ step: AnalysisSubStep; message: string } | null>(null);

  // Force Lab as the sole surface (no top tab selector)
  useEffect(() => {
    if (activeTab !== 'lab') {
      setActiveTab('lab');
    }
  }, [activeTab, setActiveTab]);

  // Keep persisted uiState in sync with reducer core fields
  useEffect(() => {
    setUiState(prev => ({
      ...prev,
      step,
      analysisStep,
      currentEpIndex,
      activeTab
    }));
  }, [step, analysisStep, currentEpIndex, activeTab, setUiState]);

  useEffect(() => {
    setAnalysisError(null);
  }, [analysisStep]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'multimodal' | 'video' | 'sync' | 'about' | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>({
    project: { status: 'idle' },
    secrets: { status: 'disabled' }
  });
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [syncRefreshKey, setSyncRefreshKey] = useState(0);
  const conflictQueueRef = useRef<Array<{ remote: ProjectData; local: ProjectData; resolve?: (useRemote: boolean) => void; mode: 'decision' | 'notice' }>>([]);
  const activeConflictRef = useRef<{ remote: ProjectData; local: ProjectData; resolve?: (useRemote: boolean) => void; mode: 'decision' | 'notice' } | null>(null);
  const [activeConflict, setActiveConflict] = useState<{ remote: ProjectData; local: ProjectData; resolve?: (useRemote: boolean) => void; mode: 'decision' | 'notice' } | null>(null);

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [splitTab, setSplitTab] = useState<ActiveTab | null>(null);
  const [isSplitMenuOpen, setIsSplitMenuOpen] = useState(false);
  const [openLabModal, setOpenLabModal] = useState<ModuleKey | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [isSyncBannerDismissed, setIsSyncBannerDismissed] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = usePersistedState<string>({
    key: 'script2video_avatar_url',
    initialValue: '',
    deserialize: (v) => JSON.parse(v),
    serialize: (v) => JSON.stringify(v)
  });
  const hasFetchedProfileAvatar = useRef(false);
  const syncRollout = useMemo(() => {
    const percent = normalizeRolloutPercent(import.meta.env.VITE_SYNC_ROLLOUT_PERCENT);
    const salt = import.meta.env.VITE_SYNC_ROLLOUT_SALT || "";
    const allowlistRaw = import.meta.env.VITE_SYNC_ROLLOUT_ALLOWLIST || "";
    const allowlist = allowlistRaw.split(",").map((value) => value.trim()).filter(Boolean);
    const userId = user?.id || (userSignedIn ? "" : getDeviceId());
    const allowlisted = !!user?.id && allowlist.includes(user.id);
    if (!userId) {
      return { enabled: percent >= 100, percent, bucket: null, allowlisted };
    }
    const bucket = hashToBucket(userId, salt);
    const enabled = allowlisted || isInRollout(userId, percent, salt);
    return { enabled, percent, bucket, allowlisted };
  }, [user?.id, userSignedIn]);
  const isSyncFeatureEnabled = !!authSignedIn && syncRollout.enabled;

  const openSettings = useCallback((tab?: 'multimodal' | 'video' | 'sync' | 'about') => {
    setSettingsTab(tab || null);
    setIsSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
    setSettingsTab(null);
  }, []);

  const handleOpenLabModule = useCallback((key: ModuleKey) => {
    setOpenLabModal(key);
  }, []);

  const closeLabModal = useCallback(() => {
    setOpenLabModal(null);
  }, []);

  const handleOpenStats = useCallback(() => {
    setShowStatsModal(true);
  }, []);

  const closeStats = useCallback(() => setShowStatsModal(false), []);

  // Processing Queues for Phase 1 Batches handled via reducer

  // --- Cloud Sync Helpers ---

  useEffect(() => {
    projectDataRef.current = projectData;
  }, [projectData]);

  useEffect(() => {
    activeConflictRef.current = activeConflict;
  }, [activeConflict]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const projectEnabled = authSignedIn && isSyncFeatureEnabled;
    const secretsEnabled = authSignedIn && isSyncFeatureEnabled && config.syncApiKeys;
    setSyncState(prev => ({
      project: projectEnabled ? (prev.project.status === 'disabled' ? { status: 'loading' } : prev.project) : { status: 'disabled' },
      secrets: secretsEnabled
        ? (prev.secrets.status === 'disabled' ? { status: 'loading' } : prev.secrets)
        : { status: 'disabled' }
    }));
  }, [authSignedIn, config.syncApiKeys, isSyncFeatureEnabled]);

  const updateProjectSyncStatus = useCallback((status: SyncStatus, detail?: { lastSyncAt?: number; error?: string; pendingOps?: number; retryCount?: number; lastAttemptAt?: number }) => {
    setSyncState(prev => ({
      ...prev,
      project: {
        status,
        lastSyncAt: detail?.lastSyncAt ?? prev.project.lastSyncAt,
        lastError: status === 'error' ? detail?.error ?? prev.project.lastError : status === 'synced' ? undefined : prev.project.lastError,
        pendingOps: detail?.pendingOps ?? prev.project.pendingOps,
        retryCount: detail?.retryCount ?? prev.project.retryCount,
        lastAttemptAt: detail?.lastAttemptAt ?? prev.project.lastAttemptAt
      }
    }));
  }, []);

  const updateSecretsSyncStatus = useCallback((status: SyncStatus, detail?: { lastSyncAt?: number; error?: string; pendingOps?: number; retryCount?: number; lastAttemptAt?: number }) => {
    setSyncState(prev => ({
      ...prev,
      secrets: {
        status,
        lastSyncAt: detail?.lastSyncAt ?? prev.secrets.lastSyncAt,
        lastError: status === 'error' ? detail?.error ?? prev.secrets.lastError : status === 'synced' ? undefined : prev.secrets.lastError,
        pendingOps: detail?.pendingOps ?? prev.secrets.pendingOps,
        retryCount: detail?.retryCount ?? prev.secrets.retryCount,
        lastAttemptAt: detail?.lastAttemptAt ?? prev.secrets.lastAttemptAt
      }
    }));
  }, []);

  const handleCloudSyncError = useCallback((e: unknown) => {
    console.warn("Cloud sync error", e);
  }, []);

  const forceCloudPull = useCallback(() => {
    setSyncRefreshKey((v) => v + 1);
  }, []);

  const requestConflictResolution = useCallback(({ remote, local }: { remote: ProjectData; local: ProjectData }) => {
    return new Promise<boolean>((resolve) => {
      conflictQueueRef.current.push({ remote, local, resolve, mode: 'decision' });
      if (!activeConflictRef.current) {
        const next = conflictQueueRef.current.shift();
        if (next) setActiveConflict(next);
      }
    });
  }, []);

  const requestConflictNotice = useCallback(({ remote, local }: { remote: ProjectData; local: ProjectData }) => {
    conflictQueueRef.current.push({ remote, local, mode: 'notice' });
    if (!activeConflictRef.current) {
      const next = conflictQueueRef.current.shift();
      if (next) setActiveConflict(next);
    }
  }, []);

  const handleConflictChoice = useCallback((useRemote: boolean) => {
    if (!activeConflict || activeConflict.mode !== 'decision') return;
    activeConflict.resolve?.(useRemote);
    setActiveConflict(null);
    const next = conflictQueueRef.current.shift();
    if (next) setActiveConflict(next);
  }, [activeConflict]);

  const handleConflictAcknowledge = useCallback(() => {
    if (!activeConflict || activeConflict.mode !== 'notice') return;
    setActiveConflict(null);
    const next = conflictQueueRef.current.shift();
    if (next) setActiveConflict(next);
  }, [activeConflict]);


  // --- Cloud Sync (Clerk + Cloudflare Pages) ---
  useCloudSync({
    isSignedIn: !!authSignedIn && isSyncFeatureEnabled,
    isLoaded: isAuthLoaded,
    getToken: getAuthToken,
    projectData,
    setProjectData,
    setHasLoadedRemote,
    hasLoadedRemote,
    refreshKey: syncRefreshKey,
    localBackupKey: LOCAL_BACKUP_KEY,
    remoteBackupKey: REMOTE_BACKUP_KEY,
    onError: handleCloudSyncError,
    onStatusChange: updateProjectSyncStatus,
    onConflictConfirm: requestConflictResolution,
    onConflictNotice: requestConflictNotice,
    saveDebounceMs: 1200
  });

  useVideoPolling<ProjectData>({
    episodes: projectData.episodes,
    videoConfig: config.videoConfig,
    onUpdate: (updater) => setProjectData(prev => updater(prev)),
    intervalMs: 5000,
    onError: (e) => console.warn("Video polling error", e)
  });

  useSecretsSync({
    isSignedIn: !!authSignedIn && isSyncFeatureEnabled,
    isLoaded: isAuthLoaded,
    getToken: getAuthToken,
    config,
    setConfig,
    debounceMs: 1200,
    onStatusChange: updateSecretsSyncStatus
  });

  // Fetch avatar from profile (account-scoped) once per session
  useEffect(() => {
    const fetchProfile = async () => {
      if (!authSignedIn || !isAuthLoaded || hasFetchedProfileAvatar.current) return;
      try {
        const token = await getAuthToken();
        if (!token) return;
        hasFetchedProfileAvatar.current = true;
        const res = await fetch(buildApiUrl('/api/profile'), { headers: { authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
        }
      } catch (e) {
        console.warn('Fetch profile avatar failed', e);
      }
    };
    fetchProfile();
  }, [authSignedIn, isAuthLoaded, getAuthToken, setAvatarUrl]);

  // Clamp current episode index when episodes change (e.g., after remote sync)
  useEffect(() => {
    if (projectData.episodes.length === 0) {
      setCurrentEpIndex(0);
    } else if (currentEpIndex >= projectData.episodes.length) {
      setCurrentEpIndex(0);
    }
  }, [projectData.episodes.length]);

  // --- GLOBAL VIDEO TASK POLLING LOOP ---
  useEffect(() => {
    const intervalId = setInterval(async () => {
      // Identify shots that need checking
      const tasksToCheck: { epId: number, shotId: string, taskId: string }[] = [];

      projectData.episodes.forEach(ep => {
        ep.shots.forEach(s => {
          if ((s.videoStatus === 'queued' || s.videoStatus === 'generating') && s.videoId) {
            tasksToCheck.push({ epId: ep.id, shotId: s.id, taskId: s.videoId });
          }
        });
      });

      if (tasksToCheck.length === 0) return;

      // Check tasks (limit concurrency if needed, but 5-10 concurrent requests usually ok)
      // We do them sequentially or in small batches to avoid flooding
      for (const task of tasksToCheck) {
        if (!config.videoConfig.baseUrl || !config.videoConfig.apiKey) continue;

        try {
          const result = await VideoService.checkTaskStatus(task.taskId, config.videoConfig);

          // Only update state if status changed or URL became available
          if (result.status !== 'processing' && result.status !== 'queued') {
            setProjectData(prev => {
              const newEpisodes = prev.episodes.map(e => {
                if (e.id === task.epId) {
                  return {
                    ...e,
                    shots: e.shots.map(s => s.id === task.shotId ? {
                      ...s,
                      videoStatus: result.status === 'succeeded' ? 'completed' : 'error',
                      videoUrl: result.url,
                      videoErrorMsg: result.errorMsg,
                      // Keep start time for duration calc if needed
                    } : s)
                  } as Episode;
                }
                return e;
              });
              return { ...prev, episodes: newEpisodes };
            });
          }
          // If status changed from queued to processing, update that
          else if (result.status === 'processing') {
            setProjectData(prev => {
              const currentEp = prev.episodes.find(e => e.id === task.epId);
              const currentShot = currentEp?.shots.find(s => s.id === task.shotId);

              if (currentShot && currentShot.videoStatus === 'queued') {
                const newEpisodes = prev.episodes.map(e => {
                  if (e.id === task.epId) {
                    return {
                      ...e,
                      shots: e.shots.map(s => s.id === task.shotId ? {
                        ...s,
                        videoStatus: 'generating'
                      } : s)
                    } as Episode;
                  }
                  return e;
                });
                return { ...prev, episodes: newEpisodes };
              }
              return prev;
            });
          }
        } catch (e) {
          console.warn("Polling error for task " + task.taskId, e);
        }
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId);
  }, [projectData, config.videoConfig]);


  // Load default guides on mount (only if not already loaded)
  useEffect(() => {
    if (!projectData.shotGuide || !projectData.soraGuide || !projectData.dramaGuide) {
      const loadDefaultGuides = async () => {
        try {
          const [shotRes, soraRes, dramaRes] = await Promise.all([
            fetch('guides/ShotGuide.md'),
            fetch('guides/PromptGuide.md'),
            fetch('guides/DramaGuide.md')
          ]);

          if (shotRes.ok && soraRes.ok && dramaRes.ok) {
            const [shotText, soraText, dramaText] = await Promise.all([
              shotRes.text(),
              soraRes.text(),
              dramaRes.text()
            ]);
            setProjectData(prev => ({
              ...prev,
              shotGuide: prev.shotGuide || shotText,
              soraGuide: prev.soraGuide || soraText,
              dramaGuide: prev.dramaGuide || dramaText
            }));
          }
        } catch (e) {
          console.error("Error loading default guides:", e);
        }
      };
      loadDefaultGuides();
    }
  }, []);

  // --- Helper: Stats Updater ---
  const updateStats = (phase: 'context' | 'shotGen' | 'soraGen', success: boolean) => {
    setProjectData(prev => {
      const stats = { ...prev.stats };
      stats[phase].total += 1;
      if (success) stats[phase].success += 1;
      else stats[phase].error += 1;
      return { ...prev, stats };
    });
  };


  // --- Handlers ---

  const handleResetProject = () => {
    if (window.confirm("确认清空整个项目吗？\n\n这会清空本地与云端的项目数据（脚本、镜头、生成内容等），且不可恢复。")) {
      localStorage.setItem(FORCE_CLOUD_CLEAR_KEY, "1");
      setProjectData(INITIAL_PROJECT_DATA);
      setStep(WorkflowStep.IDLE);
      setAnalysisStep(AnalysisSubStep.IDLE);
      setCurrentEpIndex(0);
      setActiveTab('assets');
      localStorage.removeItem(PROJECT_STORAGE_KEY);
      localStorage.removeItem(UI_STATE_STORAGE_KEY);
      localStorage.removeItem(LOCAL_BACKUP_KEY);
      localStorage.removeItem(REMOTE_BACKUP_KEY);
      setAvatarUrl('');
    }
  };

  const handleAvatarUploadClick = () => {
    avatarFileInputRef.current?.click();
  };

  const uploadAvatarToSupabase = async (file: File) => {
    try {
      const safeName = file.name
        .normalize("NFKD")
        .replace(/[^\w.\-]+/g, "_")
        .toLowerCase();
      const payload = {
        fileName: `avatars/${Date.now()}-${safeName}`,
        bucket: 'public-assets',
        contentType: file.type
      };
      const res = await fetch(buildApiUrl('/api/upload-url'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Upload URL error ${res.status}`);
      const data = await res.json();
      const signedUrl: string = data.signedUrl;
      if (!signedUrl) throw new Error('No signedUrl returned');

      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      });
      if (!uploadRes.ok) {
        const txt = await uploadRes.text();
        throw new Error(`Upload failed ${uploadRes.status}: ${txt}`);
      }

      const publicUrl: string | undefined = data.publicUrl;
      const storedUrl = publicUrl || data.path || '';
      if (!storedUrl) throw new Error('No public URL/path returned');
      setAvatarUrl(storedUrl);
      // Save to profile for multi-device sync
      try {
        const token = await getAuthToken();
        if (token) {
          await fetch(buildApiUrl('/api/profile'), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
            body: JSON.stringify({ avatarUrl: storedUrl })
          });
        }
      } catch (e) {
        console.warn('Save profile avatar failed', e);
      }
      alert('头像已上传并应用（Supabase public-assets）');
    } catch (e: any) {
      alert(`上传头像失败: ${e.message || e}`);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadAvatarToSupabase(file);
    e.target.value = '';
  };

  const handleAssetLoad = (
    type: 'script' | 'globalStyleGuide' | 'shotGuide' | 'soraGuide' | 'dramaGuide' | 'csvShots' | 'understandingJson',
    content: string,
    fileName?: string
  ) => {
    if (type === 'script') {
      const episodes = parseScriptToEpisodes(content);
      const stats = buildCharacterStats(episodes);
      setProjectData(prev => {
        const existingChars = prev.context.characters || [];
        const existingNames = new Set(existingChars.map(c => c.name));

        // Update existing characters with fresh stats
        const updatedExisting = existingChars.map((c) => {
          const stat = stats.get(c.name);
          if (!stat) return c;
          const appearanceCount = stat.count;
          const episodeUsage = formatEpisodeUsage(stat.episodeIds);
          return {
            ...c,
            appearanceCount,
            episodeUsage,
            isMain: appearanceCount > 1 || c.isMain,
            assetPriority: (c.assetPriority || (appearanceCount > 1 ? "medium" : "low")) as "low" | "medium" | "high",
          };
        });

        // Add any new characters parsed from script
        let counter = 0;
        const newChars = Array.from(stats.entries())
          .filter(([name]) => name && !existingNames.has(name))
          .map(([name, stat]) => ({
            id: `char-script-${Date.now()}-${counter++}`,
            name,
            role: "",
            isMain: stat.count > 1,
            bio: "",
            forms: [],
            appearanceCount: stat.count,
            episodeUsage: formatEpisodeUsage(stat.episodeIds),
            assetPriority: (stat.count > 1 ? "medium" : "low") as "low" | "medium" | "high",
          }));

        return {
          ...prev,
          fileName: fileName || 'script.txt',
          rawScript: content,
          episodes,
          context: {
            ...prev.context,
            characters: [...updatedExisting, ...newChars],
          }
        };
      });
      if (episodes.length > 0) setCurrentEpIndex(0);
      setActiveTab('script');

    } else if (type === 'csvShots') {
      try {
        const shotMap = parseCSVToShots(content);
        setProjectData(prev => {
          const updatedEpisodes = prev.episodes.map(ep => {
            const matchedShots = shotMap.get(ep.title);
            if (matchedShots && matchedShots.length > 0) {
              return {
                ...ep,
                shots: matchedShots,
                status: matchedShots[0].soraPrompt ? 'completed' : 'confirmed_shots'
              } as Episode;
            }
            return ep;
          });
          return { ...prev, episodes: updatedEpisodes };
        });
        alert(`Successfully imported shots for ${shotMap.size} episodes.`);
        setActiveTab('table');
      } catch (e: any) {
        alert("Error importing CSV: " + e.message);
      }

    } else if (type === 'understandingJson') {
      try {
        const payload = parseUnderstandingJSON(content);
        setProjectData(prev => {
          const episodeSummaryMap = new Map(
            payload.context.episodeSummaries.map(summary => [summary.episodeId, summary.summary])
          );
          const updatedEpisodes = prev.episodes.map(ep => {
            const summary = episodeSummaryMap.get(ep.id);
            return summary ? { ...ep, summary } : ep;
          });
          return {
            ...prev,
            context: payload.context,
            episodes: updatedEpisodes,
            contextUsage: payload.contextUsage ?? prev.contextUsage,
            phase1Usage: payload.phase1Usage ? { ...prev.phase1Usage, ...payload.phase1Usage } : prev.phase1Usage
          };
        });
        alert('Successfully imported understanding data.');
        setActiveTab('understanding');
      } catch (e: any) {
        alert("Error importing understanding JSON: " + e.message);
      }

    } else if (type === 'globalStyleGuide') {
      setProjectData(prev => ({ ...prev, globalStyleGuide: content }));
    } else if (type === 'shotGuide') {
      setProjectData(prev => ({ ...prev, shotGuide: content }));
    } else if (type === 'soraGuide') {
      setProjectData(prev => ({ ...prev, soraGuide: content }));
    } else if (type === 'dramaGuide') {
      setProjectData(prev => ({ ...prev, dramaGuide: content }));
    }
  };

  const handleTryMe = async () => {
    setProcessing(true, "Concocting a hilarious script with AI...");

    try {
      let dramaGuideText = projectData.dramaGuide;
      if (!dramaGuideText) {
        try {
          const res = await fetch('guides/DramaGuide.md');
          if (res.ok) {
            dramaGuideText = await res.text();
          }
        } catch (err) {
          console.warn('Load drama guide failed, fallback to prompt defaults', err);
          dramaGuideText = '';
        }
      }

      const result = await GeminiService.generateDemoScript(config.textConfig, dramaGuideText);

      const episodes = parseScriptToEpisodes(result.script);

      setProjectData(prev => ({
        ...prev,
        fileName: 'AI_Generated_Joke.txt',
        rawScript: result.script,
        episodes: episodes,
        globalStyleGuide: result.styleGuide,
        dramaGuide: prev.dramaGuide || dramaGuideText || '',
        contextUsage: GeminiService.addUsage(prev.contextUsage || { promptTokens: 0, responseTokens: 0, totalTokens: 0 }, result.usage),
        stats: {
          ...prev.stats,
          context: {
            total: prev.stats.context.total + 1,
            success: prev.stats.context.success + 1,
            error: prev.stats.context.error
          }
        }
      }));

      if (episodes.length > 0) setCurrentEpIndex(0);
      setActiveTab('script');
      setStep(WorkflowStep.IDLE);
      setProcessing(false);

    } catch (e: any) {
      console.error(e);
      setProcessing(false);
      alert("Failed to generate demo script: " + e.message);
      updateStats('context', false);
    }
  };

  // --- Workflow Logic ---

  // === PHASE 1: DEEP UNDERSTANDING WORKFLOW (Batched) ===

  const startAnalysis = () => {
    setAnalysisError(null);
    setStep(WorkflowStep.SETUP_CONTEXT);
    setAnalysisStep(AnalysisSubStep.PROJECT_SUMMARY);
    processProjectSummary();
  };

  // Step 1: Project Summary
  const processProjectSummary = async () => {
    setAnalysisError(null);
    setProcessing(true, "Step 1/6: Analyzing Global Project Arc...");
    setActiveTab('assets');
    try {
      const result = await GeminiService.generateProjectSummary(config.textConfig, projectData.rawScript, projectData.globalStyleGuide);

      setProjectData(prev => ({
        ...prev,
        context: { ...prev.context, projectSummary: result.projectSummary },
        contextUsage: GeminiService.addUsage(prev.contextUsage || { promptTokens: 0, responseTokens: 0, totalTokens: 0 }, result.usage),
        phase1Usage: { ...prev.phase1Usage, projectSummary: GeminiService.addUsage(prev.phase1Usage.projectSummary, result.usage) }
      }));

      setProcessing(false);
      setAnalysisError(null);
      updateStats('context', true);
    } catch (e: any) {
      setProcessing(false);
      setAnalysisError({ step: AnalysisSubStep.PROJECT_SUMMARY, message: e.message || "Unknown error" });
      alert("Project summary failed: " + e.message);
      updateStats('context', false);
    }
  };

  const confirmSummaryAndNext = () => {
    setAnalysisError(null);
    // Prepare batch for Episode Summaries
    const epQueue = projectData.episodes.map(ep => ep.id);
    setQueue(epQueue, epQueue.length);
    setAnalysisStep(AnalysisSubStep.EPISODE_SUMMARIES);
  };

  // Step 2: Episode Summaries (Batched 1-by-1 for Detail)
  useEffect(() => {
    if (analysisStep === AnalysisSubStep.EPISODE_SUMMARIES && analysisQueue.length > 0 && !isProcessing) {
      processNextEpisodeSummary();
    }
  }, [analysisStep, analysisQueue, isProcessing]);

  const processNextEpisodeSummary = async () => {
    const epId = analysisQueue[0];
    const episode = projectData.episodes.find(e => e.id === epId);
    if (!episode) {
      shiftQueue();
      return;
    }

    setAnalysisError(null);
    setProcessing(true, `Step 2/6: Analyzing Episode ${epId} (${analysisTotal - analysisQueue.length + 1}/${analysisTotal})...`);

    try {
      const result = await GeminiService.generateEpisodeSummary(
        config.textConfig,
        episode.title,
        episode.content,
        projectData.context,
        epId
      );

      setProjectData(prev => {
        const updatedEps = prev.episodes.map(e => e.id === epId ? { ...e, summary: result.summary } : e);
        const updatedContextEpSummaries = [...prev.context.episodeSummaries, { episodeId: epId, summary: result.summary }];

        return {
          ...prev,
          episodes: updatedEps,
          context: { ...prev.context, episodeSummaries: updatedContextEpSummaries },
          contextUsage: GeminiService.addUsage(prev.contextUsage!, result.usage),
          phase1Usage: { ...prev.phase1Usage, episodeSummaries: GeminiService.addUsage(prev.phase1Usage.episodeSummaries, result.usage) }
        };
      });

      shiftQueue();
      setProcessing(false);
      setAnalysisError(null);
      updateStats('context', true);
    } catch (e: any) {
      setProcessing(false);
      const ignore = window.confirm(`Failed to summarize Episode ${epId}: ${e.message}. Skip this episode?`);
      if (ignore) {
        shiftQueue();
        updateStats('context', false);
        setAnalysisError(null);
      } else {
        setAnalysisError({ step: AnalysisSubStep.EPISODE_SUMMARIES, message: e.message || "Unknown error" });
      }
    }
  };

  const confirmEpSummariesAndNext = () => {
    setAnalysisError(null);
    setAnalysisStep(AnalysisSubStep.CHAR_IDENTIFICATION);
    processCharacterList();
  };

  // Step 3: Character List
  const processCharacterList = async () => {
    setAnalysisError(null);
    setProcessing(true, "Step 3/6: Identifying Character Roster...");
    try {
      // 基于解析结果先标注出现次数 & 主次角色
      const stats = buildCharacterStats(projectData.episodes);
      const mergedCharacters = (() => {
        const existing = projectData.context.characters || [];
        const existingNames = new Set(existing.map((c) => c.name));
        const updatedExisting = existing.map((c) => {
          const stat = stats.get(c.name);
          if (!stat) return c;
          const appearanceCount = stat.count;
          return {
            ...c,
            appearanceCount,
            episodeUsage: c.episodeUsage || formatEpisodeUsage(stat.episodeIds),
            isMain: appearanceCount > 1,
            assetPriority: c.assetPriority || (appearanceCount > 1 ? "medium" : "low"),
          };
        });
        const newOnes = Array.from(stats.entries())
          .filter(([name]) => name && !existingNames.has(name))
          .map(([name, stat]) => ({
            id: `char-script-${Date.now()}-${name}`,
            name,
            role: "",
            isMain: stat.count > 1,
            bio: "",
            forms: [],
            appearanceCount: stat.count,
            episodeUsage: formatEpisodeUsage(stat.episodeIds),
            assetPriority: stat.count > 1 ? "medium" : "low",
          }));
        return [...updatedExisting, ...newOnes];
      })() as Character[];

      const minorNames = mergedCharacters
        .filter((c) => (c.appearanceCount ?? 0) <= 1)
        .map((c) => c.name);

      let briefResult: { characters: any[]; usage: TokenUsage } | null = null;
      if (minorNames.length) {
        briefResult = await GeminiService.generateCharacterBriefs(
          config.textConfig,
          minorNames,
          projectData.rawScript,
          projectData.context.projectSummary
        );
      }

      const briefMap = new Map<string, any>(
        (briefResult?.characters || []).map((c) => [c.name, c])
      );

      const updatedCharacters = mergedCharacters.map((c) => {
        const brief = briefMap.get(c.name);
        return {
          ...c,
          role: brief?.role || c.role,
          bio: brief?.bio || c.bio,
          archetype: brief?.archetype || c.archetype,
          assetPriority: brief?.assetPriority || c.assetPriority || (c.isMain ? "medium" : "low"),
          episodeUsage: c.episodeUsage || brief?.episodeUsage,
          tags: brief?.tags || c.tags,
        };
      });

      setProjectData(prev => ({
        ...prev,
        context: { ...prev.context, characters: updatedCharacters },
        contextUsage: briefResult ? GeminiService.addUsage(prev.contextUsage!, briefResult.usage) : prev.contextUsage!,
        phase1Usage: {
          ...prev.phase1Usage,
          charList: briefResult
            ? GeminiService.addUsage(prev.phase1Usage.charList, briefResult.usage)
            : prev.phase1Usage.charList
        }
      }));
      setProcessing(false);
      setAnalysisError(null);
      updateStats('context', true);
    } catch (e: any) {
      setProcessing(false);
      setAnalysisError({ step: AnalysisSubStep.CHAR_IDENTIFICATION, message: e.message || "Unknown error" });
      alert("Character list generation failed: " + e.message);
      updateStats('context', false);
    }
  };

  const confirmCharListAndNext = () => {
    setAnalysisError(null);
    // Setup Queue for deep dive
    const mainChars = projectData.context.characters.filter(c => c.isMain).map(c => c.name);
    setQueue(mainChars, mainChars.length);
    setAnalysisStep(AnalysisSubStep.CHAR_DEEP_DIVE);
  };

  // Step 4: Character Deep Dive
  useEffect(() => {
    if (analysisStep === AnalysisSubStep.CHAR_DEEP_DIVE && analysisQueue.length > 0 && !isProcessing) {
      processNextCharacter();
    }
  }, [analysisStep, analysisQueue, isProcessing]);

  const processNextCharacter = async () => {
    const charName = analysisQueue[0];
    setAnalysisError(null);
    setProcessing(true, `Step 4/6: Deep Analysis for '${charName}' (${analysisTotal - analysisQueue.length + 1}/${analysisTotal})...`);

    try {
      const result = await GeminiService.analyzeCharacterDepth(
        config.textConfig,
        charName,
        projectData.rawScript,
        projectData.context.projectSummary,
        projectData.globalStyleGuide
      );

      setProjectData(prev => {
        const normalizedForms = (result.forms || []).map((f) => {
          const base = f.formName || "Standard";
          const prefix = base.startsWith(`${charName}-`) ? base : `${charName}-${base}`;
          return { ...f, formName: prefix };
        });
        const updatedChars = prev.context.characters.map(c =>
          c.name === charName
            ? {
              ...c,
              forms: normalizedForms,
              bio: result.bio || c.bio,
              archetype: result.archetype || c.archetype,
              episodeUsage: result.episodeUsage || c.episodeUsage,
              tags: result.tags || c.tags
            }
            : c
        );
        return {
          ...prev,
          context: { ...prev.context, characters: updatedChars },
          contextUsage: GeminiService.addUsage(prev.contextUsage!, result.usage),
          phase1Usage: { ...prev.phase1Usage, charDeepDive: GeminiService.addUsage(prev.phase1Usage.charDeepDive, result.usage) }
        };
      });

      shiftQueue();
      setProcessing(false);
      setAnalysisError(null);
      updateStats('context', true);

    } catch (e: any) {
      console.error(e);
      setProcessing(false);
      const ignore = window.confirm(`Failed to analyze ${charName}: ${e.message}. Skip?`);
      if (ignore) {
        shiftQueue();
        updateStats('context', false);
        setAnalysisError(null);
      } else {
        setAnalysisError({ step: AnalysisSubStep.CHAR_DEEP_DIVE, message: e.message || "Unknown error" });
      }
    }
  };

  const confirmCharDepthAndNext = () => {
    setAnalysisError(null);
    setAnalysisStep(AnalysisSubStep.LOC_IDENTIFICATION);
    processLocationList();
  };

  // Step 5: Location List
  const processLocationList = async () => {
    setAnalysisError(null);
    setProcessing(true, "Step 5/6: Mapping Locations...");
    try {
      const result = await GeminiService.identifyLocations(config.textConfig, projectData.rawScript, projectData.context.projectSummary);
      setProjectData(prev => ({
        ...prev,
        context: { ...prev.context, locations: result.locations },
        contextUsage: GeminiService.addUsage(prev.contextUsage!, result.usage),
        phase1Usage: { ...prev.phase1Usage, locList: GeminiService.addUsage(prev.phase1Usage.locList, result.usage) }
      }));
      setProcessing(false);
      setAnalysisError(null);
      updateStats('context', true);
    } catch (e: any) {
      setProcessing(false);
      setAnalysisError({ step: AnalysisSubStep.LOC_IDENTIFICATION, message: e.message || "Unknown error" });
      alert("Location mapping failed: " + e.message);
      updateStats('context', false);
    }
  };

  const confirmLocListAndNext = () => {
    setAnalysisError(null);
    const coreLocs = projectData.context.locations.filter(l => l.type === 'core').map(l => l.name);
    setQueue(coreLocs, coreLocs.length);
    setAnalysisStep(AnalysisSubStep.LOC_DEEP_DIVE);
  };

  // Step 6: Location Deep Dive
  useEffect(() => {
    if (analysisStep === AnalysisSubStep.LOC_DEEP_DIVE && analysisQueue.length > 0 && !isProcessing) {
      processNextLocation();
    }
  }, [analysisStep, analysisQueue, isProcessing]);

  const processNextLocation = async () => {
    const locName = analysisQueue[0];
    setAnalysisError(null);
    setProcessing(true, `Step 6/6: Visualizing '${locName}' (${analysisTotal - analysisQueue.length + 1}/${analysisTotal})...`);

    try {
      const result = await GeminiService.analyzeLocationDepth(
        config.textConfig,
        locName,
        projectData.rawScript,
        projectData.globalStyleGuide
      );

      setProjectData(prev => {
        const updatedLocs = prev.context.locations.map(l =>
          l.name === locName ? { ...l, visuals: result.visuals, zones: result.zones ?? l.zones } : l
        );
        return {
          ...prev,
          context: { ...prev.context, locations: updatedLocs },
          contextUsage: GeminiService.addUsage(prev.contextUsage!, result.usage),
          phase1Usage: { ...prev.phase1Usage, locDeepDive: GeminiService.addUsage(prev.phase1Usage.locDeepDive, result.usage) }
        };
      });

      shiftQueue();
      setProcessing(false);
      setAnalysisError(null);
      updateStats('context', true);

    } catch (e: any) {
      setProcessing(false);
      const ignore = window.confirm(`Failed to visualize ${locName}: ${e.message}. Skip?`);
      if (ignore) {
        shiftQueue();
        updateStats('context', false);
        setAnalysisError(null);
      } else {
        setAnalysisError({ step: AnalysisSubStep.LOC_DEEP_DIVE, message: e.message || "Unknown error" });
      }
    }
  };

  const finishAnalysis = () => {
    setAnalysisError(null);
    setAnalysisStep(AnalysisSubStep.COMPLETE);
    alert("Phase 1 Complete! Context is fully established.");
  };

  const retryAnalysisStep = () => {
    if (isProcessing) return;
    setAnalysisError(null);
    switch (analysisStep) {
      case AnalysisSubStep.PROJECT_SUMMARY:
        processProjectSummary();
        break;
      case AnalysisSubStep.EPISODE_SUMMARIES:
        if (analysisQueue.length > 0) processNextEpisodeSummary();
        break;
      case AnalysisSubStep.CHAR_IDENTIFICATION:
        processCharacterList();
        break;
      case AnalysisSubStep.CHAR_DEEP_DIVE:
        if (analysisQueue.length > 0) processNextCharacter();
        break;
      case AnalysisSubStep.LOC_IDENTIFICATION:
        processLocationList();
        break;
      case AnalysisSubStep.LOC_DEEP_DIVE:
        if (analysisQueue.length > 0) processNextLocation();
        break;
      default:
        break;
    }
  };

  // === PHASE 2 & 3 Hooks ===
  const { startPhase2, confirmEpisodeShots, retryCurrentEpisodeShots } = useShotGeneration({
    projectDataRef,
    setProjectData,
    config,
    setStep,
    setCurrentEpIndex,
    setProcessing,
    setStatus,
    setActiveTab,
    updateStats,
    currentEpIndex
  });

  const { startPhase3, continueNextEpisodeSora, retryCurrentEpisodeSora } = useSoraGeneration({
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
  });

  // === PHASE 5: VIDEO GENERATION ===
  const handleGenerateVideo = async (episodeId: number, shotId: string, customPrompt: string, params: VideoParams) => {
    if (!config.videoConfig.apiKey || !config.videoConfig.baseUrl) {
      alert("Video API settings missing. Please open Settings -> Video Generation.");
      openSettings('video');
      return;
    }

    // Ad-hoc Logic
    if (episodeId === -1) {
      const playgroundId = -1;
      let playgroundEpIndex = projectData.episodes.findIndex(e => e.id === playgroundId);

      if (playgroundEpIndex === -1) {
        const playgroundEp: Episode = {
          id: playgroundId,
          title: "Creative Playground",
          content: "Ad-hoc generations",
          scenes: [],
          shots: [],
          status: 'completed'
        };
        setProjectData(prev => ({
          ...prev,
          episodes: [...prev.episodes, playgroundEp]
        }));
        playgroundEpIndex = projectData.episodes.length;
      }

      const newShotId = `gen-${Date.now()}`;
      const newShot: Shot = {
        id: newShotId,
        duration: params.duration || '4s',
        shotType: 'Custom',
        movement: 'Custom',
        description: 'Ad-hoc generation',
        dialogue: '',
        soraPrompt: customPrompt,
        finalVideoPrompt: customPrompt,
        videoStatus: 'queued',
        videoParams: params,
        videoStartTime: Date.now()
      };

      setProjectData(prev => {
        const episodesCopy = [...prev.episodes];
        let existingPlayground = episodesCopy.find(e => e.id === playgroundId);
        if (!existingPlayground) {
          existingPlayground = {
            id: playgroundId,
            title: "Creative Playground",
            content: "Ad-hoc generations",
            scenes: [],
            shots: [],
            status: 'completed'
          };
          episodesCopy.push(existingPlayground);
        }
        existingPlayground.shots = [...existingPlayground.shots, newShot];
        return { ...prev, episodes: episodesCopy };
      });

      try {
        const { id } = await VideoService.submitVideoTask(customPrompt, config.videoConfig, params);
        setProjectData(prev => {
          const episodesCopy = prev.episodes.map(e => {
            if (e.id === playgroundId) {
              return {
                ...e,
                shots: e.shots.map(s => s.id === newShotId ? {
                  ...s,
                  videoId: id
                } : s)
              } as Episode;
            }
            return e;
          });
          return { ...prev, episodes: episodesCopy };
        });
      } catch (e: any) {
        setProjectData(prev => {
          const episodesCopy = prev.episodes.map(ep => {
            if (ep.id === playgroundId) {
              return {
                ...ep,
                shots: ep.shots.map(s => s.id === newShotId ? {
                  ...s,
                  videoStatus: 'error',
                  videoErrorMsg: e.message
                } : s)
              } as Episode;
            }
            return ep;
          });
          return { ...prev, episodes: episodesCopy };
        });
      }
      return;
    }

    // Standard Logic
    const episode = projectData.episodes.find(e => e.id === episodeId);
    if (!episode) return;
    const shot = episode.shots.find(s => s.id === shotId);
    if (!shot) return;

    setProjectData(prev => {
      const newEpisodes = prev.episodes.map(e => {
        if (e.id === episodeId) {
          return {
            ...e,
            shots: e.shots.map(s => s.id === shotId ? {
              ...s,
              videoStatus: 'queued',
              videoErrorMsg: undefined,
              finalVideoPrompt: customPrompt,
              videoParams: params,
              videoStartTime: Date.now()
            } : s)
          } as Episode;
        }
        return e;
      });
      return { ...prev, episodes: newEpisodes };
    });

    try {
      const { id } = await VideoService.submitVideoTask(customPrompt, config.videoConfig, params);
      setProjectData(prev => {
        const newEpisodes = prev.episodes.map(e => {
          if (e.id === episodeId) {
            return {
              ...e,
              shots: e.shots.map(s => s.id === shotId ? {
                ...s,
                videoStatus: 'queued',
                videoId: id,
              } : s)
            } as Episode;
          }
          return e;
        });
        return { ...prev, episodes: newEpisodes };
      });
    } catch (e: any) {
      setProjectData(prev => {
        const newEpisodes = prev.episodes.map(ep => {
          if (ep.id === episodeId) {
            return {
              ...ep,
              shots: ep.shots.map(s => s.id === shotId ? { ...s, videoStatus: 'error', videoErrorMsg: e.message } : s)
            } as Episode;
          }
          return ep;
        });
        return { ...prev, episodes: newEpisodes };
      });
    }
  };

  const handleRemixVideo = async (episodeId: number, shotId: string, customPrompt: string, originalVideoId: string) => {
    if (!config.videoConfig.apiKey || !config.videoConfig.baseUrl) return;

    setProjectData(prev => {
      const newEpisodes = prev.episodes.map(e => {
        if (e.id === episodeId) {
          return {
            ...e,
            shots: e.shots.map(s => s.id === shotId ? {
              ...s,
              videoStatus: 'queued',
              videoErrorMsg: undefined,
              finalVideoPrompt: customPrompt,
              videoStartTime: Date.now()
            } : s)
          } as Episode;
        }
        return e;
      });
      return { ...prev, episodes: newEpisodes };
    });

    try {
      const { id } = await VideoService.remixVideo(originalVideoId, customPrompt, config.videoConfig);
      setProjectData(prev => {
        const newEpisodes = prev.episodes.map(e => {
          if (e.id === episodeId) {
            return {
              ...e,
              shots: e.shots.map(s => s.id === shotId ? {
                ...s,
                videoStatus: 'queued',
                videoId: id
              } : s)
            } as Episode;
          }
          return e;
        });
        return { ...prev, episodes: newEpisodes };
      });
    } catch (e: any) {
      setProjectData(prev => {
        const newEpisodes = prev.episodes.map(ep => {
          if (ep.id === episodeId) {
            return {
              ...ep,
              shots: ep.shots.map(s => s.id === shotId ? { ...s, videoStatus: 'error', videoErrorMsg: e.message } : s)
            } as Episode;
          }
          return ep;
        });
        return { ...prev, episodes: newEpisodes };
      });
    }
  };

  // --- Render Helpers ---
  const currentEpisode = projectData.episodes[currentEpIndex];
  const hasGeneratedShots = projectData.episodes.some(ep => ep.shots.length > 0);
  const hasUnderstandingData = Boolean(
    projectData.context.projectSummary ||
    projectData.context.episodeSummaries.length > 0 ||
    projectData.context.characters.length > 0 ||
    projectData.context.locations.length > 0
  );
  const getActiveModelName = () => {
    if (activeTab === 'visuals') return config.multimodalConfig.model || 'Multimodal';
    if (activeTab === 'video') return config.videoConfig.model || 'Video';
    return config.textConfig.model;
  };
  const statusLabel = (status: SyncStatus) => {
    switch (status) {
      case "synced":
        return "已同步";
      case "syncing":
        return "同步中";
      case "loading":
        return "加载中";
      case "conflict":
        return "冲突";
      case "error":
        return "错误";
      case "offline":
        return "离线";
      case "disabled":
        return "仅本地";
      case "idle":
      default:
        return "就绪";
    }
  };
  const aggregateSyncStatus = () => {
    if (!isOnline) return { state: "offline" as const, label: statusLabel("offline") };
    const statuses = [syncState.project.status, syncState.secrets.status].filter((s) => s !== "disabled");
    if (statuses.includes("error")) return { state: "error" as const, label: statusLabel("error") };
    if (statuses.includes("conflict")) return { state: "conflict" as const, label: statusLabel("conflict") };
    if (statuses.includes("syncing") || statuses.includes("loading")) return { state: "syncing" as const, label: statusLabel("syncing") };
    if (statuses.length === 0) return { state: "disabled" as const, label: statusLabel("disabled") };
    if (statuses.includes("idle")) return { state: "idle" as const, label: statusLabel("idle") };
    return { state: "synced" as const, label: statusLabel("synced") };
  };
  const syncIndicator = (() => {
    const agg = aggregateSyncStatus();
    const colorMap: Record<string, string> = {
      synced: "#34d399",
      syncing: "#38bdf8",
      loading: "#38bdf8",
      conflict: "#fbbf24",
      error: "#f87171",
      offline: "#9ca3af",
      disabled: "#9ca3af",
      idle: "#a5b4fc",
    };
    return { label: agg.label, color: colorMap[agg.state] || "#a5b4fc" };
  })();
  const providerLabel = config.textConfig.provider === 'gemini'
    ? 'Gemini'
    : config.textConfig.provider === 'openrouter'
      ? 'OpenRouter'
      : config.textConfig.provider === 'deyunai'
        ? 'DeyunAI'
        : config.textConfig.provider === 'qwen'
          ? 'Qwen'
          : 'Partner';
  const activeModelLabel = `${providerLabel} | ${getActiveModelName()}`;
  const safeEpisode = currentEpisode || projectData.episodes[0];
  const tabOptions: { key: ActiveTab; label: string; icon: LucideIcon; hidden?: boolean }[] = [];

  const handleExportCsv = () => exportToCSV(projectData.episodes);
  const handleExportXls = () => exportToXLS(projectData.episodes);
  const handleExportUnderstandingJson = () => exportUnderstandingToJSON(projectData);

  const headerNode = null;

  const renderTabContent = (tabKey: ActiveTab) => {
    switch (tabKey) {
      case 'assets':
        return <AssetsModule data={projectData} setProjectData={setProjectData} onAssetLoad={handleAssetLoad} />;
      case 'script':
        return <ScriptViewer episode={safeEpisode} rawScript={projectData.rawScript} characters={projectData.context.characters} />;
      case 'table':
        return (
          <ShotsModule
            shots={projectData.episodes[currentEpIndex]?.shots || []}
            showSora={step >= WorkflowStep.GENERATE_SORA}
          />
        );
      case 'lab':
        return (
          <div className="h-full">
            <NodeLab
              projectData={projectData}
              setProjectData={setProjectData}
              onOpenModule={handleOpenLabModule}
              syncIndicator={syncIndicator}
              onExportCsv={handleExportCsv}
              onExportXls={handleExportXls}
              onExportUnderstandingJson={handleExportUnderstandingJson}
              onToggleTheme={toggleTheme}
              isDarkMode={isDarkMode}
              onOpenSettings={openSettings}
              onResetProject={handleResetProject}
              onSignOut={() => signOut()}
              onOpenStats={handleOpenStats}
              accountInfo={{
                isLoaded: isUserLoaded,
                isSignedIn: !!userSignedIn,
                name: user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "Qalam User",
                email: user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress,
                avatarUrl: avatarUrl || user?.imageUrl,
                onSignIn: () => openSignIn(),
                onSignOut: () => signOut(),
                onUploadAvatar: handleAvatarUploadClick,
              }}
              onTryMe={handleTryMe}
              onToggleWorkflow={() => setShowWorkflow((v) => !v)}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const renderMainContent = () => {
    if (splitTab) {
      return (
        <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 md:px-6 pb-4 overflow-hidden">
          <div className="min-h-0 overflow-hidden rounded-2xl border border-[var(--border-subtle)]/60 bg-[var(--bg-panel)]/60">
            <div className="h-full overflow-auto">{renderTabContent(activeTab)}</div>
          </div>
          <div className="min-h-0 overflow-hidden rounded-2xl border border-[var(--border-subtle)]/60 bg-[var(--bg-panel)]/60">
            <div className="h-full overflow-auto">{renderTabContent(splitTab)}</div>
          </div>
        </div>
      );
    }

    return renderTabContent(activeTab);
  };

  let labModalTitle: string | null = null;
  let labModalWidth: number | string | undefined = undefined;
  let labModalContent: React.ReactNode = null;
  if (openLabModal === "assets") {
    labModalTitle = "Assets";
    labModalWidth = 1040;
    labModalContent = (
      <AssetsModule data={projectData} setProjectData={setProjectData} onAssetLoad={handleAssetLoad} />
    );
  } else if (openLabModal === "script") {
    labModalTitle = "Script";
    labModalWidth = 960;
    labModalContent = (
      <ScriptViewer episode={safeEpisode} rawScript={projectData.rawScript} characters={projectData.context.characters} />
    );
  } else if (openLabModal === "shots") {
    labModalTitle = "Shots";
    labModalWidth = 1100;
    labModalContent = (
      <ShotsModule shots={projectData.episodes[currentEpIndex]?.shots || []} showSora={step >= WorkflowStep.GENERATE_SORA} />
    );
  }

  return (
    <>
      <AppShell
        isDarkMode={isDarkMode}
        header={null}
        banner={
          !isSyncBannerDismissed && (
            <SyncStatusBanner
              syncState={syncState}
              isOnline={isOnline}
              isSignedIn={!!authSignedIn}
              syncRollout={syncRollout}
              onOpenDetails={() => openSettings('sync')}
              onForceSync={forceCloudPull}
              onClose={() => setIsSyncBannerDismissed(true)}
            />
          )
        }
      >
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={closeSettings}
          config={config}
          onConfigChange={setConfig}
          isSignedIn={!!authSignedIn}
          getAuthToken={getAuthToken}
          onForceSync={forceCloudPull}
          syncState={syncState}
          syncRollout={syncRollout}
          activeTabOverride={settingsTab || undefined}
          onResetProject={handleResetProject}
        />
        {activeConflict && (
          <ConflictModal
            isOpen={!!activeConflict}
            remoteData={activeConflict.remote}
            localData={activeConflict.local}
            mode={activeConflict.mode}
            onUseRemote={activeConflict.mode === 'decision' ? () => handleConflictChoice(true) : undefined}
            onKeepLocal={activeConflict.mode === 'decision' ? () => handleConflictChoice(false) : undefined}
            onAcknowledge={activeConflict.mode === 'notice' ? handleConflictAcknowledge : undefined}
          />
        )}
        <input
          type="file"
          accept="image/*"
          ref={avatarFileInputRef}
          className="hidden"
          onChange={handleAvatarFileChange}
        />
        {renderMainContent()}
        {labModalTitle && labModalContent && (
          <FloatingPanelShell title={labModalTitle} isOpen onClose={closeLabModal} width={labModalWidth}>
            {labModalContent}
          </FloatingPanelShell>
        )}
        {showStatsModal && (
          <FloatingPanelShell title="Dashboard" isOpen onClose={closeStats} width={960}>
            <Dashboard data={projectData} isDarkMode={isDarkMode} />
          </FloatingPanelShell>
        )}
      </AppShell>
      {showWorkflow && (
        <div className="fixed bottom-16 left-6 z-[60] pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
          <WorkflowCard
            workflow={{
              step,
              analysisStep,
              analysisQueueLength: analysisQueue.length,
              analysisTotal,
              isProcessing,
              analysisError,
              currentEpIndex,
              episodes: projectData.episodes,
              setCurrentEpIndex,
              setStep,
              setAnalysisStep,
              onStartAnalysis: startAnalysis,
              onConfirmSummaryNext: confirmSummaryAndNext,
              onConfirmEpSummariesNext: confirmEpSummariesAndNext,
              onConfirmCharListNext: confirmCharListAndNext,
              onConfirmCharDepthNext: confirmCharDepthAndNext,
              onConfirmLocListNext: confirmLocListAndNext,
              onFinishAnalysis: finishAnalysis,
              onRetryAnalysis: retryAnalysisStep,
              onStartPhase2: startPhase2,
              onConfirmEpisodeShots: confirmEpisodeShots,
              onRetryEpisodeShots: retryCurrentEpisodeShots,
              onStartPhase3: startPhase3,
              onRetryEpisodeSora: retryCurrentEpisodeSora,
              onContinueNextEpisodeSora: continueNextEpisodeSora,
            }}
          />
        </div>
      )}
    </>
  );
};

export default App;
