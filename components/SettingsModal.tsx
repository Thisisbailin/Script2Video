
import React, { useEffect, useRef, useState } from 'react';
import { AppConfig, TextProvider, SyncState } from '../types';
import { AVAILABLE_MODELS, PARTNER_TEXT_BASE_URL } from '../constants';
import * as VideoService from '../services/videoService';
import * as GeminiService from '../services/geminiService';
import * as MultimodalService from '../services/multimodalService';
import { X, Video, Cpu, Key, Globe, RefreshCw, CheckCircle, AlertCircle, Loader2, Zap, Image as ImageIcon, Info, Sparkles, BrainCircuit, Film, Copy, Shield } from 'lucide-react';
import { getDeviceId } from '../utils/device';
import { buildApiUrl } from '../utils/api';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    config: AppConfig;
    onConfigChange: (c: AppConfig) => void;
    isSignedIn?: boolean;
    getAuthToken?: () => Promise<string | null>;
    onForceSync?: () => void;
    syncState?: SyncState;
    syncRollout?: { enabled: boolean; percent: number; bucket?: number | null; allowlisted?: boolean };
    activeTabOverride?: 'text' | 'multimodal' | 'video' | 'sync' | 'about';
}

import { useWorkflowStore } from '../node-workspace/store/workflowStore';

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, config, onConfigChange, isSignedIn, getAuthToken, onForceSync, syncState, syncRollout, activeTabOverride }) => {
    const [activeTab, setActiveTab] = useState<'text' | 'multimodal' | 'video' | 'sync' | 'about'>('text');
    const deviceIdRef = useRef<string>(getDeviceId());
    const { setAvailableImageModels: setAvailableImageModelsStore, setAvailableVideoModels: setAvailableVideoModelsStore, applyViduReferenceDemo } = useWorkflowStore();

    // Model Fetch States
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [modelFetchMessage, setModelFetchMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

    const [isLoadingTextModels, setIsLoadingTextModels] = useState(false);
    const [textModelFetchMessage, setTextModelFetchMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

    const [isLoadingMultiModels, setIsLoadingMultiModels] = useState(false);
    const [multiModelFetchMessage, setMultiModelFetchMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

    const [availableVideoModels, setAvailableVideoModels] = useState<string[]>([]);
    const [availableTextModels, setAvailableTextModels] = useState<string[]>([]);
    const [availableMultiModels, setAvailableMultiModels] = useState<string[]>([]);

    const [snapshots, setSnapshots] = useState<{ version: number; createdAt: number }[]>([]);
    const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
    const [snapshotMessage, setSnapshotMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
    const [isRestoringSnapshot, setIsRestoringSnapshot] = useState(false);
    const [auditEntries, setAuditEntries] = useState<Array<{ id: number; action: string; status: string; createdAt: number; detail: Record<string, unknown> }>>([]);
    const [isLoadingAudit, setIsLoadingAudit] = useState(false);
    const [auditMessage, setAuditMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

    const projectSync = syncState?.project;
    const secretsSync = syncState?.secrets;
    const syncAllowed = syncRollout?.enabled ?? true;
    const syncPercent = syncRollout?.percent ?? 100;
    const syncIsRollout = syncPercent < 100;
    const [showViduOverlay, setShowViduOverlay] = useState(false);

    useEffect(() => {
        if (isOpen && activeTabOverride) {
            setActiveTab(activeTabOverride);
        }
    }, [activeTabOverride, isOpen]);

    useEffect(() => {
        if (isOpen && config.videoProvider === 'vidu') {
            setShowViduOverlay(true);
        }
    }, [config.videoProvider, isOpen]);

    const formatSnapshotTime = (ts: number) => new Date(ts).toLocaleString();
    const formatSyncTime = (ts?: number) => (ts ? new Date(ts).toLocaleString() : "—");
    const formatAuditDetail = (detail: Record<string, unknown>) => {
        const parts: string[] = [];
        if (typeof detail.updatedAt === "number") parts.push(`v${detail.updatedAt}`);
        if (typeof detail.episodes === "number") parts.push(`eps ${detail.episodes}`);
        if (typeof detail.shots === "number") parts.push(`shots ${detail.shots}`);
        if (typeof detail.version === "number") parts.push(`snapshot ${detail.version}`);
        if (typeof detail.mode === "string") parts.push(`mode ${detail.mode}`);
        if (typeof detail.reason === "string") parts.push(`reason: ${detail.reason}`);
        if (typeof detail.error === "string") parts.push(`error: ${detail.error}`);
        if (typeof detail.textKey === "boolean") parts.push(`textKey ${detail.textKey ? "yes" : "no"}`);
        if (typeof detail.multiKey === "boolean") parts.push(`multiKey ${detail.multiKey ? "yes" : "no"}`);
        if (typeof detail.videoKey === "boolean") parts.push(`videoKey ${detail.videoKey ? "yes" : "no"}`);
        if (typeof detail.deviceId === "string") parts.push(`device ${detail.deviceId}`);
        return parts.join(" · ");
    };

    const isViduEndpoint = () => {
        const url = config.videoConfig?.baseUrl?.toLowerCase() || '';
        const model = config.videoConfig?.model?.toLowerCase() || '';
        return url.includes("api.deyunai.com") || url.includes("vidu") || model.includes("vidu");
    };

    const viduDemoAudioPayload = {
        mode: "audioVideo",
        audioParams: {
            model: "viduq2-pro",
            subjects: [
                { id: "subject1", images: ["https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/image2video.png", "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-1.png", "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-2.png"], voiceId: "professional_host" },
                { id: "subject2", images: ["https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-3.png", "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/startend2video-1.jpeg", "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/startend2video-2.jpeg"], voiceId: "professional_host" },
                { id: "subject3", images: ["https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/scene-template/hug.jpeg", "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-1.png", "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-2.png"], voiceId: "professional_host" }
            ],
            prompt: "@1 和 @2 在一起吃火锅，并且旁白音说火锅大家都爱吃。",
            duration: 10,
            audio: true,
            offPeak: true
        }
    };

    const viduDemoVisualPayload = {
        mode: "videoOnly",
        visualParams: {
            model: "viduq2-pro",
            images: [
                "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-1.png",
                "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-2.png",
                "https://prod-ss-images.s3.cn-northwest-1.amazonaws.com.cn/vidu-maas/template/reference2video-3.png"
            ],
            prompt: "Santa Claus and the bear hug by the lakeside.",
            duration: 10,
            seed: 0,
            aspectRatio: "16:9",
            resolution: "1080p",
            movementAmplitude: "auto",
            offPeak: true,
            audio: false
        }
    };

    const copyViduPayload = async (payload: unknown) => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
            setModelFetchMessage({ type: 'success', text: 'Vidu 演示 payload 已复制' });
        } catch (err) {
            setModelFetchMessage({ type: 'error', text: '复制失败，请手动复制' });
        }
    };

    const handleVideoProviderChange = (provider: 'default' | 'vidu') => {
        onConfigChange({
            ...config,
            videoProvider: provider
        });
        if (provider === 'vidu') {
            applyViduReferenceDemo();
            setShowViduOverlay(true);
        }
    };
    const statusLabel = (status?: string) => {
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

    const fetchSnapshots = async () => {
        if (!syncAllowed) {
            setSnapshotMessage({ type: 'error', text: "Cloud sync is not enabled for this account yet." });
            return;
        }
        if (!getAuthToken || !isSignedIn) {
            setSnapshotMessage({ type: 'error', text: "Sign in to view cloud snapshots." });
            return;
        }
        setIsLoadingSnapshots(true);
        setSnapshotMessage(null);
        try {
            const token = await getAuthToken();
            if (!token) {
                setSnapshotMessage({ type: 'error', text: "Auth token missing. Please re-login." });
                return;
            }
            const res = await fetch(buildApiUrl("/api/project-snapshots"), {
                headers: { authorization: `Bearer ${token}`, "x-device-id": deviceIdRef.current }
            });
            if (!res.ok) {
                throw new Error(`Failed to load snapshots (${res.status})`);
            }
            const data = await res.json();
            setSnapshots(Array.isArray(data?.snapshots) ? data.snapshots : []);
            setSnapshotMessage({ type: 'success', text: "Snapshots loaded." });
        } catch (e: any) {
            setSnapshotMessage({ type: 'error', text: e.message || "Failed to load snapshots." });
        } finally {
            setIsLoadingSnapshots(false);
        }
    };

    const restoreSnapshot = async (version: number) => {
        if (!syncAllowed) {
            setSnapshotMessage({ type: 'error', text: "Cloud sync is not enabled for this account yet." });
            return;
        }
        if (!getAuthToken || !isSignedIn) {
            setSnapshotMessage({ type: 'error', text: "Sign in to restore snapshots." });
            return;
        }
        const confirmRestore = window.confirm("确定恢复该快照？恢复后将覆盖云端数据，并在下次同步时更新本地。");
        if (!confirmRestore) return;
        setIsRestoringSnapshot(true);
        try {
            const token = await getAuthToken();
            if (!token) {
                setSnapshotMessage({ type: 'error', text: "Auth token missing. Please re-login." });
                return;
            }
            const res = await fetch(buildApiUrl("/api/project-restore"), {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    authorization: `Bearer ${token}`,
                    "x-device-id": deviceIdRef.current
                },
                body: JSON.stringify({ version })
            });
            if (!res.ok) {
                throw new Error(`Restore failed (${res.status})`);
            }
            setSnapshotMessage({ type: 'success', text: "Snapshot restored. Sync will refresh local data shortly." });
            onForceSync?.();
            await fetchSnapshots();
        } catch (e: any) {
            setSnapshotMessage({ type: 'error', text: e.message || "Restore failed." });
        } finally {
            setIsRestoringSnapshot(false);
        }
    };

    const fetchAuditLogs = async () => {
        if (!syncAllowed) {
            setAuditMessage({ type: 'error', text: "Cloud sync is not enabled for this account yet." });
            return;
        }
        if (!getAuthToken || !isSignedIn) {
            setAuditMessage({ type: 'error', text: "Sign in to view audit logs." });
            return;
        }
        setIsLoadingAudit(true);
        setAuditMessage(null);
        try {
            const token = await getAuthToken();
            if (!token) {
                setAuditMessage({ type: 'error', text: "Auth token missing. Please re-login." });
                return;
            }
            const res = await fetch(buildApiUrl("/api/sync-audit"), {
                headers: { authorization: `Bearer ${token}`, "x-device-id": deviceIdRef.current }
            });
            if (!res.ok) {
                throw new Error(`Failed to load logs (${res.status})`);
            }
            const data = await res.json();
            setAuditEntries(Array.isArray(data?.entries) ? data.entries : []);
            setAuditMessage({ type: 'success', text: "Logs loaded." });
        } catch (e: any) {
            setAuditMessage({ type: 'error', text: e.message || "Failed to load logs." });
        } finally {
            setIsLoadingAudit(false);
        }
    };

    // Video Models Fetcher
    const handleFetchVideoModels = async () => {
        const { baseUrl, apiKey } = config.videoConfig;
        if (!baseUrl || !apiKey) {
            setModelFetchMessage({ type: 'error', text: "Please enter URL and API Key first." });
            return;
        }

        // Check if it's a submit URL - if so, skip model fetch and just "ping"
        if (baseUrl.includes('/submit')) {
            setModelFetchMessage({
                type: 'success',
                text: "Submission URL detected. Model fetching skipped (Mode: Direct Submit)."
            });
            return;
        }

        setIsLoadingModels(true);
        setModelFetchMessage(null);
        try {
            const models = await VideoService.fetchModels(baseUrl, apiKey);
            if (models.length > 0) {
                setAvailableVideoModels(models);
                setAvailableVideoModelsStore(models);
                setModelFetchMessage({ type: 'success', text: `Found ${models.length} models.` });
                if (!config.videoConfig.model) {
                    onConfigChange({ ...config, videoConfig: { ...config.videoConfig, model: models[0] } });
                }
            } else {
                setAvailableVideoModels([]);
                // Only show success if no error was thrown
                setModelFetchMessage({ type: 'success', text: "Connection reachable, but no models list returned." });
            }
        } catch (e: any) {
            setModelFetchMessage({ type: 'error', text: e.message || "Failed to connect." });
        } finally {
            setIsLoadingModels(false);
        }
    };

    // Text Models Fetcher (OpenRouter)
    const handleFetchTextModels = async () => {
        const { baseUrl, apiKey } = config.textConfig;
        if (!baseUrl || !apiKey) {
            setTextModelFetchMessage({ type: 'error', text: "Please enter URL and API Key first." });
            return;
        }
        setIsLoadingTextModels(true);
        setTextModelFetchMessage(null);
        try {
            const models = await GeminiService.fetchTextModels(baseUrl, apiKey);
            if (models.length > 0) {
                setAvailableTextModels(models);
                setTextModelFetchMessage({ type: 'success', text: `Found ${models.length} models.` });
            } else {
                setTextModelFetchMessage({ type: 'success', text: "Connection OK. No models listed." });
            }
        } catch (e: any) {
            setTextModelFetchMessage({ type: 'error', text: e.message });
        } finally {
            setIsLoadingTextModels(false);
        }
    };

    // Multimodal Models Fetcher
    const handleFetchMultiModels = async () => {
        const { baseUrl, apiKey } = config.multimodalConfig;
        if (!baseUrl || !apiKey) {
            setMultiModelFetchMessage({ type: 'error', text: "Please enter URL and API Key first." });
            return;
        }
        setIsLoadingMultiModels(true);
        setMultiModelFetchMessage(null);
        try {
            const models = await MultimodalService.fetchMultimodalModels(baseUrl, apiKey);
            if (models.length > 0) {
                setAvailableMultiModels(models);
                setAvailableImageModelsStore(models);
                setMultiModelFetchMessage({ type: 'success', text: `Found ${models.length} models.` });
            } else {
                setMultiModelFetchMessage({ type: 'success', text: "Connection OK. No models listed." });
            }
        } catch (e: any) {
            setMultiModelFetchMessage({ type: 'error', text: e.message });
        } finally {
            setIsLoadingMultiModels(false);
        }
    };

    const setProvider = (p: TextProvider) => {
        const nextConfig = { ...config.textConfig };
        if (p === 'gemini') {
            nextConfig.baseUrl = '';
            nextConfig.model = 'gemini-2.5-flash';
            nextConfig.apiKey = config.textConfig.apiKey || '';
        } else if (p === 'openrouter') {
            nextConfig.baseUrl = config.textConfig.baseUrl || 'https://openrouter.ai/api/v1';
            nextConfig.model = config.textConfig.model || '';
        } else {
            // partner: fully managed endpoint
            nextConfig.baseUrl = PARTNER_TEXT_BASE_URL;
            nextConfig.model = 'partner-text-pro';
            nextConfig.apiKey = '';
        }
        onConfigChange({
            ...config,
            textConfig: {
                ...nextConfig,
                provider: p,
            }
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity">
            <div className="bg-[var(--bg-panel)] rounded-xl border border-[var(--border-subtle)] w-full max-w-4xl p-0 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col transition-colors text-[var(--text-primary)]">

                {/* Header */}
                <div className="bg-[var(--bg-panel)]/85 px-6 py-4 flex justify-between items-center border-b border-[var(--border-subtle)] shrink-0">
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">System Settings</h2>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] shrink-0">
                    <button
                        onClick={() => setActiveTab('text')}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'text' ? 'bg-white/5 text-[var(--accent-blue)] border-b-2 border-[var(--accent-blue)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'}`}
                    >
                        <Cpu size={16} /> Text
                    </button>
                    <button
                        onClick={() => setActiveTab('multimodal')}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'multimodal' ? 'bg-white/5 text-pink-300 border-b-2 border-pink-500/70' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'}`}
                    >
                        <ImageIcon size={16} /> Visuals
                    </button>
                    <button
                        onClick={() => setActiveTab('video')}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'video' ? 'bg-white/5 text-indigo-300 border-b-2 border-indigo-500/70' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'}`}
                    >
                        <Video size={16} /> Video
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('sync');
                            fetchSnapshots();
                            fetchAuditLogs();
                        }}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'sync' ? 'bg-white/5 text-emerald-300 border-b-2 border-emerald-500/70' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'}`}
                    >
                        <RefreshCw size={16} /> Sync
                    </button>
                    <button
                        onClick={() => setActiveTab('about')}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'about' ? 'bg-white/5 text-[var(--text-primary)] border-b-2 border-[var(--border-subtle)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'}`}
                        title="About Project"
                    >
                        <Info size={16} /> Info
                    </button>
                </div>

                <div className="p-6 overflow-y-auto text-[var(--text-primary)]">
                    {activeTab === 'sync' && (
                        <>
                            <div className="mb-4 p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)]/70 flex items-start gap-3">
                                <input
                                    id="rememberKeys"
                                    type="checkbox"
                                    className="mt-1 h-4 w-4 text-[var(--accent-blue)] border-[var(--border-subtle)] rounded focus:ring-[var(--accent-blue)] bg-[var(--bg-panel)]"
                                    checked={!!config.rememberApiKeys}
                                    onChange={(e) => {
                                        onConfigChange({
                                            ...config,
                                            rememberApiKeys: e.target.checked,
                                        });
                                    }}
                                />
                                <label htmlFor="rememberKeys" className="text-sm text-[var(--text-secondary)] leading-tight">
                                    记住 API 密钥到本地（默认不落盘，刷新后需重新输入）。勾选后密钥会写入浏览器存储，请仅在可信设备使用。
                                </label>
                            </div>
                            <div className="mb-6 p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)]/70 flex items-start gap-3">
                                <input
                                    id="syncKeys"
                                    type="checkbox"
                                    className="mt-1 h-4 w-4 text-[var(--accent-blue)] border-[var(--border-subtle)] rounded focus:ring-[var(--accent-blue)] bg-[var(--bg-panel)]"
                                    checked={!!config.syncApiKeys}
                                    onChange={(e) => {
                                        onConfigChange({
                                            ...config,
                                            syncApiKeys: e.target.checked,
                                        });
                                    }}
                                />
                                <label htmlFor="syncKeys" className="text-sm text-[var(--text-secondary)] leading-tight">
                                    云端同步密钥（与账户绑定）。勾选后密钥将存入服务器，请确认账号安全。
                                </label>
                            </div>
                        </>
                    )}
                    {activeTab === 'text' && (
                        <div className="space-y-6">
                            {/* Provider Switcher */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Provider</label>
                                <div className="flex rounded-lg bg-[var(--bg-panel)]/80 p-1 border border-[var(--border-subtle)]">
                                    <button
                                        onClick={() => setProvider('gemini')}
                                        className={`flex-1 py-2 text-sm rounded-md transition-all flex items-center justify-center gap-2 ${config.textConfig.provider === 'gemini' ? 'bg-[var(--accent-blue)] text-white shadow' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--accent-blue)]'}`}
                                    >
                                        <Zap size={14} /> Google Gemini
                                    </button>
                                    <button
                                        onClick={() => setProvider('openrouter')}
                                        className={`flex-1 py-2 text-sm rounded-md transition-all flex items-center justify-center gap-2 ${config.textConfig.provider === 'openrouter' ? 'bg-[var(--accent-blue)] text-white shadow' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--accent-blue)]'}`}
                                    >
                                        <Globe size={14} /> OpenRouter / OpenAI
                                    </button>
                                    <button
                                        onClick={() => setProvider('partner')}
                                        className={`flex-1 py-2 text-sm rounded-md transition-all flex items-center justify-center gap-2 ${config.textConfig.provider === 'partner' ? 'bg-[var(--accent-blue)] text-white shadow' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--accent-blue)]'}`}
                                    >
                                        <Shield size={14} /> Partner Route
                                    </button>
                                </div>
                            </div>

                            {/* Configuration Content */}
                            {config.textConfig.provider === 'gemini' ? (
                                <div className="space-y-4 bg-[var(--bg-panel)]/70 p-4 rounded-lg border border-[var(--border-subtle)]">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Gemini Model</label>
                                        <select
                                            value={config.textConfig.model}
                                            onChange={(e) => onConfigChange({ ...config, textConfig: { ...config.textConfig, model: e.target.value } })}
                                            className="w-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-blue)] focus:outline-none"
                                        >
                                            {AVAILABLE_MODELS.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-2">
                                            <Key size={14} /> API Key
                                        </label>
                                        <input
                                            type="password"
                                            placeholder="AIza..."
                                            value={config.textConfig.apiKey || ''}
                                            onChange={(e) => onConfigChange({ ...config, textConfig: { ...config.textConfig, apiKey: e.target.value } })}
                                            className="w-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-blue)] focus:outline-none"
                                        />
                                        <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-1">
                                            <CheckCircle size={12} className="text-green-500" />
                                            支持手动填写，留空时会使用环境变量 VITE_GEMINI_API_KEY。
                                        </p>
                                    </div>
                                </div>
                            ) : config.textConfig.provider === 'openrouter' ? (
                                <div className="space-y-4 bg-[var(--bg-panel)]/70 p-4 rounded-lg border border-[var(--border-subtle)]">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-2">
                                            <Globe size={14} /> API Endpoint URL
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="https://openrouter.ai/api/v1"
                                            value={config.textConfig.baseUrl || ''}
                                            onChange={(e) => onConfigChange({ ...config, textConfig: { ...config.textConfig, baseUrl: e.target.value } })}
                                            className="w-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-blue)] focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-2">
                                            <Key size={14} /> API Key
                                        </label>
                                        <input
                                            type="password"
                                            placeholder="sk-or-..."
                                            value={config.textConfig.apiKey || ''}
                                            onChange={(e) => onConfigChange({ ...config, textConfig: { ...config.textConfig, apiKey: e.target.value } })}
                                            className="w-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-blue)] focus:outline-none"
                                        />
                                    </div>

                                    {/* Fetch & Select Text Model */}
                                    <div className="pt-2 border-t border-[var(--border-subtle)]/60">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-sm font-medium text-[var(--text-secondary)]">Target Model</label>
                                            <button
                                                onClick={handleFetchTextModels}
                                                disabled={isLoadingTextModels}
                                                className="text-xs flex items-center gap-1 text-[var(--accent-blue)] hover:text-sky-300 disabled:opacity-50"
                                            >
                                                {isLoadingTextModels ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                                Fetch Models
                                            </button>
                                        </div>
                                        {textModelFetchMessage && (
                                            <p className={`text-xs mb-2 flex items-center gap-1 ${textModelFetchMessage.type === 'error' ? 'text-red-500' : 'text-green-400'}`}>
                                                {textModelFetchMessage.type === 'error' ? <AlertCircle size={10} /> : <CheckCircle size={10} />}
                                                {textModelFetchMessage.text}
                                            </p>
                                        )}
                                        {availableTextModels.length > 0 ? (
                                            <select
                                                value={config.textConfig.model}
                                                onChange={(e) => onConfigChange({ ...config, textConfig: { ...config.textConfig, model: e.target.value } })}
                                                className="w-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-blue)] focus:outline-none"
                                            >
                                                <option value="">Select a model...</option>
                                                {availableTextModels.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                placeholder="e.g. google/gemini-pro-1.5"
                                                value={config.textConfig.model}
                                                onChange={(e) => onConfigChange({ ...config, textConfig: { ...config.textConfig, model: e.target.value } })}
                                                className="w-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-blue)] focus:outline-none"
                                            />
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 bg-[var(--bg-panel)]/70 p-4 rounded-lg border border-[var(--border-subtle)]">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="text-sm font-semibold text-[var(--text-primary)]">合作专线 · 自动配置</div>
                                            <div className="text-xs text-[var(--text-secondary)]">使用内置密钥与专属网关，无需填写。</div>
                                        </div>
                                        <span className="px-2 py-1 rounded-full text-[11px] bg-white/5 border border-[var(--border-subtle)] text-[var(--text-secondary)]">Managed</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">模型</label>
                                            <input
                                                value={config.textConfig.model || 'partner-text-pro'}
                                                readOnly
                                                className="w-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-[var(--text-primary)] opacity-70"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Base URL</label>
                                            <input
                                                value={config.textConfig.baseUrl || PARTNER_TEXT_BASE_URL}
                                                readOnly
                                                className="w-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-[var(--text-primary)] opacity-70"
                                            />
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-[var(--bg-panel)]/80 border border-dashed border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] leading-relaxed">
                                        专属合作通道，使用平台预置密钥与标识头部 <code className="px-1 py-0.5 rounded bg-black/40 text-[var(--text-primary)]">X-Partner-Integration: Qalam-NodeLab</code>。如需更新密钥/网关请修改环境变量 PARTNER_API_KEY / PARTNER_API_BASE。
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'multimodal' && (
                        <div className="space-y-4">
                            <div className="p-3 bg-[var(--bg-panel)]/70 border border-[var(--border-subtle)] rounded text-xs text-pink-200 mb-4">
                                Phase 4 uses Multimodal Intelligence to generate visual concepts. Use an OpenRouter or OpenAI compatible API that supports image generation or rich markdown responses (e.g., GPT-4o, Claude 3.5 Sonnet, etc).
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-2">
                                    <Globe size={14} /> API Endpoint URL
                                </label>
                                <input
                                    type="text"
                                    placeholder="https://openrouter.ai/api/v1"
                                    value={config.multimodalConfig?.baseUrl || ''}
                                    onChange={(e) => onConfigChange({
                                        ...config,
                                        multimodalConfig: { ...config.multimodalConfig, baseUrl: e.target.value }
                                    })}
                                    className="w-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-blue)] focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-2">
                                    <Key size={14} /> API Key
                                </label>
                                <input
                                    type="password"
                                    placeholder="sk-..."
                                    value={config.multimodalConfig?.apiKey || ''}
                                    onChange={(e) => onConfigChange({
                                        ...config,
                                        multimodalConfig: { ...config.multimodalConfig, apiKey: e.target.value }
                                    })}
                                    className="w-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-blue)] focus:outline-none"
                                />
                            </div>
                            <div className="pt-2 border-t border-[var(--border-subtle)]/60">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-[var(--text-secondary)]">Model</label>
                                    <button
                                        onClick={handleFetchMultiModels}
                                        disabled={isLoadingMultiModels}
                                        className="text-xs flex items-center gap-1 text-[var(--accent-blue)] hover:text-sky-300 disabled:opacity-50"
                                    >
                                        {isLoadingMultiModels ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                        Fetch Models
                                    </button>
                                </div>
                                {multiModelFetchMessage && (
                                    <p className={`text-xs mb-2 flex items-center gap-1 ${multiModelFetchMessage.type === 'error' ? 'text-red-500' : 'text-green-400'}`}>
                                        {multiModelFetchMessage.type === 'error' ? <AlertCircle size={10} /> : <CheckCircle size={10} />}
                                        {multiModelFetchMessage.text}
                                    </p>
                                )}
                                {availableMultiModels.length > 0 ? (
                                    <select
                                        value={config.multimodalConfig?.model || ''}
                                        onChange={(e) => onConfigChange({
                                            ...config,
                                            multimodalConfig: { ...config.multimodalConfig, model: e.target.value }
                                        })}
                                        className="w-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-blue)] focus:outline-none"
                                    >
                                        <option value="">Select a model...</option>
                                        {availableMultiModels.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="e.g. gpt-4o"
                                        value={config.multimodalConfig?.model || ''}
                                        onChange={(e) => onConfigChange({
                                            ...config,
                                            multimodalConfig: { ...config.multimodalConfig, model: e.target.value }
                                        })}
                                        className="w-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-blue)] focus:outline-none"
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'video' && (
                        <div className="space-y-4">
                            <div className="p-3 bg-[var(--bg-panel)]/70 border border-[var(--border-subtle)] rounded text-xs text-indigo-200 mb-4">
                                Phase 5 requires an external Video Generation API. You can use standard proxies (OneAPI) or direct endpoints.
                            </div>

                            <div className="grid md:grid-cols-2 gap-3">
                                <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]/40 space-y-2">
                                    <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">视频服务提供商</div>
                                    <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                        <input
                                            type="radio"
                                            checked={config.videoProvider !== 'vidu'}
                                            onChange={() => handleVideoProviderChange('default')}
                                        />
                                        默认（现有视频模型）
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                        <input
                                            type="radio"
                                            checked={config.videoProvider === 'vidu'}
                                            onChange={() => handleVideoProviderChange('vidu')}
                                        />
                                        Vidu 聚合平台
                                    </label>
                                    <p className="text-[11px] text-[var(--text-secondary)]">选择 Vidu 将自动载入参考生视频演示组，并使用 Cloudflare 环境变量 VIDU_API_KEY。</p>
                                </div>

                                {config.videoProvider === 'vidu' && (
                                    <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]/40 space-y-2">
                                        <div className="text-sm font-semibold text-[var(--text-primary)]">Vidu API</div>
                                        <input
                                            type="text"
                                            placeholder="https://api.deyunai.com/ent/v2"
                                            value={config.viduConfig?.baseUrl || ''}
                                            onChange={(e) => onConfigChange({
                                                ...config,
                                                viduConfig: { ...config.viduConfig, baseUrl: e.target.value }
                                            })}
                                            className="w-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-xs focus:ring-2 focus:ring-[var(--accent-blue)] focus:outline-none"
                                        />
                                        <div className="text-[11px] text-[var(--text-secondary)] p-2 bg-[var(--bg-panel)]/60 rounded border border-dashed border-[var(--border-subtle)]">
                                            已在 Pages 配置环境变量 <code>VIDU_API_KEY</code>，无需在此输入。
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="默认模型（如 viduq2-pro）"
                                            value={config.viduConfig?.defaultModel || ''}
                                            onChange={(e) => onConfigChange({
                                                ...config,
                                                viduConfig: { ...config.viduConfig, defaultModel: e.target.value }
                                            })}
                                            className="w-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-xs focus:ring-2 focus:ring-[var(--accent-blue)] focus:outline-none"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)]/80 p-3">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2 text-[var(--text-primary)] text-sm font-semibold">
                                        <Sparkles size={16} className="text-amber-300" />
                                        Vidu 参考生视频快速演示
                                    </div>
                                    <button
                                        onClick={() => setShowViduOverlay(!showViduOverlay)}
                                        className="text-xs px-3 py-1 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--accent-blue)] text-[var(--text-secondary)]"
                                    >
                                        {showViduOverlay ? "收起" : "展开"}
                                    </button>
                                </div>
                                {(showViduOverlay || isViduEndpoint()) && (
                                    <div className="space-y-3 text-xs text-[var(--text-secondary)]">
                                        <div className="p-3 rounded-lg bg-[var(--bg-muted)]/60 border border-[var(--border-subtle)]">
                                            <div className="flex items-start gap-2">
                                                <Info size={14} className="mt-0.5 text-[var(--accent-blue)]" />
                                                <div className="space-y-1">
                                                    <div className="text-[var(--text-primary)] font-medium">官方参考：音视频直出/纯视频共用 `reference2video`</div>
                                                    <div>默认启用音视频直出，模型 `viduq2-pro`，时长上限预填 10s，可编辑；分辨率 1080p，动效 `auto`，错峰模式已开启。</div>
                                                    <div>主体参考：示例 3 个主体，每个 3 张参考图，prompt 中用 <code>@1</code>/<code>@2</code>/<code>@3</code> 绑定。</div>
                                                    <div>切换到 Vidu 服务商时，可直接复制演示 payload 调用后端 `viduService.createReferenceVideo`。</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid md:grid-cols-2 gap-3">
                                            <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]/40">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="text-[var(--text-primary)] font-semibold">音视频直出示例</div>
                                                    <button
                                                        onClick={() => copyViduPayload(viduDemoAudioPayload)}
                                                        className="flex items-center gap-1 text-[var(--accent-blue)] hover:text-sky-300"
                                                    >
                                                        <Copy size={14} /> 复制
                                                    </button>
                                                </div>
                                                <pre className="text-[10px] whitespace-pre-wrap break-all bg-[var(--bg-panel)]/60 p-2 rounded border border-[var(--border-subtle)]">
{JSON.stringify(viduDemoAudioPayload, null, 2)}
                                                </pre>
                                            </div>
                                            <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]/40">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="text-[var(--text-primary)] font-semibold">纯视频直出示例</div>
                                                    <button
                                                        onClick={() => copyViduPayload(viduDemoVisualPayload)}
                                                        className="flex items-center gap-1 text-[var(--accent-blue)] hover:text-sky-300"
                                                    >
                                                        <Copy size={14} /> 复制
                                                    </button>
                                                </div>
                                                <pre className="text-[10px] whitespace-pre-wrap break-all bg-[var(--bg-panel)]/60 p-2 rounded border border-[var(--border-subtle)]">
{JSON.stringify(viduDemoVisualPayload, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                                    <Globe size={14} /> API Endpoint URL
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. https://api.wuyinkeji.com/api/sora2/submit"
                                    value={config.videoConfig?.baseUrl || ''}
                                    onChange={(e) => onConfigChange({
                                        ...config,
                                        videoConfig: { ...config.videoConfig, baseUrl: e.target.value }
                                    })}
                                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-gray-400 dark:placeholder-gray-600"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                                    <Key size={14} /> API Key
                                </label>
                                <input
                                    type="password"
                                    placeholder="sk-..."
                                    value={config.videoConfig?.apiKey || ''}
                                    onChange={(e) => onConfigChange({
                                        ...config,
                                        videoConfig: { ...config.videoConfig, apiKey: e.target.value }
                                    })}
                                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>

                            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Model ID <span className="text-gray-500 font-normal">(Optional)</span>
                                    </label>
                                    <button
                                        onClick={handleFetchVideoModels}
                                        disabled={isLoadingModels}
                                        className="text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 disabled:opacity-50"
                                    >
                                        {isLoadingModels ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                        Test Connection
                                    </button>
                                </div>

                                {modelFetchMessage && (
                                    <p className={`text-xs mb-2 flex items-center gap-1 ${modelFetchMessage.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                                        {modelFetchMessage.type === 'error' ? <AlertCircle size={10} /> : <CheckCircle size={10} />}
                                        {modelFetchMessage.text}
                                    </p>
                                )}

                                {availableVideoModels.length > 0 ? (
                                    <div className="relative">
                                        <select
                                            value={config.videoConfig?.model || ''}
                                            onChange={(e) => onConfigChange({
                                                ...config,
                                                videoConfig: { ...config.videoConfig, model: e.target.value }
                                            })}
                                            className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none"
                                        >
                                            {availableVideoModels.map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="Leave empty if URL implies model (e.g. sora2)"
                                        value={config.videoConfig?.model || ''}
                                        onChange={(e) => onConfigChange({
                                            ...config,
                                            videoConfig: { ...config.videoConfig, model: e.target.value }
                                        })}
                                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-gray-400 dark:placeholder-gray-600"
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'sync' && (
                        <div className="space-y-6">
                            {syncIsRollout && (
                                <div className="text-xs px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]/40 text-[var(--text-secondary)]">
                                    云端同步正在灰度发布（{syncPercent}%）。
                                    {syncAllowed ? "该账号已启用。" : "该账号暂未启用，当前仅本地保存。"}
                                </div>
                            )}
                            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]/70">
                                <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Sync Diagnostics</div>
                                {!syncState && (
                                    <div className="text-xs text-[var(--text-secondary)]">同步状态不可用。</div>
                                )}
                                {syncState && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]/40">
                                            <div className="text-xs font-semibold text-[var(--text-primary)] mb-2">Project</div>
                                            <div className="text-xs text-[var(--text-secondary)] space-y-1">
                                                <div>状态：{statusLabel(projectSync?.status)}</div>
                                                <div>最后同步：{formatSyncTime(projectSync?.lastSyncAt)}</div>
                                                <div>最近尝试：{formatSyncTime(projectSync?.lastAttemptAt)}</div>
                                                <div>待发送：{projectSync?.pendingOps ?? 0}</div>
                                                <div>重试次数：{projectSync?.retryCount ?? 0}</div>
                                                {projectSync?.lastError && (
                                                    <div className="text-rose-300">错误：{projectSync.lastError}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]/40">
                                            <div className="text-xs font-semibold text-[var(--text-primary)] mb-2">Secrets</div>
                                            <div className="text-xs text-[var(--text-secondary)] space-y-1">
                                                <div>状态：{statusLabel(secretsSync?.status)}</div>
                                                <div>最后同步：{formatSyncTime(secretsSync?.lastSyncAt)}</div>
                                                <div>最近尝试：{formatSyncTime(secretsSync?.lastAttemptAt)}</div>
                                                <div>待发送：{secretsSync?.pendingOps ?? 0}</div>
                                                <div>重试次数：{secretsSync?.retryCount ?? 0}</div>
                                                {secretsSync?.lastError && (
                                                    <div className="text-rose-300">错误：{secretsSync.lastError}</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]/70">
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <div>
                                        <div className="text-sm font-semibold text-[var(--text-primary)]">Cloud Snapshots</div>
                                        <div className="text-xs text-[var(--text-secondary)]">最近 20 条快照，仅在云端保存。</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                onForceSync?.();
                                                fetchSnapshots();
                                            }}
                                            className="px-3 py-1.5 rounded-lg text-xs border border-[var(--border-subtle)] hover:border-emerald-400 hover:text-emerald-200 transition"
                                            disabled={!syncAllowed}
                                        >
                                            Sync Now
                                        </button>
                                        <button
                                            onClick={fetchSnapshots}
                                            className="px-3 py-1.5 rounded-lg text-xs bg-[var(--accent-blue)] text-white hover:bg-sky-500 transition"
                                            disabled={isLoadingSnapshots || !syncAllowed}
                                        >
                                            {isLoadingSnapshots ? "Loading..." : "Refresh"}
                                        </button>
                                    </div>
                                </div>

                                {snapshotMessage && (
                                    <div className={`text-xs px-3 py-2 rounded-lg border ${snapshotMessage.type === 'error' ? 'border-red-400/60 text-red-300 bg-red-900/20' : 'border-emerald-400/60 text-emerald-200 bg-emerald-900/20'}`}>
                                        {snapshotMessage.text}
                                    </div>
                                )}

                                <div className="mt-4 space-y-2">
                                    {snapshots.length === 0 && (
                                        <div className="text-xs text-[var(--text-secondary)]">暂无快照记录。</div>
                                    )}
                                    {snapshots.map((snap) => (
                                        <div key={snap.version} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]/40">
                                            <div>
                                                <div className="text-xs font-mono text-[var(--text-primary)]">v{snap.version}</div>
                                                <div className="text-xs text-[var(--text-secondary)]">{formatSnapshotTime(snap.createdAt)}</div>
                                            </div>
                                            <button
                                                onClick={() => restoreSnapshot(snap.version)}
                                                disabled={isRestoringSnapshot || !syncAllowed}
                                                className="px-3 py-1.5 rounded-lg text-xs border border-[var(--border-subtle)] hover:border-emerald-400 hover:text-emerald-200 transition"
                                            >
                                                {isRestoringSnapshot ? "Restoring..." : "Restore"}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]/70">
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <div>
                                        <div className="text-sm font-semibold text-[var(--text-primary)]">Sync Audit Logs</div>
                                        <div className="text-xs text-[var(--text-secondary)]">最近 50 条操作记录。</div>
                                    </div>
                                    <button
                                        onClick={fetchAuditLogs}
                                        className="px-3 py-1.5 rounded-lg text-xs bg-[var(--accent-blue)] text-white hover:bg-sky-500 transition"
                                        disabled={isLoadingAudit || !syncAllowed}
                                    >
                                        {isLoadingAudit ? "Loading..." : "Refresh"}
                                    </button>
                                </div>

                                {auditMessage && (
                                    <div className={`text-xs px-3 py-2 rounded-lg border ${auditMessage.type === 'error' ? 'border-red-400/60 text-red-300 bg-red-900/20' : 'border-emerald-400/60 text-emerald-200 bg-emerald-900/20'}`}>
                                        {auditMessage.text}
                                    </div>
                                )}

                                <div className="mt-4 space-y-2">
                                    {auditEntries.length === 0 && (
                                        <div className="text-xs text-[var(--text-secondary)]">暂无日志记录。</div>
                                    )}
                                    {auditEntries.map((entry) => (
                                        <div key={entry.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)]/40">
                                            <div>
                                                <div className="text-xs font-semibold text-[var(--text-primary)]">
                                                    {entry.action} · {entry.status}
                                                </div>
                                                <div className="text-xs text-[var(--text-secondary)]">{formatSnapshotTime(entry.createdAt)}</div>
                                                {Object.keys(entry.detail || {}).length > 0 && (
                                                    <div className="text-[11px] text-[var(--text-secondary)] mt-1">
                                                        {formatAuditDetail(entry.detail)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                恢复快照会覆盖云端项目数据，并在下次同步时更新本地。建议在恢复前先导出 CSV 作为本地备份。
                            </div>
                        </div>
                    )}

                    {activeTab === 'about' && (
                        <div className="space-y-8 py-4">
                            {/* Hero Section */}
                            <div className="text-center space-y-2">
                                <img src="/icon-256.png" alt="Qalam Icon" className="h-16 w-16 mx-auto rounded-2xl shadow-lg shadow-emerald-500/15" />
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Qalam</h1>
                                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">v0.3 · NodeLab</div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xl mx-auto leading-relaxed">
                                    当前阶段：节点主导的 AIGC 工作流，可视化编排节点驱动多模态生成。
                                </p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                {/* Roadmap Timeline */}
                                <div className="bg-gray-50 dark:bg-gray-900/60 p-5 rounded-xl border border-gray-200 dark:border-gray-700/60">
                                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        版本迭代图谱
                                    </h3>
                                    <div className="relative pl-5 space-y-4">
                                        <span className="absolute left-2 top-2 bottom-2 w-[2px] bg-gray-200 dark:bg-gray-700 rounded-full" />
                                        {[
                                            { ver: "0.1 · Script2Video", desc: "组件导向：手动点击完成基础逻辑。", active: false },
                                            { ver: "0.2 · eSheep", desc: "工作流导向：流程化自动批处理。", active: false },
                                            { ver: "0.3 · NodeLab", desc: "节点导向：自由搭建 AIGC 节点组合。", active: true },
                                            { ver: "0.4 · Qalam", desc: "Agent 主导：助理制定并执行创意计划。", active: false },
                                            { ver: "0.5 · Zendo", desc: "多 Agent：研究小组协作，感知化实时交互。", active: false },
                                        ].map((item) => (
                                            <div key={item.ver} className="flex items-start gap-3">
                                                <span
                                                    className={`mt-1 h-2.5 w-2.5 rounded-full ${item.active ? "bg-sky-400 shadow-[0_0_0_4px_rgba(56,189,248,0.25)]" : "bg-gray-300 dark:bg-gray-600"}`}
                                                />
                                                <div>
                                                    <div className={`text-sm font-semibold ${item.active ? "text-sky-200" : "text-gray-900 dark:text-gray-100"}`}>{item.ver}</div>
                                                    <div className={`text-xs ${item.active ? "text-sky-200/80" : "text-gray-600 dark:text-gray-400"}`}>{item.desc}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Features List */}
                                <div className="bg-gray-50 dark:bg-gray-900/60 p-5 rounded-xl border border-gray-200 dark:border-gray-700/60">
                                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Sparkles size={10} /> Core Features
                                    </h3>
                                    <ul className="space-y-3">
                                        <li className="flex items-start gap-3">
                                            <BrainCircuit size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="text-sm text-gray-800 dark:text-gray-200 font-medium block">Deep Script Understanding</span>
                                                <span className="text-xs text-gray-500 block">Analyzes plot, characters, and themes.</span>
                                            </div>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <Film size={16} className="text-blue-500 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="text-sm text-gray-800 dark:text-gray-200 font-medium block">Automated Shot Lists</span>
                                                <span className="text-xs text-gray-500 block">Converts text to professional shooting scripts.</span>
                                            </div>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <ImageIcon size={16} className="text-pink-500 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="text-sm text-gray-800 dark:text-gray-200 font-medium block">Visual Concept Studio</span>
                                                <span className="text-xs text-gray-500 block">Generates character and location concepts.</span>
                                            </div>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <Zap size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="text-sm text-gray-800 dark:text-gray-200 font-medium block">Sora Prompt Engineering</span>
                                                <span className="text-xs text-gray-500 block">Creates production-ready video prompts.</span>
                                            </div>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <Video size={16} className="text-purple-500 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="text-sm text-gray-800 dark:text-gray-200 font-medium block">Video Generation</span>
                                                <span className="text-xs text-gray-500 block">Direct integration with Video APIs.</span>
                                            </div>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            {/* Footer / Credits */}
                            <div className="pt-2 text-center border-t border-gray-200 dark:border-gray-800">
                                <p className="text-xs text-gray-500">
                                    Designed by <span className="text-gray-700 dark:text-gray-400 font-medium">Bai & Gemini</span>
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex justify-end border-t border-gray-200 dark:border-gray-700 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                    >
                        Save & Close
                    </button>
                </div>
            </div>
        </div>
    );
};
