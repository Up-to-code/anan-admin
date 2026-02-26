"use client";

import * as React from "react";
import { CalendarDays, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option = { label: string; value: string };

export type TimePreset =
  | "24h"
  | "7d"
  | "30d"
  | "90d"
  | "1y"
  | "custom";

export type TimeFilterValue = {
  preset: TimePreset;
  fromMs?: number;
  toMs?: number;
};

const PRESET_LABELS: Record<TimePreset, string> = {
  "24h": "آخر 24 ساعة",
  "7d": "آخر 7 أيام",
  "30d": "آخر 30 يوم",
  "90d": "آخر 90 يوم",
  "1y": "آخر سنة",
  custom: "مخصص",
};

function presetToRange(preset: TimePreset): TimeFilterValue {
  const now = Date.now();
  if (preset === "custom") return { preset };
  const delta =
    preset === "24h"
      ? 24 * 60 * 60 * 1000
      : preset === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : preset === "30d"
          ? 30 * 24 * 60 * 60 * 1000
          : preset === "90d"
            ? 90 * 24 * 60 * 60 * 1000
            : 365 * 24 * 60 * 60 * 1000;
  return { preset, fromMs: now - delta, toMs: now };
}

export function TimeStatusFilter(props: {
  value: TimeFilterValue;
  onTimeChange: (next: TimeFilterValue) => void;
  statusValue?: string;
  onStatusChange?: (value: string) => void;
  statusOptions?: Option[];
  extraFilters?: React.ReactNode;
}) {
  const { value, onTimeChange, statusValue, onStatusChange, statusOptions, extraFilters } = props;
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");

  React.useEffect(() => {
    if (value.preset !== "custom") return;
    setFromDate(value.fromMs ? new Date(value.fromMs).toISOString().slice(0, 10) : "");
    setToDate(value.toMs ? new Date(value.toMs).toISOString().slice(0, 10) : "");
  }, [value.preset, value.fromMs, value.toMs]);

  const applyCustom = (nextFrom: string, nextTo: string) => {
    const fromMs = nextFrom ? new Date(`${nextFrom}T00:00:00`).getTime() : undefined;
    const toMs = nextTo ? new Date(`${nextTo}T23:59:59`).getTime() : undefined;
    onTimeChange({ preset: "custom", fromMs, toMs });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        <span>فلاتر الوقت والحالة</span>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="w-full md:w-[220px]">
          <Label className="mb-1 block text-xs">الفترة الزمنية</Label>
          <Select
            value={value.preset}
            onValueChange={(preset) =>
              onTimeChange(presetToRange(preset as TimePreset))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRESET_LABELS) as TimePreset[]).map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {PRESET_LABELS[preset]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {statusOptions && onStatusChange ? (
          <div className="w-full md:w-[220px]">
            <Label className="mb-1 block text-xs">الحالة</Label>
            <Select value={statusValue ?? "all"} onValueChange={onStatusChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {extraFilters}
      </div>

      {value.preset === "custom" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="mb-1 block text-xs">من تاريخ</Label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={fromDate}
                onChange={(event) => {
                  const next = event.target.value;
                  setFromDate(next);
                  applyCustom(next, toDate);
                }}
                className="pe-10"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-xs">إلى تاريخ</Label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={toDate}
                onChange={(event) => {
                  const next = event.target.value;
                  setToDate(next);
                  applyCustom(fromDate, next);
                }}
                className="pe-10"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
