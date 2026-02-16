"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Settings,
  Shield,
  Database,
  Server,
  Cpu,
  HardDrive,
  RefreshCw,
  CheckCircle,
  Activity,
  Zap,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatTokens(n: number | undefined): string {
  if (n === undefined || n === null) return "٠";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("ar-SA");
}

function StatusCard({
  title,
  status,
  icon: Icon,
  color = "emerald",
}: {
  title: string;
  status: string;
  icon: React.ElementType;
  color?: "emerald" | "amber" | "rose" | "blue";
}) {
  const colorClasses: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  };

  return (
    <Card className="relative overflow-hidden">
      <div
        className={cn("absolute top-0 left-0 right-0 h-1", `bg-${color}-500`)}
      />
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", colorClasses[color])}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-sm font-semibold mt-0.5">{status}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SystemRow({
  icon: Icon,
  title,
  status,
  description,
  statusColor = "emerald",
}: {
  icon: React.ElementType;
  title: string;
  status: string;
  description?: string;
  statusColor?: "emerald" | "amber" | "rose" | "blue" | "violet";
}) {
  const colorClasses: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    rose: "bg-rose-500/10 text-rose-600",
    blue: "bg-blue-500/10 text-blue-600",
    violet: "bg-violet-500/10 text-violet-600",
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border hover:bg-muted/30 transition-colors">
      <div
        className={cn("p-2.5 rounded-xl bg-muted", colorClasses[statusColor])}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="font-medium">{title}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {description}
          </div>
        )}
      </div>
      <div
        className={cn(
          "text-xs font-medium px-3 py-1.5 rounded-full",
          colorClasses[statusColor],
        )}
      >
        {status}
      </div>
    </div>
  );
}

export default function SystemPage() {
  const [refreshing, setRefreshing] = React.useState(false);
  const tokenStats = useQuery(api.features.admin.api.aiTokenUsageStats);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">{ar.dashboard}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {ar.system}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{ar.system}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            مراقبة حالة النظام والخدمات
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw
            className={cn("h-4 w-4 ml-2", refreshing && "animate-spin")}
          />
          تحديث الحالة
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard title="API" status="متصل" icon={Activity} color="emerald" />
        <StatusCard
          title="قاعدة البيانات"
          status="متصل"
          icon={Database}
          color="emerald"
        />
        <StatusCard
          title="الوكيل الذكي"
          status="يعمل"
          icon={Zap}
          color="emerald"
        />
        <StatusCard
          title="الرموز المستخدمة"
          status={formatTokens(tokenStats?.estimatedTotalTokens || 0)}
          icon={Cpu}
          color="blue"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Zap className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <CardTitle className="text-base">
                استخدام الذكاء الاصطناعي
              </CardTitle>
              <CardDescription>إحصائيات الأسبوع الحالي</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 rounded-xl bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">
                الرموز الأسبوعية
              </p>
              <p className="text-2xl font-bold">
                {formatTokens(tokenStats?.estimatedTotalTokens || 0)}
              </p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">الطلبات</p>
              <p className="text-2xl font-bold">
                {tokenStats?.weeklyRequests || 0}
              </p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">رمز الإدخال</p>
              <p className="text-2xl font-bold">
                {formatTokens(tokenStats?.estimatedPromptTokens || 0)}
              </p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">رمز الإخراج</p>
              <p className="text-2xl font-bold">
                {formatTokens(tokenStats?.estimatedCompletionTokens || 0)}
              </p>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="outline" asChild>
              <Link href="/analytics/llm">
                عرض التفاصيل
                <ExternalLink className="h-4 w-4 mr-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">حالة الخدمات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <SystemRow
            icon={Shield}
            title="المصادقة"
            status="نشط"
            description="نظام المصادقة يعمل بشكل طبيعي"
            statusColor="emerald"
          />
          <SystemRow
            icon={Database}
            title="قاعدة البيانات"
            status="Convex"
            description="قاعدة بيانات Convex سحابية"
            statusColor="blue"
          />
          <SystemRow
            icon={Server}
            title="الخادم"
            status="Next.js 16"
            description="App Router مع Turbopack"
            statusColor="violet"
          />
          <SystemRow
            icon={HardDrive}
            title="التخزين"
            status="صحي"
            description="نظام تخزين الملفات"
            statusColor="amber"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">إجراءات النظام</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline">
              <RefreshCw className="h-4 w-4 ml-2" />
              مسح الذاكرة المؤقتة
            </Button>
            <Button variant="outline">
              <Database className="h-4 w-4 ml-2" />
              تصدير البيانات
            </Button>
            <Button variant="outline">
              <Shield className="h-4 w-4 ml-2" />
              فحص الأمان
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
