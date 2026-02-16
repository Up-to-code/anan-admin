import {
  AlertCircle,
  Phone,
  TrendingUp,
  Target,
  FileText,
  CheckCircle,
  XCircle,
} from "lucide-react";

export const ORDER_STATUS = {
  new_lead: {
    label: "جديد",
    color: "blue",
    textColor: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    icon: AlertCircle,
  },
  contacted: {
    label: "تواصل",
    color: "violet",
    textColor: "text-violet-600",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    icon: Phone,
  },
  qualified: {
    label: "مؤهل",
    color: "amber",
    textColor: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: TrendingUp,
  },
  offer_made: {
    label: "عرض",
    color: "orange",
    textColor: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    icon: Target,
  },
  under_contract: {
    label: "عقد",
    color: "cyan",
    textColor: "text-cyan-600",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-200",
    icon: FileText,
  },
  closed_won: {
    label: "مغلق",
    color: "emerald",
    textColor: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    icon: CheckCircle,
  },
  closed_lost: {
    label: "خسارة",
    color: "gray",
    textColor: "text-gray-500",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    icon: XCircle,
  },
} as const;

export const ORDER_TRANSITIONS: Record<string, string[]> = {
  new_lead: ["contacted", "closed_lost"],
  contacted: ["qualified", "closed_lost"],
  qualified: ["offer_made", "closed_lost"],
  offer_made: ["under_contract", "closed_lost"],
  under_contract: ["closed_won", "closed_lost"],
  closed_won: [],
  closed_lost: [],
};

export const ORDER_STATUS_LIST = [
  "new_lead",
  "contacted",
  "qualified",
  "offer_made",
  "under_contract",
  "closed_won",
  "closed_lost",
] as const;

export type OrderStatus = keyof typeof ORDER_STATUS;
