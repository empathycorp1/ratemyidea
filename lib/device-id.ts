const KEY = "rmi_device_id";

/** A stable per-browser identifier, persisted in localStorage. Not an
 *  account — just the "device" half of the like/presence dedupe (see
 *  db/schema.sql's `likes` and `presence` tables). Client-only. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall back to
    // a per-session id so the app still works, just without dedupe
    // persisting across reloads.
    return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
