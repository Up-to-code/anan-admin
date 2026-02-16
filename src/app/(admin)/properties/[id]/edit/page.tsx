"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ar } from "@/lib/ar";

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params.id as Id<"properties">;

  const property = useQuery(api.features.admin.api.propertyGet, { id: propertyId });
  const updateProperty = useMutation(api.features.admin.api.propertyUpdate);
  const [isLoading, setIsLoading] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [area, setArea] = React.useState("");
  const [beds, setBeds] = React.useState("");
  const [baths, setBaths] = React.useState("");
  const [sqft, setSqft] = React.useState("");
  const [status, setStatus] = React.useState<"available" | "sold" | "reserved">("available");
  const [description, setDescription] = React.useState("");

  React.useEffect(() => {
    if (property) {
      setTitle(property.title);
      setAddress(property.address);
      setPrice(String(property.price));
      setLocation(property.location ?? "");
      setArea(property.area ?? "");
      setBeds(String(property.beds));
      setBaths(String(property.baths));
      setSqft(property.sqft ? String(property.sqft) : "");
      setStatus((property.status ?? "available") as "available" | "sold" | "reserved");
      setDescription(property.description);
    }
  }, [property]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateProperty({
        id: propertyId,
        title: title.trim(),
        address: address.trim() || undefined,
        price: Number(price || 0),
        location: location.trim() || undefined,
        area: area.trim() || undefined,
        beds: Number(beds || 0),
        baths: Number(baths || 0),
        sqft: sqft ? Number(sqft) : undefined,
        status,
        description: description.trim() || undefined,
      });
      toast.success(ar.propertyUpdated);
      router.push(`/properties/${propertyId}`);
    } catch {
      toast.error(ar.propertyUpdateFailed);
    } finally {
      setIsLoading(false);
    }
  }

  if (property === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!property) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{ar.propertyNotFound}</p>
          <Button asChild className="mt-4">
            <Link href="/properties">{ar.back}</Link>
          </Button>
        </CardContent>
      </Card>
    );
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
            <BreadcrumbLink href="/properties">{ar.properties}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/properties/${propertyId}`}>
              {property.title}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{ar.edit}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <CardTitle>{ar.edit} - {property.title}</CardTitle>
        </CardHeader>
        <CardContent>
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{ar.title}</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>{ar.address}</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>{ar.price}</Label>
                  <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>{ar.status}</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "available" | "sold" | "reserved")}
                  >
                    <option value="available">{ar.available}</option>
                    <option value="sold">{ar.sold}</option>
                    <option value="reserved">{ar.reserved}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>{ar.location}</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>{ar.area}</Label>
                  <Input value={area} onChange={(e) => setArea(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>{ar.beds}</Label>
                  <Input type="number" value={beds} onChange={(e) => setBeds(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{ar.baths}</Label>
                  <Input type="number" value={baths} onChange={(e) => setBaths(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{ar.sqft}</Label>
                  <Input type="number" value={sqft} onChange={(e) => setSqft(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{ar.description}</Label>
                <Textarea className="min-h-[100px]" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
                  {ar.save}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  {ar.cancel}
                </Button>
              </div>
            </form>
        </CardContent>
      </Card>
    </div>
  );
}
