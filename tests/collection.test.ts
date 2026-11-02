import { describe, expect, it } from "vitest";
import { carInputSchema, mayBeDuplicate, normalizeBarcode } from "../src/lib/collection";
import type { CollectionCar } from "../src/lib/types";

const existingCar: CollectionCar = {
  id: "car-1",
  name: "'69 Dodge Charger 500",
  series: "HW Muscle Mania",
  manufacturer: "Dodge",
  modelYear: 2024,
  collectorNumber: "088/250",
  color: "Red",
  barcode: "0194735214081",
  quantity: 1,
  purchasePrice: 3.49,
  condition: "Carded",
  isFavorite: false,
  isTreasureHunt: false,
  isSuperTreasureHunt: false,
  addedAt: "2026-10-28",
  imageTone: "vermilion",
};

const validInput = { name: "Model", series: "Mainline", manufacturer: "", modelYear: 2024, collectorNumber: "", color: "", barcode: "", quantity: 1, purchasePrice: "", purchaseDate: "", purchaseLocation: "", condition: "Carded", isFavorite: false, isTreasureHunt: false, isSuperTreasureHunt: false, notes: "" };

describe("collection helpers", () => {
  it("normalizes scanner input to digits while preserving leading zeroes", () => {
    expect(normalizeBarcode(" 0-194735-214081 ")).toBe("0194735214081");
  });

  it("requires casting identity in addition to a shared barcode", () => {
    expect(mayBeDuplicate(existingCar, { name: "Different car", series: "HW Muscle Mania", modelYear: 2024, collectorNumber: "", barcode: existingCar.barcode })).toBe(false);
    expect(mayBeDuplicate(existingCar, { name: existingCar.name, series: existingCar.series, modelYear: 2024, collectorNumber: "", barcode: existingCar.barcode })).toBe(true);
  });

  it("validates required identity, supported year, and positive quantity", () => {
    expect(carInputSchema.safeParse({ ...validInput, name: "" }).success).toBe(false);
    expect(carInputSchema.safeParse({ ...validInput, quantity: 0 }).success).toBe(false);
    expect(carInputSchema.safeParse(validInput).success).toBe(true);
  });
});