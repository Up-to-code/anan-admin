"use client";

import type { AssistantPayload } from "./types";

function SummaryCard({
  payload,
}: {
  payload: Extract<AssistantPayload, { type: "summary_block" }>;
}) {
  return (
    <div className="agent-card">
      <div className="agent-card-title">{payload.title}</div>
      <div className="agent-card-body">
        <p>{payload.summary}</p>
        {payload.count !== undefined ? (
          <p className="agent-card-subtle">Count: {payload.count}</p>
        ) : null}
        {payload.cta ? <p className="agent-card-subtle">{payload.cta}</p> : null}
      </div>
    </div>
  );
}

function PropertyCard({
  payload,
}: {
  payload: Extract<AssistantPayload, { type: "recommendation_property" }>;
}) {
  return (
    <div className="agent-card">
      <div className="agent-card-title">{payload.title}</div>
      <div className="agent-card-body">
        {payload.address ? <p>{payload.address}</p> : null}
        {payload.price !== undefined ? (
          <p className="agent-card-subtle">Price: {payload.price.toLocaleString()}</p>
        ) : null}
        {payload.status ? <p className="agent-card-subtle">Status: {payload.status}</p> : null}
        {payload.description ? <p>{payload.description}</p> : null}
      </div>
    </div>
  );
}

function BankCard({
  payload,
}: {
  payload: Extract<AssistantPayload, { type: "recommendation_bank" }>;
}) {
  return (
    <div className="agent-card">
      <div className="agent-card-title">{payload.name}</div>
      <div className="agent-card-body">
        {payload.product ? <p>{payload.product}</p> : null}
        {payload.status ? <p className="agent-card-subtle">Status: {payload.status}</p> : null}
        {payload.description ? <p>{payload.description}</p> : null}
      </div>
    </div>
  );
}

function DeveloperCard({
  payload,
}: {
  payload: Extract<AssistantPayload, { type: "recommendation_developer" }>;
}) {
  return (
    <div className="agent-card">
      <div className="agent-card-title">{payload.name}</div>
      <div className="agent-card-body">
        {payload.slug ? <p className="agent-card-subtle">{payload.slug}</p> : null}
        {payload.status ? <p className="agent-card-subtle">Status: {payload.status}</p> : null}
        {payload.description ? <p>{payload.description}</p> : null}
      </div>
    </div>
  );
}

function ActionStateCard({
  payload,
}: {
  payload: Extract<AssistantPayload, { type: "action_state" }>;
}) {
  return (
    <div className="agent-card">
      <div className="agent-card-title">{payload.title}</div>
      <div className="agent-card-body">
        <p className="agent-card-subtle">State: {payload.state}</p>
        {payload.details ? <p>{payload.details}</p> : null}
      </div>
    </div>
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
