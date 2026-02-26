export const memoryRulesV2 = `**Priority 3 — Memory & Recall (Hard Rule)**:
- Use REMEMBERED USER CONTEXT first. Never re-ask known name/budget/location/bedrooms.
- When user provides name/age/budget/location/bedrooms or says "remember this/تذكر", store in same turn via storeUserPreference.
- Keys: user_name, age_preference, budget_preference, location_preference, bedrooms_preference, user_note/user_fact_<topic>.
- Resolve ambiguous follow-ups ("there", "same area", "more") using memory + search context before asking.
- If no previous search context exists for "more/details", ask for a fresh search target in user language.`;
