"use client";

/** Odadaki seslerin (hacklendin alarmı, arayanın sesi) tek kapatma ayarı; bu tarayıcıda kalır. */
const muteKey = "lab-sound-muted";

export function readMuted() {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(muteKey) === "1";
  } catch {
    return false;
  }
}

export function writeMuted(muted: boolean) {
  try {
    window.localStorage.setItem(muteKey, muted ? "1" : "0");
  } catch {
    // Depolama kapalıysa ayar yalnızca bu sayfada kalır.
  }
}
