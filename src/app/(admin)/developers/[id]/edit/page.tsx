"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ar } from "@/lib/ar";
import { useSession } from "@/lib/auth-client";
import { isConvexAuthError } from "@/lib/convex-errors";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
  slug: z
    .string()
    .min(2, "المعرّف يجب أن يكون حرفين على الأقل")
    .regex(/^[a-z0-9-]+$/, "المعرّف يجب أن يحتوي على أحرف صغيرة وأرقام وشرطات فقط"),
  contactEmail: z.string().email("البريد الإلكتروني غير صالح").optional().or(z.literal("")),
  website: z.string().url("الرابط غير صالح").optional().or(z.literal("")),
  description: z.string().optional(),
  status: z.enum(["active", "pending"]),
});

type FormData = z.infer<typeof formSchema>;

export default function EditDeveloperPage() {
  const router = useRouter();
  const params = useParams();
  const developerId = params.id as Id<"partners">;
  
  const developer = useQuery(api.features.admin.api.partnerGet, { id: developerId });
  const updatePartner = useMutation(api.features.admin.api.partnerUpdate);
  const { data: session, isPending: isSessionPending } = useSession();
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexAuthLoading } =
    useConvexAuth();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
      contactEmail: "",
      website: "",
      description: "",
      status: "active",
    },
  });

  // Populate form when developer data loads
  React.useEffect(() => {
    if (developer) {
      form.reset({
        name: developer.name,
        slug: developer.slug,
        contactEmail: developer.contactEmail || "",
        website: developer.website || "",
        description: developer.description || "",
        status: (developer.status ?? "pending") as "active" | "pending",
      });
    }
  }, [developer, form]);

  async function onSubmit(data: FormData) {
    if (!session || !isConvexAuthenticated) {
      toast.error("انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى.");
      router.push("/signin");
      return;
    }

    setIsLoading(true);
    try {
      await updatePartner({
        id: developerId,
        name: data.name,
        slug: data.slug,
        contactEmail: data.contactEmail || undefined,
        website: data.website || undefined,
        description: data.description || undefined,
        status: data.status,
      });
      toast.success("تم تحديث المطور بنجاح");
      router.push(`/developers/${developerId}`);
    } catch (error) {
      if (isConvexAuthError(error)) {
        toast.error("انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى.");
        router.push("/signin");
        return;
      }
      toast.error("فشل تحديث المطور");
    } finally {
      setIsLoading(false);
    }
  }

  const isAuthReady = !isSessionPending && !isConvexAuthLoading;
  const canSubmit = isAuthReady && Boolean(session) && isConvexAuthenticated && !isLoading;

  if (developer === undefined) {
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
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!developer) {
    return (
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/developers">{ar.developers}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{ar.notFound}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{ar.developerNotFound}</p>
            <Button asChild className="mt-4">
              <a href="/developers">{ar.back}</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/developers">{ar.developers}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/developers/${developerId}`}>
              {developer.name}
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
          <CardTitle>{ar.edit} - {developer.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{ar.name}</FormLabel>
                      <FormControl>
                        <Input placeholder="اسم المطور" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{ar.slug}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="developer-name"
                          dir="ltr"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{ar.contactEmail}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="contact@developer.com"
                          dir="ltr"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{ar.website}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://developer.com"
                          dir="ltr"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{ar.status}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={ar.status} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">{ar.active}</SelectItem>
                          <SelectItem value="pending">{ar.pending}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{ar.description}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="وصف المطور..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4">
                <Button type="submit" disabled={!canSubmit}>
                  {isLoading && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
                  {!isAuthReady ? "جاري التحقق من الجلسة..." : ar.save}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  {ar.cancel}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
