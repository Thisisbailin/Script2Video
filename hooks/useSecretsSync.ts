import { useEffect, useRef } from "react";
import { AppConfig } from "../types";

type Options = {
  isSignedIn: boolean;
  isLoaded: boolean;
  getToken: () => Promise<string | null>;
  config: AppConfig;
  setConfig: (c: AppConfig | ((c: AppConfig) => AppConfig)) => void;
  debounceMs?: number;
};

type SecretsPayload = {
  textApiKey?: string;
  multiApiKey?: string;
  videoApiKey?: string;
};

export const useSecretsSync = ({
  isSignedIn,
  isLoaded,
  getToken,
  config,
  setConfig,
  debounceMs = 1200
}: Options) => {
  const saveTimeout = useRef<number | null>(null);
  const hasLoadedRef = useRef(false);
  const lastSentRef = useRef<SecretsPayload | null>(null);

  // 拉取云端密钥
  useEffect(() => {
    if (!isSignedIn || !isLoaded || !config.syncApiKeys || hasLoadedRef.current) return;
    let cancelled = false;
    const load = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch("/api/secrets", {
          headers: { authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const secrets: SecretsPayload = data?.secrets || {};
        lastSentRef.current = secrets;
        setConfig(prev => ({
          ...prev,
          textConfig: { ...prev.textConfig, apiKey: secrets.textApiKey || prev.textConfig.apiKey },
          multimodalConfig: { ...prev.multimodalConfig, apiKey: secrets.multiApiKey || prev.multimodalConfig.apiKey },
          videoConfig: { ...prev.videoConfig, apiKey: secrets.videoApiKey || prev.videoConfig.apiKey }
        }));
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) hasLoadedRef.current = true;
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [config.syncApiKeys, getToken, isLoaded, isSignedIn, setConfig]);

  // 保存云端密钥
  useEffect(() => {
    if (!isSignedIn || !isLoaded || !config.syncApiKeys) return;
    if (saveTimeout.current) window.clearTimeout(saveTimeout.current);

    saveTimeout.current = window.setTimeout(async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const payload: SecretsPayload = {
          textApiKey: config.textConfig.apiKey || '',
          multiApiKey: config.multimodalConfig.apiKey || '',
          videoApiKey: config.videoConfig.apiKey || ''
        };
        // 如果与上次发送一致则跳过
        if (lastSentRef.current &&
          lastSentRef.current.textApiKey === payload.textApiKey &&
          lastSentRef.current.multiApiKey === payload.multiApiKey &&
          lastSentRef.current.videoApiKey === payload.videoApiKey) {
          return;
        }
        await fetch("/api/secrets", {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ secrets: payload })
        });
        lastSentRef.current = payload;
      } catch {
        /* ignore */
      }
    }, debounceMs);

    return () => {
      if (saveTimeout.current) window.clearTimeout(saveTimeout.current);
    };
  }, [config.syncApiKeys, config.textConfig.apiKey, config.multimodalConfig.apiKey, config.videoConfig.apiKey, debounceMs, getToken, isLoaded, isSignedIn]);
};
