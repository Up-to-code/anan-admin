"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Landmark,
  Loader2,
  ChevronDown,
  Mail,
  Globe,
  FileText,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ar } from "@/lib/ar";

const statusOptions = [
  { value: "active", label: ar.active },
  { value: "inactive", label: ar.inactive },
  { value: "suspended", label: ar.suspended },
];

function FormSection({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
              <span className="font-medium">{title}</span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isOpen && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t p-4">{children}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

export default function CreateBankPage() {
  const router = useRouter();
  const createBank = useMutation(api.features.admin.api.bankCreate);

  const [isLoading, setIsLoading] = React.useState(false);
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [status, setStatus] = React.useState<
    "active" | "inactive" | "suspended"
  >("active");
  const [description, setDescription] = React.useState("");

  React.useEffect(() => {
    if (name && !slug) {
      const generated = name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      setSlug(generated);
    }
  }, [name, slug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(ar.name + " مطلوب");
      return;
    }
    setIsLoading(true);
    try {
      await createBank({
        name: name.trim(),
        slug: slug.trim() || name.toLowerCase().replace(/\s+/g, "-"),
        contactEmail: contactEmail.trim() || undefined,
        description: description.trim() || undefined,
        status,
      } as any);
      toast.success("تم إنشاء البنك");
      router.push("/banks");
    } catch {
      toast.error("فشل في إنشاء البنك");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/banks">{ar.banks}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{ar.addBankLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{ar.addBankLabel}</h1>
          <p className="text-muted-foreground">أضف بنكاً جديداً إلى النظام</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-2 gap-4">
              <FormField label={ar.name + " *"}>
                <Input
                  placeholder="اسم البنك"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-lg"
                />
              </FormField>
              <FormField label={ar.status}>
                <div className="flex gap-2">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(opt.value as any)}
                      className={cn(
                        "flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors",
                        status === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FormField>
            </div>
          </CardContent>
        </Card>

        <FormSection title="معلومات الاتصال" icon={Mail}>
          <div className="grid md:grid-cols-2 gap-4">
            <FormField label={ar.email}>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="contact@bank.com"
                  dir="ltr"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="pr-9"
                />
              </div>
            </FormField>
            <FormField label="المعرّف (Slug)">
              <Input
                placeholder="bank-slug"
                dir="ltr"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="الوصف" icon={FileText}>
          <Textarea
            placeholder="وصف البنك..."
            className="min-h-[100px] resize-none"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormSection>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {ar.cancel}
          </Button>
          <Button type="submit" disabled={isLoading} className="min-w-[100px]">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : ar.save}
          </Button>
        </div>
      </form>
    </div>
  );
}
