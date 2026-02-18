"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  UsersRound,
  Shield,
  ChevronRight,
  Mail,
  Phone,
  BarChart3,
  MessageSquare,
  Activity,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  StatCard,
  PageHeader,
  EmptyState,
  ResultCount,
} from "@/components/admin/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type TeamMember = {
  userId: string;
  name?: string | null;
  phone: string | null;
  email?: string | null;
  role: "user" | "admin";
  canEditRole: boolean;
};

function TeamMemberCard({
  member,
  onRoleChange,
}: {
  member: TeamMember;
  onRoleChange: (member: TeamMember, role: "user" | "admin") => Promise<void>;
}) {
  const [pending, setPending] = React.useState(false);
  const initials = member.name?.charAt(0) || member.userId?.slice(0, 1) || "?";
  const isAdmin = member.role === "admin";

  const handleToggle = async (checked: boolean) => {
    if (!member.canEditRole) return;
    const newRole = checked ? "admin" : "user";
    setPending(true);
    try {
      await onRoleChange(member, newRole);
      toast.success(ar.roleUpdated);
    } catch {
      toast.error(ar.roleUpdateFailed);
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="overflow-hidden group hover:shadow-md transition-shadow">
      <div className={cn("h-1", isAdmin ? "bg-primary" : "bg-muted")} />
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Link href={`/users/${member.userId}`} className="flex-1 min-w-0">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold",
                  isAdmin ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                    {member.name || ar.unnamed}
                  </h3>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge
                    variant={isAdmin ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {isAdmin ? ar.admin : ar.user}
                  </Badge>
                </div>
                <div className="flex flex-col gap-0.5 mt-1.5">
                  {member.email && (
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Mail className="h-3 w-3 shrink-0" />
                      {member.email}
                    </p>
                  )}
                  {member.phone && (
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Phone className="h-3 w-3 shrink-0" />
                      {member.phone}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 text-primary/80">
                  {ar.viewDetails}
                </p>
              </div>
            </div>
          </Link>
          {member.canEditRole && (
            <div className="flex shrink-0 items-center gap-2">
              <Switch
                checked={isAdmin}
                onCheckedChange={handleToggle}
                disabled={pending}
                aria-label={ar.switchRole}
              />
              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                {ar.admin}
              </Label>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    message_sent: "رسالة",
    search: "بحث",
    order_created: "طلب",
    login: "تسجيل دخول",
    property_viewed: "عرض عقار",
  };
  return map[action] ?? action;
}

export default function TeamPage() {
  const members = useQuery(api.features.admin.api.listTeamMembers, {});
  const myStats = useQuery(api.features.admin.api.getMyAdminStats, {});
  const setRoleByUserId = useMutation(api.features.admin.api.setUserRoleByUserId);
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [statsOpen, setStatsOpen] = React.useState(true);
  const loading = members === undefined;

  const handleRoleChange = React.useCallback(
    async (member: TeamMember, role: "user" | "admin") => {
      await setRoleByUserId({ userId: member.userId, role });
    },
    [setRoleByUserId],
  );

  const filteredMembers = React.useMemo(() => {
    if (!members) return [];
    if (roleFilter === "all") return members;
    return members.filter((m) => m.role === roleFilter);
  }, [members, roleFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={ar.team}
        description={ar.teamDesc}
        icon={UsersRound}
        breadcrumbs={[{ label: ar.team }]}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={ar.teamMembers}
          value={members?.length ?? 0}
          icon={UsersRound}
          color="blue"
        />
        <StatCard
          label={ar.admin}
          value={members?.filter((m) => m.role === "admin").length ?? 0}
          icon={Shield}
          color="violet"
        />
      </div>

      {myStats && (
        <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              {ar.myStats}
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform",
                  statsOpen && "rotate-90"
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">
                      {myStats.threadCount}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ar.myThreads}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">
                      {myStats.activityCount}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ar.myActivity}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">
                      {myStats.handoffsCount}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ar.handoffs}
                  </p>
                </CardContent>
              </Card>
            </div>
            {myStats.recentActivity.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {ar.recentActivity}
                </p>
                <div className="space-y-1">
                  {myStats.recentActivity.slice(0, 5).map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span>{formatAction(a.action)}</span>
                      {a.channel && (
                        <Badge variant="outline" className="text-[10px]">
                          {a.channel}
                        </Badge>
                      )}
                      <span>
                        {new Date(a.createdAt).toLocaleDateString("ar-SA")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {!loading && members && members.length > 0 && (
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">{ar.filterBy}</Label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar.all}</SelectItem>
              <SelectItem value="admin">{ar.admin}</SelectItem>
              <SelectItem value="user">{ar.user}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : !members || members.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={ar.noTeamMembers}
          description={ar.teamEmptyDesc}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => (
            <TeamMemberCard
              key={member.userId}
              member={member}
              onRoleChange={handleRoleChange}
            />
          ))}
        </div>
      )}

      {!loading && members && members.length > 0 && (
        <ResultCount
          showing={filteredMembers.length}
          total={members.length}
        />
      )}
    </div>
  );
}
