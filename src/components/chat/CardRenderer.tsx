"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StructuredAssistantPayload } from "./types";

function SummaryBlockCard({
  payload,
}: {
  payload: Extract<StructuredAssistantPayload, { type: "summary_block" }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{payload.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">{payload.summary}</p>
        {payload.count !== undefined ? (
          <p className="text-xs text-muted-foreground">Count: {payload.count}</p>
        ) : null}
        {payload.cta ? <p className="text-xs font-medium">{payload.cta}</p> : null}
      </CardContent>
    </Card>
  );
}

function RecommendationPropertyCard({
  payload,
}: {
  payload: Extract<StructuredAssistantPayload, { type: "recommendation_property" }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{payload.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {payload.address ? <p className="text-muted-foreground">{payload.address}</p> : null}
        {payload.price !== undefined ? (
          <p className="text-xs text-muted-foreground">Price: {payload.price.toLocaleString()}</p>
        ) : null}
        {payload.status ? <p className="text-xs text-muted-foreground">Status: {payload.status}</p> : null}
        {payload.description ? <p className="text-xs">{payload.description}</p> : null}
      </CardContent>
    </Card>
  );
}

function RecommendationBankCard({
  payload,
}: {
  payload: Extract<StructuredAssistantPayload, { type: "recommendation_bank" }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{payload.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {payload.product ? <p className="text-muted-foreground">{payload.product}</p> : null}
        {payload.status ? <p className="text-xs text-muted-foreground">Status: {payload.status}</p> : null}
        {payload.description ? <p className="text-xs">{payload.description}</p> : null}
      </CardContent>
    </Card>
  );
}

function RecommendationDeveloperCard({
  payload,
}: {
  payload: Extract<StructuredAssistantPayload, { type: "recommendation_developer" }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{payload.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {payload.slug ? <p className="text-xs text-muted-foreground">{payload.slug}</p> : null}
        {payload.status ? <p className="text-xs text-muted-foreground">Status: {payload.status}</p> : null}
        {payload.description ? <p className="text-xs">{payload.description}</p> : null}
      </CardContent>
    </Card>
  );
}

function ActionStateCard({
  payload,
}: {
  payload: Extract<StructuredAssistantPayload, { type: "action_state" }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{payload.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p className="text-xs text-muted-foreground">State: {payload.state}</p>
        {payload.details ? <p className="text-xs">{payload.details}</p> : null}
      </CardContent>
    </Card>
  );
}

export function StructuredCardRenderer({ payload }: { payload: StructuredAssistantPayload }) {
  switch (payload.type) {
    case "summary_block":
      return <SummaryBlockCard payload={payload} />;
    case "recommendation_property":
      return <RecommendationPropertyCard payload={payload} />;
    case "recommendation_bank":
      return <RecommendationBankCard payload={payload} />;
    case "recommendation_developer":
      return <RecommendationDeveloperCard payload={payload} />;
    case "action_state":
      return <ActionStateCard payload={payload} />;
    case "text":
      return null;
    default:
      return null;
  }
}
