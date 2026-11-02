export type CarCondition = "Carded" | "Loose" | "Mint" | "Opened" | "Damaged";

export type CollectionCar = {
  id: string;
  name: string;
  series: string;
  manufacturer: string;
  modelYear: number;
  collectorNumber: string;
  color: string;
  barcode: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate?: string;
  purchaseLocation?: string;
  condition: CarCondition;
  notes?: string;
  isFavorite: boolean;
  isTreasureHunt: boolean;
  isSuperTreasureHunt: boolean;
  addedAt: string;
  imageTone: string;
  imageUrl?: string;
};

export type CarFormState = {
  name: string;
  series: string;
  manufacturer: string;
  collectorNumber: string;
  modelYear: string;
  color: string;
  barcode: string;
  quantity: string;
  purchasePrice: string;
  purchaseDate: string;
  purchaseLocation: string;
  condition: CarCondition;
  isFavorite: boolean;
  isTreasureHunt: boolean;
  isSuperTreasureHunt: boolean;
  notes: string;
};

export type NavigationItem = "Overview" | "My Garage" | "Wishlist" | "Analytics" | "Series";