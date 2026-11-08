"use client";

// "Tekrar hoş geldin" için: bu tarayıcıda daha önce giriş yapılmış mı? Yalnızca bir işaret
// saklanır, kim olduğu saklanmaz. Saklama kapalıysa (gizli sekme) "Hoş geldin" görünür.

const KEY = "signed-in-before";

export function hasSignedInBefore() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markSignedIn() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Saklama kapalı; önemli değil.
  }
}
