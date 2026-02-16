/**
 * Column tests: scenarios sent through the agent, judged on response.
 * Align with QUALITY_SCENARIOS.md (Scenario A turn 2 = another, Scenario B turn 3 = more details).
 */

export type ColumnTestCase = {
  id: string;
  userMessage: string;
  intent: "search" | "another" | "more_details" | "handoff" | "objection";
  /** For multi-turn: run this after a previous turn with the same threadId. */
  dependsOn?: string;
  passCriteria: {
    /** Tool call assertions: e.g. { smartPropertySearch: { refreshToken: "more" } } */
    toolCalls?: Record<string, Record<string, unknown>>;
    /** Required tool names (any order) */
    requiredTools?: string[];
    /** At least one of these tools must be called */
    requiredToolsAny?: string[];
    /** Forbidden tool names */
    forbiddenTools?: string[];
    /** offerBlocks.length >= N */
    minOfferBlocks?: number;
    /** At least one block has imageUrls.length >= N */
    minImagesPerOffer?: number;
    /** Response text must not contain these strings (e.g. location/budget re-ask) */
    responseMustNotContain?: string[];
    /** Response text must contain one of these */
    responseMustContainAny?: string[];
    /** Enforce one-language output quality */
    enforceSingleLanguage?: boolean;
    /** Expected primary response language */
    expectedLanguage?: "ar" | "en";
  };
};

/** Column tests aligned with QUALITY_SCENARIOS.md Scenario A (Arabic) and Scenario B (English). */
export const COLUMN_TEST_CASES: ColumnTestCase[] = [
  // Scenario A: Arabic, first search then "more" (QUALITY_SCENARIOS Scenario A)
  {
    id: "A1-search-arabic",
    userMessage: "شقق للبيع في الرياض مليون ريال",
    intent: "search",
    passCriteria: {
      requiredToolsAny: ["smartPropertySearch"],
      minOfferBlocks: 2,
      minImagesPerOffer: 1,
      enforceSingleLanguage: true,
      expectedLanguage: "ar",
    },
  },
  {
    id: "A2-another-arabic",
    userMessage: "أعطني خيارات ثانية",
    intent: "another",
    dependsOn: "A1-search-arabic",
    passCriteria: {
      requiredToolsAny: ["smartPropertySearch"],
      minOfferBlocks: 2,
      responseMustNotContain: ["ما الموقع", "ما الميزانية", "كم الميزانية"],
      enforceSingleLanguage: true,
      expectedLanguage: "ar",
    },
  },
  {
    id: "A3-more-details-arabic",
    userMessage: "تفاصيل أكثر عن الشقة الثانية",
    intent: "more_details",
    dependsOn: "A2-another-arabic",
    passCriteria: {
      requiredToolsAny: ["getLastSearchFindings", "getMoreDetailsForProperty"],
      minOfferBlocks: 1,
      enforceSingleLanguage: true,
      expectedLanguage: "ar",
    },
  },
  // Scenario B: English, multiple offers and images (QUALITY_SCENARIOS Scenario B)
  {
    id: "B1-search-english",
    userMessage: "Apartments for sale in Riyadh, 2 beds, 1.5M",
    intent: "search",
    passCriteria: {
      requiredToolsAny: ["smartPropertySearch"],
      minOfferBlocks: 2,
      minImagesPerOffer: 1,
      enforceSingleLanguage: true,
      expectedLanguage: "en",
    },
  },
  {
    id: "B2-another-english",
    userMessage: "Send me more options",
    intent: "another",
    dependsOn: "B1-search-english",
    passCriteria: {
      requiredToolsAny: ["smartPropertySearch"],
      minOfferBlocks: 2,
      enforceSingleLanguage: true,
      expectedLanguage: "en",
    },
  },
  {
    id: "B3-more-details-english",
    userMessage: "More details on the first one",
    intent: "more_details",
    dependsOn: "B2-another-english",
    passCriteria: {
      requiredToolsAny: ["getLastSearchFindings", "getMoreDetailsForProperty"],
      minOfferBlocks: 1,
      enforceSingleLanguage: true,
      expectedLanguage: "en",
    },
  },
  // Scenario F: WhatsApp sales conversion
  {
    id: "F1-ready-to-buy-arabic",
    userMessage: "أنا جاهز أكمل شراء العرض الثاني وتواصل معي",
    intent: "handoff",
    dependsOn: "A2-another-arabic",
    passCriteria: {
      requiredToolsAny: ["requestHumanHandoff", "createSalesOrderDraft"],
      responseMustContainAny: ["تواصل", "موعد", "المبيعات", "جاهز"],
      enforceSingleLanguage: true,
      expectedLanguage: "ar",
    },
  },
  {
    id: "F2-ready-to-buy-english",
    userMessage: "I am ready to proceed with the first option, connect me with sales",
    intent: "handoff",
    dependsOn: "B2-another-english",
    passCriteria: {
      requiredToolsAny: ["requestHumanHandoff", "createSalesOrderDraft"],
      responseMustContainAny: ["sales", "proceed", "contact", "viewing"],
      enforceSingleLanguage: true,
      expectedLanguage: "en",
    },
  },
  // R1–R5: Routing tests (property vs general)
  {
    id: "R1-general-mortgage-rates",
    userMessage: "What are mortgage rates in Saudi Arabia 2025?",
    intent: "search",
    passCriteria: {
      requiredToolsAny: ["webSearch", "searchRealEstateInfo"],
      forbiddenTools: ["smartPropertySearch"],
    },
  },
  {
    id: "R2-general-neighborhoods",
    userMessage: "Best neighborhoods in Riyadh for families",
    intent: "search",
    passCriteria: {
      requiredToolsAny: ["webSearch", "searchRealEstateInfo"],
      forbiddenTools: ["smartPropertySearch"],
    },
  },
  {
    id: "R3-property-arabic",
    userMessage: "شقق للبيع في الرياض مليون",
    intent: "search",
    passCriteria: {
      requiredToolsAny: ["smartPropertySearch"],
    },
  },
  {
    id: "R4-general-market-trends",
    userMessage: "Market trends Riyadh real estate",
    intent: "search",
    passCriteria: {
      requiredToolsAny: ["webSearch", "searchRealEstateInfo"],
      forbiddenTools: ["smartPropertySearch"],
    },
  },
  {
    id: "R5-property-english",
    userMessage: "Find apartments in Jeddah 2 beds",
    intent: "search",
    passCriteria: {
      requiredToolsAny: ["smartPropertySearch"],
    },
  },
  // Scenario G: objection handling
  {
    id: "G1-objection-price-arabic",
    userMessage: "السعر غالي، عطيني بدائل أرخص وقريبة",
    intent: "objection",
    dependsOn: "A1-search-arabic",
    passCriteria: {
      requiredToolsAny: ["smartPropertySearch", "getLastSearchContext"],
      responseMustContainAny: ["بدائل", "أحياء", "ميزانية", "خيار"],
      enforceSingleLanguage: true,
      expectedLanguage: "ar",
    },
  },
  {
    id: "G2-objection-not-ready-english",
    userMessage: "I like it but I am not ready now",
    intent: "objection",
    dependsOn: "B1-search-english",
    passCriteria: {
      responseMustContainAny: ["follow", "later", "save", "ready", "viewing"],
      enforceSingleLanguage: true,
      expectedLanguage: "en",
    },
  },
];

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function hasLatin(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

/**
 * Judge a single test case result using assertions.
 * Returns { pass: boolean, reasons: string[] }.
 */
export function judgeColumnTest(
  testCase: ColumnTestCase,
  result: {
    toolCalls: Array<{ name: string; args: unknown }>;
    toolResults: Array<{ name: string; result: unknown }>;
    assistantMessage: string;
    offerBlocks?: Array<{ imageUrl?: string; imageUrls?: string[] }>;
  }
): { pass: boolean; reasons: string[]; suggestions: string[] } {
  const reasons: string[] = [];
  const criteria = testCase.passCriteria;
  const hasToolTrace = result.toolCalls.length > 0 || result.toolResults.length > 0;
  const calledNames = new Set([
    ...result.toolCalls.map((t) => t.name),
    ...result.toolResults.map((t) => t.name),
  ]);

  if (criteria.requiredTools && hasToolTrace) {
    for (const req of criteria.requiredTools) {
      if (!calledNames.has(req)) {
        reasons.push(`Missing required tool: ${req}`);
      }
    }
  }

  if (criteria.forbiddenTools && hasToolTrace) {
    for (const forb of criteria.forbiddenTools) {
      if (calledNames.has(forb)) {
        reasons.push(`Forbidden tool was called: ${forb}`);
      }
    }
  }

  if (criteria.requiredToolsAny && hasToolTrace) {
    const hasAny = criteria.requiredToolsAny.some((name) => calledNames.has(name));
    if (!hasAny) {
      reasons.push(`Missing required tool family: one of [${criteria.requiredToolsAny.join(", ")}]`);
    }
  }

  if (criteria.toolCalls && hasToolTrace) {
    for (const [toolName, expectedArgs] of Object.entries(criteria.toolCalls)) {
      const call = result.toolCalls.find((t) => t.name === toolName);
      if (!call) {
        reasons.push(`Tool ${toolName} not called but had expected args`);
      } else {
        for (const [key, val] of Object.entries(expectedArgs)) {
          if ((call.args as Record<string, unknown>)[key] !== val) {
            reasons.push(`Tool ${toolName} arg ${key} mismatch: expected ${JSON.stringify(val)}`);
          }
        }
      }
    }
  }

  if (criteria.minOfferBlocks != null) {
    const count = result.offerBlocks?.length ?? 0;
    if (count < criteria.minOfferBlocks) {
      reasons.push(
        `offerBlocks.length (${count}) < minOfferBlocks (${criteria.minOfferBlocks})`
      );
    }
  }

  if (criteria.minImagesPerOffer != null) {
    const blocks = result.offerBlocks ?? [];
    const hasEnough = blocks.some(
      (b) => {
        const imageCount = (b.imageUrls?.length ?? 0) || (b.imageUrl ? 1 : 0);
        return imageCount >= criteria.minImagesPerOffer!;
      }
    );
    if (!hasEnough) {
      reasons.push(
        `No offer block has >= ${criteria.minImagesPerOffer} images`
      );
    }
  }

  if (criteria.responseMustNotContain) {
    const lower = result.assistantMessage.toLowerCase();
    for (const phrase of criteria.responseMustNotContain) {
      if (lower.includes(phrase.toLowerCase())) {
        reasons.push(`Response contains forbidden phrase: "${phrase}"`);
      }
    }
  }

  if (criteria.responseMustContainAny) {
    const lower = result.assistantMessage.toLowerCase();
    const hasAny = criteria.responseMustContainAny.some((p) =>
      lower.includes(p.toLowerCase())
    );
    if (!hasAny) {
      reasons.push(
        `Response must contain one of: ${criteria.responseMustContainAny.join(", ")}`
      );
    }
  }

  if (criteria.enforceSingleLanguage) {
    const containsArabic = hasArabic(result.assistantMessage);
    const containsLatin = hasLatin(result.assistantMessage);
    if (containsArabic && containsLatin) {
      reasons.push("Response mixes Arabic and English in the same reply");
    }
  }

  if (criteria.expectedLanguage) {
    const containsArabic = hasArabic(result.assistantMessage);
    const containsLatin = hasLatin(result.assistantMessage);
    if (criteria.expectedLanguage === "ar" && !containsArabic) {
      reasons.push("Expected Arabic response but Arabic text was not detected");
    }
    if (criteria.expectedLanguage === "en" && !containsLatin) {
      reasons.push("Expected English response but English text was not detected");
    }
  }

  return {
    pass: reasons.length === 0,
    reasons,
    suggestions: suggestImprovements(reasons, testCase),
  };
}

/** Map failure reasons to actionable improvement suggestions. */
function suggestImprovements(reasons: string[], testCase: ColumnTestCase): string[] {
  const suggestions: string[] = [];
  for (const r of reasons) {
    if (r.startsWith("Missing required tool:")) {
      const tool = r.replace("Missing required tool: ", "");
      suggestions.push(
        `Instruction: Always call ${tool} when user intent is "${testCase.intent}" (e.g. "${testCase.userMessage}").`
      );
    } else if (r.startsWith("Missing required tool family:")) {
      suggestions.push(
        `Instruction: For intent "${testCase.intent}", call at least one allowed search/detail tool before replying.`
      );
    } else if (r.includes("refreshToken") && r.includes("mismatch")) {
      suggestions.push(
        "Instruction: For 'another'/'خيارات ثانية'/'more options', always pass refreshToken: 'more' to smartPropertySearch."
      );
    } else if (r.includes("Response contains forbidden phrase")) {
      suggestions.push(
        "Instruction: Never re-ask location or budget when user says 'another' or 'more options'."
      );
    } else if (r.includes("offerBlocks.length") && r.includes("minOfferBlocks")) {
      suggestions.push(
        "Check: extraction pipeline, search agent, or relax minOfferBlocks if no results; improve query."
      );
    } else if (r.includes("No offer block has >= ")) {
      suggestions.push(
        "Check: image pipeline (extractPropertyDetails, offer formatter); ensure imageUrls flow to offerBlocks."
      );
    } else if (r.includes("mixes Arabic and English")) {
      suggestions.push(
        "Instruction: Keep a single language per reply; match the user's language and avoid mixed-language bullets."
      );
    } else if (r.includes("Expected Arabic response")) {
      suggestions.push(
        "Instruction: When user message is Arabic, answer fully in Arabic and keep labels/details in Arabic."
      );
    } else if (r.includes("Expected English response")) {
      suggestions.push(
        "Instruction: When user message is English, answer fully in English and avoid Arabic fallback text."
      );
    } else if (r.includes("Tool ") && r.includes(" not called")) {
      suggestions.push(
        `Instruction: Ensure agent calls the expected tool for intent "${testCase.intent}".`
      );
    } else {
      suggestions.push(`Review: ${r}`);
    }
  }
  return Array.from(new Set(suggestions));
}
