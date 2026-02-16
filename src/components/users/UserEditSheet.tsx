"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { ar } from "@/lib/ar";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface UserEditSheetProps {
  user: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserEditSheet({ user, open, onOpenChange }: UserEditSheetProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [salary, setSalary] = React.useState("");
  const [employment, setEmployment] = React.useState("");
  const [maxBudget, setMaxBudget] = React.useState("");
  const [preferredLocation, setPreferredLocation] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [firstTimeBuyer, setFirstTimeBuyer] = React.useState(false);
  const [kids, setKids] = React.useState("");
  const [minBeds, setMinBeds] = React.useState("");
  const [verified, setVerified] = React.useState(false);
  const [planType, setPlanType] = React.useState("free");

  const updateProfile = useMutation(api.features.admin.api.updateUserProfile);

  React.useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setEmail(user.email ?? "");
      setPhone(user.phone ?? "");
      setSalary(user.salary?.toString() ?? "");
      setEmployment(user.employment ?? "");
      setMaxBudget(user.maxBudget?.toString() ?? "");
      setPreferredLocation(user.preferredLocation ?? "");
      setNotes(user.notes ?? "");
      setFirstTimeBuyer(user.firstTimeBuyer ?? false);
      setKids(user.kids?.toString() ?? "");
      setMinBeds(user.minBeds?.toString() ?? "");
      setVerified(user.verified ?? false);
      setPlanType(user.planType ?? "free");
    }
  }, [user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      const updates: Record<string, any> = {};
      if (name) updates.name = name;
      if (email) updates.email = email;
      if (phone) updates.phone = phone;
      if (salary) updates.salary = Number(salary);
      if (employment) updates.employment = employment;
      if (maxBudget) updates.maxBudget = Number(maxBudget);
      if (preferredLocation) updates.preferredLocation = preferredLocation;
      if (notes) updates.notes = notes;
      updates.firstTimeBuyer = firstTimeBuyer;
      if (kids) updates.kids = Number(kids);
      if (minBeds) updates.minBeds = Number(minBeds);
      updates.verified = verified;
      updates.planType = planType;

      await updateProfile({
        profileId: user._id,
        updates,
      });
      toast.success(ar.userUpdated);
      onOpenChange(false);
    } catch {
      toast.error(ar.userUpdateFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{ar.editUser}</SheetTitle>
          <SheetDescription>{ar.editUserDesc}</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-4">
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">{ar.basicInfo}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{ar.name}</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{ar.email}</Label>
                <Input id="email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{ar.phone}</Label>
              <Input id="phone" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">{ar.financialInfo}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salary">{ar.salary}</Label>
                <Input id="salary" type="number" dir="ltr" value={salary} onChange={(e) => setSalary(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employment">{ar.employment}</Label>
                <Input id="employment" value={employment} onChange={(e) => setEmployment(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxBudget">{ar.maxBudget}</Label>
              <Input id="maxBudget" type="number" dir="ltr" value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">{ar.preferences}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minBeds">{ar.minBeds}</Label>
                <Input id="minBeds" type="number" value={minBeds} onChange={(e) => setMinBeds(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kids">{ar.kids}</Label>
                <Input id="kids" type="number" value={kids} onChange={(e) => setKids(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredLocation">{ar.preferredLocation}</Label>
              <Input id="preferredLocation" value={preferredLocation} onChange={(e) => setPreferredLocation(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="firstTimeBuyer">{ar.firstTimeBuyer}</Label>
              <Switch id="firstTimeBuyer" checked={firstTimeBuyer} onCheckedChange={setFirstTimeBuyer} />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">{ar.adminSettings}</h4>
            <div className="flex items-center justify-between">
              <Label htmlFor="verified">{ar.verified}</Label>
              <Switch id="verified" checked={verified} onCheckedChange={setVerified} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="planType">{ar.planType}</Label>
              <Select value={planType} onValueChange={setPlanType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">{ar.free}</SelectItem>
                  <SelectItem value="paid">{ar.paid}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{ar.notes}</Label>
            <textarea
              id="notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {ar.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              {ar.saveChanges}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
