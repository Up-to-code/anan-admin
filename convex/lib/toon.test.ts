import { decode } from "@toon-format/toon";
import { expect, test } from "vitest";
import { toonEncode } from "./toon";

test("toonEncode encodes plain object", () => {
  const data = { id: 1, name: "Test" };
  const result = toonEncode(data);
  expect(result).toContain("id");
  expect(result).toContain("name");
  expect(result).toContain("Test");
  const decoded = decode(result);
  expect(decoded).toEqual(data);
});

test("toonEncode encodes array of objects (tabular)", () => {
  const data = [
    { sku: "A1", qty: 2, price: 9.99 },
    { sku: "B2", qty: 1, price: 14.5 },
  ];
  const result = toonEncode(data);
  expect(result).toContain("sku");
  expect(result).toContain("qty");
  expect(result).toContain("price");
  const decoded = decode(result);
  expect(decoded).toEqual(data);
});

test("toonEncode encodes null and falls back safely", () => {
  const result = toonEncode(null);
  expect(result).toBeTruthy();
  const decoded = decode(result);
  expect(decoded).toBeNull();
});

test("toonEncode produces fewer chars than JSON for arrays", () => {
  const data = [
    { title: "Property 1", price: 200000, beds: 2 },
    { title: "Property 2", price: 350000, beds: 3 },
  ];
  const toon = toonEncode(data);
  const json = JSON.stringify(data);
  expect(toon.length).toBeLessThan(json.length);
});
