"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  UserCheck,
  Shield,
  Activity,
  Search,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  StatCard,
  PageHeader,
  EmptyState,
  ResultCount,
} from "@/components/admin/ui";
import {
  TimeStatusFilter,
  type TimeFilterValue,
} from "@/components/admin/TimeStatusFilter";

function UserCard({ user }: { user: any }) {
  const initials = user.name?.charAt(0) || "ع";
  const isRecent =
    user.lastActivityAt &&
    Date.now() - user.lastActivityAt < 24 * 60 * 60 * 1000;

  return (
    <Link href={`/users/${user.userId}`}>
      <Card className="group hover:shadow-lg hover:border-primary/20 transition-all cursor-pointer overflow-hidden">
        <div
          className={cn(
            "h-1",
            user.role === "admin" ? "bg-primary" : "bg-transparent",
          )}
        />
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold",
                user.role === "admin"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">
                  {user.name || ar.unnamed}
                </h3>
                {user.verified && (
                  <UserCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={user.role === "admin" ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {user.role === "admin" ? ar.admin : ar.user}
                </Badge>
                {isRecent && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    نشط الآن
                  </span>
                )}
              </div>
              {(user.email || user.phone) && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {user.email || user.phone}
                </p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function UsersPage() {
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<string>("recent");
  const [timeFilter, setTimeFilter] = React.useState<TimeFilterValue>({
    preset: "7d",
    fromMs: Date.now() - 7 * 24 * 60 * 60 * 1000,
    toMs: Date.now(),
  });

  const users = useQuery(api.features.admin.api.listUsers, {
    limit: 50,
    fromMs: timeFilter.fromMs,
    toMs: timeFilter.toMs,
  });
  const loading = users === undefined;

  const filteredAndSortedUsers = React.useMemo(() => {
    if (!users) return [];
    let filtered = users;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.name?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower) ||
          user.phone?.includes(search),
      );
    }

    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    const sorted = [...filtered];
    switch (sortBy) {
      case "recent":
        sorted.sort(
          (a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0),
        );
        break;
      case "name":
        sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      case "created":
        sorted.sort((a, b) => b._creationTime - a._creationTime);
        break;
    }

    return sorted;
  }, [users, search, roleFilter, sortBy]);

  const stats = React.useMemo(() => {
    if (!users) return { total: 0, admins: 0, active: 0, verified: 0 };
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    return {
      total: users.length,
      admins: users.filter((u) => u.role === "admin").length,
      active: users.filter((u) => u.lastActivityAt && u.lastActivityAt > dayAgo)
        .length,
      verified: users.filter((u) => u.verified).length,
    };
  }, [users]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={ar.users}
        description="إدارة المستخدمين والعملاء"
        icon={Users}
        breadcrumbs={[{ label: ar.users }]}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي المستخدمين"
          value={stats.total}
          icon={Users}
          color="blue"
        />
        <StatCard
          label="المشرفون"
          value={stats.admins}
          icon={Shield}
          color="violet"
        />
        <StatCard
          label="نشط اليوم"
          value={stats.active}
          icon={Activity}
          color="emerald"
        />
        <StatCard
          label="موثقون"
          value={stats.verified}
          icon={UserCheck}
          color="amber"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ابحث بالاسم، البريد، أو رقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder={ar.role} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar.all}</SelectItem>
            <SelectItem value="admin">{ar.admin}</SelectItem>
            <SelectItem value="user">{ar.user}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="ترتيب" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">الأحدث نشاطاً</SelectItem>
            <SelectItem value="name">{ar.name}</SelectItem>
            <SelectItem value="created">{ar.createdAt}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TimeStatusFilter value={timeFilter} onTimeChange={setTimeFilter} />

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : filteredAndSortedUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={ar.noUsers}
          description={ar.tryChangingSearch}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedUsers.map((user) => (
            <UserCard key={user.userId} user={user} />
          ))}
        </div>
      )}

      {!loading && filteredAndSortedUsers.length > 0 && (
        <ResultCount
          showing={filteredAndSortedUsers.length}
          total={stats.total}
        />
      )}
    </div>
  );
}
