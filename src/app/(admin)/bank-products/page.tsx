"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Package, Settings2 } from "lucide-react";
import { ar } from "@/lib/ar";
import { toast } from "sonner";
import { BankProductForm } from "@/components/banks/BankProductForm";

export default function BankProductsPage() {
  const searchParams = useSearchParams();
  const bankIdFromUrl = searchParams.get("bankId") as Id<"banks"> | null;
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editProduct, setEditProduct] = React.useState<{
    _id: Id<"bankProducts">;
    bankId: Id<"banks">;
    name: string;
    type: string;
    description?: string;
    rules?: any;
  } | null>(null);
  const [selectedBankId, setSelectedBankId] =
    React.useState<Id<"banks"> | null>(null);

  const products = useQuery(api.features.admin.api.bankProductsList, {});
  const banks = useQuery(api.features.admin.api.banksList, {});

  React.useEffect(() => {
    if (bankIdFromUrl && banks?.some((b) => b._id === bankIdFromUrl)) {
      setSelectedBankId(bankIdFromUrl);
    }
  }, [bankIdFromUrl, banks]);
  const createProduct = useMutation(api.features.admin.api.bankProductCreate);
  const updateProduct = useMutation(api.features.admin.api.bankProductUpdate);
  const deleteProduct = useMutation(api.features.admin.api.bankProductRemove);

  const handleCreate = async (data: {
    name: string;
    type: string;
    description?: string;
    rules?: any;
  }) => {
    if (!selectedBankId) {
      toast.error("اختر بنكاً أولاً");
      return;
    }
    try {
      await createProduct({
        bankId: selectedBankId,
        ...data,
      });
      toast.success(ar.productCreated);
      setCreateOpen(false);
      setSelectedBankId(null);
    } catch {
      toast.error(ar.productCreateFailed);
    }
  };

  const handleUpdate = async (data: {
    name: string;
    type: string;
    description?: string;
    rules?: any;
  }) => {
    if (!editProduct) return;
    try {
      await updateProduct({
        id: editProduct._id,
        ...data,
      });
      toast.success(ar.productUpdated);
      setEditProduct(null);
    } catch {
      toast.error(ar.productUpdateFailed);
    }
  };

  const handleDelete = async (id: Id<"bankProducts">) => {
    if (!window.confirm(ar.deleteProductConfirm)) return;
    try {
      await deleteProduct({ id });
      toast.success(ar.productDeleted);
    } catch {
      toast.error(ar.productDeleteFailed);
    }
  };

  const getBankName = (bankId: Id<"banks">) => {
    return banks?.find((b) => b._id === bankId)?.name || "-";
  };

  const productTypeLabels: Record<string, string> = {
    mortgage: "تمويل عقاري",
    personal_loan: "قرض شخصي",
    car_loan: "تمويل سيارة",
    construction_loan: "قرض بناء",
    refinance: "إعادة تمويل",
    other: "أخرى",
  };

  if (products === undefined || banks === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{ar.products}</h1>
          <p className="text-sm text-muted-foreground">
            {ar.manageBankProductsDesc}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 ml-2" />
          {ar.createProduct}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {products.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{ar.name}</TableHead>
                  <TableHead>{ar.bank}</TableHead>
                  <TableHead>{ar.type}</TableHead>
                  <TableHead>الشروط</TableHead>
                  <TableHead className="w-24">{ar.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product._id}>
                    <TableCell className="font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell>{getBankName(product.bankId)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {productTypeLabels[product.type] || product.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {product.rules &&
                      Object.keys(product.rules).length > 0 ? (
                        <Badge variant="secondary" className="gap-1">
                          <Settings2 className="h-3 w-3" />
                          {Object.keys(product.rules).length} شروط
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditProduct(product as any)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(product._id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{ar.noProducts}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{ar.createProduct}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{ar.bank}</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={selectedBankId || ""}
                onChange={(e) =>
                  setSelectedBankId(
                    (e.target.value || null) as Id<"banks"> | null,
                  )
                }
              >
                <option value="">{ar.selectBank}</option>
                {banks?.map((bank) => (
                  <option key={bank._id} value={bank._id}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedBankId && (
              <BankProductForm
                onSubmit={handleCreate}
                onCancel={() => setCreateOpen(false)}
                submitLabel={ar.createProduct}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editProduct} onOpenChange={() => setEditProduct(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{ar.edit}</DialogTitle>
          </DialogHeader>
          {editProduct && (
            <BankProductForm
              defaultValues={{
                name: editProduct.name,
                type: editProduct.type,
                description: editProduct.description,
                rules: editProduct.rules,
              }}
              onSubmit={handleUpdate}
              onCancel={() => setEditProduct(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
