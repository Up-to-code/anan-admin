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
    title: "navMain",
    items: [
      { title: ar.dashboard, href: "/", icon: LayoutDashboard },
    ],
  },
  {
    title: "navTeam",
    items: [
      { title: ar.team, href: "/team", icon: UsersRound },
      { title: ar.users, href: "/users", icon: Users },
    ],
  },
  {
    title: "navSales",
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
    title: "navData",
    items: [
      { title: ar.developers, href: "/developers", icon: Building2 },
      { title: ar.properties, href: "/properties", icon: Landmark },
      { title: ar.banks, href: "/banks", icon: BriefcaseBusiness },
      { title: ar.bankProduct, href: "/bank-products", icon: Package },
    ],
  },
  {
    title: "navContent",
    items: [
      { title: ar.prompts, href: "/prompts", icon: Sparkles },
      { title: ar.knowledge, href: "/knowledge", icon: BookOpen },
      { title: ar.reviews, href: "/reviews", icon: MessageSquareText },
      { title: ar.favorites, href: "/favorites", icon: Heart },
    ],
  },
  {
    title: "navSystem",
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
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 relative group/item",
        isActive
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 font-medium"
          : "text-muted-foreground/80 hover:bg-muted hover:text-foreground",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon className={cn(
        "h-4 w-4 shrink-0 transition-transform duration-200",
        !isActive && "group-hover/item:scale-110"
      )} />
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
  const isAdmin = useQuery(api.features.admin.api.isAdmin);
  const unreadCount = useQuery(
    api.features.admin.api.notificationsUnreadCount,
    isAdmin === true ? {} : "skip",
  );
  const summary = useQuery(
    api.features.admin.api.pipelineSummary,
    isAdmin === true ? {} : "skip",
  );

  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return { navMain: true };
    const saved = localStorage.getItem("sidebar_expanded_groups");
    return saved ? JSON.parse(saved) : { navMain: true };
  });

  React.useEffect(() => {
    localStorage.setItem("sidebar_expanded_groups", JSON.stringify(expandedGroups));
  }, [expandedGroups]);

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Zap className="h-4 w-4" />
          </div>
          {!collapsed && <span className="font-bold text-lg tracking-tight">عنان</span>}
        </Link>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <TooltipProvider>
          <nav className="space-y-2">
            {navGroups.map((group) => {
              const isExpanded = expandedGroups[group.title] ?? false;
              const hasActiveChild = group.items.some(item =>
                item.href === "/" ? pathname === "/" : item.href ? pathname.startsWith(item.href) : false
              );

              return (
                <div key={group.title} className="space-y-1">
                  {!collapsed ? (
                    <button
                      onClick={() => toggleGroup(group.title)}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 hover:text-foreground transition-colors group/header",
                        hasActiveChild && !isExpanded && "text-primary/70"
                      )}
                    >
                      <span>{(ar as any)[group.title]}</span>
                      <ChevronRight className={cn(
                        "h-3 w-3 transition-transform duration-200 opacity-0 group-hover/header:opacity-100",
                        isExpanded && "rotate-90 opacity-100"
                      )} />
                    </button>
                  ) : (
                    <div className="h-px bg-muted mx-2 my-4 opacity-50" />
                  )}

                  <div className={cn(
                    "space-y-1 overflow-hidden transition-all duration-300",
                    collapsed ? "block" : isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                  )}>
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
              );
            })}
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
