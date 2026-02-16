"use client";

import * as React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert, Copy, Check, Shield } from "lucide-react";

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
  const [copied, setCopied] = React.useState(false);

  const cliCommand = `npx convex run seed:addAdmin '{"userId":"YOUR_USER_ID"}'`;

  const copyCli = () => {
    void navigator.clipboard.writeText(cliCommand);
    setCopied(true);
    toast.success("تم نسخ الأمر");
    setTimeout(() => setCopied(false), 2000);
  };

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
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription className="text-center">
              إذا كنت مطوراً، شغّل الأمر التالي من <strong>جذر المشروع</strong>{" "}
              (المجلد الذي فيه مجلد{" "}
              <code className="bg-muted px-1 rounded">convex</code>):
            </AlertDescription>
          </Alert>

          <div className="rounded-lg bg-muted p-4 font-mono text-xs break-all text-center">
            <code>{cliCommand}</code>
          </div>

          <Button variant="outline" className="w-full" onClick={copyCli}>
            {copied ? (
              <Check className="ml-2 h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="ml-2 h-4 w-4" />
            )}
            {copied ? "تم النسخ" : "نسخ الأمر"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            استبدل <code className="bg-muted px-1 rounded">YOUR_USER_ID</code>{" "}
            بمعرف المستخدم الخاص بك
          </p>
        </CardContent>
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

  // Not admin - show need admin content
  if (isAdmin === false) {
    return <NeedAdminContent />;
  }

  // User is admin, render children
  return <>{children}</>;
}
