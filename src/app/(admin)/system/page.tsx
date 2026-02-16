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
  Settings,
  Shield,
  Database,
  Server,
  Cpu,
  HardDrive,
  RefreshCw,
  Activity,
  Zap,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, StatCard } from "@/components/admin/ui";

function formatTokens(n: number | undefined): string {
  if (n === undefined || n === null) return "٠";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("ar-SA");
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
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/10",
    amber: "bg-amber-500/10 text-amber-600 border-amber-500/10",
    rose: "bg-rose-500/10 text-rose-600 border-rose-500/10",
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/10",
    violet: "bg-violet-500/10 text-violet-600 border-violet-500/10",
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors">
      <div className={cn("p-2.5 rounded-xl bg-muted border border-border/50", colorClasses[statusColor])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="font-bold text-sm">{title}</div>
        {description && (
          <div className="text-[10px] text-muted-foreground mt-0.5 opacity-70">
            {description}
          </div>
        )}
      </div>
      <Badge variant="outline" className={cn("text-[10px] font-medium px-2 py-0.5", colorClasses[statusColor])}>
        {status}
      </Badge>
    </div>
  );
}

// Minimal Badge replacement code for SystemRow internal use
function Badge({ className, children, variant }: any) {
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className)}>{children}</span>;
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
      <PageHeader
        title={ar.system}
        description="مراقبة حالة النظام، أداء الخدمات، واستخدام الموارد."
        icon={Settings}
        breadcrumbs={[{ label: ar.dashboard, href: "/" }, { label: ar.system }]}
        action={
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="h-9">
            <RefreshCw className={cn("h-4 w-4 ml-2", refreshing && "animate-spin")} />
            تحديث الحالة
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="حالة الـ API" value="متصل" icon={Activity} color="emerald" />
        <StatCard label="قاعدة البيانات" value="متصل" icon={Database} color="emerald" />
        <StatCard label="الوكيل الذكي" value="نشط" icon={Zap} color="violet" />
        <StatCard label="الرموز المستخدمة" value={formatTokens(tokenStats?.estimatedTotalTokens || 0)} icon={Cpu} color="blue" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">استهلاك الذكاء الاصطناعي</CardTitle>
                  <CardDescription className="text-xs">إحصائيات استخدام الرموز (Tokens) للأسبوع الحالي.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-[10px] text-muted-foreground mb-1">الإجمالي الأسبوعي</p>
                  <p className="text-xl font-bold">{formatTokens(tokenStats?.estimatedTotalTokens || 0)}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-[10px] text-muted-foreground mb-1">إجمالي الطلبات</p>
                  <p className="text-xl font-bold font-mono">{tokenStats?.weeklyRequests || 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-[10px] text-muted-foreground mb-1">رموز الإدخال</p>
                  <p className="text-xl font-bold">{formatTokens(tokenStats?.estimatedPromptTokens || 0)}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-[10px] text-muted-foreground mb-1">رموز الإخراج</p>
                  <p className="text-xl font-bold">{formatTokens(tokenStats?.estimatedCompletionTokens || 0)}</p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" asChild className="text-xs hover:bg-violet-50 hover:text-violet-600 transition-colors">
                  <Link href="/analytics/llm">عرض تحليلات الـ LLM <ExternalLink className="h-3.5 w-3.5 mr-2" /></Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold">حالة الخدمات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <SystemRow icon={Shield} title="المصادقة" status="نشط" description="نظام المصادقة والتراخيص يعمل بشكل طبيعي" statusColor="emerald" />
              <SystemRow icon={Database} title="قاعدة البيانات" status="Convex" description="البنية التحتية لقاعدة البيانات السحابية" statusColor="blue" />
              <SystemRow icon={Server} title="الخادم الرئيسي" status="Healthy" description="Next.js 16 مع Turbopack" statusColor="violet" />
              <SystemRow icon={HardDrive} title="التخزين" status="مستقر" description="نظام رفع وتخزين الملفات والصور" statusColor="amber" />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">إجراءات الصيانة</CardTitle>
              <CardDescription className="text-xs">أدوات إدارية لصيانة النظام.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start text-xs h-9">
                <RefreshCw className="h-3.5 w-3.5 ml-2 opacity-70" />
                مسح الذاكرة المؤقتة (Cache)
              </Button>
              <Button variant="outline" className="w-full justify-start text-xs h-9">
                <Database className="h-3.5 w-3.5 ml-2 opacity-70" />
                تصدير نسخة احتياطية بيانات
              </Button>
              <Button variant="outline" className="w-full justify-start text-xs h-9">
                <Shield className="h-3.5 w-3.5 ml-2 opacity-70" />
                بدء فحص الأمان الدوري
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
