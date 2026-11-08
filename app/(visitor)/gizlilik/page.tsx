import { LegalPage, legalMetadata } from "@/components/legal/LegalPage";

export const metadata = legalMetadata("privacy");

export default function Page() {
  return <LegalPage doc="privacy" />;
}
