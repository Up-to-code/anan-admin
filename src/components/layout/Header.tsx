"use client";

import * as React from "react";
import Link from "next/link";
import {
  Moon,
  Sun,
  LogOut,
  User,
  Bell,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Bot,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MobileSidebar } from "./Sidebar";
import { useSidebar } from "./SidebarContext";
import { useTheme } from "@/components/providers/ThemeProvider";
import { ar } from "@/lib/ar";
import { signOut, useSession } from "@/lib/auth-client";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { cn } from "@/lib/utils";

function NotificationBell() {
  const isAdmin = useQuery(api.features.admin.api.isAdmin);
  const unreadCount = useQuery(
    api.features.admin.api.notificationsUnreadCount,
    isAdmin === true ? {} : "skip",
  );
  const notificationsResult = useQuery(
    api.features.admin.api.notificationsList,
    isAdmin === true
      ? { paginationOpts: { numItems: 10, cursor: null } }
      : "skip",
  );
  const acknowledge = useMutation(
    api.features.admin.api.notificationAcknowledge,
  );

  const notifications = notificationsResult?.page;

  const handleAcknowledge = async (id: string) => {
    await acknowledge({ id: id as any });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <h4 className="font-medium">{ar.notifications}</h4>
          <Badge variant="secondary" className="text-xs">
            {unreadCount || 0} {ar.unread}
          </Badge>
        </div>
        <ScrollArea className="h-80">
          {notifications && notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.slice(0, 5).map((n: any) => (
                <div
                  key={n._id}
                  className={cn(
                    "p-3 hover:bg-muted/50 transition-colors",
                    !n.read && "bg-muted/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n._creationTime).toLocaleDateString("ar-SA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {!n.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => handleAcknowledge(n._id)}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {ar.noNotifications}
            </div>
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href="/notifications">
              {ar.view} {ar.all}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SidebarToggle() {
  const { collapsed, toggle } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="hidden lg:flex"
    >
      {collapsed ? (
        <ChevronRight className="h-5 w-5" />
      ) : (
        <ChevronLeft className="h-5 w-5" />
      )}
    </Button>
  );
}

export function Header() {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-2 border-b bg-background px-4">
      <SidebarToggle />
      <MobileSidebar />

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 bg-primary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/30 transition-all shadow-sm hidden md:flex"
          asChild
        >
          <Link href="/agent">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold tracking-tight">{ar.aiAgent}</span>
            <Sparkles className="h-3 w-3 text-primary/50" />
          </Link>
        </Button>

        <NotificationBell />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <Avatar className="h-7 w-7">
                <AvatarImage
                  src={session?.user?.image || undefined}
                  alt={session?.user?.name || ""}
                />
                <AvatarFallback>
                  {session?.user?.name?.charAt(0) || "A"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm">
                {session?.user?.name?.split(" ")[0] || ar.user}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{session?.user?.name}</p>
              <p className="text-xs text-muted-foreground">
                {session?.user?.email}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {ar.profile}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              {ar.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
