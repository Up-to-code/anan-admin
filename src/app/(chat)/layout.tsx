import { AdminGuard } from "@/components/layout/AdminGuard";
import { AdminAccessGuard } from "@/components/layout/AdminAccessGuard";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <AdminAccessGuard>
        <main className="h-screen overflow-hidden bg-background">{children}</main>
      </AdminAccessGuard>
    </AdminGuard>
  );
}
