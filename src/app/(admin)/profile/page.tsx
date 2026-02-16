"use client";

import * as React from "react";
import Link from "next/link";
import { useSession, signOut } from "@/lib/auth-client";
import { ar } from "@/lib/ar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  LogOut,
  Mail,
  Shield,
  CheckCircle,
  Clock,
  User,
  Key,
  Activity,
  Settings,
} from "lucide-react";
import { PageHeader } from "@/components/admin/ui";

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { data: session, isPending } = useSession();

  const handleSignOut = async () => {
    await signOut();
  };

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const user = session?.user;

  return (
    <div className="space-y-6">
      <PageHeader
        title={ar.profile}
        description="إعدادات الحساب الشخصي"
        icon={User}
        breadcrumbs={[{ label: ar.profile }]}
      />

      <Card className="relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
        <CardContent className="pt-8 pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="relative">
                <Avatar className="h-20 w-20 ring-4 ring-muted">
                  <AvatarImage src={user?.image || undefined} />
                  <AvatarFallback className="text-xl font-bold">
                    {user?.name?.charAt(0) || "A"}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-500 ring-2 ring-background">
                  <CheckCircle className="h-3 w-3 text-white" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {user?.name || ar.unnamed}
                </h2>
                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                  <Mail className="h-4 w-4" />
                  <span>{user?.email}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-primary/10 text-primary">
                    <Shield className="h-3 w-3 ml-1" />
                    مشرف
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" asChild>
                <Link href="/settings">
                  <Settings className="h-4 w-4 ml-2" />
                  {ar.settings}
                </Link>
              </Button>
              <Button variant="destructive" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 ml-2" />
                {ar.signOut}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Shield className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-base">الأمان</CardTitle>
                <CardDescription>حالة أمان الحساب</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between py-3 border-b">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">البريد الإلكتروني</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <CheckCircle className="h-4 w-4" />
                  موثق
                </div>
              </div>
              <div className="flex items-center justify-between py-3 border-b">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">الجلسة</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <CheckCircle className="h-4 w-4" />
                  نشطة
                </div>
              </div>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">الدور</span>
                </div>
                <Badge className="bg-primary/10 text-primary">مشرف</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">معلومات الحساب</CardTitle>
                <CardDescription>بيانات المستخدم</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <InfoRow label={ar.name} value={user?.name || "-"} icon={User} />
              <InfoRow
                label={ar.email}
                value={user?.email || "-"}
                icon={Mail}
              />
              <InfoRow
                label="المعرف"
                value={user?.id ? `${user.id.slice(0, 24)}...` : "-"}
                icon={Key}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">النشاط الأخير</CardTitle>
              <CardDescription>آخر نشاطات الحساب</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">تسجيل دخول</p>
                  <p className="text-xs text-muted-foreground">من المتصفح</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">الآن</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
