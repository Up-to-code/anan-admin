"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save, Loader2 } from "lucide-react";
import { ar } from "@/lib/ar";
import type { BankProductRules } from "@/lib/types";

interface BankProductFormProps {
  defaultValues?: {
    name: string;
    type: string;
    description?: string;
    rules?: BankProductRules;
  };
  onSubmit: (data: {
    name: string;
    type: string;
    description?: string;
    rules?: BankProductRules;
  }) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

const productTypes = [
  { value: "mortgage", label: "تمويل عقاري" },
  { value: "personal_loan", label: "قرض شخصي" },
  { value: "car_loan", label: "تمويل سيارة" },
  { value: "construction_loan", label: "قرض بناء" },
  { value: "refinance", label: "إعادة تمويل" },
  { value: "other", label: "أخرى" },
];

const employmentTypes = [
  { value: "any", label: "أي نوع" },
  { value: "employed", label: "موظف" },
  { value: "self_employed", label: "عمل حر" },
  { value: "retired", label: "متقاعد" },
];

const defaultDocuments = [
  "بطاقة الهوية",
  "كشف راتب",
  "عقد العمل",
  "كشف حساب بنكي",
  "تقرير ائتماني",
];

export function BankProductForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = ar.save,
}: BankProductFormProps) {
  const [loading, setLoading] = React.useState(false);
  const [name, setName] = React.useState(defaultValues?.name || "");
  const [type, setType] = React.useState(defaultValues?.type || "");
  const [description, setDescription] = React.useState(
    defaultValues?.description || "",
  );
  const [rules, setRules] = React.useState<BankProductRules>(
    defaultValues?.rules || {},
  );
  const [newDocument, setNewDocument] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        name,
        type,
        description: description || undefined,
        rules: Object.keys(rules).length > 0 ? rules : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const updateRule = <K extends keyof BankProductRules>(
    key: K,
    value: BankProductRules[K],
  ) => {
    setRules((prev: BankProductRules) => ({ ...prev, [key]: value }));
  };

  const addDocument = () => {
    if (newDocument.trim()) {
      const docs = rules.requiredDocuments || [];
      updateRule("requiredDocuments", [...docs, newDocument.trim()]);
      setNewDocument("");
    }
  };

  const removeDocument = (index: number) => {
    const docs = rules.requiredDocuments || [];
    updateRule(
      "requiredDocuments",
      docs.filter((_: string, i: number) => i !== index),
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">معلومات المنتج</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{ar.name}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">{ar.type}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر النوع" />
                </SelectTrigger>
                <SelectContent>
                  {productTypes.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value}>
                      {pt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{ar.description}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">شروط الأهلية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>الحد الأدنى للراتب (ريال)</Label>
              <Input
                type="number"
                value={rules.minSalary || ""}
                onChange={(e) =>
                  updateRule(
                    "minSalary",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                placeholder="مثال: 5000"
              />
            </div>
            <div className="space-y-2">
              <Label>نوع الوظيفة</Label>
              <Select
                value={rules.employmentType || "any"}
                onValueChange={(v) =>
                  updateRule(
                    "employmentType",
                    v as BankProductRules["employmentType"],
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {employmentTypes.map((et) => (
                    <SelectItem key={et.value} value={et.value}>
                      {et.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الحد الأدنى لسنوات الخبرة</Label>
              <Input
                type="number"
                value={rules.minEmploymentYears || ""}
                onChange={(e) =>
                  updateRule(
                    "minEmploymentYears",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                placeholder="مثال: 2"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>الحد الأدنى للعمر</Label>
              <Input
                type="number"
                value={rules.minAge || ""}
                onChange={(e) =>
                  updateRule(
                    "minAge",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                placeholder="مثال: 21"
              />
            </div>
            <div className="space-y-2">
              <Label>الحد الأقصى للعمر</Label>
              <Input
                type="number"
                value={rules.maxAge || ""}
                onChange={(e) =>
                  updateRule(
                    "maxAge",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                placeholder="مثال: 60"
              />
            </div>
            <div className="space-y-2">
              <Label>مشتري لأول مرة</Label>
              <Select
                value={
                  rules.firstTimeBuyer === true
                    ? "true"
                    : rules.firstTimeBuyer === false
                      ? "false"
                      : "any"
                }
                onValueChange={(v) =>
                  updateRule(
                    "firstTimeBuyer",
                    v === "true" ? true : v === "false" ? false : "any",
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">أي حالة</SelectItem>
                  <SelectItem value="true">نعم فقط</SelectItem>
                  <SelectItem value="false">لا فقط</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>الحد الأقصى لنسبة الدين (%)</Label>
              <Input
                type="number"
                value={rules.maxDebtRatio || ""}
                onChange={(e) =>
                  updateRule(
                    "maxDebtRatio",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                placeholder="مثال: 50"
              />
            </div>
            <div className="space-y-2">
              <Label>الحد الأدنى للتصنيف الائتماني</Label>
              <Input
                type="number"
                value={rules.minCreditScore || ""}
                onChange={(e) =>
                  updateRule(
                    "minCreditScore",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                placeholder="مثال: 650"
              />
            </div>
            <div className="space-y-2">
              <Label>الحد الأدنى للدفعة الأولى (%)</Label>
              <Input
                type="number"
                value={rules.minDownPayment || ""}
                onChange={(e) =>
                  updateRule(
                    "minDownPayment",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                placeholder="مثال: 10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">تفاصيل القرض</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>الحد الأدنى لمبلغ القرض (ريال)</Label>
              <Input
                type="number"
                value={rules.minLoanAmount || ""}
                onChange={(e) =>
                  updateRule(
                    "minLoanAmount",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                placeholder="مثال: 100000"
              />
            </div>
            <div className="space-y-2">
              <Label>الحد الأقصى لمبلغ القرض (ريال)</Label>
              <Input
                type="number"
                value={rules.maxLoanAmount || ""}
                onChange={(e) =>
                  updateRule(
                    "maxLoanAmount",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                placeholder="مثال: 5000000"
              />
            </div>
            <div className="space-y-2">
              <Label>مدة القرض (شهور)</Label>
              <Input
                value={rules.loanTermMonths?.join(", ") || ""}
                onChange={(e) =>
                  updateRule(
                    "loanTermMonths",
                    e.target.value
                      ? e.target.value.split(",").map((s) => Number(s.trim()))
                      : undefined,
                  )
                }
                placeholder="مثال: 60, 120, 180, 240"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>الحد الأدنى لسعر الفائدة (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={rules.interestRate?.min || ""}
                onChange={(e) =>
                  updateRule("interestRate", {
                    ...rules.interestRate,
                    min: e.target.value ? Number(e.target.value) : 0,
                    max: rules.interestRate?.max || 0,
                  })
                }
                placeholder="مثال: 3.5"
              />
            </div>
            <div className="space-y-2">
              <Label>الحد الأقصى لسعر الفائدة (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={rules.interestRate?.max || ""}
                onChange={(e) =>
                  updateRule("interestRate", {
                    ...rules.interestRate,
                    min: rules.interestRate?.min || 0,
                    max: e.target.value ? Number(e.target.value) : 0,
                  })
                }
                placeholder="مثال: 6.5"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>رسوم المعالجة (ريال)</Label>
              <Input
                type="number"
                value={rules.fees?.processingFee || ""}
                onChange={(e) =>
                  updateRule("fees", {
                    ...rules.fees,
                    processingFee: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                placeholder="مثال: 1000"
              />
            </div>
            <div className="space-y-2">
              <Label>رسوم السداد المبكر (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={rules.fees?.earlyPaymentFee || ""}
                onChange={(e) =>
                  updateRule("fees", {
                    ...rules.fees,
                    earlyPaymentFee: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                placeholder="مثال: 2"
              />
            </div>
            <div className="space-y-2">
              <Label>رسوم التأخير (ريال)</Label>
              <Input
                type="number"
                value={rules.fees?.latePaymentFee || ""}
                onChange={(e) =>
                  updateRule("fees", {
                    ...rules.fees,
                    latePaymentFee: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                placeholder="مثال: 200"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">المستندات المطلوبة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {rules.requiredDocuments?.map((doc: string, index: number) => (
              <Badge key={index} variant="secondary" className="gap-1">
                {doc}
                <button
                  type="button"
                  onClick={() => removeDocument(index)}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newDocument}
              onChange={(e) => setNewDocument(e.target.value)}
              placeholder="أضف مستند..."
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), addDocument())
              }
            />
            <Button type="button" variant="outline" onClick={addDocument}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">اقتراحات:</span>
            {defaultDocuments.map((doc) => (
              <Button
                key={doc}
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  const docs = rules.requiredDocuments || [];
                  if (!docs.includes(doc)) {
                    updateRule("requiredDocuments", [...docs, doc]);
                  }
                }}
              >
                + {doc}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ملاحظات إضافية</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={rules.notes || ""}
            onChange={(e) => updateRule("notes", e.target.value || undefined)}
            placeholder="أي ملاحظات إضافية حول المنتج..."
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {ar.cancel}
          </Button>
        )}
        <Button type="submit" disabled={loading || !name || !type}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
