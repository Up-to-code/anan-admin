"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  ShoppingCart,
  CheckCircle,
  Sparkles,
  Search,
  Heart,
  Bot,
  Activity,
  DollarSign,
  User,
  UserCog,
  ChevronRight,
  Package,
  Eye,
  Loader2,
  Globe,
  MapPin,
  Database,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, StatCard } from "@/components/admin/ui";

function formatNumber(n: number | undefined): string {
  if (n === undefined || n === null) return "٠";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}م`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}ك`;
  return n.toLocaleString("ar-SA");
}

function formatTokens(n: number | undefined): string {
  if (n === undefined || n === null) return "٠";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("ar-SA");
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function OrderCard({ order }: { order: any }) {
  const statusConfig: Record<string, { className: string; label: string }> = {
    new_lead: { className: "bg-blue-500/10 text-blue-600", label: "جديد" },
    contacted: { className: "bg-violet-500/10 text-violet-600", label: "تواصل" },
    qualified: { className: "bg-amber-500/10 text-amber-600", label: "مؤهل" },
    closed_won: { className: "bg-emerald-500/10 text-emerald-600", label: "مغلق" },
    closed_lost: { className: "bg-gray-500/10 text-gray-600", label: "خسارة" },
  };
  const status = statusConfig[order.status] || statusConfig.new_lead;

  return (
    <Link href={`/orders/${order._id}`}>
      <Card className="group hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10 shrink-0">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate">{(ar as any)[order.type] || order.type}</h3>
                <Badge variant="outline" className={cn("text-[10px]", status.className)}>
                  {status.label}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{new Date(order._creationTime).toLocaleDateString("ar-SA")}</span>
                {order.budget && <span>{order.budget.toLocaleString("ar-SA")} ر.س</span>}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ChatMessage({ message }: { message: any }) {
  const isUser = message.role === "user";
  const text = message.text || message.content || message.body || "";
  const time = message._creationTime
    ? new Date(message._creationTime).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
        isUser ? "bg-primary text-primary-foreground" : "bg-muted"
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn(
        "max-w-[75%] rounded-2xl px-4 py-2.5",
        isUser ? "bg-primary text-primary-foreground rounded-tl-md" : "bg-muted rounded-tr-md"
      )}>
        <p className="text-sm whitespace-pre-wrap">{text}</p>
        {time && (
          <p className={cn("text-[10px] mt-1", isUser ? "text-primary-foreground/60" : "text-muted-foreground")}>
            {time}
          </p>
        )}
      </div>
    </div>
  );
}

function ConversationList({ threads, activeThreadId, onSelect }: {
  threads: any[];
  activeThreadId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="w-72 border-l shrink-0">
      <div className="p-3 border-b">
        <h3 className="font-semibold text-sm">المحادثات</h3>
      </div>
      <ScrollArea className="h-[400px]">
        <div className="p-2 space-y-1">
          {threads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">لا توجد محادثات</div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread._id}
                onClick={() => onSelect(thread._id)}
                className={cn(
                  "w-full text-right p-3 rounded-lg transition-all",
                  activeThreadId === thread._id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted"
                )}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">{thread.title || "محادثة"}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(thread._creationTime).toLocaleDateString("ar-SA")}
                </p>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ChatView({ messages, loading }: { messages: any[]; loading: boolean }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-muted-foreground">لا توجد رسائل</p>
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollRef} className="flex-1 h-[400px]">
      <div className="p-4 space-y-4">
        {messages.map((msg, i) => (
          <ChatMessage key={msg._id || i} message={msg} />
        ))}
      </div>
    </ScrollArea>
  );
}

function TraceView({ traces }: { traces: any[] }) {
  if (!traces || traces.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        لا يوجد سجل أدوات لهذا الثريد.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[220px] border-t">
      <div className="p-3 space-y-3">
        {traces.map((trace: any) => (
          <Card key={trace._id} className="border-dashed">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{new Date(trace._creationTime).toLocaleString("ar-SA")}</span>
                <span>Tools: {(trace.toolCalls?.length ?? 0)} / Results: {(trace.toolResults?.length ?? 0)}</span>
              </div>
              <p className="text-xs">
                <span className="font-medium">المستخدم: </span>
                {trace.userMessage || "-"}
              </p>
              <p className="text-xs">
                <span className="font-medium">الرد: </span>
                {trace.assistantMessage || "-"}
              </p>
              <div className="flex flex-wrap gap-1">
                {(trace.toolCalls ?? []).slice(0, 8).map((tool: any, i: number) => (
                  <Badge key={`${trace._id}-tool-${i}`} variant="outline" className="text-[10px]">
                    {tool?.name || "unknown"}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

function SearchLogCard({ log }: { log: any }) {
  return (
    <Card className="hover:bg-muted/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 shrink-0">
            <Globe className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{log.query || "-"}</h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {log.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{log.location}</span>
                </div>
              )}
              <span>{new Date(log._creationTime).toLocaleDateString("ar-SA")}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KnowledgeResearchCard({ research }: { research: any }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-violet-500" />
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-violet-500/10 shrink-0">
            <Database className="h-5 w-5 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{research.query}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(research._creationTime).toLocaleDateString("ar-SA")}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-[10px]">{research.channel || "ويب"}</Badge>
              <span className="text-xs text-muted-foreground">{research.sourceRuns?.length || 0} مصدر</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? "إخفاء" : "عرض"}
            <ChevronRight className={cn("h-4 w-4 mr-1 transition-transform", expanded && "rotate-90")} />
          </Button>
        </div>

        {expanded && research.sourceRuns && research.sourceRuns.length > 0 && (
          <div className="mt-4 space-y-2 border-t pt-4">
            <h4 className="text-sm font-medium">المصادر</h4>
            {research.sourceRuns.slice(0, 5).map((source: any, i: number) => (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                <span className="text-sm truncate flex-1">{source.title || source.url}</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityCard({ activity }: { activity: any }) {
  const config: Record<string, { icon: React.ElementType; label: string }> = {
    message_sent: { icon: MessageSquare, label: "رسالة" },
    search: { icon: Search, label: "بحث" },
    order_created: { icon: ShoppingCart, label: "طلب جديد" },
    login: { icon: CheckCircle, label: "تسجيل دخول" },
  };
  const { icon: Icon, label } = config[activity.action] || { icon: Activity, label: activity.action };

  return (
    <Card className="hover:bg-muted/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-muted shrink-0">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm">{label}</h3>
            <p className="text-xs text-muted-foreground">
              {new Date(activity._creationTime).toLocaleString("ar-SA")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UserDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const userId = params.userId as string;

  const [tab, setTab] = React.useState<"overview" | "orders" | "conversation" | "search" | "activity">("overview");
  const [summary, setSummary] = React.useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [activeThreadId, setActiveThreadId] = React.useState<string | null>(null);

  const user = useQuery(api.features.admin.api.getUser, { userId });
  const userFullData = useQuery(api.features.admin.api.getUserFullData, { userId });
  const userOrders = useQuery(api.features.admin.api.ordersForUser, { userId }) as any[] | undefined;
  const userThreads = useQuery(
    api.features.admin.api.conversationsListThreads,
    userId ? { userId, paginationOpts: { cursor: null, numItems: 20 } } : "skip"
  ) as { page: Array<{ _id: string; title?: string; _creationTime: number }> } | undefined;
  const setRoleByUserId = useMutation(api.features.admin.api.setUserRoleByUserId);
  const generateSummary = useMutation(api.features.admin.api.generateUserSummary);
  const aiCosts = useQuery(api.features.admin.api.getTotalAICostsByUserId, { userId });
  const toolCosts = useQuery(api.features.admin.api.getToolCostsByUserId, { userId });

  const threadMessages = useQuery(
    api.features.admin.api.conversationsGetThreadMessages,
    activeThreadId ? { threadId: activeThreadId, paginationOpts: { cursor: null, numItems: 100 } } : "skip"
  ) as { page: Array<any> } | undefined;
  const threadTraces = useQuery(
    api.features.admin.api.conversationsGetThreadTraces,
    activeThreadId ? { threadId: activeThreadId, limit: 20 } : "skip"
  ) as Array<any> | undefined;

  React.useEffect(() => {
    const nextTab = searchParams.get("tab");
    if (nextTab === "conversation") setTab("conversation");
  }, [searchParams]);

  React.useEffect(() => {
    if (userThreads?.page?.length && !activeThreadId) {
      setActiveThreadId(userThreads.page[0]._id);
    }
  }, [userThreads, activeThreadId]);

  if (user === undefined) return <LoadingSkeleton />;
  if (!user) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{ar.userNotFound}</p>
          <Button asChild className="mt-4"><Link href="/users">{ar.back}</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const counts = (userFullData?.counts || {}) as Record<string, number>;
  const threads = userThreads?.page || [];
  const messages = threadMessages?.page || [];

  async function onRoleChange(role: "user" | "admin") {
    try { await setRoleByUserId({ userId, role }); toast.success(ar.roleUpdated); }
    catch { toast.error(ar.roleUpdateFailed); }
  }

  async function onGenerateSummary() {
    setSummaryLoading(true);
    try { const result = await generateSummary({ userId }); setSummary(result.summary); }
    catch { toast.error("فشل إنشاء الملخص"); }
    finally { setSummaryLoading(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.name || ar.unnamed}
        description={user.phone || user.email || "-"}
        icon={User}
        breadcrumbs={[
          { label: ar.users, href: "/users" },
          { label: user.name || ar.unnamed },
        ]}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={onGenerateSummary} disabled={summaryLoading}>
              {summaryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              ملخص AI
            </Button>
            <Button variant="outline" onClick={() => onRoleChange(user.role === "admin" ? "user" : "admin")}>
              <UserCog className="h-4 w-4" />
              تغيير الدور
            </Button>
          </div>
        }
      />

      {summary && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span className="font-medium">ملخص الذكاء الاصطناعي</span>
            </div>
            <pre className="text-sm whitespace-pre-wrap font-sans">{summary}</pre>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label={ar.orders}
          value={counts.orders || 0}
          icon={ShoppingCart}
          color="blue"
        />
        <StatCard
          label="محادثات"
          value={counts.threads || 0}
          icon={MessageSquare}
          color="violet"
        />
        <StatCard
          label="سجل البحث"
          value={counts.searchLogs || 0}
          icon={Search}
          color="emerald"
        />
        <StatCard
          label="بحث المعرفة"
          value={counts.knowledgeResearch || 0}
          icon={Database}
          color="blue"
        />
        <StatCard
          label={ar.favorites}
          value={counts.favorites || 0}
          icon={Heart}
          color="rose"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">{ar.overview}</TabsTrigger>
          <TabsTrigger value="orders">{ar.orders}</TabsTrigger>
          <TabsTrigger value="conversation">{ar.conversation}</TabsTrigger>
          <TabsTrigger value="search">البحث</TabsTrigger>
          <TabsTrigger value="activity">{ar.activity}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-6">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">{ar.basicInfo}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-0">
                  <div className="flex justify-between py-3 border-b"><span className="text-muted-foreground">{ar.name}</span><span className="font-medium">{user.name || "-"}</span></div>
                  <div className="flex justify-between py-3 border-b"><span className="text-muted-foreground">{ar.email}</span><span className="font-medium">{user.email || "-"}</span></div>
                  <div className="flex justify-between py-3 border-b"><span className="text-muted-foreground">{ar.phone}</span><span className="font-medium" dir="ltr">{user.phone || "-"}</span></div>
                  <div className="flex justify-between py-3"><span className="text-muted-foreground">{ar.createdAt}</span><span className="font-medium">{new Date(user._creationTime).toLocaleDateString("ar-SA")}</span></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">{ar.financialInfo}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-0">
                  <div className="flex justify-between py-3 border-b"><span className="text-muted-foreground">{ar.budget}</span><span className="font-medium">{(user as any).maxBudget ? `${((user as any).maxBudget as number).toLocaleString("ar-SA")} ر.س` : "-"}</span></div>
                  <div className="flex justify-between py-3 border-b"><span className="text-muted-foreground">{ar.salary}</span><span className="font-medium">{(user as any).salary ? `${((user as any).salary as number).toLocaleString("ar-SA")} ر.س` : "-"}</span></div>
                  <div className="flex justify-between py-3"><span className="text-muted-foreground">{ar.preferredLocation}</span><span className="font-medium">{(user as any).preferredLocation || "-"}</span></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">تكلفة الذكاء الاصطناعي</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-xl bg-muted/50"><p className="text-xs text-muted-foreground">الرموز</p><p className="text-xl font-bold">{formatTokens(aiCosts?.totalTokens || 0)}</p></div>
                <div className="text-center p-4 rounded-xl bg-muted/50"><p className="text-xs text-muted-foreground">الطلبات</p><p className="text-xl font-bold">{aiCosts?.totalRequests || 0}</p></div>
                <div className="text-center p-4 rounded-xl bg-muted/50"><p className="text-xs text-muted-foreground">استدعاءات الأدوات</p><p className="text-xl font-bold">{(toolCosts as any)?.totalToolCalls || 0}</p></div>
                <div className="text-center p-4 rounded-xl bg-muted/50"><p className="text-xs text-muted-foreground">التكلفة</p><p className="text-xl font-bold">${((aiCosts?.totalTokens || 0) * 0.00001).toFixed(4)}</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          <div className="grid sm:grid-cols-2 gap-4">
            {!userOrders || userOrders.length === 0 ? (
              <Card className="col-span-full"><CardContent className="py-16 text-center"><Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">{ar.noOrders}</p></CardContent></Card>
            ) : userOrders.map((order) => <OrderCard key={order._id} order={order} />)}
          </div>
        </TabsContent>

        <TabsContent value="conversation" className="mt-6">
          <Card className="overflow-hidden">
            <div className="flex h-[500px]">
              <ConversationList threads={threads} activeThreadId={activeThreadId} onSelect={setActiveThreadId} />
              <div className="flex-1 flex flex-col">
                <div className="p-3 border-b flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="font-medium text-sm">{threads.find(t => t._id === activeThreadId)?.title || "المحادثة"}</span>
                </div>
                <ChatView messages={messages} loading={!!activeThreadId && threadMessages === undefined} />
                <TraceView traces={threadTraces || []} />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4 mt-6">
          <Card>
            <CardHeader><CardTitle className="text-base">سجل البحث</CardTitle></CardHeader>
            <CardContent>
              {!userFullData?.searchLogs || userFullData.searchLogs.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">{ar.noSearches}</div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">{userFullData.searchLogs.map((log: any) => <SearchLogCard key={log._id} log={log} />)}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">بحث الويب والمعرفة</CardTitle></CardHeader>
            <CardContent>
              {!userFullData?.knowledgeResearch || userFullData.knowledgeResearch.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">لا توجد عمليات بحث</div>
              ) : (
                <div className="space-y-3">{userFullData.knowledgeResearch.map((r: any) => <KnowledgeResearchCard key={r._id} research={r} />)}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <div className="grid sm:grid-cols-2 gap-3">
            {!userFullData?.activity || userFullData.activity.length === 0 ? (
              <Card className="col-span-full"><CardContent className="py-16 text-center"><Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">{ar.noActivity}</p></CardContent></Card>
            ) : userFullData.activity.map((a: any) => <ActivityCard key={a._id} activity={a} />)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
