"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  ShoppingCart,
  Target,
  AlertTriangle,
  ArrowRight,
  Clock,
  MessageCircle,
  Search,
  Building2,
  Landmark,
  Bot,
  Activity,
  TrendingUp,
  Zap,
  RefreshCw,
  Cpu,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { AreaChart, BarChart, PieChart, COLORS } from "@/components/ui/charts";
import { cn } from "@/lib/utils";
import { StatCard, PageHeader, PageSkeleton } from "@/components/admin/ui";

const arabicDays = ["سبت", "أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];
const arabicMonths = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function formatNumber(n: number | undefined): string {
  if (n === undefined || n === null) return "٠";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}م`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}ك`;
  return n.toLocaleString("ar-SA");
}

function formatTokens(n: number | undefined): string {
  if (n === undefined || n === null) return "٠";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("ar-SA");
}

function TimeRangeSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ranges = [
    { key: "day", label: "اليوم" },
    { key: "week", label: "أسبوع" },
    { key: "month", label: "شهر" },
    { key: "year", label: "سنة" },
  ];

  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {ranges.map((r) => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={cn(
            "px-4 py-2 text-sm rounded-md transition-all font-medium",
            value === r.key
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  color,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    violet: "bg-violet-500/10 text-violet-600",
    amber: "bg-amber-500/10 text-amber-600",
    cyan: "bg-cyan-500/10 text-cyan-600",
  };

  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:shadow-md hover:border-primary/20 transition-all group"
    >
      <div className={cn("p-2.5 rounded-xl", colorClasses[color])}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="font-medium">{label}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mr-auto" />
    </Link>
  );
}

export default function DashboardPage() {
  const [timeRange, setTimeRange] = React.useState("week");

  const stats = useQuery(api.features.admin.api.dashboardStats);
  const overviewStats = useQuery(api.features.admin.api.overviewStats);
  const summary = useQuery(api.features.admin.api.pipelineSummary);
  const chartData = useQuery(api.features.admin.api.dashboardChartData, {
    range: timeRange as "day" | "week" | "month" | "year",
  });
  const feed = useQuery(api.features.admin.api.salesActivityFeed, { limit: 8 });
  const topAreas = useQuery(api.features.admin.api.topSearchedAreas);
  const tokenStats = useQuery(api.features.admin.api.aiTokenUsageStats);
  const searchAnalytics = useQuery(api.features.admin.api.searchAnalyticsStats);

  const loading = stats === undefined;

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

  const pipelineChartData = React.useMemo(() => {
    if (!summary?.stageCounts) return [];
    const stageConfig = [
      { key: "new_lead", label: "جديد", color: COLORS.blue },
      { key: "contacted", label: "تواصل", color: COLORS.violet },
      { key: "qualified", label: "مؤهل", color: COLORS.amber },
      { key: "offer_made", label: "عرض", color: COLORS.cyan },
      { key: "under_contract", label: "عقد", color: COLORS.rose },
      { key: "closed_won", label: "ربح", color: COLORS.emerald },
      { key: "closed_lost", label: "خسارة", color: "#6b7280" },
    ];
    return stageConfig
      .filter(
        (s) =>
          ((summary.stageCounts as Record<string, number>)[s.key] || 0) > 0,
      )
      .map((s) => ({
        name: s.label,
        value: (summary.stageCounts as Record<string, number>)[s.key] || 0,
        color: s.color,
      }));
  }, [summary]);

  const channelChartData = React.useMemo(() => {
    if (!stats?.messagesByChannel) return [];
    return [
      {
        name: "واتساب",
        value: stats.messagesByChannel.whatsapp,
        color: "#25D366",
      },
      { name: "تطبيق", value: stats.messagesByChannel.app, color: COLORS.blue },
      { name: "ويب", value: stats.messagesByChannel.web, color: COLORS.violet },
    ];
  }, [stats]);

  if (loading) return <PageSkeleton />;

  const conversionRate = Math.round((summary?.conversionRate ?? 0) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="لوحة التحكم"
        description="نظرة عامة على أداء المنصة والمبيعات"
        icon={Layers}
        action={
          <div className="flex items-center gap-3">
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
        breadcrumbs={[{ label: "لوحة التحكم" }]}
      />

      {/* Primary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="الطلبات"
          value={formatNumber(stats?.totalOrders)}
          icon={ShoppingCart}
          color="blue"
          trend={`${summary?.unassigned ?? 0} غير مسند`}
          href="/orders"
        />
        <StatCard
          label="معدل التحويل"
          value={`${conversionRate}%`}
          icon={Target}
          color={
            conversionRate >= 20
              ? "emerald"
              : conversionRate >= 10
                ? "amber"
                : "rose"
          }
          trend={
            conversionRate >= 20
              ? "ممتاز"
              : conversionRate >= 10
                ? "جيد"
                : "يحتاج تحسين"
          }
          trendUp={conversionRate >= 15}
          href="/orders?status=closed_won"
        />
        <StatCard
          label="العملاء"
          value={formatNumber(stats?.totalUsers)}
          icon={Users}
          color="violet"
          description={`${formatNumber(stats?.activeUsers24h)} نشط اليوم`}
          href="/users"
        />
        <StatCard
          label="طلبات قديمة"
          value={summary?.stale ?? 0}
          icon={AlertTriangle}
          color="rose"
          trend="تحتاج متابعة"
          trendUp={false}
          href="/orders?stale=true"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="العقارات"
          value={formatNumber(stats?.totalProperties)}
          icon={Building2}
          color="cyan"
          href="/properties"
        />
        <StatCard
          label="البنوك"
          value={formatNumber(stats?.totalBanks)}
          icon={Landmark}
          color="blue"
          href="/banks"
        />
        <StatCard
          label="المطورين"
          value={formatNumber(stats?.totalPartners)}
          icon={Users}
          color="violet"
          href="/developers"
        />
        <StatCard
          label="تحويلات معلقة"
          value={overviewStats?.handoffsPending ?? 0}
          icon={Bot}
          color="amber"
          href="/notifications"
        />
      </div>

      {/* AI Usage Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-500/10">
                <Zap className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-base">
                  استخدام الذكاء الاصطناعي
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  رمز الأسبوع والطلبات
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/analytics/llm">
                التفاصيل
                <ArrowRight className="h-4 w-4 mr-1" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-xl bg-muted/50 border">
              <Cpu className="h-5 w-5 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold">
                {formatTokens(tokenStats?.estimatedTotalTokens || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">رمز الأسبوع</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/50 border">
              <Activity className="h-5 w-5 mx-auto mb-2 text-emerald-600" />
              <p className="text-2xl font-bold">
                {formatNumber(tokenStats?.weeklyRequests || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">طلب الأسبوع</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/50 border">
              <ArrowUpRight className="h-5 w-5 mx-auto mb-2 text-violet-600" />
              <p className="text-2xl font-bold">
                {formatTokens(tokenStats?.estimatedPromptTokens || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">رمز الإدخال</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/50 border">
              <ArrowDownRight className="h-5 w-5 mx-auto mb-2 text-cyan-600" />
              <p className="text-2xl font-bold">
                {formatTokens(tokenStats?.estimatedCompletionTokens || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">رمز الإخراج</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">النشاط عبر الزمن</CardTitle>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: COLORS.blue }}
                  />
                  رسائل
                </span>
                <span className="flex items-center gap-1.5">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: COLORS.emerald }}
                  />
                  مستخدمون
                </span>
                <span className="flex items-center gap-1.5">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: COLORS.violet }}
                  />
                  طلبات
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <AreaChart
              data={chartDataFormatted}
              index="name"
              categories={["messages", "users", "orders"]}
              height={260}
              colors={[COLORS.blue, COLORS.emerald, COLORS.violet]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">توزيع المسار</CardTitle>
              <Badge
                variant={
                  summary?.unassigned && summary.unassigned > 5
                    ? "destructive"
                    : "secondary"
                }
              >
                {summary?.unassigned && summary.unassigned > 5
                  ? "تحتاج انتباه"
                  : "جيد"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div className="w-1/2">
                <PieChart
                  data={pipelineChartData}
                  height={200}
                  innerRadius={50}
                  showLabel={false}
                />
              </div>
              <div className="w-1/2 space-y-2">
                {pipelineChartData.slice(0, 6).map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-muted/50"
                  >
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="flex-1">{s.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {s.value}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Charts Row */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">الرسائل حسب القناة</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={channelChartData}
              index="name"
              categories={["value"]}
              height={160}
              colors={[COLORS.blue]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">البحث حسب القناة</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={[
                {
                  name: "واتساب",
                  value: searchAnalytics?.byChannel?.whatsapp || 0,
                  color: "#25D366",
                },
                {
                  name: "تطبيق",
                  value: searchAnalytics?.byChannel?.app || 0,
                  color: COLORS.blue,
                },
                {
                  name: "ويب",
                  value: searchAnalytics?.byChannel?.web || 0,
                  color: COLORS.violet,
                },
              ]}
              index="name"
              categories={["value"]}
              height={160}
              colors={[COLORS.emerald]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">أكثر المناطق بحثاً</CardTitle>
              <Badge variant="secondary">{topAreas?.length || 0}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topAreas?.slice(0, 5).map((area, i) => (
                <div
                  key={area.location}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                >
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      i === 0
                        ? "bg-amber-500/10 text-amber-600"
                        : i === 1
                          ? "bg-gray-400/10 text-gray-600"
                          : i === 2
                            ? "bg-amber-700/10 text-amber-700"
                            : "bg-muted text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </div>
                  <span className="flex-1 text-sm font-medium truncate">
                    {area.location}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {area.count}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">آخر النشاطات</CardTitle>
              <Link
                href="/users"
                className="text-xs text-primary hover:underline"
              >
                عرض الكل
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {feed?.map((item, i) => {
                const Icon =
                  item.title === "message_sent"
                    ? MessageCircle
                    : item.title === "search"
                      ? Search
                      : item.title.includes("order")
                        ? ShoppingCart
                        : Clock;
                const label =
                  item.title === "message_sent"
                    ? "رسالة جديدة"
                    : item.title === "search"
                      ? "بحث"
                      : item.title.includes("order")
                        ? "طلب"
                        : item.title;
                const diffMs = Date.now() - item.createdAt;
                const timeAgo =
                  diffMs < 60000
                    ? "الآن"
                    : diffMs < 3600000
                      ? `${Math.floor(diffMs / 60000)} د`
                      : diffMs < 86400000
                        ? `${Math.floor(diffMs / 3600000)} س`
                        : `${Math.floor(diffMs / 86400000)} ي`;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50"
                  >
                    <div className="p-1.5 rounded-lg bg-muted">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <span className="flex-1 text-sm">{label}</span>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo}
                    </span>
                  </div>
                );
              })}
              {(!feed || feed.length === 0) && (
                <div className="py-8 text-center text-muted-foreground">
                  لا يوجد نشاط حديث
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">أكثر الاستعلامات</CardTitle>
              <Badge variant="secondary">
                {searchAnalytics?.topQueries?.length || 0}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {searchAnalytics?.topQueries
                ?.slice(0, 7)
                .map((q: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50"
                  >
                    <span className="text-xs text-muted-foreground w-5 font-medium">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm truncate">{q.query}</span>
                    <Badge variant="outline" className="text-xs">
                      {q.count}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">روابط سريعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickLink
              href="/orders"
              icon={ShoppingCart}
              label="مسار المبيعات"
              color="blue"
            />
            <QuickLink
              href="/users"
              icon={Users}
              label="المستخدمون"
              color="violet"
            />
            <QuickLink
              href="/properties"
              icon={Building2}
              label="العقارات"
              color="cyan"
            />
            <QuickLink
              href="/analytics/llm"
              icon={Zap}
              label="تحليلات AI"
              color="emerald"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
