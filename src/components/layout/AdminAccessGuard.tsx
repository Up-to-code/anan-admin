"use client";

import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert } from "lucide-react";

function LoadingSkeleton() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="space-y-4 w-full max-w-md">
        <Skeleton className="h-8 w-3/4 mx-auto" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

function NeedAdminContent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <ShieldAlert className="h-8 w-8 text-amber-500" />
          </div>
          <CardTitle className="text-xl">صلاحية المدير مطلوبة</CardTitle>
          <CardDescription className="mt-2">
            حسابك غير مسجل كمدير في النظام. يمكنك طلب إضافة صلاحية المدير من
            مطور النظام.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export function AdminAccessGuard({ children }: { children: React.ReactNode }) {
  const isAdmin = useQuery(api.features.admin.api.isAdmin);

  // Loading state - waiting for admin check
  if (isAdmin === undefined) {
    return <LoadingSkeleton />;
  }

  // Not admin or unauthenticated (null) - show need admin content or redirect
  if (isAdmin !== true) {
    return <NeedAdminContent />;
  }

  // User is admin, render children
  return <>{children}</>;
}
