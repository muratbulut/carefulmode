import { VisitorShell } from "@/components/visitor/VisitorShell";

export default function VisitorLayout({ children }: LayoutProps<"/">) {
  return <VisitorShell>{children}</VisitorShell>;
}
