import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { systemPrompt } from "./agents/anan/instructions/system";
import {
  reasoningBlock,
  realEstatePrompt,
} from "./agents/anan/instructions/realEstate";
import { toolsPrompt } from "./agents/anan/instructions/toolsSummary";
import { ROLE_ADMIN } from "./roles";

const propertyImportValidator = v.object({
  title: v.string(),
  address: v.string(),
  price: v.number(),
  beds: v.number(),
  baths: v.number(),
  sqft: v.optional(v.number()),
  description: v.string(),
});

/**
 * Bulk import properties from JSON array. For mock data or migrations.
 * Run: npx convex run seed:importFromJson '{"properties":[...]}'
 */
export const importFromJson = mutation({
  args: {
    properties: v.array(propertyImportValidator),
  },
  returns: v.object({ inserted: v.number() }),
  handler: async (ctx, { properties: props }) => {
    let inserted = 0;
    for (const p of props) {
      await ctx.db.insert("properties", {
        title: p.title,
        address: p.address,
        price: p.price,
        beds: p.beds,
        baths: p.baths,
        sqft: p.sqft,
        description: p.description,
      });
      inserted++;
    }
    return { inserted };
  },
});

/**
 * Update prompts in DB to latest from code. Run after prompt changes.
 */
export const updatePrompts = mutation({
  args: {},
  returns: v.object({ updated: v.number() }),
  handler: async (ctx) => {
    const prompts = [
      { key: "system", value: systemPrompt },
      { key: "realEstate", value: `${reasoningBlock}\n\n${realEstatePrompt}` },
      { key: "tools", value: toolsPrompt },
    ];
    for (const p of prompts) {
      const existing = await ctx.db
        .query("prompts")
        .withIndex("key", (q) => q.eq("key", p.key))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { value: p.value });
      } else {
        await ctx.db.insert("prompts", p);
      }
    }
    return { updated: prompts.length };
  },
});

/**
 * Add a user to the admin allowlist. Run from Convex dashboard or CLI:
 * npx convex run seed:addAdmin '{"userId":"<better-auth-user-id>"}'
 * Get the userId from Better Auth (e.g. after signing in, check the user table in Convex dashboard).
 */
export const addAdmin = internalMutation({
  args: { userId: v.string() },
  returns: v.id("adminUsers"),
  handler: async (ctx, { userId }) => {
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("adminUsers", { userId });
  },
});

/**
 * Add a user to the admin allowlist by email. Run from Convex dashboard or CLI:
 *   npx convex run seed:addAdminByEmail '{"email":"adminadmin@gmail.com"}'
 *   (use --prod for production deployment)
 *
 * Admin auth flow:
 * 1. User must exist in Better Auth first: sign up once in the app that uses
 *    this Convex deployment (admin app signup/signin or web app).
 * 2. Then run this mutation; it looks up the user by email and adds them to adminUsers.
 */
export const addAdminByEmail = mutation({
  args: { email: v.string() },
  returns: v.id("adminUsers"),
  handler: async (ctx, { email }) => {
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: email }],
    });
    if (!user || typeof user !== "object") {
      throw new Error(
        `No user found with email: ${email}. Have them sign up first in the app that uses this Convex deployment (admin or web), then run this again.`
      );
    }
    const userId = String((user as { _id: string })._id);
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("adminUsers", { userId });
  },
});

/**
 * One-time migration: backfill userRoles (by phone) from adminUsers. Resolves each admin userId
 * to a phone via verifiedPhones and inserts userRoles with role "admin".
 * Run once from Convex dashboard or: npx convex run seed:migrateAdminUsersToRoles '{}'
 */
export const migrateAdminUsersToRoles = internalMutation({
  args: {},
  returns: v.object({ migrated: v.number(), inserted: v.number() }),
  handler: async (ctx) => {
    const admins = await ctx.db.query("adminUsers").collect();
    let inserted = 0;
    for (const a of admins) {
      const verified = await ctx.db
        .query("verifiedPhones")
        .withIndex("userId", (q) => q.eq("userId", a.userId))
        .first();
      if (!verified) continue;
      const normalized = verified.phoneNumber.replace(/\D/g, "");
      const existing = await ctx.db
        .query("userRoles")
        .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
        .first();
      if (!existing) {
        await ctx.db.insert("userRoles", {
          phoneNumber: normalized,
          role: ROLE_ADMIN,
        });
        inserted++;
      }
    }
    return { migrated: admins.length, inserted };
  },
});

/**
 * Seed mock properties, banks, knowledge pages, and prompts for development.
 * Run once via dashboard or: npx convex run seed:run
 */
export const run = mutation({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const existingBanks = await ctx.db.query("banks").take(1);
    const existingPrompts = await ctx.db.query("prompts").take(1);
    const existingKnowledgePages = await ctx.db.query("knowledgePages").take(1);
    const existingAISettings = await ctx.db.query("aiSettings").take(1);

    if (existingPrompts.length === 0) {
      await ctx.db.insert("prompts", { key: "system", value: systemPrompt });
      await ctx.db.insert("prompts", {
        key: "realEstate",
        value: `${reasoningBlock}\n\n${realEstatePrompt}`,
      });
      await ctx.db.insert("prompts", { key: "tools", value: toolsPrompt });
    }

    if (existingAISettings.length === 0) {
      // Initialize default AI settings
      const defaultSettings = [
        { key: "defaultModel", value: "moonshotai/kimi-k2-thinking" },
        { key: "searchModel", value: "moonshotai/kimi-k2-thinking" },
        { key: "maxTokens", value: "4096" },
        { key: "temperature", value: "0.7" },
        { key: "enableCache", value: "true" },
        { key: "enableStreaming", value: "true" },
        { key: "agentName", value: "عنان" },
        { key: "agentLanguage", value: "ar" },
        {
          key: "welcomeMessage",
          value: "مرحباً! أنا مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟",
        },
        { key: "enableWebSearch", value: "true" },
        { key: "enableAutoHandoff", value: "true" },
        { key: "enableContextMemory", value: "true" },
      ];
      for (const s of defaultSettings) {
        await ctx.db.insert("aiSettings", s);
      }
    }

    if (existingKnowledgePages.length === 0) {
      await ctx.db.insert("knowledgePages", {
        slug: "loan-guide",
        title: "Property Loans in Saudi Arabia",
        category: "loan",
        content: `How property loans work in Saudi Arabia:

1. **Eligibility**: Banks typically require proof of employment, minimum income (often 25,000-40,000 SAR/year), and Saudi residency. First-time buyers may get better rates.

2. **Loan-to-Value (LTV)**: Most banks offer up to 85-95% LTV for first-time buyers, meaning you need 5-15% down payment.

3. **Sharia-compliant options**: Many Saudi banks offer Islamic (Murabaha) financing with no interest—instead, a profit margin is agreed upfront.

4. **Process**: Apply with your bank, provide salary certificate and employment letter, get pre-approval, then search for properties within your budget.

5. **Income multiplier**: Banks usually lend up to 40-50% of your monthly income for repayments.`,
      });
      await ctx.db.insert("knowledgePages", {
        slug: "saudi-buying",
        title: "Buying Property in Saudi Arabia",
        category: "buying",
        content: `Buying property in Saudi Arabia:

1. **Eligibility**: Foreign buyers can purchase in specified areas (e.g. Mecca, Medina, Riyadh for certain developments). Saudi nationals and GCC citizens have broader rights.

2. **Popular markets**: Riyadh, Jeddah, Dammam, and the new giga-projects (NEOM, Red Sea) offer diverse options.

3. **Price ranges**: Riyadh apartments from 500k SAR, villas 1M+. Jeddah often slightly lower. Europe comparables (e.g. Spain, Portugal) from 300k EUR.

4. **Process**: Engage a broker, get loan pre-approval, view properties, make an offer, sign contract, register with Ministry of Justice.`,
      });
      await ctx.db.insert("knowledgePages", {
        slug: "first-time-buyer",
        title: "First-Time Buyer Guide",
        category: "general",
        content: `First-time buyer tips:

- Get pre-approved for a loan before viewing properties
- Budget for down payment (5-15%), fees, and moving costs
- Consider location, schools, and commute
- Think about bedrooms: 1 per child + 1 for guests is a common rule
- Visit properties in person when possible`,
      });
    }

    if (existingBanks.length > 0) {
      return {
        message:
          "Banks already exist. Prompts, knowledge pages, and AI settings seeded if empty.",
        prompts: existingPrompts.length === 0 ? 3 : 0,
        knowledgePages: existingKnowledgePages.length === 0 ? 3 : 0,
        aiSettings: existingAISettings.length === 0 ? 12 : 0,
      };
    }

    const bank1 = await ctx.db.insert("banks", {
      name: "First National Mortgage",
      slug: "first-national",
      contactEmail: "loans@firstnational.com",
      rules: { minIncome: 30000, maxLTV: 0.95 },
      products: [
        {
          name: "First-Time Buyer",
          type: "mortgage",
          description: "For first-time home buyers",
          rules: { firstTimeBuyer: true, minIncome: 25000, maxLTV: 0.95 },
        },
        {
          name: "Standard Mortgage",
          type: "mortgage",
          rules: { minIncome: 40000, employmentRequired: true },
        },
      ],
      state: "active",
      status: "active",
    });

    // Seed normalized bankProducts for bank1
    await ctx.db.insert("bankProducts", {
      bankId: bank1,
      name: "First-Time Buyer",
      type: "mortgage",
      description: "For first-time home buyers",
      rules: { firstTimeBuyer: true, minIncome: 25000, maxLTV: 0.95 },
    });
    await ctx.db.insert("bankProducts", {
      bankId: bank1,
      name: "Standard Mortgage",
      type: "mortgage",
      rules: { minIncome: 40000, employmentRequired: true },
    });

    const bank2 = await ctx.db.insert("banks", {
      name: "Prime Loans Co",
      slug: "prime-loans",
      contactEmail: "contact@primeloans.com",
      products: [
        {
          name: "Construction Loan",
          type: "loan",
          rules: { minIncome: 50000, maxLTV: 0.8 },
        },
      ],
      state: "active",
      status: "active",
    });

    // Seed normalized bankProducts for bank2
    await ctx.db.insert("bankProducts", {
      bankId: bank2,
      name: "Construction Loan",
      type: "loan",
      rules: { minIncome: 50000, maxLTV: 0.8 },
    });

    const bankSaudi = await ctx.db.insert("banks", {
      name: "AlRajhi Home Finance",
      slug: "alrajhi-home",
      contactEmail: "home@alrajhibank.com",
      rules: { minIncome: 60000, maxLTV: 0.9 },
      products: [
        {
          name: "Murabaha Home Finance",
          type: "mortgage",
          description: "Sharia-compliant home financing for Saudi residents",
          rules: {
            minIncome: 60000,
            maxLTV: 0.9,
            employmentRequired: true,
            firstTimeBuyer: true,
          },
        },
        {
          name: "Standard Home Loan",
          type: "mortgage",
          rules: { minIncome: 80000, maxLTV: 0.85, employmentRequired: true },
        },
      ],
      state: "active",
      status: "active",
    });

    // Seed normalized bankProducts for bankSaudi
    await ctx.db.insert("bankProducts", {
      bankId: bankSaudi,
      name: "Murabaha Home Finance",
      type: "mortgage",
      description: "Sharia-compliant home financing for Saudi residents",
      rules: {
        minIncome: 60000,
        maxLTV: 0.9,
        employmentRequired: true,
        firstTimeBuyer: true,
      },
    });
    await ctx.db.insert("bankProducts", {
      bankId: bankSaudi,
      name: "Standard Home Loan",
      type: "mortgage",
      rules: { minIncome: 80000, maxLTV: 0.85, employmentRequired: true },
    });

    await ctx.db.insert("properties", {
      title: "Cozy 2BR Downtown",
      address: "123 Main St, City Center",
      price: 250000,
      beds: 2,
      baths: 1,
      sqft: 950,
      bankId: bank1,
      description:
        "Charming 2-bedroom apartment in the heart of downtown. Walk to cafes and shops.",
    });

    await ctx.db.insert("properties", {
      title: "Spacious 4BR Family Home",
      address: "456 Oak Ave, Suburb",
      price: 420000,
      beds: 4,
      baths: 3,
      sqft: 2200,
      bankId: bank2,
      description: "Great family home with large yard. Near schools and parks.",
    });

    await ctx.db.insert("properties", {
      title: "Modern 3BR Condo",
      address: "789 River Rd, Waterfront",
      price: 380000,
      beds: 3,
      baths: 2,
      sqft: 1600,
      description: "New build with modern finishes. Stunning river views.",
    });

    await ctx.db.insert("properties", {
      title: "Riyadh 3BR Apartment - Al Olaya",
      address: "Al Olaya District, Riyadh",
      price: 850000,
      beds: 3,
      baths: 2,
      sqft: 1800,
      bankId: bankSaudi,
      description:
        "Luxury apartment in Al Olaya, Riyadh. Saudi Arabia. Modern finishes, premium location. Near King Fahd Road.",
    });

    await ctx.db.insert("properties", {
      title: "Jeddah 4BR Villa - Al Hamra",
      address: "Al Hamra, Jeddah",
      price: 1200000,
      beds: 4,
      baths: 4,
      sqft: 2800,
      bankId: bankSaudi,
      description:
        "Spacious villa in Jeddah, Saudi Arabia. Four bedrooms, private garden. Family-friendly neighborhood.",
    });

    await ctx.db.insert("properties", {
      title: "Riyadh 2BR Apartment - Al Malaz",
      address: "Al Malaz, Riyadh",
      price: 550000,
      beds: 2,
      baths: 1,
      sqft: 1100,
      description:
        "Affordable 2-bedroom in Riyadh, Saudi Arabia. Good for first-time buyers. Near metro.",
    });

    await ctx.db.insert("properties", {
      title: "Barcelona 2BR Apartment - Eixample",
      address: "Eixample, Barcelona, Spain",
      price: 320000,
      beds: 2,
      baths: 2,
      sqft: 950,
      description:
        "Charming apartment in Barcelona, Europe. Central Eixample. Walk to Sagrada Familia. Ideal for investment or relocation.",
    });

    await ctx.db.insert("properties", {
      title: "Lisbon 3BR Apartment - Alfama",
      address: "Alfama, Lisbon, Portugal",
      price: 380000,
      beds: 3,
      baths: 2,
      sqft: 1400,
      description:
        "Historic district apartment in Lisbon, Europe. River views. Portugal golden visa eligible.",
    });

    await ctx.db.insert("properties", {
      title: "Madrid 4BR Penthouse",
      address: "Salamanca, Madrid, Spain",
      price: 750000,
      beds: 4,
      baths: 3,
      sqft: 2200,
      description:
        "Penthouse in Madrid, Europe. Family-sized. Terrace, premium location.",
    });

    const extraProps = [
      {
        title: "Riyadh 5BR Villa - Al Nakheel",
        address: "Al Nakheel, Riyadh",
        price: 1800000,
        beds: 5,
        baths: 5,
        sqft: 3500,
        desc: "Luxury villa Riyadh Saudi Arabia. Pool, garden, maids room.",
      },
      {
        title: "Jeddah 3BR - Al Rawdah",
        address: "Al Rawdah, Jeddah",
        price: 780000,
        beds: 3,
        baths: 2,
        sqft: 1650,
        desc: "Modern apartment Jeddah Saudi Arabia. Sea view, balcony.",
      },
      {
        title: "Dammam 4BR - Al Faisaliyah",
        address: "Al Faisaliyah, Dammam",
        price: 920000,
        beds: 4,
        baths: 3,
        sqft: 2400,
        desc: "Family home Dammam Saudi Arabia. Near corniche, schools.",
      },
      {
        title: "Riyadh 1BR Studio - Al Sulimaniyah",
        address: "Al Sulimaniyah, Riyadh",
        price: 320000,
        beds: 1,
        baths: 1,
        sqft: 650,
        desc: "Studio apartment Riyadh. First-time buyer, investment.",
      },
      {
        title: "Barcelona 1BR - Gracia",
        address: "Gracia, Barcelona",
        price: 245000,
        beds: 1,
        baths: 1,
        sqft: 550,
        desc: "Cozy 1-bed Barcelona Europe. Bohemian neighborhood.",
      },
      {
        title: "Valencia 3BR - Ruzafa",
        address: "Ruzafa, Valencia, Spain",
        price: 295000,
        beds: 3,
        baths: 2,
        sqft: 1200,
        desc: "Apartment Valencia Europe. Trendy area, terrace.",
      },
      {
        title: "Porto 2BR - Ribeira",
        address: "Ribeira, Porto, Portugal",
        price: 340000,
        beds: 2,
        baths: 1,
        sqft: 800,
        desc: "Historic Porto Portugal. River views, UNESCO area.",
      },
      {
        title: "Berlin 2BR - Mitte",
        address: "Mitte, Berlin, Germany",
        price: 420000,
        beds: 2,
        baths: 2,
        sqft: 900,
        desc: "Central Berlin Europe. High ceilings, modern.",
      },
      {
        title: "Amsterdam 2BR - Jordaan",
        address: "Jordaan, Amsterdam",
        price: 580000,
        beds: 2,
        baths: 1,
        sqft: 750,
        desc: "Canal-side Amsterdam. Charming, canal view.",
      },
      {
        title: "Riyadh 6BR Compound - Al Yasmine",
        address: "Al Yasmine, Riyadh",
        price: 2500000,
        beds: 6,
        baths: 6,
        sqft: 4800,
        desc: "Compound villa Riyadh. Private pool, gym, staff quarters.",
      },
      {
        title: "Jeddah 2BR - Al Zahra",
        address: "Al Zahra, Jeddah",
        price: 620000,
        beds: 2,
        baths: 2,
        sqft: 1050,
        desc: "Apartment Jeddah Saudi. Near Red Sea, beach access.",
      },
      {
        title: "Riyadh 4BR - Al Rabwah",
        address: "Al Rabwah, Riyadh",
        price: 1100000,
        beds: 4,
        baths: 4,
        sqft: 2600,
        desc: "Villa Riyadh. Gated community, garden.",
      },
      {
        title: "Seville 2BR - Santa Cruz",
        address: "Santa Cruz, Seville, Spain",
        price: 265000,
        beds: 2,
        baths: 1,
        sqft: 700,
        desc: "Andalusian apartment Seville Europe. Historic center.",
      },
      {
        title: "Milan 2BR - Navigli",
        address: "Navigli, Milan, Italy",
        price: 485000,
        beds: 2,
        baths: 2,
        sqft: 850,
        desc: "Milan apartment Europe. Canal district, nightlife.",
      },
      {
        title: "Paris 1BR - Le Marais",
        address: "Le Marais, Paris, France",
        price: 520000,
        beds: 1,
        baths: 1,
        sqft: 500,
        desc: "Paris studio Europe. Historic Marais, investment.",
      },
      {
        title: "London 2BR - Shoreditch",
        address: "Shoreditch, London, UK",
        price: 680000,
        beds: 2,
        baths: 2,
        sqft: 900,
        desc: "London apartment Europe. Trendy East London.",
      },
      {
        title: "Dubai 3BR - Downtown",
        address: "Downtown, Dubai, UAE",
        price: 1450000,
        beds: 3,
        baths: 3,
        sqft: 2100,
        desc: "Dubai apartment. Burj Khalifa view, luxury.",
      },
      {
        title: "Riyadh 3BR - Al Muhammadiyah",
        address: "Al Muhammadiyah, Riyadh",
        price: 680000,
        beds: 3,
        baths: 2,
        sqft: 1550,
        desc: "Family apartment Riyadh. Schools nearby.",
      },
      {
        title: "Jeddah 5BR Villa - Al Hamra",
        address: "Al Hamra, Jeddah",
        price: 1650000,
        beds: 5,
        baths: 5,
        sqft: 3200,
        desc: "Beach villa Jeddah. Pool, private access.",
      },
      {
        title: "Copenhagen 2BR - Nørrebro",
        address: "Nørrebro, Copenhagen",
        price: 445000,
        beds: 2,
        baths: 1,
        sqft: 720,
        desc: "Copenhagen apartment Europe. Design district.",
      },
      {
        title: "Vienna 3BR - Neubau",
        address: "Neubau, Vienna, Austria",
        price: 520000,
        beds: 3,
        baths: 2,
        sqft: 1300,
        desc: "Vienna apartment Europe. Museums, cafes.",
      },
      {
        title: "Rome 2BR - Trastevere",
        address: "Trastevere, Rome, Italy",
        price: 395000,
        beds: 2,
        baths: 1,
        sqft: 680,
        desc: "Rome apartment Europe. Historic, romantic.",
      },
      {
        title: "Athens 2BR - Plaka",
        address: "Plaka, Athens, Greece",
        price: 285000,
        beds: 2,
        baths: 2,
        sqft: 820,
        desc: "Athens apartment Europe. Acropolis views.",
      },
      {
        title: "Riyadh 2BR - Al Wurud",
        address: "Al Wurud, Riyadh",
        price: 480000,
        beds: 2,
        baths: 1,
        sqft: 950,
        desc: "Affordable Riyadh. Starter home, good value.",
      },
      {
        title: "Jeddah 1BR - Al Shati",
        address: "Al Shati, Jeddah",
        price: 380000,
        beds: 1,
        baths: 1,
        sqft: 600,
        desc: "Jeddah studio. Beach area, investment.",
      },
      {
        title: "Malaga 3BR - El Palo",
        address: "El Palo, Malaga, Spain",
        price: 315000,
        beds: 3,
        baths: 2,
        sqft: 1150,
        desc: "Malaga beach apartment Europe. Costa del Sol.",
      },
      {
        title: "Nice 2BR - Old Town",
        address: "Vieux Nice, Nice, France",
        price: 465000,
        beds: 2,
        baths: 1,
        sqft: 650,
        desc: "Nice apartment France. Mediterranean, promenade.",
      },
      {
        title: "Prague 2BR - Vinohrady",
        address: "Vinohrady, Prague",
        price: 325000,
        beds: 2,
        baths: 2,
        sqft: 880,
        desc: "Prague apartment Europe. Art nouveau, parks.",
      },
      {
        title: "Bucharest 3BR - Old Town",
        address: "Old Town, Bucharest",
        price: 195000,
        beds: 3,
        baths: 2,
        sqft: 1100,
        desc: "Bucharest apartment Europe. Affordable, growth market.",
      },
    ];
    for (const p of extraProps) {
      await ctx.db.insert("properties", {
        title: p.title,
        address: p.address,
        price: p.price,
        beds: p.beds,
        baths: p.baths,
        sqft: p.sqft,
        description: p.desc,
      });
    }

    return {
      message: "Seed completed.",
      banks: 3,
      properties: 9 + extraProps.length,
      prompts: existingPrompts.length === 0 ? 3 : 0,
      knowledgePages: existingKnowledgePages.length === 0 ? 3 : 0,
    };
  },
});
