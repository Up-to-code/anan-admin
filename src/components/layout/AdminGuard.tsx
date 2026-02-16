"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw } from "lucide-react";

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="space-y-4 w-full max-w-md p-8">
        <div className="flex items-center justify-center mb-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <RefreshCw className="h-6 w-6 text-primary animate-spin" />
          </div>
        </div>
        <Skeleton className="h-8 w-3/4 mx-auto" />
        <Skeleton className="h-4 w-1/2 mx-auto" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

function NotAuthenticatedScreen() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to signin after a brief delay
    const timer = setTimeout(() => {
      router.push("/signin");
    }, 100);
    return () => clearTimeout(timer);
  }, [router]);

  return <LoadingScreen />;
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending, error } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    // Reset redirect flag when pathname changes
    setHasRedirected(false);
  }, [pathname]);

  useEffect(() => {
    // Only redirect once and only if not pending
    if (!isPending && !session && !hasRedirected) {
      setHasRedirected(true);
      router.push("/signin");
    }
  }, [session, isPending, router, hasRedirected]);

  // Still loading session
  if (isPending) {
    return <LoadingScreen />;
  }

  // No session - show loading while redirecting
  if (!session) {
    return <NotAuthenticatedScreen />;
  }

  // Has session, render children
  return <>{children}</>;
}
