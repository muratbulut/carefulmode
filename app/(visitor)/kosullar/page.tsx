import { LegalPage, legalMetadata } from "@/components/legal/LegalPage";

export const metadata = legalMetadata("terms");

export default function Page() {
  return <LegalPage doc="terms" />;
}
