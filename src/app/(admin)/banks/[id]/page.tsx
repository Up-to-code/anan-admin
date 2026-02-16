"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Pencil,
  Landmark,
  Mail,
  Trash2,
  Globe,
  Phone,
  Calendar,
  Package,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  Plus,
  CheckCircle,
  Pause,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ar } from "@/lib/ar";
import { toast } from "sonner";
import { PageHeader, StatCard } from "@/components/admin/ui";
import type { LucideIcon } from "lucide-react";

const statusConfig: Record<
  string,
  { label: string; className: string; icon: React.ElementType }
> = {
  active: {
    label: ar.active,
    className: "bg-emerald-500/10 text-emerald-600",
    icon: CheckCircle,
  },
  inactive: {
    label: ar.inactive,
    className: "bg-gray-500/10 text-gray-600",
    icon: Activity,
  },
  suspended: {
    label: ar.suspended,
    className: "bg-rose-500/10 text-rose-600",
    icon: Pause,
  },
};


function ProductCard({ product }: { product: any }) {
  const status = statusConfig[product.status] || statusConfig.inactive;
  const StatusIcon = status.icon;

  return (
    <Link href={`/bank-products?bankId=${product.bankId}`}>
      <Card className="group hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-violet-500/10 shrink-0">
              <Package className="h-5 w-5 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate">{product.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {product.type || "-"}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn("text-[10px]", status.className)}
            >
              <StatusIcon className="h-3 w-3 ml-1" />
              {status.label}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function BankDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bankId = params.id as Id<"banks">;
  const bank = useQuery(api.features.admin.api.bankGet, { id: bankId }) as any;
  const bankProducts = useQuery(api.features.admin.api.bankProductsList, {
    bankId,
  }) as any[];
  const removeBank = useMutation(api.features.admin.api.bankRemove);

  if (bank === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!bank) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Landmark className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">{ar.bankNotFound}</p>
          <Button asChild className="mt-4">
            <Link href="/banks">{ar.back}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const status = statusConfig[bank.status] || statusConfig.inactive;
  const StatusIcon = status.icon;

  const onDelete = async () => {
    try {
      await removeBank({ id: bank._id });
      toast.success(ar.bankDeleted);
      router.push("/banks");
    } catch {
      toast.error(ar.bankDeleteFailed);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={bank.name}
        description={bank.slug}
        icon={Landmark as LucideIcon}
        breadcrumbs={[
          { label: ar.banks, href: "/banks" },
          { label: bank.name },
        ]}
        action={
          <div className="flex gap-2">
            {bank.website && (
              <Button variant="outline" asChild>
                <a
                  href={bank.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 ml-2" />
                  {ar.website}
                </a>
              </Button>
            )}
            <Button asChild>
              <Link href={`/banks/${bank._id}/edit`}>
                <Pencil className="h-4 w-4 ml-2" />
                {ar.edit}
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 ml-2" />
                  {ar.delete}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    {ar.deleteBankConfirm}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع المنتجات
                    المرتبطة.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{ar.cancel}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-rose-600 hover:bg-rose-700"
                  >
                    {ar.delete}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={ar.products}
          value={bankProducts?.length || 0}
          icon={Package}
          color="violet"
        />
        <StatCard
          label="نشط"
          value={bankProducts?.filter((p) => p.status === "active").length || 0}
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          label={ar.status}
          value={status.label}
          icon={StatusIcon as LucideIcon}
          color={
            bank.status === "active"
              ? "emerald"
              : bank.status === "suspended"
                ? "rose"
                : "amber"
          }
        />
        <StatCard
          label={ar.createdAt}
          value={new Date(bank._creationTime).toLocaleDateString("ar-SA")}
          icon={Calendar}
          color="blue"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-muted">
                <Landmark className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-base">معلومات البنك</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground flex-1">
                {ar.slug}
              </span>
              <span className="text-sm font-mono">{bank.slug}</span>
            </div>
            {bank.contactEmail && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground flex-1">
                  {ar.email}
                </span>
                <a
                  href={`mailto:${bank.contactEmail}`}
                  className="text-sm hover:text-primary"
                >
                  {bank.contactEmail}
                </a>
              </div>
            )}
            {bank.phone && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground flex-1">
                  {ar.phone}
                </span>
                <span className="text-sm" dir="ltr">
                  {bank.phone}
                </span>
              </div>
            )}
            {bank.website && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground flex-1">
                  {ar.website}
                </span>
                <a
                  href={bank.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-primary truncate max-w-[200px]"
                >
                  {bank.website}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <Package className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <CardTitle className="text-base">المنتجات</CardTitle>
                  <CardDescription>
                    {bankProducts?.length || 0} منتج
                  </CardDescription>
                </div>
              </div>
              <Button size="sm" asChild>
                <Link href={`/bank-products?bankId=${bank._id}`}>
                  <Plus className="h-4 w-4 ml-2" />
                  {ar.addProduct}
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {bankProducts && bankProducts.length > 0 ? (
              <div className="space-y-3">
                {bankProducts.slice(0, 5).map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
                {bankProducts.length > 5 && (
                  <div className="pt-2 text-center">
                    <Button variant="outline" asChild>
                      <Link href={`/bank-products?bankId=${bank._id}`}>
                        عرض الكل ({bankProducts.length})
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">{ar.noProducts}</p>
                <Button className="mt-4" asChild>
                  <Link href={`/bank-products?bankId=${bank._id}`}>
                    <Plus className="h-4 w-4 ml-2" />
                    {ar.addProduct}
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {bank.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{ar.description}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {bank.description}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
