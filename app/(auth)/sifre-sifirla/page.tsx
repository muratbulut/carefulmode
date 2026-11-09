import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthShell";
import { ResetWizard } from "@/components/auth/ResetWizard";
import { getMessages } from "@/lib/i18n";

const t = getMessages();

export const metadata: Metadata = { title: t.pages.resetPassword };

export default function ResetPasswordPage() {
  return (
    <AuthCard narrow>
      <ResetWizard />
    </AuthCard>
  );
}
