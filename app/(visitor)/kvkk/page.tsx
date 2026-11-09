import { LegalPage, legalMetadata } from "@/components/legal/LegalPage";

export const metadata = legalMetadata("kvkk");

export default function Page() {
  return <LegalPage doc="kvkk" />;
}
