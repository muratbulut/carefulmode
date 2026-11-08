// Öğretmen ekranlarının tarayıcıdaki ortak parçaları: panoya kopyalama, eylem hatasının metni,
// davet bağlantısı ve düzeyin adı.

import { getMessages, type Messages } from "@/lib/i18n";
import { isClassLevel } from "@/lib/classroom/rules";
import type { TeacherActionError } from "@/lib/classroom/teacher-actions";
import { paths } from "@/lib/navigation";

/** Panoya yazar; tarayıcı izin vermezse eski yöntemle dener. Başaramazsa false. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function errorText(error: TeacherActionError): string {
  return getMessages().classroom.errors[error];
}

/** Davet bağlantısının tam adresi. */
export function inviteLink(origin: string, code: string) {
  return origin + paths.join(code);
}

/** Düzeyin adı ("7. sınıf", "Karma"); bilinmeyen kodda boş. */
export function levelName(level: string, t: Messages["classroom"] = getMessages().classroom): string {
  return isClassLevel(level) ? t.levels[level] : "";
}
