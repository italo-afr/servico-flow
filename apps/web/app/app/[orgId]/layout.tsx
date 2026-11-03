import { OrgShell } from '@/components/org';

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return <OrgShell>{children}</OrgShell>;
}
