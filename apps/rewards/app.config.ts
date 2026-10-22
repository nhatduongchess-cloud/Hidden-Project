import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.EAS_BUILD_PROFILE) {
    const endpoint = process.env.EXPO_PUBLIC_API_URL;
    if (!endpoint || !/^https:\/\/[^/]+\/api\/rewards\/?$/.test(endpoint)) {
      throw new Error(
        "Set EXPO_PUBLIC_API_URL to the public HTTPS service URL ending in /api/rewards before building.",
      );
    }
  }
  return {
    ...config,
    name: config.name || "REwards",
    slug: config.slug || "re-rewards",
  };
};
