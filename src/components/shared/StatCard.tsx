import * as React from "react";
import Link from "next/link";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  href?: string;
}

export function StatCard({ label, value, icon: Icon, href }: StatCardProps) {
  const content = (
    <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
      {Icon && (
        <div className="p-2 rounded-lg bg-muted shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-lg font-semibold truncate">{value}</div>
        <div className="text-xs text-muted-foreground truncate">{label}</div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return content;
}
