import { hashToBucket, isInRollout, normalizeRolloutPercent } from "../../utils/rollout";

export type RolloutEnv = {
  SYNC_ROLLOUT_PERCENT?: string;
  SYNC_ROLLOUT_SALT?: string;
  SYNC_ROLLOUT_ALLOWLIST?: string;
};

const parseAllowlist = (value?: string) => {
  if (!value) return new Set<string>();
  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
};

export const getSyncRolloutInfo = (userId: string, env: RolloutEnv) => {
  const percent = normalizeRolloutPercent(env.SYNC_ROLLOUT_PERCENT);
  const salt = env.SYNC_ROLLOUT_SALT || "";
  const allowlist = parseAllowlist(env.SYNC_ROLLOUT_ALLOWLIST);
  const allowlisted = allowlist.has(userId);
  const bucket = hashToBucket(userId, salt);
  const enabled = allowlisted || isInRollout(userId, percent, salt);
  return { enabled, percent, bucket, allowlisted };
};

export const isSyncEnabledForUser = (userId: string, env: RolloutEnv) =>
  getSyncRolloutInfo(userId, env).enabled;
