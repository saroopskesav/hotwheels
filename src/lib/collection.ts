import { z } from "zod";
import type { CollectionCar } from "@/lib/types";

export const carInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a car name.").max(120),
  series: z.string().trim().min(1, "Enter a series.").max(80),
  manufacturer: z.string().trim().max(80),
  modelYear: z.coerce.number().int().min(1968).max(2100),
  collectorNumber: z.string().trim().max(24),
  color: z.string().trim().max(60),
  barcode: z.string().trim().max(32),
  quantity: z.coerce.number().int().min(1).max(9999),
  purchasePrice: z.union([z.literal(""), z.coerce.number().min(0).max(99999999)]),
  purchaseDate: z.string().max(10),
  purchaseLocation: z.string().trim().max(120),
  condition: z.enum(["Carded", "Loose", "Mint", "Opened", "Damaged"]),
  isFavorite: z.boolean(),
  isTreasureHunt: z.boolean(),
  isSuperTreasureHunt: z.boolean(),
  notes: z.string().trim().max(1000),
});

export type CarInput = z.infer<typeof carInputSchema>;

export function normalizeBarcode(value: string) {
  return value.replace(/\D/g, "");
}

export function mayBeDuplicate(existing: CollectionCar, incoming: Pick<CarInput, "name" | "series" | "modelYear" | "collectorNumber" | "barcode">) {
  const normalize = (value: string) => value.trim().toLocaleLowerCase();
  const sameName = normalize(existing.name) === normalize(incoming.name);
  const sameSeries = normalize(existing.series) === normalize(incoming.series);
  const sameYear = existing.modelYear === incoming.modelYear;
  const sameNumber = Boolean(incoming.collectorNumber) && normalize(existing.collectorNumber) === normalize(incoming.collectorNumber);
  const barcode = normalizeBarcode(incoming.barcode);
  const sameBarcodeWithIdentity = Boolean(barcode) && normalizeBarcode(existing.barcode) === barcode && sameName && sameSeries;

  return sameName && sameSeries && (sameYear || sameNumber) || sameBarcodeWithIdentity;
}