import { v } from "convex/values";

export const bankProductRulesValidator = v.optional(
  v.object({
    minSalary: v.optional(v.number()),
    employmentType: v.optional(
      v.union(
        v.literal("employed"),
        v.literal("self_employed"),
        v.literal("retired"),
        v.literal("any"),
      ),
    ),
    minEmploymentYears: v.optional(v.number()),
    minAge: v.optional(v.number()),
    maxAge: v.optional(v.number()),
    firstTimeBuyer: v.optional(
      v.union(v.literal(true), v.literal(false), v.literal("any")),
    ),
    maxDebtRatio: v.optional(v.number()),
    minCreditScore: v.optional(v.number()),
    minDownPayment: v.optional(v.number()),
    maxLoanAmount: v.optional(v.number()),
    minLoanAmount: v.optional(v.number()),
    loanTermMonths: v.optional(v.array(v.number())),
    interestRate: v.optional(
      v.object({
        min: v.number(),
        max: v.number(),
      }),
    ),
    fees: v.optional(
      v.object({
        processingFee: v.optional(v.number()),
        earlyPaymentFee: v.optional(v.number()),
        latePaymentFee: v.optional(v.number()),
      }),
    ),
    requiredDocuments: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  }),
);

export type BankProductRules = {
  minSalary?: number;
  employmentType?: "employed" | "self_employed" | "retired" | "any";
  minEmploymentYears?: number;
  minAge?: number;
  maxAge?: number;
  firstTimeBuyer?: boolean | "any";
  maxDebtRatio?: number;
  minCreditScore?: number;
  minDownPayment?: number;
  maxLoanAmount?: number;
  minLoanAmount?: number;
  loanTermMonths?: number[];
  interestRate?: { min: number; max: number };
  fees?: {
    processingFee?: number;
    earlyPaymentFee?: number;
    latePaymentFee?: number;
  };
  requiredDocuments?: string[];
  notes?: string;
};
