"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
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
  CreditCard,
  Home,
  Percent,
  Calendar,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { Separator } from "@/components/ui/separator";

function StatCard({
  label,
  value,
  icon: Icon,
  color = "blue",
}: {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  color?: "blue" | "emerald" | "amber" | "rose" | "violet";
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    rose: "bg-rose-500/10 text-rose-600",
    violet: "bg-violet-500/10 text-violet-600",
  };

  return (
    <Card className="relative overflow-hidden">
      <div
        className={cn("absolute top-0 left-0 right-0 h-1", `bg-${color}-500`)}
      />
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          {Icon && (
            <div className={cn("p-2.5 rounded-xl", colorClasses[color])}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const productTypeConfig: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  mortgage: { label: "تمويل عقاري", icon: Home, color: "blue" },
  personal_loan: { label: "قرض شخصي", icon: CreditCard, color: "violet" },
  auto_loan: { label: "تمويل سيارة", icon: Package, color: "emerald" },
  construction: { label: "تمويل بناء", icon: Landmark, color: "amber" },
  default: { label: "منتج", icon: Package, color: "gray" },
};

function ProductRow({ product }: { product: any }) {
  const type = productTypeConfig[product.type] || productTypeConfig.default;
  const TypeIcon = type.icon;

  return (
    <div className="flex items-center gap-3 py-3 px-2 hover:bg-muted/50 rounded-lg transition-colors">
      <div className={cn("p-2 rounded-lg shrink-0", `bg-${type.color}-500/10`)}>
        <TypeIcon className={cn("h-4 w-4", `text-${type.color}-600`)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{product.name}</span>
          {product.type && (
            <Badge variant="outline" className="text-[10px]">
              {type.label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          {product.minAmount && (
            <span>من {product.minAmount.toLocaleString("ar-SA")} ر.س</span>
          )}
          {product.maxAmount && (
            <span>إلى {product.maxAmount.toLocaleString("ar-SA")} ر.س</span>
          )}
          {product.interestRate && (
            <span className="flex items-center gap-1">
              <Percent className="h-3 w-3" />
              {product.interestRate}%
            </span>
          )}
        </div>
      </div>
      <Badge
        variant={product.status === "active" ? "default" : "secondary"}
        className={cn(
          "text-[10px]",
          product.status === "active" && "bg-emerald-500/10 text-emerald-600",
        )}
      >
        {product.status === "active" ? "نشط" : "غير نشط"}
      </Badge>
      <Link href={`/bank-products/${product._id}`}>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
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
    active: {
      label: ar.active,
      icon: CheckCircle,
      className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    },
    suspended: {
      label: ar.suspended,
      icon: Pause,
      className: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    },
    inactive: {
      label: ar.inactive,
      icon: Activity,
      className: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    },
  };
  const status =
    statusConfig[bank.status as keyof typeof statusConfig] ||
    statusConfig.inactive;
  const StatusIcon = status.icon;
  const activeProducts = products.filter((p) => p.status === "active").length;

  return (
    <Card className="group hover:shadow-md hover:border-primary/20 transition-all overflow-hidden">
      <div
        className={cn(
          "h-1",
          bank.status === "active"
            ? "bg-emerald-500"
            : bank.status === "suspended"
              ? "bg-rose-500"
              : "bg-gray-400",
        )}
      />
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn("p-3 rounded-xl shrink-0", status.className)}>
            <Landmark className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/banks/${bank._id}`}
                className="font-medium truncate hover:text-primary"
              >
                {bank.name}
              </Link>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
              {bank.slug}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {bank.contactEmail && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  <span className="truncate max-w-[120px]">
                    {bank.contactEmail}
                  </span>
                </div>
              )}
              {bank.website && (
                <div className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  <a
                    href={bank.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary truncate max-w-[100px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    موقع
                  </a>
                </div>
              )}
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn("text-[10px] gap-1", status.className)}
          >
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </Badge>
        </div>

        {/* Products Summary */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-violet-600" />
              <span className="font-medium">{products.length} منتج</span>
            </div>
            {activeProducts > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {activeProducts} نشط
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="gap-1 text-xs"
            >
              {expanded ? "إخفاء" : "عرض"} المنتجات
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Expandable Products List */}
        {expanded && (
          <div className="mt-3 border-t pt-3">
            {products.length > 0 ? (
              <ScrollArea className="h-[200px]">
                <div className="space-y-1 pr-2">
                  {products.map((product) => (
                    <ProductRow key={product._id} product={product} />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="py-6 text-center text-muted-foreground text-sm">
                لا توجد منتجات لهذا البنك
              </div>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href={`/bank-products?bankId=${bank._id}`}>
                  <Plus className="h-3.5 w-3.5 ml-1" />
                  إضافة منتج
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/banks/${bank._id}/edit`}>
                <Edit className="h-3.5 w-3.5 ml-1" />
                تعديل
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/banks/${bank._id}`}>
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
                تفاصيل
              </Link>
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
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
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (bank) =>
          bank.name?.toLowerCase().includes(searchLower) ||
          bank.slug?.toLowerCase().includes(searchLower) ||
          bank.contactEmail?.toLowerCase().includes(searchLower),
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (b) => (b.status ?? "inactive") === statusFilter,
      );
    }

    return filtered;
  }, [banks, search, statusFilter]);

  const stats = React.useMemo(() => {
    if (!banks) return { total: 0, active: 0, inactive: 0, products: 0 };
    return {
      total: banks.length,
      active: banks.filter((b) => b.status === "active").length,
      inactive: banks.filter((b) => b.status === "inactive" || !b.status)
        .length,
      products: allProducts?.length ?? 0,
    };
  }, [banks, allProducts]);

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
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">{ar.dashboard}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              {ar.banks}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{ar.banks}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة البنوك ومنتجاتها (قروض، تمويل، إلخ)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/bank-products">
              <Package className="ml-2 h-4 w-4" />
              كل المنتجات
            </Link>
          </Button>
          <Button asChild>
            <Link href="/banks/create">
              <Plus className="ml-2 h-4 w-4" />
              {ar.addBank}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي البنوك"
          value={stats.total}
          icon={Landmark}
          color="blue"
        />
        <StatCard
          label="نشط"
          value={stats.active}
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          label="غير نشط"
          value={stats.inactive}
          icon={Activity}
          color="amber"
        />
        <StatCard
          label="المنتجات"
          value={stats.products}
          icon={Package}
          color="violet"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={ar.searchBanks}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
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
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : filteredBanks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Landmark className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">
              {ar.noBanksFound}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {ar.tryChangingSearch}
            </p>
            <Button asChild className="mt-4">
              <Link href="/banks/create">
                <Plus className="ml-2 h-4 w-4" />
                {ar.addBank}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filteredBanks.map((bank) => (
            <BankCard
              key={bank._id}
              bank={bank}
              products={productsByBank.get(bank._id) || []}
              onDelete={() => setDeleteBankId(bank._id)}
            />
          ))}
        </div>
      )}

      {!loading && filteredBanks.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          عرض {filteredBanks.length} من {stats.total} بنك
        </div>
      )}

      <AlertDialog
        open={!!deleteBankId}
        onOpenChange={() => setDeleteBankId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {ar.deleteBankConfirm}
            </AlertDialogTitle>
            <AlertDialogDescription>
              هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع المنتجات المرتبطة
              بهذا البنك.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDelete}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {ar.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
