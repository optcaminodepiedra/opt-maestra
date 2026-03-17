import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getNavByRole } from "@/lib/nav";
import { Sidebar } from "@/components/app/Sidebar";
import { TopBar } from "@/components/app/TopBar";
import { MobileSidebar } from "@/components/app/MobileSidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session as any).user.role as string;
  const name = (session as any).user.name as string;

  const sections = getNavByRole(role);

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <Sidebar sections={sections} />
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <TopBar
            name={name}
            leftSlot={<MobileSidebar sections={sections} />}
          />
          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
