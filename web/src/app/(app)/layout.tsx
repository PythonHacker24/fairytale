import SidebarShell from "@/components/SidebarShell";
import DisclaimerFooter from "@/components/DisclaimerFooter";
import MobileBlock from "@/components/MobileBlock";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {/* Desktop playground: hidden below lg (1024px). */}
      <div className="hidden lg:block">
        <SidebarShell>
          {children}
          <DisclaimerFooter />
        </SidebarShell>
      </div>
      {/* Mobile gate: shown only below lg. */}
      <div className="lg:hidden">
        <MobileBlock />
      </div>
    </>
  );
}
