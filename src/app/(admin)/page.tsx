"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  ShoppingCart,
  ArrowRight,
  CreditCard,
  Activity,
  Search,
  MessageCircle,
  Zap,
  BarChart3,
} from "lucide-react";
import { AreaChart, COLORS } from "@/components/ui/charts";
import { cn } from "@/lib/utils";
import { PageSkeleton, StatCard, PageHeader } from "@/components/admin/ui";
import {
  TimeStatusFilter,
  type TimeFilterValue,
} from "@/components/admin/TimeStatusFilter";

// --- Funnel Component ---
function FunnelStage({
  label,
  count,
  color,
  percent
}: {
  label: string;
  count: number;
  color: string;
  percent: number;
}) {
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="w-24 text-sm font-medium text-muted-foreground">{label}</div>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <div className="w-12 text-sm font-bold text-right">{count}</div>
    </div>
  );
}

// --- Helper Functions ---
const arabicDays = ["سبت", "أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];
const arabicMonths = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

function formatNumber(n: number | undefined): string {
  if (n === undefined || n === null) return "٠";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("ar-SA");
}

export default function DashboardPage() {
  const [timeRange, setTimeRange] = React.useState<"day" | "week" | "month" | "year">("week");
  const [timeFilter, setTimeFilter] = React.useState<TimeFilterValue>({
    preset: "7d",
    fromMs: Date.now() - 7 * 24 * 60 * 60 * 1000,
    toMs: Date.now(),
  });
  const isAdmin = useQuery(api.features.admin.api.isAdmin);

  // Data Hooks
  const stats = useQuery(
    api.features.admin.api.dashboardStats,
    isAdmin === true
      ? { fromMs: timeFilter.fromMs, toMs: timeFilter.toMs }
      : "skip",
  );
  const summary = useQuery(
    api.features.admin.api.pipelineSummary,
    isAdmin === true
      ? { fromMs: timeFilter.fromMs, toMs: timeFilter.toMs }
      : "skip",
  );
  const chartData = useQuery(
    api.features.admin.api.dashboardChartData,
    isAdmin === true
      ? {
          range: timeRange as "day" | "week" | "month" | "year",
          fromMs: timeFilter.fromMs,
          toMs: timeFilter.toMs,
        }
      : "skip",
  );
  const feed = useQuery(
    api.features.admin.api.salesActivityFeed,
    isAdmin === true
      ? { limit: 8, fromMs: timeFilter.fromMs, toMs: timeFilter.toMs }
      : "skip",
  );
  const topAreas = useQuery(
    api.features.admin.api.topSearchedAreas,
    isAdmin === true
      ? { fromMs: timeFilter.fromMs, toMs: timeFilter.toMs }
      : "skip",
  );
  const aiTokenStats = useQuery(
    api.features.admin.api.aiTokenUsageStats,
    isAdmin === true ? {} : "skip",
  );
  const aiChartData = useQuery(
    api.features.admin.api.aiUsageChartData,
    isAdmin === true ? { range: "week" } : "skip",
  );

  const loading = stats === undefined;

  // Transformations
  const chartDataFormatted = React.useMemo(() => {
    if (!chartData) return [];
    return chartData.messageSeries.map((_, i) => ({
      name:
        chartData.range === "day"
          ? `${i}:00`
          : chartData.range === "year"
            ? arabicMonths[i] || `${i + 1}`
            : arabicDays[i % 7] || `${i + 1}`,
      messages: chartData.messageSeries[i],
      users: chartData.newUserSeries[i],
      orders: chartData.orderSeries[i],
    }));
  }, [chartData]);

  const conversionRate = Math.round((summary?.conversionRate ?? 0) * 100);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <PageHeader
        title="نظرة عامة"
        description="ملخص أداء المنصة ومسار المبيعات."
        action={null}
      />

      <TimeStatusFilter
        value={timeFilter}
        onTimeChange={(next) => {
          setTimeFilter(next);
          if (next.preset === "24h") setTimeRange("day");
          if (next.preset === "7d") setTimeRange("week");
          if (next.preset === "30d" || next.preset === "90d") setTimeRange("month");
          if (next.preset === "1y") setTimeRange("year");
          if (next.preset === "custom") setTimeRange("week");
        }}
        extraFilters={
          <div className="w-full md:w-[220px]">
            <label className="mb-1 block text-xs text-muted-foreground">
              كثافة الرسم
            </label>
            <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
              {["day", "week", "month", "year"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeRange(t as "day" | "week" | "month" | "year")}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                    timeRange === t
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                  )}
                >
                  {t === "day" ? "يوم" : t === "week" ? "أسبوع" : t === "month" ? "شهر" : "سنة"}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي الطلبات"
          value={formatNumber(stats?.totalOrders)}
          icon={ShoppingCart}
          trend={`${summary?.unassigned ?? 0} غير مسند`}
          trendUp={false}
          color="blue"
        />
        <StatCard
          label="معدل التحويل"
          value={`${conversionRate}%`}
          icon={Activity}
          trend={conversionRate >= 15 ? "أداء ممتاز" : "يحتاج تحسين"}
          trendUp={conversionRate >= 15}
          color="emerald"
        />
        <StatCard
          label="المستخدمين النشطين"
          value={formatNumber(stats?.activeUsers24h)}
          icon={Users}
          description="خلال ٢٤ ساعة"
          color="violet"
        />
        <StatCard
          label="إجمالي العقارات"
          value={formatNumber(stats?.totalProperties)}
          icon={CreditCard}
          description="جميع الوحدات"
          color="amber"
        />
      </div>

      {aiTokenStats && (
        <Card className="shadow-sm border-border/50 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <Zap className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">استخدام الذكاء الاصطناعي</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(aiTokenStats.estimatedTotalTokens)} رمز • ~$
                    {(
                      (aiTokenStats.estimatedPromptTokens || 0) * 0.00001 +
                      (aiTokenStats.estimatedCompletionTokens || 0) * 0.00003
                    ).toFixed(4)} تقدير
                  </p>
                </div>
              </div>
              {aiTokenStats.modelUsage?.length ? (
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    الأعلى:{" "}
                    {[...aiTokenStats.modelUsage]
                      .sort((a, b) => (b.estimatedTokens || 0) - (a.estimatedTokens || 0))[0]
                      ?.model?.split("/")
                      .pop() || "-"}
                  </span>
                </div>
              ) : null}
              {aiChartData?.tokensSeries?.length ? (
                <div className="flex items-center gap-2 h-8 min-w-[100px]">
                  <div className="flex-1 flex items-end gap-0.5 h-6">
                    {aiChartData.tokensSeries.map((v, i) => {
                      const max = Math.max(1, ...aiChartData.tokensSeries);
                      return (
                        <div
                          key={i}
                          className="flex-1 min-w-[2px] bg-violet-500/40 rounded-sm transition-all"
                          style={{
                            height: `${Math.max(4, (v / max) * 100)}%`,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <Button variant="ghost" size="sm" asChild>
                <Link href="/analytics/llm" className="gap-1">
                  التفاصيل <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>النشاط والنمو</CardTitle>
            <CardDescription>الرسائل، المستخدمين الجدد، والطلبات عبر الزمن.</CardDescription>
          </CardHeader>
          <CardContent>
            <AreaChart
              data={chartDataFormatted}
              index="name"
              categories={["messages", "users", "orders"]}
              colors={[COLORS.blue, COLORS.emerald, COLORS.violet]}
              height={300}
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>قمع المبيعات</CardTitle>
              {summary?.unassigned && summary.unassigned > 0 ? (
                <Badge variant="destructive">{summary.unassigned} غير مسند</Badge>
              ) : null}
            </div>
            <CardDescription>توزيع الطلبات حسب المرحلة الحالية.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <FunnelStage label="جديد / تواصل" count={(summary?.stageCounts as any)?.new_lead + (summary?.stageCounts as any)?.contacted || 0} color={COLORS.blue} percent={100} />
            <FunnelStage label="مؤهل" count={(summary?.stageCounts as any)?.qualified || 0} color={COLORS.violet} percent={75} />
            <FunnelStage label="عرض مقدم" count={(summary?.stageCounts as any)?.offer_made || 0} color={COLORS.cyan} percent={50} />
            <FunnelStage label="تحت العقد" count={(summary?.stageCounts as any)?.under_contract || 0} color={COLORS.amber} percent={35} />
            <FunnelStage label="مغلق (ربح)" count={(summary?.stageCounts as any)?.closed_won || 0} color={COLORS.emerald} percent={25} />

            <Separator className="my-4" />
            <div className="text-center">
              <Link href="/orders" className="text-sm text-primary hover:underline flex items-center justify-center gap-1">
                إدارة المسار بالكامل <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-base">آخر النشاطات</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {feed?.length === 0 && <div className="p-6 text-center text-muted-foreground">لا يوجد نشاط حديث</div>}
              {feed?.slice(0, 6).map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {item.title === 'message_sent' ? <MessageCircle size={14} className="text-primary" /> :
                      item.title === 'search' ? <Search size={14} className="text-primary" /> :
                        <Activity size={14} className="text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleTimeString('ar-SA')}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-border/50">
              <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
                <Link href="/analytics/activity">عرض السجل الكامل</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-base">أكثر المناطق طلباً</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {topAreas?.slice(0, 6).map((area, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-mono text-muted-foreground w-4">0{i + 1}</div>
                    <div className="text-sm font-medium">{area.location}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/60" style={{ width: `${Math.min(100, (area.count / (topAreas[0].count || 1)) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground min-w-[20px] text-right">{area.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
