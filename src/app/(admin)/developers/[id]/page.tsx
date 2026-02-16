"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { ar } from "@/lib/ar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pencil,
  Mail,
  Globe,
  Building2,
  Phone,
  Calendar,
  ExternalLink,
  FileText,
  Home,
  ArrowRight,
  Plus,
  MapPin,
  Bed,
  Bath,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function DeveloperDetailPage() {
  const params = useParams();
  const developerId = params.id as Id<"partners">;
  const developer = useQuery(api.features.partners.queries.get, {
    id: developerId,
  });
  const properties = useQuery(api.features.admin.api.propertiesList, {
    partnerId: developerId,
  }) as any[] | undefined;

  if (developer === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    );
  }

  if (!developer) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">{ar.developerNotFound}</p>
          <Button asChild className="mt-4">
            <Link href="/developers">{ar.back}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const statusColor =
    developer.status === "active"
      ? "bg-emerald-500/10 text-emerald-600"
      : "bg-gray-500/10 text-gray-600";
  const statusLabel = developer.status === "active" ? ar.active : ar.inactive;

  const availableCount =
    properties?.filter((p) => p.status === "available").length || 0;
  const soldCount = properties?.filter((p) => p.status === "sold").length || 0;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/developers" className="gap-1">
          <ArrowRight className="h-4 w-4" />
          {ar.developers}
        </Link>
      </Button>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{developer.name}</h1>
              <Badge className={cn("border-0", statusColor)}>
                {statusLabel}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              {developer.slug}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {developer.website && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={developer.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5 ml-1" />
                {ar.website}
              </a>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link href={`/developers/${developer._id}/edit`}>
              <Pencil className="h-3.5 w-3.5 ml-1" />
              {ar.edit}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Home className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{properties?.length || 0}</p>
                <p className="text-xs text-muted-foreground">{ar.properties}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Home className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{availableCount}</p>
                <p className="text-xs text-muted-foreground">{ar.available}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10">
                <Home className="h-4 w-4 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{soldCount}</p>
                <p className="text-xs text-muted-foreground">{ar.sold}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {new Date(developer._creationTime).toLocaleDateString(
                    "ar-SA",
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{ar.createdAt}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              معلومات المطور
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{ar.slug}:</span>
              <span className="font-mono">{developer.slug}</span>
            </div>
            {developer.contactEmail && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{ar.email}:</span>
                <a
                  href={`mailto:${developer.contactEmail}`}
                  className="hover:text-primary"
                >
                  {developer.contactEmail}
                </a>
              </div>
            )}
            {developer.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{ar.phone}:</span>
                <span dir="ltr">{developer.phone}</span>
              </div>
            )}
            {developer.website && (
              <div className="flex items-center gap-3 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{ar.website}:</span>
                <a
                  href={developer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary truncate max-w-[200px]"
                >
                  {developer.website}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {developer.description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{ar.description}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {developer.description}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="h-4 w-4" />
            عقارات المطور
          </CardTitle>
          <Button size="sm" asChild>
            <Link href={`/properties/create?partnerId=${developer._id}`}>
              <Plus className="h-4 w-4 ml-1" />
              {ar.addProperty}
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {properties && properties.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{ar.title}</TableHead>
                  <TableHead>{ar.location}</TableHead>
                  <TableHead>{ar.price}</TableHead>
                  <TableHead>{ar.beds}</TableHead>
                  <TableHead>{ar.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((property) => (
                  <TableRow key={property._id}>
                    <TableCell>
                      <Link
                        href={`/properties/${property._id}`}
                        className="font-medium hover:text-primary"
                      >
                        {property.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {property.location || property.area || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {property.price
                        ? `${property.price.toLocaleString()} ر.س`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Bed className="h-3 w-3 text-muted-foreground" />
                        {property.beds || 0}
                        <Bath className="h-3 w-3 text-muted-foreground mr-2" />
                        {property.baths || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          property.status === "available" &&
                            "border-emerald-500 text-emerald-600",
                          property.status === "sold" &&
                            "border-rose-500 text-rose-600",
                          property.status === "reserved" &&
                            "border-amber-500 text-amber-600",
                        )}
                      >
                        {property.status === "available"
                          ? ar.available
                          : property.status === "sold"
                            ? ar.sold
                            : ar.reserved}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Home className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{ar.noProperties}</p>
              <Button size="sm" className="mt-4" asChild>
                <Link href={`/properties/create?partnerId=${developer._id}`}>
                  <Plus className="h-4 w-4 ml-1" />
                  {ar.addProperty}
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
