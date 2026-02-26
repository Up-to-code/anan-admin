import type { Doc } from "../_generated/dataModel";

type NotificationAudience = "sales" | "admin" | "user";
type NotificationPriority = "low" | "medium" | "high" | "urgent";

export type NotificationManifestEvent =
  | "order_assigned"
  | "order_mentioned"
  | "order_status_changed"
  | "system_alert";

export type NotificationTemplate = {
  title: string;
  body: string;
  audience: NotificationAudience;
  priority: NotificationPriority;
  actionRequired: boolean;
  metadata?: Record<string, unknown>;
};

function toArabicStatus(status: string): string {
  switch (status) {
    case "new_lead":
      return "جديد";
    case "contacted":
      return "تم التواصل";
    case "qualified":
      return "مؤهل";
    case "offer_made":
      return "تم إرسال عرض";
    case "under_contract":
      return "تحت التعاقد";
    case "closed_won":
      return "مغلق - ناجح";
    case "closed_lost":
      return "مغلق - غير ناجح";
    default:
      return status;
  }
}

export function buildNotificationTemplate(args: {
  event: NotificationManifestEvent;
  order?: Doc<"orders">;
  actorName?: string;
  mentionNote?: string;
  previousStatus?: string;
  nextStatus?: string;
}): NotificationTemplate {
  const orderId = args.order?._id ? String(args.order._id).slice(-8) : "";
  const orderType = args.order?.type ?? "طلب";

  switch (args.event) {
    case "order_assigned":
      return {
        title: "تم إسناد طلب لك",
        body: `تم إسناد ${orderType} رقم ${orderId} إليك للمتابعة.`,
        audience: "sales",
        priority: args.order?.priority ?? "medium",
        actionRequired: true,
      };
    case "order_mentioned":
      return {
        title: "تم ذكرك في طلب",
        body: `${args.actorName ?? "أحد أعضاء الفريق"} قام بذكرك في ${orderType} رقم ${orderId}${args.mentionNote ? `: ${args.mentionNote}` : "."}`,
        audience: "sales",
        priority: args.order?.priority ?? "medium",
        actionRequired: true,
        metadata: { mentionNote: args.mentionNote },
      };
    case "order_status_changed":
      return {
        title: "تم تحديث حالة طلب",
        body: `تم تحديث حالة ${orderType} رقم ${orderId} من ${toArabicStatus(
          args.previousStatus ?? "",
        )} إلى ${toArabicStatus(args.nextStatus ?? args.order?.status ?? "")}.`,
        audience: "sales",
        priority: args.order?.priority ?? "medium",
        actionRequired: (args.nextStatus ?? args.order?.status) !== "closed_won" &&
          (args.nextStatus ?? args.order?.status) !== "closed_lost",
      };
    case "system_alert":
    default:
      return {
        title: "تنبيه من النظام",
        body: "يوجد تحديث جديد يتطلب المراجعة في لوحة التحكم.",
        audience: "admin",
        priority: "medium",
        actionRequired: false,
      };
  }
}
