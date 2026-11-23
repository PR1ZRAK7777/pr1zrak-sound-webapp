export const API_BASE = (document.querySelector('meta[name="player-api"]')?.content || "").replace(/\/$/, "");

export async function checkPlayerAccess(initData) {
  if (!API_BASE) return {allowed: false, reason: "unconfigured"};
  if (!initData) return {allowed: false, reason: "telegram"};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(API_BASE + "/api/access", {
      headers: {"X-Telegram-Init-Data": initData, "tuna-skip-browser-warning": "true"}, cache: "no-store", signal: controller.signal
    });
    if (response.status === 401) return {allowed: false, reason: "telegram"};
    if (!response.ok) return {allowed: false, reason: "unavailable"};
    const result = await response.json();
    return {allowed: result.allowed === true, reason: result.allowed === true ? "allowed" : "vip"};
  } catch (_) { return {allowed: false, reason: "unavailable"}; }
  finally { clearTimeout(timeout); }
}

export function fetchPlayerAudio(url) {
  const protectedAudio = API_BASE && url.startsWith(API_BASE + "/api/");
  return fetch(url, protectedAudio ? {headers: {"X-Telegram-Init-Data": window.Telegram?.WebApp?.initData || "", "tuna-skip-browser-warning": "true"}, cache: "no-store"} : {});
}
