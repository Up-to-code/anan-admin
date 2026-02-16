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

export type OpenRouterModel = {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
};
