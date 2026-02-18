import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import { modules } from "./test.setup";

test("userProfiles upsert creates new profile", async () => {
  const t = convexTest(schema, modules);
  const id = await t.mutation(internal.services.users.upsertInternal, {
    userId: "test-user-1",
    salary: 60000,
    employment: "employed",
  });
  expect(id).toBeTruthy();

  const profile = await t.query(internal.services.users.getByUserIdInternal, {
    userId: "test-user-1",
  });
  expect(profile).toBeTruthy();
  expect(profile?.salary).toBe(60000);
  expect(profile?.employment).toBe("employed");
});

test("userProfiles upsert patches existing profile", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.services.users.upsertInternal, {
    userId: "test-user-2",
    salary: 50000,
    kids: 2,
  });

  await t.mutation(internal.services.users.upsertInternal, {
    userId: "test-user-2",
    salary: 55000,
    minBeds: 3,
  });

  const profile = await t.query(internal.services.users.getByUserIdInternal, {
    userId: "test-user-2",
  });
  expect(profile?.salary).toBe(55000);
  expect(profile?.kids).toBe(2);
  expect(profile?.minBeds).toBe(3);
});
