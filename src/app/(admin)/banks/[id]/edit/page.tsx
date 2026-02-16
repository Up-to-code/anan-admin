"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Save } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ar } from "@/lib/ar";

export default function EditBankPage() {
  const params = useParams();
  const router = useRouter();
  const bankId = params.id as Id<"banks">;

  const bank = useQuery(api.features.admin.api.bankGet, { id: bankId });
  const updateBank = useMutation(api.features.admin.api.bankUpdate);
  const [isSaving, setIsSaving] = React.useState(false);
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [status, setStatus] = React.useState<"active" | "inactive" | "suspended">("active");
  const [description, setDescription] = React.useState("");

  React.useEffect(() => {
    if (!bank) return;
    setName(bank.name ?? "");
    setSlug(bank.slug ?? "");
    setContactEmail(bank.contactEmail ?? "");
    setStatus((bank.status ?? "active") as "active" | "inactive" | "suspended");
    setDescription(bank.description ?? "");
  }, [bank]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error(ar.nameAndSlugRequired);
      return;
    }
    try {
      setIsSaving(true);
      await updateBank({
        id: bankId,
        name: name.trim(),
        slug: slug.trim(),
        contactEmail: contactEmail.trim() || undefined,
        status,
        description: description.trim() || undefined,
      });
      toast.success(ar.bankUpdated);
      router.push(`/banks/${bankId}`);
    } catch {
      toast.error(ar.bankUpdateFailed);
    } finally {
      setIsSaving(false);
    }
  }

  if (bank === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (bank === null) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="mb-4 text-muted-foreground">{ar.bankNotFound}</p>
        <Button variant="outline" onClick={() => router.push("/banks")}>
          {ar.back}
        </Button>
      </div>
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
            <BreadcrumbLink href="/banks">{ar.banks}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/banks/${bankId}`}>{bank.name}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{ar.edit}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <CardTitle>{ar.editBank}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{ar.name}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{ar.slug}</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{ar.contactEmailLabel}</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{ar.status}</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive" | "suspended")}
              >
                <option value="active">{ar.active}</option>
                <option value="inactive">{ar.inactive}</option>
                <option value="suspended">{ar.suspended}</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>{ar.description}</Label>
              <Textarea
                className="min-h-[100px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isSaving}>
                <Save className="ms-2 h-4 w-4" />
                {isSaving ? ar.saving : ar.save}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push(`/banks/${bankId}`)}>
                {ar.cancel}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
