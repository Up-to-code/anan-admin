"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  Loader2,
  Cpu,
  MessageSquare,
  Settings2,
  Sparkles,
  CheckCircle,
  Activity,
  Zap,
  DollarSign,
  TrendingUp,
  Globe,
  ExternalLink,
} from "lucide-react";
import { ar } from "@/lib/ar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StatCard, PageHeader } from "@/components/admin/ui";

// ============================================
// ALL HOOKS MUST BE DEFINED AT THE TOP LEVEL
// BEFORE ANY CONDITIONAL RETURNS
// ============================================

const defaultPrompts = [
  {
    key: "system",
    label: "الموجه الرئيسي",
    description: "الموجه الأساسي للوكيل",
  },
  { key: "realEstate", label: "العقارات", description: "موجه البحث العقاري" },
  { key: "tools", label: "الأدوات", description: "وصف الأدوات المتاحة" },
];

const modelOptions = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "premium" },
  { value: "moonshotai/kimi-k2-thinking", label: "Kimi K2 Thinking", tier: "premium" },
  { value: "qwen/qwen3.5-plus", label: "Qwen 3.5 Plus", tier: "standard" },
  { value: "google/gemini-pro-1.5", label: "Gemini Pro 1.5", tier: "premium" },
  {
    value: "google/gemini-2.0-flash-exp",
    label: "Gemini 2.0 Flash",
    tier: "fast",
  },
  {
    value: "meta-llama/llama-3.1-70b-instruct",
    label: "Llama 3.1 70B",
    tier: "standard",
  },
  {
    value: "meta-llama/llama-3.2-3b-instruct",
    label: "Llama 3.2 3B",
    tier: "fast",
  },
];

function formatTokens(n: number | undefined): string {
  if (n === undefined || n === null) return "٠";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("ar-SA");
}

export default function SettingsPage() {
  // ============================================
  // ALL STATE HOOKS - MUST BE AT TOP
  // ============================================
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [settingsState, setSettingsState] = React.useState<
    Record<string, string>
  >({});
  const [promptValues, setPromptValues] = React.useState<
    Record<string, string>
  >({});
  const [openRouterPricing, setOpenRouterPricing] = React.useState<
    Array<{ id: string; pricing?: { prompt: string; completion: string } }>
  >([]);

  // ============================================
  // ALL DATA FETCHING HOOKS
  // ============================================
  const aiSettings = useQuery(api.features.admin.api.aiSettingsList, {});
  const prompts = useQuery(api.features.admin.api.promptsList, {});
  const tokenStats = useQuery(api.features.admin.api.aiTokenUsageStats, {});
  const agentConfig = useQuery(api.features.admin.api.agentLLMConfig, {});

  // ============================================
  // ALL MUTATION HOOKS
  // ============================================
  const updateSetting = useMutation(api.features.admin.api.aiSettingsUpdate);
  const batchUpdateSettings = useMutation(
    api.features.admin.api.aiSettingsBatchUpdate,
  );
  const updatePrompt = useMutation(api.features.admin.api.promptUpdate);

  // ============================================
  // ALL EFFECT HOOKS
  // ============================================
  React.useEffect(() => {
    if (aiSettings) {
      const values: Record<string, string> = {};
      aiSettings.forEach((s) => {
        values[s.key] = s.value;
      });
      setSettingsState(values);
    }
  }, [aiSettings]);

  React.useEffect(() => {
    if (prompts) {
      const values: Record<string, string> = {};
      prompts.forEach((p) => {
        values[p.key] = p.value;
      });
      setPromptValues(values);
    }
  }, [prompts]);

  React.useEffect(() => {
    fetch("https://openrouter.ai/api/v1/models")
      .then((r) => r.json())
      .then((d) => setOpenRouterPricing(d.data || []))
      .catch(() => { });
  }, []);

  // ============================================
  // ALL MEMO HOOKS
  // ============================================
  const isLoading = aiSettings === undefined || prompts === undefined;

  const totalTokens = tokenStats?.estimatedTotalTokens || 0;
  const totalRequests = tokenStats?.totalRequests || 0;
  const modelCount = tokenStats?.modelUsage?.length || 0;

  const estimatedCost = React.useMemo(() => {
    if (!tokenStats?.modelUsage?.length || openRouterPricing.length === 0) {
      return totalTokens * 0.00001;
    }
    let cost = 0;
    for (const m of tokenStats.modelUsage) {
      const promptTk = (m as any).promptTokens ?? m.estimatedTokens * 0.7;
      const completionTk =
        (m as any).completionTokens ?? m.estimatedTokens * 0.3;
      const orModel = openRouterPricing.find((p) => p.id === m.model);
      if (orModel?.pricing) {
        const promptPrice = parseFloat(orModel.pricing.prompt) || 0;
        const completionPrice = parseFloat(orModel.pricing.completion) || 0;
        cost +=
          (promptTk / 1000) * promptPrice +
          (completionTk / 1000) * completionPrice;
      } else {
        cost += promptTk * 0.00001 + completionTk * 0.00003;
      }
    }
    return cost > 0 ? cost : totalTokens * 0.00001;
  }, [tokenStats?.modelUsage, openRouterPricing, totalTokens]);

  // ============================================
  // NOW WE CAN DO CONDITIONAL RETURNS
  // ============================================
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // ============================================
  // HELPER FUNCTIONS (after hooks)
  // ============================================
  const getSetting = (key: string, defaultValue: string = "") =>
    settingsState[key] ?? defaultValue;
  const getPrompt = (key: string) => promptValues[key] || "";

  const updateLocalSetting = (key: string, value: string) => {
    setSettingsState((s) => ({ ...s, [key]: value }));
  };

  const handleSaveSetting = async (key: string) => {
    setSavingKey(key);
    try {
      await updateSetting({ key, value: settingsState[key] || "" });
      toast.success(ar.success);
    } catch {
      toast.error(ar.error);
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveAllSettings = async () => {
    setSavingKey("all");
    try {
      const settingsArray = Object.entries(settingsState).map(
        ([key, value]) => ({ key, value }),
      );
      await batchUpdateSettings({ settings: settingsArray });
      toast.success(ar.success);
    } catch {
      toast.error(ar.error);
    } finally {
      setSavingKey(null);
    }
  };

  const handleSavePrompt = async (key: string) => {
    setSavingKey(`prompt-${key}`);
    try {
      await updatePrompt({ key, value: promptValues[key] || "" });
      toast.success(ar.success);
    } catch {
      toast.error(ar.error);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={ar.settings}
        description="إعدادات الذكاء الاصطناعي والنماذج النصية"
        icon={Settings2}
        breadcrumbs={[{ label: ar.settings }]}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="الرموز هذا الأسبوع"
          value={formatTokens(totalTokens)}
          icon={Activity}
          color="blue"
          description="استخدام فعلي"
        />
        <StatCard
          label="طلبات AI"
          value={totalRequests}
          icon={Zap}
          color="violet"
          description="آخر 7 أيام"
        />
        <StatCard
          label="النماذج المستخدمة"
          value={modelCount}
          icon={Cpu}
          color="emerald"
          description="نماذج مختلفة"
        />
        <StatCard
          label="التكلفة التقديرية"
          value={`$${estimatedCost.toFixed(4)}`}
          icon={DollarSign}
          color="amber"
          description="من أسعار OpenRouter"
        />
      </div>

      <Tabs defaultValue="models" className="space-y-4">
        <TabsList>
          <TabsTrigger value="models">
            <Cpu className="h-4 w-4 ml-2" />
            النماذج
          </TabsTrigger>
          <TabsTrigger value="prompts">
            <MessageSquare className="h-4 w-4 ml-2" />
            القوالب
          </TabsTrigger>
          <TabsTrigger value="agent">
            <Sparkles className="h-4 w-4 ml-2" />
            الوكيل
          </TabsTrigger>
          <TabsTrigger value="usage">
            <Activity className="h-4 w-4 ml-2" />
            الاستخدام
          </TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="space-y-4">
          {agentConfig && !("error" in agentConfig) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  النموذج الفعلي للوكيل
                </CardTitle>
                <CardDescription>
                  النموذج المستخدم حالياً (يُعدّل من متغيرات البيئة)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">
                      {ar.modeLabel}:
                    </span>{" "}
                    <Badge variant="outline">{agentConfig.mode}</Badge>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      {ar.modelLabel}:
                    </span>{" "}
                    <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                      {agentConfig.model}
                    </code>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">إعدادات النماذج</CardTitle>
                  <CardDescription>
                    اختر النماذج المستخدمة في أجزاء مختلفة من التطبيق
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveAllSettings}
                  disabled={savingKey === "all"}
                >
                  {savingKey === "all" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {ar.save}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>النموذج الافتراضي</Label>
                  <Select
                    value={getSetting("defaultModel", "google/gemini-2.5-flash")}
                    onValueChange={(v) => updateLocalSetting("defaultModel", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          <div className="flex items-center justify-between w-full gap-2">
                            <span>{m.label}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {m.tier}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    النموذج المستخدم للمحادثات والردود العامة
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>نموذج البحث</Label>
                  <Select
                    value={getSetting("searchModel", "google/gemini-2.5-flash")}
                    onValueChange={(v) => updateLocalSetting("searchModel", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          <div className="flex items-center justify-between w-full gap-2">
                            <span>{m.label}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {m.tier}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    النموذج المستخدم لبحث العقارات والقروض
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>الحد الأقصى للرموز</Label>
                  <Input
                    type="number"
                    value={getSetting("maxTokens", "4096")}
                    onChange={(e) =>
                      updateLocalSetting("maxTokens", e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    الحد الأقصى للرموز في كل رد
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>درجة الحرارة</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={getSetting("temperature", "0.7")}
                    onChange={(e) =>
                      updateLocalSetting("temperature", e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = دقيق، 1 = إبداعي، 2 = عشوائي
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">{ar.enableCache}</p>
                    <p className="text-sm text-muted-foreground">
                      تقليل التكلفة عبر تخزين الردود المتكررة
                    </p>
                  </div>
                  <Switch
                    checked={getSetting("enableCache", "true") === "true"}
                    onCheckedChange={(v) =>
                      updateLocalSetting("enableCache", v ? "true" : "false")
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">{ar.streamingResponse}</p>
                    <p className="text-sm text-muted-foreground">
                      عرض الردود أثناء توليدها
                    </p>
                  </div>
                  <Switch
                    checked={getSetting("enableStreaming", "true") === "true"}
                    onCheckedChange={(v) =>
                      updateLocalSetting(
                        "enableStreaming",
                        v ? "true" : "false",
                      )
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompts" className="space-y-4">
          {defaultPrompts.map((prompt) => (
            <Card key={prompt.key}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{prompt.label}</CardTitle>
                    <CardDescription>{prompt.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {prompt.key}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => handleSavePrompt(prompt.key)}
                      disabled={savingKey === `prompt-${prompt.key}`}
                    >
                      {savingKey === `prompt-${prompt.key}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={getPrompt(prompt.key)}
                  onChange={(e) =>
                    setPromptValues((v) => ({
                      ...v,
                      [prompt.key]: e.target.value,
                    }))
                  }
                  rows={8}
                  className="font-mono text-sm"
                  placeholder={`أدخل ${prompt.label}...`}
                />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="agent" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    إعدادات الوكيل الذكي
                  </CardTitle>
                  <CardDescription>تكوين سلوك الوكيل وقدراته</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveAllSettings}
                  disabled={savingKey === "all"}
                >
                  {savingKey === "all" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {ar.save}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>اسم الوكيل</Label>
                  <Input
                    value={getSetting("agentName", "عنان")}
                    onChange={(e) =>
                      updateLocalSetting("agentName", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>اللغة الافتراضية</Label>
                  <Select
                    value={getSetting("agentLanguage", "ar")}
                    onValueChange={(v) =>
                      updateLocalSetting("agentLanguage", v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ar">العربية</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>الرسالة الترحيبية</Label>
                <Textarea
                  value={getSetting(
                    "welcomeMessage",
                    "مرحباً! أنا مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟",
                  )}
                  onChange={(e) =>
                    updateLocalSetting("welcomeMessage", e.target.value)
                  }
                  rows={2}
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">{ar.enableWebSearch}</p>
                    <p className="text-sm text-muted-foreground">
                      السماح للوكيل بالبحث عن معلومات إضافية
                    </p>
                  </div>
                  <Switch
                    checked={getSetting("enableWebSearch", "true") === "true"}
                    onCheckedChange={(v) =>
                      updateLocalSetting(
                        "enableWebSearch",
                        v ? "true" : "false",
                      )
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">{ar.autoHandoff}</p>
                    <p className="text-sm text-muted-foreground">
                      تحويل المحادثات المعقدة لفريق المبيعات
                    </p>
                  </div>
                  <Switch
                    checked={getSetting("enableAutoHandoff", "true") === "true"}
                    onCheckedChange={(v) =>
                      updateLocalSetting(
                        "enableAutoHandoff",
                        v ? "true" : "false",
                      )
                    }
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">{ar.rememberContext}</p>
                    <p className="text-sm text-muted-foreground">
                      حفظ تفضيلات المستخدم عبر الجلسات
                    </p>
                  </div>
                  <Switch
                    checked={
                      getSetting("enableContextMemory", "true") === "true"
                    }
                    onCheckedChange={(v) =>
                      updateLocalSetting(
                        "enableContextMemory",
                        v ? "true" : "false",
                      )
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Activity className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base">استخدام النماذج</CardTitle>
                  <CardDescription>تفصيل استخدام كل نموذج</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {tokenStats?.modelUsage && tokenStats.modelUsage.length > 0 ? (
                <div className="space-y-3">
                  {tokenStats.modelUsage.map((m: any) => (
                    <div
                      key={m.model}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          <Cpu className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{m.model}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.requests || 0} طلب
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-medium">
                          {formatTokens(m.estimatedTokens)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          رمز تقديري
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  لا توجد بيانات استخدام
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">إحصائيات سريعة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between py-3 border-b">
                  <span className="text-muted-foreground">
                    {ar.totalTokens}
                  </span>
                  <span className="font-medium">
                    {formatTokens(totalTokens)}
                  </span>
                </div>
                <div className="flex justify-between py-3 border-b">
                  <span className="text-muted-foreground">
                    {ar.inputTokens}
                  </span>
                  <span className="font-medium">
                    {formatTokens(tokenStats?.estimatedPromptTokens || 0)}
                  </span>
                </div>
                <div className="flex justify-between py-3 border-b">
                  <span className="text-muted-foreground">
                    {ar.outputTokens}
                  </span>
                  <span className="font-medium">
                    {formatTokens(tokenStats?.estimatedCompletionTokens || 0)}
                  </span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-muted-foreground">إجمالي الطلبات</span>
                  <span className="font-medium">{totalRequests}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{ar.costEstimate}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-6 rounded-xl bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">
                    التكلفة التقديرية
                  </p>
                  <p className="text-3xl font-bold text-primary">
                    ${estimatedCost.toFixed(4)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    من أسعار OpenRouter
                  </p>
                </div>
                <div className="flex justify-between py-3 border-b text-sm">
                  <span className="text-muted-foreground">
                    التكلفة لكل 1K رمز
                  </span>
                  <span className="font-medium">~$0.01</span>
                </div>
                <div className="flex justify-between py-3 text-sm">
                  <span className="text-muted-foreground">
                    {ar.costPerRequest}
                  </span>
                  <span className="font-medium">
                    $
                    {totalRequests > 0
                      ? (estimatedCost / totalRequests).toFixed(6)
                      : "0"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <span>{ar.forMoreDetails}</span>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/analytics/llm">
                    <Globe className="h-4 w-4 ml-2" />
                    {ar.analyticsFullPage}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
