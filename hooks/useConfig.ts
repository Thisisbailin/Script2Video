import { AppConfig } from "../types";
import { INITIAL_TEXT_CONFIG, INITIAL_VIDEO_CONFIG, INITIAL_MULTIMODAL_CONFIG, INITIAL_REMEMBER_KEYS } from "../constants";
import { usePersistedState } from "./usePersistedState";

export const useConfig = (key: string) => {
  const [config, setConfig] = usePersistedState<AppConfig>({
    key,
    initialValue: {
      textConfig: INITIAL_TEXT_CONFIG,
      videoConfig: INITIAL_VIDEO_CONFIG,
      multimodalConfig: INITIAL_MULTIMODAL_CONFIG,
      rememberApiKeys: INITIAL_REMEMBER_KEYS
    },
    deserialize: (value) => {
      const parsed = JSON.parse(value);
      const rememberApiKeys = parsed.rememberApiKeys ?? INITIAL_REMEMBER_KEYS;
      const safeText = rememberApiKeys ? parsed.textConfig : { ...parsed.textConfig, apiKey: '' };
      const safeVideo = rememberApiKeys ? parsed.videoConfig : { ...parsed.videoConfig, apiKey: '' };
      const safeMulti = rememberApiKeys ? parsed.multimodalConfig : { ...parsed.multimodalConfig, apiKey: '' };
      return {
        rememberApiKeys,
        textConfig: { ...INITIAL_TEXT_CONFIG, ...safeText },
        videoConfig: { ...INITIAL_VIDEO_CONFIG, ...safeVideo },
        multimodalConfig: { ...INITIAL_MULTIMODAL_CONFIG, ...safeMulti }
      } as AppConfig;
    },
    serialize: (value) => {
      const { rememberApiKeys = INITIAL_REMEMBER_KEYS } = value;
      const textConfig = rememberApiKeys ? value.textConfig : { ...value.textConfig, apiKey: '' };
      const videoConfig = rememberApiKeys ? value.videoConfig : { ...value.videoConfig, apiKey: '' };
      const multimodalConfig = rememberApiKeys ? value.multimodalConfig : { ...value.multimodalConfig, apiKey: '' };
      return JSON.stringify({
        rememberApiKeys,
        textConfig,
        videoConfig,
        multimodalConfig
      });
    }
  });

  return { config, setConfig };
};
