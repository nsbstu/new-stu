import type { ModelSettings } from "../domain/types";

const settingsKey = "knowledge-quest.model-settings.v1";
const secretKey = "knowledge-quest.api-key.session";

export const defaultModelSettings: ModelSettings = {
  baseUrl: "https://api.openai.com/v1",
  model: "",
  temperature: 0.3,
};

export function normalizeModelBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return trimmed;
  try {
    const url = new URL(trimmed);
    if (!url.pathname || url.pathname === "/") url.pathname = "/v1";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return trimmed;
  }
}

export function modelEndpoint(baseUrl: string, path: string) {
  return normalizeModelBaseUrl(baseUrl) + (path.startsWith("/") ? path : "/" + path);
}

export function loadModelSettings(): ModelSettings {
  const raw = localStorage.getItem(settingsKey);
  if (!raw) return defaultModelSettings;
  try {
    const settings = { ...defaultModelSettings, ...JSON.parse(raw) };
    return { ...settings, baseUrl: normalizeModelBaseUrl(settings.baseUrl) };
  }
  catch { return defaultModelSettings; }
}

export function saveModelSettings(settings: ModelSettings, apiKey: string) {
  localStorage.setItem(settingsKey, JSON.stringify({ ...settings, baseUrl: normalizeModelBaseUrl(settings.baseUrl) }));
  if (apiKey) sessionStorage.setItem(secretKey, apiKey);
  else sessionStorage.removeItem(secretKey);
}

export function loadApiKey() {
  return sessionStorage.getItem(secretKey) ?? "";
}

export function isModelConfigured(settings = loadModelSettings()) {
  return Boolean(settings.baseUrl.trim() && settings.model.trim() && loadApiKey());
}
