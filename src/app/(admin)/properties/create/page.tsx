"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  Building2,
  Loader2,
  MapPin,
  DollarSign,
  Bed,
  Bath,
  Ruler,
  ChevronDown,
  Upload,
  X,
  Image as ImageIcon,
  FileText,
  Home,
  Link2,
  Tag,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ar } from "@/lib/ar";
import { ImageUploader } from "@/components/shared/ImageUploader";

const statusOptions = [
  { value: "available", label: ar.available },
  { value: "sold", label: ar.sold },
  { value: "reserved", label: ar.reserved },
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
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

export default function CreatePropertyPage() {
  const router = useRouter();
  const createProperty = useMutation(api.features.admin.api.propertyCreate);
  const partners = useQuery(api.features.admin.api.partnersList, {});
  const banks = useQuery(api.features.admin.api.banksList, { limit: 200 });

  const [isLoading, setIsLoading] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [area, setArea] = React.useState("");
  const [beds, setBeds] = React.useState("");
  const [baths, setBaths] = React.useState("");
  const [sqft, setSqft] = React.useState("");
  const [status, setStatus] = React.useState<"available" | "sold" | "reserved">(
    "available",
  );
  const [description, setDescription] = React.useState("");
  const [partnerId, setPartnerId] = React.useState("");
  const [bankId, setBankId] = React.useState("");
  const [images, setImages] = React.useState<
    Array<{
      storageId?: string;
      url?: string;
      isPrimary?: boolean;
      caption?: string;
    }>
  >([]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(ar.title + " مطلوب");
      return;
    }
    setIsLoading(true);
    try {
      await createProperty({
        title: title.trim(),
        address: address.trim() || undefined,
        price: Number(price || 0),
        beds: Number(beds || 0),
        baths: Number(baths || 0),
        sqft: sqft ? Number(sqft) : undefined,
        status,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        area: area.trim() || undefined,
        partnerId: partnerId ? (partnerId as any) : undefined,
        bankId: bankId ? (bankId as any) : undefined,
      } as any);
      toast.success("تم إنشاء العقار");
      router.push("/properties");
    } catch {
      toast.error("فشل في إنشاء العقار");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/properties">{ar.properties}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{ar.addPropertyLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{ar.addPropertyLabel}</h1>
          <p className="text-muted-foreground">أضف عقاراً جديداً إلى النظام</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
          <CardContent className="pt-6">
            <div className="flex flex-col gap-6">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField label={ar.title + " *"}>
                  <Input
                    placeholder="مثال: فيلا في حي النرجس"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
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

              <FormField label={ar.price}>
                <div className="relative">
                  <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="pr-9 text-lg"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ر.س
                  </span>
                </div>
              </FormField>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <FormSection title="الموقع" icon={MapPin}>
            <div className="grid gap-4">
              <FormField label={ar.address}>
                <Input
                  placeholder="العنوان التفصيلي"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={ar.location}>
                  <Input
                    placeholder="المدينة/الحي"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </FormField>
                <FormField label={ar.area}>
                  <Input
                    placeholder="المنطقة"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                  />
                </FormField>
              </div>
            </div>
          </FormSection>

          <FormSection title="المواصفات" icon={Home}>
            <div className="grid grid-cols-3 gap-4">
              <FormField label={ar.beds}>
                <div className="relative">
                  <Bed className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="0"
                    value={beds}
                    onChange={(e) => setBeds(e.target.value)}
                    className="pr-9"
                  />
                </div>
              </FormField>
              <FormField label={ar.baths}>
                <div className="relative">
                  <Bath className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="0"
                    value={baths}
                    onChange={(e) => setBaths(e.target.value)}
                    className="pr-9"
                  />
                </div>
              </FormField>
              <FormField label={ar.sqft}>
                <div className="relative">
                  <Ruler className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="0"
                    value={sqft}
                    onChange={(e) => setSqft(e.target.value)}
                    className="pr-9"
                  />
                </div>
              </FormField>
            </div>
          </FormSection>
        </div>

        <FormSection title="الربط" icon={Link2}>
          <div className="grid md:grid-cols-2 gap-4">
            <FormField label={ar.developers}>
              <select
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
              >
                <option value="">{ar.selectBank}</option>
                {(partners ?? []).map((p) => (
                  <option key={p._id} value={String(p._id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label={ar.banks}>
              <select
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
              >
                <option value="">{ar.selectBank}</option>
                {(banks ?? []).map((b) => (
                  <option key={b._id} value={String(b._id)}>
                    {b.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </FormSection>

        <FormSection title={ar.images} icon={ImageIcon}>
          <ImageUploader
            images={images}
            onImagesChange={setImages}
            maxImages={10}
            kind="image"
          />
        </FormSection>

        <FormSection title="الوصف" icon={FileText}>
          <Textarea
            placeholder="وصف تفصيلي للعقار..."
            className="min-h-[120px] resize-none"
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
