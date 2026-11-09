import { AuthShell } from "@/components/auth/AuthShell";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <AuthShell>{children}</AuthShell>;
}
