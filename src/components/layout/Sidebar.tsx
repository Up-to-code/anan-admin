"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Bot,
  ShoppingCart,
  Bell,
  Building2,
  Landmark,
  BriefcaseBusiness,
  Package,
  MessageSquareText,
  Heart,
  Sparkles,
  BookOpen,
  Settings,
  User,
  Menu,
  Zap,
  ChevronRight,
  BarChart3,
  Cog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ar } from "@/lib/ar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar, SidebarProvider } from "./SidebarContext";

interface NavItemConfig {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavGroupConfig {
  title: string;
  items: NavItemConfig[];
}

const navGroups: NavGroupConfig[] = [
  {
    title: "الرئيسية",
    items: [
      { title: ar.dashboard, href: "/", icon: LayoutDashboard },
      { title: ar.agentChat, href: "/agent", icon: Bot },
    ],
  },
  {
    title: "الفريق والعملاء",
    items: [
      { title: ar.team, href: "/team", icon: UsersRound },
      { title: ar.users, href: "/users", icon: Users },
    ],
  },
  {
    title: "المبيعات",
    items: [
      {
        title: ar.pipelineOrders,
        href: "/orders",
        icon: ShoppingCart,
        badge: "orders",
      },
      {
        title: ar.notifications,
        href: "/notifications",
        icon: Bell,
        badge: "notifications",
      },
    ],
  },
  {
    title: "الكيانات",
    items: [
      { title: ar.developers, href: "/developers", icon: Building2 },
      { title: ar.properties, href: "/properties", icon: Landmark },
      { title: ar.banks, href: "/banks", icon: BriefcaseBusiness },
      { title: ar.bankProduct, href: "/bank-products", icon: Package },
    ],
  },
  {
    title: "المحتوى",
    items: [
      { title: ar.prompts, href: "/prompts", icon: Sparkles },
      { title: ar.knowledge, href: "/knowledge", icon: BookOpen },
      { title: ar.reviews, href: "/reviews", icon: MessageSquareText },
      { title: ar.favorites, href: "/favorites", icon: Heart },
    ],
  },
  {
    title: "النظام",
    items: [
      { title: "تحليلات AI", href: "/analytics/llm", icon: BarChart3 },
      { title: ar.settings, href: "/settings", icon: Cog },
      { title: ar.system, href: "/system", icon: Settings },
      { title: ar.profile, href: "/profile", icon: User },
    ],
  },
];

type NavItemProps = NavItemConfig;

function NavItem({
  item,
  isActive,
  badgeCount,
  collapsed,
  onClick,
}: {
  item: NavItemProps;
  isActive: boolean;
  badgeCount?: number;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;

  const content = (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors relative",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="flex-1">{item.title}</span>}
      {item.badge && badgeCount !== undefined && badgeCount > 0 && (
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground",
            collapsed && "absolute -top-1 -right-1 h-4 min-w-4 text-[8px]",
          )}
        >
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="left" className="font-arabic">
          {item.title}
          {item.badge && badgeCount !== undefined && badgeCount > 0 && (
            <span className="mr-2 text-destructive">({badgeCount})</span>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const unreadCount = useQuery(
    api.features.admin.api.notificationsUnreadCount,
    {},
  );
  const summary = useQuery(api.features.admin.api.pipelineSummary);

  const getBadgeCount = (badge?: string) => {
    if (badge === "notifications") return unreadCount;
    if (badge === "orders") return summary?.unassigned;
    return undefined;
  };

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-14 items-center gap-2 border-b",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          {!collapsed && <span className="font-bold text-lg">عنان</span>}
        </Link>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <TooltipProvider>
          <nav className="space-y-4">
            {navGroups.map((group) => (
              <div key={group.title}>
                {!collapsed && (
                  <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">
                    {group.title}
                  </p>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <NavItem
                      key={item.href}
                      item={item}
                      isActive={
                        item.href === "/"
                          ? pathname === "/"
                          : item.href
                            ? pathname.startsWith(item.href)
                            : false
                      }
                      badgeCount={getBadgeCount(item.badge)}
                      collapsed={collapsed}
                      onClick={onNavigate}
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </TooltipProvider>
      </ScrollArea>
    </div>
  );
}

export function Sidebar() {
  const { collapsed } = useSidebar();

  return (
    <aside
      className={cn(
        "hidden lg:flex h-screen flex-col border-l bg-card transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 p-0">
        <SidebarProvider>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SidebarProvider>
      </SheetContent>
    </Sheet>
  );
}
