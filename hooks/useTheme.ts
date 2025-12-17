import { useCallback } from "react";
import { usePersistedState } from "./usePersistedState";

export const useTheme = (key: string, defaultDark = true) => {
  const [isDarkMode, setIsDarkMode] = usePersistedState<boolean>({
    key,
    initialValue: defaultDark,
    deserialize: (value) => {
      try {
        return JSON.parse(value);
      } catch {
        return defaultDark;
      }
    },
    serialize: (value) => JSON.stringify(value)
  });

  const toggleTheme = useCallback(() => setIsDarkMode((prev) => !prev), [setIsDarkMode]);

  return { isDarkMode, setIsDarkMode, toggleTheme };
};
