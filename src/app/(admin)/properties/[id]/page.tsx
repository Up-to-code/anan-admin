"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
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
  Pencil,
  MapPin,
  Bed,
  Bath,
  Building2,
  Calendar,
  ShoppingCart,
  Eye,
  Home,
  Heart,
  ArrowRight,
  ChevronRight,
  DollarSign,
  Ruler,
  Users,
  Landmark,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, StatCard } from "@/components/admin/ui";


function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function OrderCard({ order }: { order: any }) {
  const statusConfig: Record<string, { className: string }> = {
    available: { className: "bg-emerald-500/10 text-emerald-600" },
    new_lead: { className: "bg-blue-500/10 text-blue-600" },
    contacted: { className: "bg-violet-500/10 text-violet-600" },
    qualified: { className: "bg-amber-500/10 text-amber-600" },
    closed_won: { className: "bg-emerald-500/10 text-emerald-600" },
    closed_lost: { className: "bg-gray-500/10 text-gray-600" },
  };

  return (
    <Link href={`/orders/${order._id}`}>
      <Card className="group hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10 shrink-0">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">
                {order.intent || order.type || "طلب"}
              </h3>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>
                  {new Date(order._creationTime).toLocaleDateString("ar-SA")}
                </span>
                {order.budget && (
                  <span>{order.budget.toLocaleString("ar-SA")} ر.س</span>
                )}
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                statusConfig[order.status]?.className || "",
              )}
            >
              {(ar as any)[order.status] || order.status}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function PropertyDetailPage() {
  const params = useParams();
  const propertyId = params.id as Id<"properties">;
  const property = useQuery(api.features.admin.api.propertyGet, {
    id: propertyId,
  }) as any;
  const ordersForProperty = useQuery(api.features.admin.api.ordersForProperty, {
    propertyId,
  }) as any[];

  if (property === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-xl" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Home className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">
            {ar.propertyNotFound}
          </p>
          <Button asChild className="mt-4">
            <Link href="/properties">{ar.back}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = {
    available: {
      label: ar.available,
      className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    },
    sold: {
      label: ar.sold,
      className: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    },
    reserved: {
      label: ar.reserved,
      className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    },
  };
  const status =
    statusConfig[property.status as keyof typeof statusConfig] ||
    statusConfig.available;

  return (
    <div className="space-y-6">
      <PageHeader
        title={property.title}
        description={property.location || property.area || "-"}
        icon={Home}
        breadcrumbs={[
          { label: ar.properties, href: "/properties" },
          { label: property.title },
        ]}
        action={
          <Button asChild>
            <Link href={`/properties/${property._id}/edit`}>
              <Pencil className="h-4 w-4 ml-2" />
              {ar.edit}
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={ar.orders}
          value={ordersForProperty?.length || 0}
          icon={ShoppingCart}
          color="blue"
        />
        <StatCard label={ar.viewsCount} value="-" icon={Eye} color="violet" />
        <StatCard label={ar.favorites} value="-" icon={Heart} color="rose" />
        <StatCard
          label={ar.createdAt}
          value={new Date(property._creationTime).toLocaleDateString("ar-SA")}
          icon={Calendar}
          color="amber"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-muted">
                <Home className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-base">المواصفات</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <Bed className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">{property.beds || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {ar.bedrooms}
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <Bath className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">{property.baths || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {ar.bathrooms}
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <Ruler className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">{property.sqft || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">م²</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-muted">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-base">{ar.propertyInfo}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              <InfoRow label={ar.address} value={property.address || "-"} />
              <InfoRow label={ar.location} value={property.location || "-"} />
              <InfoRow label={ar.area} value={property.area || "-"} />
              <InfoRow label={ar.type} value={property.type || "-"} />
            </div>
          </CardContent>
        </Card>
      </div>

      {property.description && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-muted">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-base">{ar.description}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {property.description}
            </p>
          </CardContent>
        </Card>
      )}

      {(property.partner || property.bank) && (
        <div className="grid md:grid-cols-2 gap-4">
          {property.partner && (
            <Link href={`/developers/${property.partner._id}`}>
              <Card className="group hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-violet-500/10">
                      <Users className="h-5 w-5 text-violet-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">
                        {ar.developers}
                      </p>
                      <p className="font-medium">{property.partner.name}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
          {property.bank && (
            <Link href={`/banks/${property.bank._id}`}>
              <Card className="group hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/10">
                      <Landmark className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">
                        {ar.banks}
                      </p>
                      <p className="font-medium">{property.bank.name}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      )}

      {ordersForProperty && ordersForProperty.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base">
                    {ar.propertyOrders}
                  </CardTitle>
                  <CardDescription>
                    {ordersForProperty.length} طلب مرتبط
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {ordersForProperty.slice(0, 6).map((order) => (
                <OrderCard key={order._id} order={order} />
              ))}
            </div>
            {ordersForProperty.length > 6 && (
              <div className="mt-4 text-center">
                <Button variant="outline" asChild>
                  <Link href={`/orders?propertyId=${property._id}`}>
                    عرض الكل ({ordersForProperty.length})
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
