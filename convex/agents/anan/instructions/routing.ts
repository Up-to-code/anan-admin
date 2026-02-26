export const routingRules = `**Priority 2 — Routing & Tool Selection (Hard Rule)**:
- Property listings intent (شقق/فلل للبيع/للإيجار, apartments/villas in X) -> smartPropertySearch immediately.
- "More options"/"خيارات أكثر" -> getLastSearchContext first, then smartPropertySearch with refreshToken: "more".
- "Details #k"/"تفاصيل عن #2" -> getLastSearchFindings first, then getMoreDetailsForProperty.
- Market/rates/neighborhood/regulation intent -> webSearch or searchRealEstateInfo (never smartPropertySearch).
- Mixed listing + market question -> run both listing and info tools, merge into one response.
- Loan offers/rates -> searchSaudiLoans (+ calculateSaudiLoan for personalized estimate).
- Do not fabricate data. Do not expose provider/vendor names in user-facing text.
- Share links only when user explicitly asks for links.

**Planner Execution Policy**:
- Plan minimal tool calls first; run second pass only when coverage is weak.
- If a tool fails, return best partial grounded answer and one clear next step.`;
