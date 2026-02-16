import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { AdminGuard } from "@/components/layout/AdminGuard";
import { AdminAccessGuard } from "@/components/layout/AdminAccessGuard";
import { SidebarProvider } from "@/components/layout/SidebarContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <AdminAccessGuard>
        <SidebarProvider>
          <div className="flex h-screen">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto bg-muted/30 p-4 lg:p-6">
                {children}
              </main>
            </div>
          </div>
        </SidebarProvider>
      </AdminAccessGuard>
    </AdminGuard>
  );
}
