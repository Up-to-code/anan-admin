"use client";

import { useMemo, useState } from "react";
import {
  ClipboardList,
  ListChecks,
  Send,
  Sparkles,
  Target,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type {
  AdminTaskMode,
  AdminTaskOutputStyle,
  AdminTaskRequest,
  AdminTaskScope,
} from "./types";

const QUICK_TASKS = [
  {
    label: "مراجعة أخطاء الإنتاج",
    prompt:
      "راجع أخطاء الإنتاج في لوحة الأدمن وحدد أول 5 مشاكل حسب الخطورة، ثم اعطني خطة إصلاح وتنفيذ.",
  },
  {
    label: "تحسين auth والأدوار",
    prompt:
      "راجع تدفق المصادقة والأدوار في لوحة الأدمن، ثم اقترح تحسينات واضحة ونفّذ الإصلاحات المطلوبة.",
  },
  {
    label: "تدقيق بحث العقارات",
    prompt:
      "دقق خوارزمية البحث عن العقارات وجودة النتائج والصور، واعطني خطة تحسين مع تنفيذ التعديلات الأهم.",
  },
  {
    label: "تجهيز تقرير إداري",
    prompt:
      "أنشئ تقرير إداري واضح عن حالة النظام: المشاكل، المخاطر، الأولويات، وخطة التنفيذ للأسبوع القادم.",
  },
] as const;

function scopeLabel(scope: AdminTaskScope): string {
  if (scope === "users") return "المستخدمون";
  if (scope === "orders") return "الطلبات";
  if (scope === "properties") return "العقارات";
  if (scope === "banks") return "البنوك";
  if (scope === "knowledge") return "المعرفة";
  if (scope === "prompts") return "البرومبتات";
  if (scope === "analytics") return "التحليلات";
  return "النظام";
}

function modeLabel(mode: AdminTaskMode): string {
  if (mode === "plan_only") return "خطة فقط";
  if (mode === "execute_only") return "تنفيذ مباشر";
  if (mode === "audit") return "تدقيق ومراجعة";
  return "خطة ثم تنفيذ";
}

function styleLabel(style: AdminTaskOutputStyle): string {
  if (style === "brief") return "مختصر";
  if (style === "checklist") return "قائمة تنفيذ";
  return "تفصيلي";
}

export function AdminHelperPanel({
  isBusy,
  pendingCount,
  onRunPrompt,
  onRunTask,
}: {
  isBusy: boolean;
  pendingCount: number;
  onRunPrompt: (prompt: string) => void;
  onRunTask: (task: AdminTaskRequest) => void;
}) {
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [acceptance, setAcceptance] = useState("");
  const [scope, setScope] = useState<AdminTaskScope>("system");
  const [mode, setMode] = useState<AdminTaskMode>("plan_then_execute");
  const [outputStyle, setOutputStyle] = useState<AdminTaskOutputStyle>("detailed");
  const [needTests, setNeedTests] = useState(true);
  const [needRisks, setNeedRisks] = useState(true);
  const [needRollback, setNeedRollback] = useState(true);
  const [needMetrics, setNeedMetrics] = useState(true);
  const [needUi, setNeedUi] = useState(true);
  const [needBackend, setNeedBackend] = useState(true);

  const requirements = useMemo(() => {
    const lines: string[] = [];
    if (needUi) lines.push("- تحديث واجهات الأدمن إذا كانت متأثرة.");
    if (needBackend) lines.push("- تحديث الباكند وواجهات API إذا لزم.");
    if (needTests) lines.push("- إضافة/تحديث اختبارات أو على الأقل smoke checks.");
    if (needRisks) lines.push("- ذكر المخاطر والانحدارات المحتملة.");
    if (needRollback) lines.push("- تضمين خطة rollback واضحة.");
    if (needMetrics) lines.push("- ذكر كيف نقيس النجاح بعد التنفيذ.");
    return lines;
  }, [needBackend, needMetrics, needRisks, needRollback, needTests, needUi]);

  const builtPrompt = useMemo(() => {
    if (!goal.trim()) return "";
    const acceptanceBlock = acceptance.trim()
      ? `\nمعايير القبول:\n${acceptance
          .split("\n")
          .filter(Boolean)
          .map((line) => `- ${line.replace(/^-+\s*/, "").trim()}`)
          .join("\n")}`
      : "";

    const contextBlock = context.trim() ? `\nالسياق:\n${context.trim()}` : "";
    const outputBlock =
      outputStyle === "checklist"
        ? "الإخراج المطلوب بصيغة قائمة تنفيذية واضحة."
        : outputStyle === "brief"
          ? "الإخراج المطلوب مختصر وواضح."
          : "الإخراج المطلوب تفصيلي مع خطوات عملية.";

    return `أنت مساعد إداري تقني في مشروع ANAN.

المهمة الرئيسية:
${goal.trim()}

النطاق:
- القسم: ${scopeLabel(scope)}
- نمط العمل: ${modeLabel(mode)}
- أسلوب الإخراج: ${styleLabel(outputStyle)}

المتطلبات الإلزامية:
${requirements.join("\n")}
${contextBlock}
${acceptanceBlock}

تعليمات التنفيذ:
1) افهم الوضع الحالي بسرعة.
2) قدم خطة عمل مرتبة (P0 ثم P1).
3) ${mode === "plan_only" ? "توقف عند الخطة ولا تنفذ تغييرات." : "نفذ التعديلات المطلوبة بالكامل."}
4) اعرض ما تم تغييره وكيف نتحقق منه.
5) ${outputBlock}`;
  }, [acceptance, context, goal, mode, outputStyle, requirements, scope]);

  const sendBuiltPrompt = () => {
    if (!goal.trim() || isBusy) return;
    const acceptanceCriteria = acceptance
      .split("\n")
      .map((line) => line.replace(/^-+\s*/, "").trim())
      .filter(Boolean);
    onRunTask({
      goal: goal.trim(),
      scope,
      mode,
      outputStyle,
      context: context.trim() || undefined,
      acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
      requirements: {
        needUi,
        needBackend,
        needTests,
        needRisks,
        needRollback,
        needMetrics,
      },
    });
  };

  const sendPlanOnly = () => {
    if (!goal.trim() || isBusy) return;
    const acceptanceCriteria = acceptance
      .split("\n")
      .map((line) => line.replace(/^-+\s*/, "").trim())
      .filter(Boolean);
    onRunTask({
      goal: goal.trim(),
      scope,
      mode: "plan_only",
      outputStyle,
      context: context.trim() || undefined,
      acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
      requirements: {
        needUi,
        needBackend,
        needTests,
        needRisks,
        needRollback,
        needMetrics,
      },
    });
  };

  const resetAll = () => {
    setGoal("");
    setContext("");
    setAcceptance("");
    setScope("system");
    setMode("plan_then_execute");
    setOutputStyle("detailed");
    setNeedTests(true);
    setNeedRisks(true);
    setNeedRollback(true);
    setNeedMetrics(true);
    setNeedUi(true);
    setNeedBackend(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">AI Helper</p>
            <p className="text-xs text-muted-foreground">إدارة المهام والخطط والتنفيذ</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">
          معلق: {pendingCount}
        </Badge>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 p-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" />
                الهدف الرئيسي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder="اكتب المهمة المطلوبة بدقة..."
              />
              <Textarea
                value={context}
                onChange={(event) => setContext(event.target.value)}
                placeholder="السياق أو المشاكل الحالية (اختياري)"
                className="min-h-[90px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Workflow className="h-4 w-4" />
                خيارات التنفيذ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">النطاق</p>
                  <Select
                    value={scope}
                    onValueChange={(value) => setScope(value as AdminTaskScope)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">النظام</SelectItem>
                      <SelectItem value="users">المستخدمون</SelectItem>
                      <SelectItem value="orders">الطلبات</SelectItem>
                      <SelectItem value="properties">العقارات</SelectItem>
                      <SelectItem value="banks">البنوك</SelectItem>
                      <SelectItem value="knowledge">المعرفة</SelectItem>
                      <SelectItem value="prompts">البرومبتات</SelectItem>
                      <SelectItem value="analytics">التحليلات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">نمط العمل</p>
                  <Select
                    value={mode}
                    onValueChange={(value) => setMode(value as AdminTaskMode)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plan_then_execute">خطة ثم تنفيذ</SelectItem>
                      <SelectItem value="plan_only">خطة فقط</SelectItem>
                      <SelectItem value="execute_only">تنفيذ مباشر</SelectItem>
                      <SelectItem value="audit">تدقيق ومراجعة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">أسلوب الإخراج</p>
                  <Select
                    value={outputStyle}
                    onValueChange={(value) => setOutputStyle(value as AdminTaskOutputStyle)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="detailed">تفصيلي</SelectItem>
                      <SelectItem value="brief">مختصر</SelectItem>
                      <SelectItem value="checklist">قائمة تنفيذ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <Checkbox checked={needUi} onCheckedChange={(value) => setNeedUi(value === true)} />
                  واجهة
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={needBackend}
                    onCheckedChange={(value) => setNeedBackend(value === true)}
                  />
                  باكند
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={needTests}
                    onCheckedChange={(value) => setNeedTests(value === true)}
                  />
                  اختبارات
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={needRisks}
                    onCheckedChange={(value) => setNeedRisks(value === true)}
                  />
                  مخاطر
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={needRollback}
                    onCheckedChange={(value) => setNeedRollback(value === true)}
                  />
                  Rollback
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={needMetrics}
                    onCheckedChange={(value) => setNeedMetrics(value === true)}
                  />
                  Metrics
                </label>
              </div>

              <Textarea
                value={acceptance}
                onChange={(event) => setAcceptance(event.target.value)}
                placeholder="معايير القبول (كل سطر معيار)"
                className="min-h-[90px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                مهام سريعة
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {QUICK_TASKS.map((task) => (
                <Button
                  key={task.label}
                  variant="outline"
                  className="justify-start text-right h-auto py-2 whitespace-normal"
                  disabled={isBusy}
                  onClick={() => onRunPrompt(task.prompt)}
                >
                  {task.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3 space-y-2">
        <Button className="w-full gap-2" onClick={sendBuiltPrompt} disabled={!builtPrompt || isBusy}>
          <Send className="h-4 w-4" />
          إرسال المهمة
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={sendPlanOnly} disabled={!builtPrompt || isBusy}>
            خطة فقط
          </Button>
          <Button variant="ghost" onClick={resetAll} disabled={isBusy}>
            مسح
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center">
          يتم إرسال برومبت منظم للوكيل لتنفيذ المهام الإدارية بشكل أدق.
        </p>
      </div>
    </div>
  );
}
