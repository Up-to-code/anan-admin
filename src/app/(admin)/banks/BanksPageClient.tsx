"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Landmark,
  Package,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertTriangle,
  Mail,
  CheckCircle,
  Activity,
  Pause,
  Edit,
  Globe,
  Home,
  Percent,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader, StatCard, EmptyState, SearchInput } from "@/components/admin/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function ProductRow({ product }: { product: any }) {
  return (
    <div className="flex items-center gap-3 py-3 px-2 hover:bg-muted/50 rounded-lg transition-colors border-b border-border/10 last:border-0">
      <div className="p-2 rounded-lg bg-primary/5 shrink-0">
        <Package className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{product.name}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground font-mono">
          {product.interestRate && (
            <span className="flex items-center gap-1 text-emerald-600">
              <Percent className="h-3 w-3" />
              {product.interestRate}%
            </span>
          )}
          {product.minAmount && (
            <span>من {product.minAmount.toLocaleString("ar-SA")}</span>
          )}
        </div>
      </div>
      <Badge
        variant={product.status === "active" ? "default" : "secondary"}
        className="text-[10px] scale-90"
      >
        {product.status === "active" ? "نشط" : "غير نشط"}
      </Badge>
      <Link href={`/bank-products/${product._id}`}>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </div>
  );
}

function BankCard({
  bank,
  products,
  onDelete,
}: {
  bank: any;
  products: any[];
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const statusConfig = {
    active: { label: ar.active, icon: CheckCircle, color: "emerald" },
    suspended: { label: ar.suspended, icon: Pause, color: "rose" },
    inactive: { label: ar.inactive, icon: Activity, color: "amber" },
  };
  const status = statusConfig[bank.status as keyof typeof statusConfig] || statusConfig.inactive;
  const activeProducts = products.filter((p) => p.status === "active").length;

  return (
    <Card className="group transition-all hover:border-primary/20 shadow-sm overflow-hidden">
      <div className={cn("h-1", `bg-${status.color}-500`)} />
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn("p-2.5 rounded-xl shrink-0 border border-border/50", `bg-${status.color}-500/5 text-${status.color}-600`)}>
            <Landmark className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <Link href={`/banks/${bank._id}`} className="font-bold truncate hover:text-primary transition-colors block text-base">
              {bank.name}
            </Link>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              {bank.contactEmail && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3 opacity-70" />
                  <span className="truncate">{bank.contactEmail}</span>
                </div>
              )}
            </div>
          </div>
          <Badge variant="outline" className={cn("text-[10px] gap-1", `bg-${status.color}-500/5 text-${status.color}-700 border-${status.color}-200`)}>
            {status.label}
          </Badge>
        </div>

        <div className="mt-4 flex items-center justify-between bg-muted/30 p-2 rounded-lg border border-border/50">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{products.length} منتجات</span>
            {activeProducts > 0 && (
              <span className="text-emerald-600">({activeProducts} نشط)</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-7 text-[11px] px-2"
          >
            {expanded ? "إخفاء" : "عرض"}
            {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
          </Button>
        </div>

        {expanded && (
          <div className="mt-2 border-t border-border/50 pt-2 animate-in slide-in-from-top-1 duration-200">
            <ScrollArea className={cn("pr-2", products.length > 5 ? "h-[200px]" : "h-auto")}>
              <div className="space-y-0.5">
                {products.map((product) => (
                  <ProductRow key={product._id} product={product} />
                ))}
              </div>
            </ScrollArea>
            <div className="mt-3 flex justify-end">
              <Button size="sm" variant="secondary" className="h-8 text-xs font-normal" asChild>
                <Link href={`/bank-products?bankId=${bank._id}`}>إدارة المنتجات</Link>
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" asChild>
              <Link href={`/banks/${bank._id}/edit`}><Edit className="h-3.5 w-3.5 ml-1.5" />تعديل</Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" asChild>
              <Link href={`/banks/${bank._id}`}>التفاصيل</Link>
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function BanksPageClient() {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [deleteBankId, setDeleteBankId] = React.useState<string | null>(null);

  const banks = useQuery(api.features.admin.api.banksList, { limit: 200 });
  const allProducts = useQuery(api.features.admin.api.bankProductsList, {});
  const removeBank = useMutation(api.features.admin.api.bankRemove);
  const loading = banks === undefined;

  const productsByBank = React.useMemo(() => {
    const map = new Map<string, any[]>();
    if (allProducts) {
      for (const p of allProducts) {
        const list = map.get(p.bankId) || [];
        list.push(p);
        map.set(p.bankId, list);
      }
    }
    return map;
  }, [allProducts]);

  const filteredBanks = React.useMemo(() => {
    if (!banks) return [];
    let filtered = banks;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(b => b.name?.toLowerCase().includes(q) || b.slug?.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(b => (b.status || "inactive") === statusFilter);
    }
    return filtered;
  }, [banks, search, statusFilter]);

  async function onConfirmDelete() {
    if (!deleteBankId) return;
    try {
      await removeBank({ id: deleteBankId as any });
      toast.success(ar.bankDeleted);
    } catch {
      toast.error(ar.bankDeleteFailed);
    } finally {
      setDeleteBankId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={ar.banks}
        description="إدارة الشراكات المصرفية والمنتجات التمويلية."
        icon={Landmark}
        breadcrumbs={[{ label: ar.dashboard, href: "/" }, { label: ar.banks }]}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild className="hidden sm:flex">
              <Link href="/bank-products"><Package className="ml-2 h-4 w-4" />المنتجات</Link>
            </Button>
            <Button asChild>
              <Link href="/banks/create"><Plus className="ml-2 h-4 w-4" />{ar.addBank}</Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="إجمالي البنوك" value={banks?.length ?? 0} icon={Landmark} color="blue" />
        <StatCard label="نشط" value={banks?.filter(b => b.status === "active").length ?? 0} icon={CheckCircle} color="emerald" />
        <StatCard label="قيد المراجعة" value={banks?.filter(b => b.status === "suspended").length ?? 0} icon={Pause} color="amber" />
        <StatCard label="المنتجات" value={allProducts?.length ?? 0} icon={Package} color="violet" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder={ar.searchBanks} />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={ar.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar.all}</SelectItem>
            <SelectItem value="active">{ar.active}</SelectItem>
            <SelectItem value="inactive">{ar.inactive}</SelectItem>
            <SelectItem value="suspended">{ar.suspended}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : filteredBanks.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title={ar.noBanksFound}
          description={ar.tryChangingSearch}
          action={<Button asChild><Link href="/banks/create">{ar.addBank}</Link></Button>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
          {filteredBanks.map(bank => (
            <BankCard
              key={bank._id}
              bank={bank}
              products={productsByBank.get(bank._id) || []}
              onDelete={() => setDeleteBankId(bank._id)}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteBankId} onOpenChange={() => setDeleteBankId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {ar.deleteBankConfirm}
            </AlertDialogTitle>
            <AlertDialogDescription>
              هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع المنتجات المرتبطة بهذا البنك بشكل دائم.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDelete} className="bg-rose-600 hover:bg-rose-700">
              {ar.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
