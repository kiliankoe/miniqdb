export interface AppConfig {
  appName: string;
  loginButtonText: string;
  nothingToSeeHereButtonText: string;
  pocketbaseUrl: string;
}

let config: AppConfig = {
  appName: "miniqdb",
  loginButtonText: "Login",
  nothingToSeeHereButtonText: "",
  pocketbaseUrl: "/",
};

export async function loadConfig(): Promise<AppConfig> {
  try {
    const res = await fetch("/config.json");
    if (res.ok) {
      const loaded = await res.json();
      config = { ...config, ...loaded };
    }
  } catch {
    // Use defaults
  }
  return config;
}

export function getConfig(): AppConfig {
  return config;
}
