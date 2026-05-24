import SidebarShell from "@/components/SidebarShell";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <SidebarShell>{children}</SidebarShell>;
}
