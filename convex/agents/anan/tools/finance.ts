import { createTool } from "@convex-dev/agent";
import { toonEncode } from "../../../lib/toon";
import { z } from "zod";
import { ActionCache } from "@convex-dev/action-cache";
import { components } from "../../../_generated/api";
import { internal } from "../../../_generated/api";
import type { AgentToolsApi } from "./types";

const serperCache = new ActionCache(components.actionCache, {
    action: internal.agents.anan.search.serperWebAction.runSerperWebSearch,
    name: "serper-web-v1",
    ttl: 15 * 24 * 60 * 60 * 1000,
});

function shapeLoanQuery(params: {
    query: string;
    loanType?: "mortgage" | "personal" | "auto" | "general";
    includeUae?: boolean;
}): string {
    const q = params.query.trim();
    const region = params.includeUae ? "Saudi Arabia UAE" : "Saudi Arabia";
    const typeHint =
        params.loanType === "mortgage"
            ? "mortgage home financing"
            : params.loanType === "personal"
                ? "personal loan"
                : params.loanType === "auto"
                    ? "auto car loan"
                    : "loan financing";
    return `${q} ${typeHint} ${region} rates eligibility calculator`;
}

export function createFinanceTools(_appApi: AgentToolsApi) {
    const searchSaudiLoans = createTool({
        description:
            "Search up-to-date loan/mortgage information in Saudi Arabia (and optional UAE). Use for rates, eligibility, bank offers, and policy updates.",
        args: z.object({
            query: z
                .string()
                .describe(
                    "Loan search topic (e.g. 'best mortgage rates for first-time buyers')",
                ),
            loanType: z
                .enum(["mortgage", "personal", "auto", "general"])
                .optional()
                .default("general"),
            includeUae: z
                .boolean()
                .optional()
                .default(false)
                .describe("When true, include UAE sources in the search."),
            num: z.number().optional().default(8),
        }),
        handler: async (ctx, { query, loanType, includeUae, num }) => {
            const shaped = shapeLoanQuery({ query, loanType, includeUae });
            try {
                const cached = await serperCache.fetch(ctx as any, {
                    query: shaped,
                    num: Math.max(6, num),
                    deep: true,
                });
                if (!cached?.ok) {
                    return toonEncode({ error: cached?.error ?? "loan search failed" });
                }
                return toonEncode({
                    query: shaped,
                    region: includeUae ? ["saudi", "uae"] : ["saudi"],
                    loanType,
                    results: cached.results,
                    searchPlan: {
                        deep: true,
                        queriesUsed: Array.isArray((cached as { queriesUsed?: unknown }).queriesUsed)
                            ? (cached as { queriesUsed: string[] }).queriesUsed
                            : [shaped],
                    },
                    presentationGuidance: {
                        avoidProviderNames: true,
                        includeLinksOnlyOnUserRequest: true,
                    },
                });
            } catch (e) {
                return toonEncode({
                    error: e instanceof Error ? e.message : "searchSaudiLoans failed",
                });
            }
        },
    });

    const calculateSaudiLoan = createTool({
        description:
            "Calculate loan installment and affordability for Saudi scenarios. Use for quick estimations before recommending banks.",
        args: z.object({
            principal: z.number().describe("Property or loan principal amount in SAR"),
            annualRatePct: z.number().describe("Annual interest/profit rate as percent"),
            years: z.number().describe("Loan duration in years"),
            downPayment: z.number().optional().default(0),
            monthlyIncome: z.number().optional(),
            existingMonthlyDebt: z.number().optional().default(0),
        }),
        handler: async (
            _ctx,
            {
                principal,
                annualRatePct,
                years,
                downPayment,
                monthlyIncome,
                existingMonthlyDebt,
            },
        ) => {
            const financedAmount = Math.max(0, principal - Math.max(0, downPayment));
            const monthlyRate = annualRatePct / 100 / 12;
            const months = Math.max(1, Math.round(years * 12));
            const monthlyPayment =
                monthlyRate <= 0
                    ? financedAmount / months
                    : (financedAmount * monthlyRate) /
                    (1 - Math.pow(1 + monthlyRate, -months));
            const totalPayment = monthlyPayment * months;
            const totalProfit = Math.max(0, totalPayment - financedAmount);
            const totalDebt = monthlyPayment + Math.max(0, existingMonthlyDebt);
            const dti =
                monthlyIncome && monthlyIncome > 0 ? totalDebt / monthlyIncome : undefined;
            let dtiBand = "unknown";
            if (typeof dti === "number") {
                dtiBand = dti <= 0.45 ? "strong" : dti <= 0.55 ? "moderate" : "high_risk";
            }
            return toonEncode({
                currency: "SAR",
                inputs: {
                    principal,
                    downPayment,
                    annualRatePct,
                    years,
                    monthlyIncome,
                    existingMonthlyDebt,
                },
                outputs: {
                    financedAmount: Math.round(financedAmount),
                    monthlyPayment: Math.round(monthlyPayment),
                    totalPayment: Math.round(totalPayment),
                    totalProfit: Math.round(totalProfit),
                    dti: typeof dti === "number" ? Number(dti.toFixed(3)) : undefined,
                    dtiBand,
                },
                note: "This is an estimate only; final eligibility and pricing depend on lender policy.",
            });
        },
    });

    return {
        searchSaudiLoans,
        calculateSaudiLoan,
    };
}
