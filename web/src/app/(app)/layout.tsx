import SidebarShell from "@/components/SidebarShell";
import DisclaimerFooter from "@/components/DisclaimerFooter";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SidebarShell>
      {children}
      <DisclaimerFooter />
    </SidebarShell>
  );
}
