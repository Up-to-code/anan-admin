"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  AreaChart,
  BarChart,
  PieChart,
  chartColors,
} from "@/components/ui/charts";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Zap,
  Users,
  Target,
  Activity,
  Cpu,
  MessageSquare,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { ar } from "@/lib/ar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatCard, PageHeader } from "@/components/admin/ui";

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
}

function formatCurrency(value: number): string {
  if (value < 0.01) return `$${value.toFixed(6)}`;
  if (value < 1) return `$${value.toFixed(4)}`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ar-SA").format(value);
}

function formatCompactNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}

function StatusBadge({ status }: { status: "good" | "warning" | "critical" }) {
  const config = {
    good: {
      icon: CheckCircle2,
      label: "ممتاز",
      className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    },
    warning: {
      icon: Clock,
      label: "متوسط",
      className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    },
    critical: {
      icon: AlertCircle,
      label: "يحتاج تحسين",
      className: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    },
  };
  const { icon: Icon, label, className } = config[status];
  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export default function LLMAnalyticsPage() {
  const [timeRange, setTimeRange] = React.useState("week");
  const [modelPricing, setModelPricing] = React.useState<OpenRouterModel[]>([]);
  const [pricingLoading, setPricingLoading] = React.useState(true);

  const tokenUsage = useQuery(api.features.admin.api.aiTokenUsageStats, {});
  const dashboardStats = useQuery(api.features.admin.api.dashboardStats, {});
  const overviewStats = useQuery(api.features.admin.api.overviewStats, {});
  const aiChartData = useQuery(api.features.admin.api.aiUsageChartData, {
    range: timeRange as any,
  });

  React.useEffect(() => {
    async function fetchPricing() {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/models");
        const data = await res.json();
        setModelPricing(data.data || []);
      } catch (error) {
        console.error("Failed to fetch OpenRouter pricing:", error);
      } finally {
        setPricingLoading(false);
      }
    }
    fetchPricing();
  }, []);

  const totalTokens = tokenUsage?.estimatedTotalTokens || 0;
  const totalPromptTokens = tokenUsage?.estimatedPromptTokens || 0;
  const totalCompletionTokens = tokenUsage?.estimatedCompletionTokens || 0;

  // Per-model cost using OpenRouter pricing (per 1K tokens)
  const estimatedCost = React.useMemo(() => {
    const fallback =
      totalPromptTokens * 0.00001 + totalCompletionTokens * 0.00003;
    if (!tokenUsage?.modelUsage?.length || modelPricing.length === 0) {
      return fallback;
    }
    let cost = 0;
    for (const m of tokenUsage.modelUsage) {
      const promptTk = (m as { promptTokens?: number }).promptTokens ?? 0;
      const completionTk =
        (m as { completionTokens?: number }).completionTokens ?? 0;
      const orModel = modelPricing.find((p) => p.id === m.model);
      if (orModel?.pricing && (promptTk > 0 || completionTk > 0)) {
        const promptPrice = parseFloat(orModel.pricing.prompt) || 0;
        const completionPrice = parseFloat(orModel.pricing.completion) || 0;
        cost +=
          (promptTk / 1000) * promptPrice +
          (completionTk / 1000) * completionPrice;
      } else {
        cost += (promptTk / 1000) * 0.00001 + (completionTk / 1000) * 0.00003;
      }
    }
    return cost > 0 ? cost : fallback;
  }, [
    tokenUsage?.modelUsage,
    modelPricing,
    totalPromptTokens,
    totalCompletionTokens,
  ]);
  const totalUsers = overviewStats?.userProfiles || 0;
  const costPerUser = totalUsers > 0 ? estimatedCost / totalUsers : 0;
  const totalRequests = tokenUsage?.totalRequests || 0;
  const weeklyRequests = tokenUsage?.weeklyRequests || 0;

  const closedWon = dashboardStats?.ordersByStatus?.closed_won || 0;
  const totalOrders = Object.values(
    dashboardStats?.ordersByStatus || {},
  ).reduce((sum: number, v: any) => sum + v, 0);
  const successRate = totalOrders > 0 ? (closedWon / totalOrders) * 100 : 0;

  const modelData =
    tokenUsage?.modelUsage?.map((m: any) => ({
      name: m.model?.split("/").pop() || m.model,
      tokens: m.estimatedTokens || 0,
      requests: m.requests || 0,
    })) || [];

  // Use real chart data from API
  const tokenChartData = React.useMemo(() => {
    if (!aiChartData) return [];
    const { bucketCount, tokensSeries, requestsSeries, range } = aiChartData;

    return tokensSeries.map((tokens, i) => ({
      date:
        range === "day"
          ? `${i}:00`
          : range === "year"
            ? [
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
            ][i] || `${i + 1}`
            : ["سبت", "أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"][
            i % 7
            ] || `${i + 1}`,
      tokens,
      requests: requestsSeries[i] || 0,
    }));
  }, [aiChartData]);

  const orderStatusData = Object.entries(
    dashboardStats?.ordersByStatus || {},
  ).map(([status, count]: [string, any]) => ({
    name: (ar as any)[status] || status,
    value: count,
  }));

  const channelData = Object.entries(
    dashboardStats?.messagesByChannel || {},
  ).map(([channel, count]: [string, any]) => ({
    name:
      channel === "whatsapp" ? "واتساب" : channel === "app" ? "تطبيق" : "ويب",
    value: count,
  }));

  const costBreakdown = [
    { name: "مدخل", value: totalPromptTokens, color: chartColors[0] },
    { name: "إخراج", value: totalCompletionTokens, color: chartColors[1] },
  ];

  const isLoading =
    tokenUsage === undefined ||
    dashboardStats === undefined ||
    overviewStats === undefined ||
    aiChartData === undefined;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="تحليلات AI"
        description="مراقبة استخدام النماذج والتكاليف وأداء الأعمال"
        icon={Zap}
        breadcrumbs={[{ label: "تحليلات AI" }]}
        action={
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-36">
                <Clock className="h-4 w-4 ml-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{ar.day}</SelectItem>
                <SelectItem value="week">{ar.week}</SelectItem>
                <SelectItem value="month">{ar.month}</SelectItem>
                <SelectItem value="year">{ar.year}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="إجمالي الرموز"
          value={formatCompactNumber(totalTokens)}
          description={`${formatNumber(totalPromptTokens)} مدخل · ${formatNumber(totalCompletionTokens)} إخراج`}
          icon={Cpu}
          color="blue"
          trend={`${formatCompactNumber(weeklyRequests)} طلب هذا الأسبوع`}
        />
        <StatCard
          label="التكلفة المقدرة"
          value={formatCurrency(estimatedCost)}
          description="من أسعار OpenRouter"
          icon={DollarSign}
          color="emerald"
          trend={estimatedCost > 1 ? "يتطلب مراقبة" : "ضمن الميزانية"}
          trendUp={estimatedCost <= 1}
        />
        <StatCard
          label="التكلفة لكل مستخدم"
          value={formatCurrency(costPerUser)}
          description={`${formatNumber(totalUsers)} مستخدم نشط`}
          icon={Users}
          color="amber"
          trend={costPerUser < 0.01 ? "منخفضة" : "مرتفعة"}
          trendUp={costPerUser < 0.01}
        />
        <StatCard
          label="معدل التحويل"
          value={`${successRate.toFixed(1)}%`}
          description={`${closedWon} مبيعات من ${totalOrders} طلب`}
          icon={Target}
          color={
            successRate >= 20 ? "emerald" : successRate >= 10 ? "amber" : "rose"
          }
          trend={
            successRate >= 20
              ? "ممتاز"
              : successRate >= 10
                ? "جيد"
                : "يحتاج تحسين"
          }
          trendUp={successRate >= 15}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4">
          <TabsTrigger value="overview" className="gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">نظرة عامة</span>
          </TabsTrigger>
          <TabsTrigger value="costs" className="gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">التكاليف</span>
          </TabsTrigger>
          <TabsTrigger value="models" className="gap-2">
            <Cpu className="h-4 w-4" />
            <span className="hidden sm:inline">النماذج</span>
          </TabsTrigger>
          <TabsTrigger value="business" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">الأعمال</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">استخدام الرموز</CardTitle>
                    <CardDescription>
                      توزيع استخدام الرموز عبر الفترة المحددة
                    </CardDescription>
                  </div>
                  <StatusBadge
                    status={totalTokens > 1000000 ? "warning" : "good"}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <AreaChart
                  data={tokenChartData}
                  index="date"
                  categories={["tokens"]}
                  height={280}
                  colors={[chartColors[0]]}
                  valueFormatter={(v) => formatCompactNumber(v)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">توزيع الرموز</CardTitle>
                <CardDescription>مدخل vs إخراج</CardDescription>
              </CardHeader>
              <CardContent>
                <PieChart
                  data={costBreakdown}
                  height={200}
                  showLabel={true}
                  innerRadius={50}
                />
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                  <div className="text-center">
                    <p
                      className="text-2xl font-bold"
                      style={{ color: chartColors[0] }}
                    >
                      {Math.round((totalPromptTokens / totalTokens) * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground">مدخل</p>
                  </div>
                  <div className="text-center">
                    <p
                      className="text-2xl font-bold"
                      style={{ color: chartColors[1] }}
                    >
                      {Math.round((totalCompletionTokens / totalTokens) * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground">إخراج</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">الطلبات اليومية</CardTitle>
                <CardDescription>عدد طلبات API عبر الفترة</CardDescription>
              </CardHeader>
              <CardContent>
                <LineChart
                  data={tokenChartData}
                  index="date"
                  categories={["requests"]}
                  height={200}
                  colors={[chartColors[1]]}
                  valueFormatter={(v) => formatNumber(v)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>أكثر النماذج استخداماً</span>
                  <Badge variant="secondary">{modelData.length} نماذج</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {modelData.length > 0 ? (
                  <div className="space-y-3">
                    {modelData.slice(0, 5).map((m: any, i: number) => {
                      const percentage = (m.tokens / totalTokens) * 100;
                      return (
                        <div key={m.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium truncate max-w-[60%]">
                              {m.name}
                            </span>
                            <span className="text-muted-foreground">
                              {formatCompactNumber(m.tokens)} (
                              {percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor:
                                  chartColors[i % chartColors.length],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    لا توجد بيانات
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold">
                    {formatCurrency(estimatedCost * 0.6)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    تكلفة المدخل
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    ~60% من التكلفة الإجمالية
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold">
                    {formatCurrency(estimatedCost * 0.4)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    تكلفة الإخراج
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    ~40% من التكلفة الإجمالية
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold">
                    {formatCurrency(
                      totalTokens > 0
                        ? (estimatedCost / totalTokens) * 1000
                        : 0,
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    لكل 1K رمز
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    متوسط التكلفة
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold">
                    {formatCurrency(costPerUser)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    لكل مستخدم
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    متوسط التكلفة
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  توزيع التكاليف حسب النموذج
                </CardTitle>
              </CardHeader>
              <CardContent>
                {modelData.length > 0 ? (
                  <BarChart
                    data={modelData}
                    index="name"
                    categories={["tokens"]}
                    height={280}
                    valueFormatter={(v) => formatCompactNumber(v)}
                  />
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                    لا توجد بيانات
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  نسبة المدخل إلى الإخراج
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PieChart
                  data={costBreakdown}
                  height={280}
                  showLabel={true}
                  innerRadius={60}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      أسعار OpenRouter
                    </CardTitle>
                    <CardDescription>
                      أسعار النماذج المحدثة من API
                    </CardDescription>
                  </div>
                  {pricingLoading && (
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pricingLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-14" />
                      ))}
                    </div>
                  ) : (
                    modelPricing.slice(0, 8).map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="font-medium text-sm truncate">
                            {model.name}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {model.id}
                          </p>
                        </div>
                        <div className="text-left shrink-0">
                          <div className="flex items-center gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">
                                مدخل:
                              </span>{" "}
                              <span className="font-medium">
                                ${parseFloat(model.pricing.prompt).toFixed(4)}
                              </span>
                            </div>
                            <div className="w-px h-4 bg-border" />
                            <div>
                              <span className="text-muted-foreground">
                                إخراج:
                              </span>{" "}
                              <span className="font-medium">
                                $
                                {parseFloat(model.pricing.completion).toFixed(
                                  4,
                                )}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            لكل 1K رمز
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">استخدام النماذج</CardTitle>
                <CardDescription>توزيع الرموز حسب النموذج</CardDescription>
              </CardHeader>
              <CardContent>
                {modelData.length > 0 ? (
                  <PieChart
                    data={modelData.slice(0, 6).map((m: any, i: number) => ({
                      name: m.name,
                      value: m.tokens,
                      color: chartColors[i % chartColors.length],
                    }))}
                    height={250}
                    showLabel={true}
                    innerRadius={40}
                  />
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    لا توجد بيانات
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="business" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">LTV</p>
                    <p className="text-2xl font-bold mt-1">-</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      القيمة الدائمة للعميل
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted">
                    <TrendingUp className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">MRR</p>
                    <p className="text-2xl font-bold mt-1">-</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      الدخل الشهري المتكرر
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted">
                    <BarChart3 className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      معدل التحويل
                    </p>
                    <p className="text-2xl font-bold mt-1">
                      {successRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {closedWon} من {totalOrders}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">قمع التحويل</CardTitle>
                <CardDescription>توزيع الطلبات حسب الحالة</CardDescription>
              </CardHeader>
              <CardContent>
                {orderStatusData.length > 0 ? (
                  <BarChart
                    data={orderStatusData}
                    index="name"
                    categories={["value"]}
                    height={280}
                    layout="vertical"
                    valueFormatter={(v) => formatNumber(v)}
                  />
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                    لا توجد بيانات
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">توزيع القنوات</CardTitle>
                <CardDescription>الرسائل حسب قناة التواصل</CardDescription>
              </CardHeader>
              <CardContent>
                {channelData.length > 0 ? (
                  <PieChart
                    data={channelData.map((d, i) => ({
                      ...d,
                      color: chartColors[i % chartColors.length],
                    }))}
                    height={280}
                    showLabel={true}
                  />
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                    لا توجد بيانات
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
