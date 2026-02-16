import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ORDER_STATUS, type OrderStatus } from "@/lib/status-config";

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = ORDER_STATUS[status] || ORDER_STATUS.new_lead;
  return (
    <Badge
      variant="secondary"
      className={cn(
        config.textColor,
        config.bgColor,
        config.borderColor,
        "border",
        className,
      )}
    >
      {config.label}
    </Badge>
  );
}
