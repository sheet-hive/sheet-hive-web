export type AppMode = "demo" | "prod";

export function getAppMode(): AppMode {
  const raw = (process.env.NEXT_PUBLIC_APP_MODE ?? "prod").toLowerCase();
  return raw === "demo" ? "demo" : "prod";
}

export function isDemoMode(): boolean {
  return getAppMode() === "demo";
}
