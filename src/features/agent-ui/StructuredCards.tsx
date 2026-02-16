"use client";

import type { AssistantPayload } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function SummaryCard({
  payload,
}: {
  payload: Extract<AssistantPayload, { type: "summary_block" }>;
}) {
  return (
    <Card className="w-full bg-[#FAFAFA] dark:bg-[#18181B] border-zinc-200 dark:border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-900 dark:text-zinc-50">{payload.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p>{payload.summary}</p>
        {payload.count !== undefined ? (
          <p className="text-sm text-muted-foreground">Count: {payload.count}</p>
        ) : null}
        {payload.cta ? <p className="text-sm text-muted-foreground">{payload.cta}</p> : null}
      </CardContent>
    </Card>
  );
}

function PropertyCard({
  payload,
}: {
  payload: Extract<AssistantPayload, { type: "recommendation_property" }>;
}) {
  return (
    <Card className="w-full bg-[#FAFAFA] dark:bg-[#18181B] border-zinc-200 dark:border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-900 dark:text-zinc-50">{payload.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {payload.address ? <p>{payload.address}</p> : null}
        {payload.price !== undefined ? (
          <p className="text-sm text-muted-foreground">Price: {payload.price.toLocaleString()}</p>
        ) : null}
        {payload.status ? <p className="text-sm text-muted-foreground">Status: {payload.status}</p> : null}
        {payload.description ? <p>{payload.description}</p> : null}
      </CardContent>
    </Card>
  );
}

function BankCard({
  payload,
}: {
  payload: Extract<AssistantPayload, { type: "recommendation_bank" }>;
}) {
  return (
    <Card className="w-full bg-[#FAFAFA] dark:bg-[#18181B] border-zinc-200 dark:border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-900 dark:text-zinc-50">{payload.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {payload.product ? <p>{payload.product}</p> : null}
        {payload.status ? <p className="text-sm text-muted-foreground">Status: {payload.status}</p> : null}
        {payload.description ? <p>{payload.description}</p> : null}
      </CardContent>
    </Card>
  );
}

function DeveloperCard({
  payload,
}: {
  payload: Extract<AssistantPayload, { type: "recommendation_developer" }>;
}) {
  return (
    <Card className="w-full bg-[#FAFAFA] dark:bg-[#18181B] border-zinc-200 dark:border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-900 dark:text-zinc-50">{payload.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {payload.slug ? <p className="text-sm text-muted-foreground">{payload.slug}</p> : null}
        {payload.status ? <p className="text-sm text-muted-foreground">Status: {payload.status}</p> : null}
        {payload.description ? <p>{payload.description}</p> : null}
      </CardContent>
    </Card>
  );
}

function ActionStateCard({
  payload,
}: {
  payload: Extract<AssistantPayload, { type: "action_state" }>;
}) {
  return (
    <Card className="w-full bg-[#FAFAFA] dark:bg-[#18181B] border-zinc-200 dark:border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-900 dark:text-zinc-50">{payload.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">State: {payload.state}</p>
        {payload.details ? <p>{payload.details}</p> : null}
      </CardContent>
    </Card>
  );
}

export function StructuredCards({ payload }: { payload: AssistantPayload }) {
  switch (payload.type) {
    case "summary_block":
      return <SummaryCard payload={payload} />;
    case "recommendation_property":
      return <PropertyCard payload={payload} />;
    case "recommendation_bank":
      return <BankCard payload={payload} />;
    case "recommendation_developer":
      return <DeveloperCard payload={payload} />;
    case "action_state":
      return <ActionStateCard payload={payload} />;
    default:
      return null;
  }
}
