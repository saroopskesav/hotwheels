"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowDownUp,
  ArrowRight,
  Bell,
  CarFront,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Command,
  Gauge,
  Grid2X2,
  Heart,
  ImagePlus,
  LayoutDashboard,
  List,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings2,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
  Trophy,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import AuthGate from "@/components/auth-gate";
import { SeriesManager, WishlistView } from "@/components/library-views";
import { carInputSchema, mayBeDuplicate, normalizeBarcode } from "@/lib/collection";
import { compressCollectionImage } from "@/lib/image";
import type { CarFormState, CollectionCar, NavigationItem } from "@/lib/types";
import { previewCars } from "@/lib/demo-data";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

const ScannerModal = dynamic(() => import("@/components/scanner-modal"), { ssr: false });
const AnalyticsView = dynamic(() => import("@/components/analytics-view"), { ssr: false });

const navItems: { label: NavigationItem; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "My Garage", icon: CarFront },
  { label: "Wishlist", icon: Heart },
  { label: "Analytics", icon: Activity },
];

const emptyCarForm: CarFormState = { name: "", series: "", manufacturer: "", collectorNumber: "", modelYear: "2026", color: "", barcode: "", quantity: "1", purchasePrice: "", purchaseDate: "", purchaseLocation: "", condition: "Carded", isFavorite: false, isTreasureHunt: false, isSuperTreasureHunt: false, notes: "" };

export default function VaultApp() {
  const [supabase] = useState(createSupabaseClient);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(() => !supabase);
  const [activePage, setActivePage] = useState<NavigationItem>("Overview");
  const [cars, setCars] = useState<CollectionCar[]>(() => supabase ? [] : previewCars);
  const [query, setQuery] = useState("");
  const [seriesFilter, setSeriesFilter] = useState("All series");
  const [manufacturerFilter, setManufacturerFilter] = useState("All manufacturers");
  const [yearFilter, setYearFilter] = useState("All years");
  const [colorFilter, setColorFilter] = useState("All colours");
  const [conditionFilter, setConditionFilter] = useState("All conditions");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [treasureOnly, setTreasureOnly] = useState(false);
  const [sortMode, setSortMode] = useState("Recently added");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanIntoCarForm, setScanIntoCarForm] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isListView, setIsListView] = useState(false);
  const [toast, setToast] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(() => supabase ? 0 : 2);
  const [seriesCount, setSeriesCount] = useState(() => supabase ? 0 : new Set(previewCars.map((car) => car.series)).size);
  const [duplicateCandidate, setDuplicateCandidate] = useState<CollectionCar | null>(null);
  const [pendingCar, setPendingCar] = useState<CollectionCar | null>(null);
  const [editingCarId, setEditingCarId] = useState<string | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [form, setForm] = useState<CarFormState>(emptyCarForm);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setAuthReady(true);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (!nextSession) setCars([]);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !session?.user.id) return;
    const client = supabase;
    let active = true;
    async function loadCars() {
      const { data, error } = await client
        .from("cars")
        .select("id, name, manufacturer, model_year, collector_number, color, barcode, quantity, purchase_price, purchase_date, purchase_location, condition, notes, is_favorite, is_treasure_hunt, is_super_treasure_hunt, created_at, series(name), car_images(storage_path, is_primary)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        notify("Could not load your vault. Check the Supabase migration and RLS policies.");
        return;
      }
      const rows = data as unknown as { id: string; name: string; manufacturer: string | null; model_year: number | null; collector_number: string | null; color: string | null; barcode: string | null; quantity: number; purchase_price: number | null; purchase_date: string | null; purchase_location: string | null; condition: CollectionCar["condition"]; notes: string | null; is_favorite: boolean; is_treasure_hunt: boolean; is_super_treasure_hunt: boolean; created_at: string; series: { name: string } | { name: string }[] | null; car_images: { storage_path: string; is_primary: boolean }[] }[];
      const mappedCars = await Promise.all(rows.map(async (row) => {
        const primaryImage = row.car_images.find((image) => image.is_primary) ?? row.car_images[0];
        const { data: signedImage } = primaryImage ? await client.storage.from("diecast-images").createSignedUrl(primaryImage.storage_path, 3600) : { data: null };
        return ({
        id: row.id,
        name: row.name,
        series: Array.isArray(row.series) ? row.series[0]?.name ?? "Unassigned" : row.series?.name ?? "Unassigned",
        manufacturer: row.manufacturer ?? "Unknown",
        modelYear: row.model_year ?? new Date(row.created_at).getFullYear(),
        collectorNumber: row.collector_number ?? "—",
        color: row.color ?? "Unspecified",
        barcode: row.barcode ?? "",
        quantity: row.quantity,
        purchasePrice: Number(row.purchase_price ?? 0),
        purchaseDate: row.purchase_date ?? undefined,
        purchaseLocation: row.purchase_location ?? undefined,
        condition: row.condition,
        notes: row.notes ?? undefined,
        isFavorite: row.is_favorite,
        isTreasureHunt: row.is_treasure_hunt,
        isSuperTreasureHunt: row.is_super_treasure_hunt,
        addedAt: row.created_at.slice(0, 10),
        imageTone: "cobalt",
        imageUrl: signedImage?.signedUrl,
      });
      }));
      setCars(mappedCars);
    }
    void loadCars();
    return () => { active = false; };
  }, [supabase, session?.user.id]);

  useEffect(() => {
    if (!supabase || !session?.user.id) return;
    const client = supabase;
    let active = true;
    async function loadCounts() {
      const [seriesResult, wishlistResult] = await Promise.all([
        client.from("series").select("id", { count: "exact", head: true }),
        client.from("wishlist").select("id", { count: "exact", head: true }).is("acquired_at", null),
      ]);
      if (!active) return;
      if (!seriesResult.error && seriesResult.count !== null) setSeriesCount(seriesResult.count);
      if (!wishlistResult.error && wishlistResult.count !== null) setWishlistCount(wishlistResult.count);
    }
    void loadCounts();
    return () => { active = false; };
  }, [supabase, session?.user.id, activePage]);

  const seriesOptions = useMemo(() => ["All series", ...new Set(cars.map((car) => car.series))], [cars]);
  const manufacturerOptions = useMemo(() => ["All manufacturers", ...new Set(cars.map((car) => car.manufacturer))], [cars]);
  const yearOptions = useMemo(() => ["All years", ...new Set(cars.map((car) => String(car.modelYear)))].sort((a, b) => a === "All years" ? -1 : b === "All years" ? 1 : Number(b) - Number(a)), [cars]);
  const colorOptions = useMemo(() => ["All colours", ...new Set(cars.map((car) => car.color))], [cars]);
  const filteredCars = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cars.filter((car) => {
      const matchesQuery = !needle || [car.name, car.series, car.manufacturer, car.collectorNumber, car.barcode].some((value) => value.toLowerCase().includes(needle));
      return matchesQuery
        && (seriesFilter === "All series" || car.series === seriesFilter)
        && (manufacturerFilter === "All manufacturers" || car.manufacturer === manufacturerFilter)
        && (yearFilter === "All years" || String(car.modelYear) === yearFilter)
        && (colorFilter === "All colours" || car.color === colorFilter)
        && (conditionFilter === "All conditions" || car.condition === conditionFilter)
        && (!favoritesOnly || car.isFavorite)
        && (!duplicatesOnly || car.quantity > 1)
        && (!treasureOnly || car.isTreasureHunt || car.isSuperTreasureHunt);
    });
  }, [cars, query, seriesFilter, manufacturerFilter, yearFilter, colorFilter, conditionFilter, favoritesOnly, duplicatesOnly, treasureOnly]);
  const sortedCars = useMemo(() => [...filteredCars].sort((first, second) => {
    switch (sortMode) {
      case "Oldest added": return first.addedAt.localeCompare(second.addedAt);
      case "Name A–Z": return first.name.localeCompare(second.name);
      case "Name Z–A": return second.name.localeCompare(first.name);
      case "Model year": return second.modelYear - first.modelYear;
      case "Purchase price": return second.purchasePrice - first.purchasePrice;
      case "Quantity": return second.quantity - first.quantity;
      default: return second.addedAt.localeCompare(first.addedAt);
    }
  }), [filteredCars, sortMode]);
  const totalUnits = cars.reduce((total, car) => total + car.quantity, 0);
  const uniqueModels = cars.length;
  const duplicateUnits = cars.reduce((total, car) => total + Math.max(0, car.quantity - 1), 0);
  const recordedSpend = cars.reduce((total, car) => total + car.purchasePrice * car.quantity, 0);
  const treasureCount = cars.filter((car) => car.isTreasureHunt || car.isSuperTreasureHunt).length;
  const superTreasureCount = cars.filter((car) => car.isSuperTreasureHunt).length;

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function openScanner(forCarForm = false) {
    setScanIntoCarForm(forCarForm);
    setIsScannerOpen(true);
  }

  function handleBarcodeDetected(barcode: string) {
    const normalized = normalizeBarcode(barcode);
    setIsScannerOpen(false);
    if (scanIntoCarForm) {
      setForm((current) => ({ ...current, barcode: normalized }));
      setScanIntoCarForm(false);
      notify("Barcode added. Check the casting details before saving.");
      return;
    }

    const matches = cars.filter((car) => normalizeBarcode(car.barcode) === normalized);
    if (matches.length) {
      setActivePage("My Garage");
      setQuery(normalized);
      notify(`${matches.length} possible barcode match${matches.length === 1 ? "" : "es"}. Barcode is not unique; confirm the casting details.`);
    } else {
      openAddCar(normalized);
      notify("Barcode added to the form. Enter the casting details manually.");
    }
  }

  function openAddCar(barcode = "") {
    setEditingCarId(null);
    setForm({ ...emptyCarForm, barcode });
    setPhotoFiles([]);
    setIsAddOpen(true);
  }

  function openEditCar(car: CollectionCar) {
    setEditingCarId(car.id);
    setForm({ name: car.name, series: car.series, manufacturer: car.manufacturer === "Unknown" ? "" : car.manufacturer, collectorNumber: car.collectorNumber === "—" ? "" : car.collectorNumber, modelYear: String(car.modelYear), color: car.color === "Unspecified" ? "" : car.color, barcode: car.barcode, quantity: String(car.quantity), purchasePrice: String(car.purchasePrice), purchaseDate: car.purchaseDate ?? "", purchaseLocation: car.purchaseLocation ?? "", condition: car.condition, isFavorite: car.isFavorite, isTreasureHunt: car.isTreasureHunt, isSuperTreasureHunt: car.isSuperTreasureHunt, notes: car.notes ?? "" });
    setPhotoFiles([]);
    setIsAddOpen(true);
  }

  function openWishInCollection(wish: { carName: string; series: string; targetPrice: string; notes: string }) {
    setEditingCarId(null);
    setPhotoFiles([]);
    setForm({ ...emptyCarForm, name: wish.carName, series: wish.series, purchasePrice: wish.targetPrice, notes: wish.notes });
    setActivePage("My Garage");
    setIsAddOpen(true);
    notify("Wishlist details loaded. Confirm the casting information before adding.");
  }

  async function createCar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validated = carInputSchema.safeParse(form);
    if (!validated.success) {
      notify(validated.error.issues[0]?.message ?? "Check the car details and try again.");
      return;
    }
    setIsSaving(true);
    const values = validated.data;
    const previousCar = editingCarId ? cars.find((car) => car.id === editingCarId) : undefined;
    const newCar: CollectionCar = {
      id: previousCar?.id ?? crypto.randomUUID(),
      name: values.name,
      series: values.series,
      manufacturer: values.manufacturer || "Unknown",
      modelYear: values.modelYear,
      collectorNumber: values.collectorNumber || "—",
      color: values.color || "Unspecified",
      barcode: values.barcode,
      quantity: values.quantity,
      purchasePrice: Number(values.purchasePrice) || 0,
      purchaseDate: values.purchaseDate || undefined,
      purchaseLocation: values.purchaseLocation || undefined,
      condition: values.condition,
      notes: values.notes || undefined,
      isFavorite: values.isFavorite,
      isTreasureHunt: values.isTreasureHunt,
      isSuperTreasureHunt: values.isSuperTreasureHunt,
      addedAt: previousCar?.addedAt ?? new Date().toISOString().slice(0, 10),
      imageTone: "cobalt",
      imageUrl: previousCar?.imageUrl,
    };
    const possibleDuplicate = cars.find((car) => car.id !== previousCar?.id && mayBeDuplicate(car, values));
    if (possibleDuplicate) {
      setDuplicateCandidate(possibleDuplicate);
      setPendingCar(newCar);
      setIsSaving(false);
      return;
    }
    await persistCar(newCar, values);
  }

  async function persistCar(newCar: CollectionCar, values: ReturnType<typeof carInputSchema.parse>) {
    setIsSaving(true);
    if (supabase) {
      const { data: savedSeries, error: seriesError } = await supabase.from("series").upsert({ name: values.series }, { onConflict: "user_id,name" }).select("id").single();
      if (seriesError || !savedSeries) {
        setIsSaving(false);
        if (seriesError?.code === "42P01" || seriesError?.code === "PGRST205") {
          notify("Supabase is missing the series table. Apply the project migration in SQL Editor, then retry.");
        } else if (seriesError?.code === "42501") {
          notify("Supabase denied access to series. Check the series RLS policy and your signed-in session.");
        } else {
          notify(`Could not save the series (${seriesError?.code || "no row returned"}). Check Supabase setup, then retry.`);
        }
        return;
      }
      const carValues = {
        series_id: savedSeries.id,
        name: values.name,
        manufacturer: values.manufacturer || null,
        model_year: values.modelYear,
        collector_number: values.collectorNumber || null,
        color: values.color || null,
        barcode: values.barcode || null,
        quantity: values.quantity,
        purchase_price: values.purchasePrice === "" ? null : Number(values.purchasePrice),
        purchase_date: values.purchaseDate || null,
        purchase_location: values.purchaseLocation || null,
        condition: values.condition,
        notes: values.notes || null,
        is_favorite: values.isFavorite,
        is_treasure_hunt: values.isTreasureHunt,
        is_super_treasure_hunt: values.isSuperTreasureHunt,
      };
      if (editingCarId) {
        const { error: saveError } = await supabase.from("cars").update(carValues).eq("id", editingCarId);
        if (saveError) {
          setIsSaving(false);
          notify("Car could not be updated. Check your connection and try again.");
          return;
        }
      } else {
        const { data: savedCar, error: saveError } = await supabase.from("cars").insert(carValues).select("id").single();
        if (saveError) {
          setIsSaving(false);
          notify("Car could not be saved. Check your connection and try again.");
          return;
        }
        newCar.id = savedCar.id;
      }
    }

    const pendingPhotos = [...photoFiles];
    const uploadUserId = session?.user.id;
    const isEditing = Boolean(editingCarId);
    const previousImageUrl = editingCarId ? cars.find((car) => car.id === editingCarId)?.imageUrl : undefined;
    const localImagePreview = supabase && pendingPhotos.length ? URL.createObjectURL(pendingPhotos[0]) : undefined;
    if (localImagePreview) newCar.imageUrl = localImagePreview;
    setCars((current) => editingCarId ? current.map((car) => car.id === editingCarId ? newCar : car) : [newCar, ...current]);
    setIsAddOpen(false);
    setActivePage("My Garage");
    setIsSaving(false);
    setPhotoFiles([]);
    setEditingCarId(null);
    notify(supabase ? editingCarId ? "Car details updated" : "Car saved to your garage" : editingCarId ? "Preview car updated" : "Added to your preview garage");

    if (supabase && pendingPhotos.length && uploadUserId && localImagePreview) {
      void uploadCarPhotos(newCar.id, pendingPhotos, uploadUserId, isEditing, localImagePreview, previousImageUrl);
    } else if (localImagePreview) {
      URL.revokeObjectURL(localImagePreview);
    }
  }

  async function uploadCarPhotos(carId: string, files: File[], userId: string, isEditing: boolean, localImagePreview: string, previousImageUrl?: string) {
    if (!supabase) return;
    const uploadedPaths: string[] = [];
    let imageRowsCreated = false;
    const newImagePaths: string[] = [];
    try {
      const compressedFiles = await Promise.all(files.map((file) => compressCollectionImage(file)));
      const results = await Promise.all(compressedFiles.map(async (file, index) => {
        const storagePath = `${userId}/cars/${carId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from("diecast-images").upload(storagePath, file, { contentType: "image/jpeg", upsert: false });
        return { storagePath, isPrimary: index === 0, error };
      }));
      uploadedPaths.push(...results.filter((result) => !result.error).map((result) => result.storagePath));
      const failedUpload = results.find((result) => result.error);
      if (failedUpload?.error) throw failedUpload.error;

      const imageRows = results.map(({ storagePath, isPrimary }) => ({ car_id: carId, storage_path: storagePath, is_primary: isPrimary }));
      const { error: rowError } = await supabase.from("car_images").insert(imageRows);
      if (rowError) throw rowError;
      imageRowsCreated = true;
      newImagePaths.push(...imageRows.map((row) => row.storage_path));

      if (isEditing) {
        const { error } = await supabase.from("car_images").update({ is_primary: false }).eq("car_id", carId).neq("storage_path", imageRows[0].storage_path);
        if (error) throw error;
      }

      const { data: signedImage, error: signedUrlError } = await supabase.storage.from("diecast-images").createSignedUrl(imageRows[0].storage_path, 3600);
      if (signedUrlError) throw signedUrlError;
      if (!signedImage?.signedUrl) throw new Error("Storage did not return an image URL.");
      setCars((current) => current.map((car) => car.id === carId ? { ...car, imageUrl: signedImage.signedUrl } : car));
      URL.revokeObjectURL(localImagePreview);
      notify("Car photos added");
    } catch (imageError) {
      if (imageRowsCreated) await supabase.from("car_images").delete().in("storage_path", newImagePaths);
      if (uploadedPaths.length) await supabase.storage.from("diecast-images").remove(uploadedPaths);
      setCars((current) => current.map((car) => car.id === carId ? { ...car, imageUrl: previousImageUrl } : car));
      URL.revokeObjectURL(localImagePreview);
      notify(imageError instanceof Error ? `Car saved, but its photo could not be uploaded: ${imageError.message}` : "Car saved, but its photos could not be uploaded.");
    }
  }

  async function confirmSeparateEntry() {
    if (!pendingCar) return;
    const validated = carInputSchema.parse(form);
    setDuplicateCandidate(null);
    await persistCar(pendingCar, validated);
    setPendingCar(null);
  }

  function dismissDuplicate() {
    setDuplicateCandidate(null);
    setPendingCar(null);
  }

  async function addDuplicateQuantity() {
    if (!duplicateCandidate || !pendingCar) return;
    const increment = pendingCar.quantity;
    dismissDuplicate();
    await changeQuantity(duplicateCandidate.id, increment);
    setIsAddOpen(false);
  }

  async function toggleFavorite(carId: string) {
    const car = cars.find((item) => item.id === carId);
    if (!car) return;
    const nextValue = !car.isFavorite;
    setCars((current) => current.map((item) => item.id === carId ? { ...item, isFavorite: nextValue } : item));
    if (supabase) {
      const { error } = await supabase.from("cars").update({ is_favorite: nextValue }).eq("id", carId);
      if (error) {
        setCars((current) => current.map((item) => item.id === carId ? { ...item, isFavorite: !nextValue } : item));
        notify("Favourite could not be updated.");
      }
    }
  }

  async function changeQuantity(carId: string, delta: number) {
    const car = cars.find((item) => item.id === carId);
    if (!car) return;
    const nextQuantity = Math.max(1, car.quantity + delta);
    setCars((current) => current.map((item) => item.id === carId ? { ...item, quantity: nextQuantity } : item));
    if (supabase) {
      const { error } = await supabase.from("cars").update({ quantity: nextQuantity }).eq("id", carId);
      if (error) {
        setCars((current) => current.map((item) => item.id === carId ? { ...item, quantity: car.quantity } : item));
        notify("Quantity could not be updated.");
      }
    }
  }

  async function removeCar(carId: string) {
    const car = cars.find((item) => item.id === carId);
    if (!car || !window.confirm(`Remove ${car.name} from your garage? This will soft-delete the record.`)) return;
    if (supabase) {
      const { error } = await supabase.from("cars").update({ deleted_at: new Date().toISOString() }).eq("id", carId);
      if (error) {
        notify("Car could not be removed. Please try again.");
        return;
      }
    }
    setCars((current) => current.filter((car) => car.id !== carId));
    notify(supabase ? "Car moved out of your active garage" : "Removed from this preview session");
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) notify("Could not sign out. Please try again.");
    else setIsAccountOpen(false);
  }

  function selectPage(page: NavigationItem) {
    setActivePage(page);
    setIsMobileMenuOpen(false);
  }

  const pageTitle = activePage === "Overview" ? "Your collection, in focus." : activePage;

  if (supabase && !authReady) return <main className="auth-loading"><span className="brand-mark"><Gauge size={22} /></span><span>Opening your vault...</span></main>;
  if (supabase && authReady && !session) return <AuthGate client={supabase} />;

  return (
    <div className="vault-shell">
      <aside className={`sidebar ${isMobileMenuOpen ? "sidebar-open" : ""}`}>
        <a className="brand-lockup" href="#overview" onClick={() => selectPage("Overview")} aria-label="Diecast Vault home">
          <span className="brand-mark"><Gauge size={22} strokeWidth={2.2} /></span>
          <span className="brand-type">DIECAST<span>VAULT</span></span>
        </a>
        <div className="workspace-switcher">
          <span className="workspace-avatar">DV</span>
          <span><strong>My collection</strong><small>Personal vault</small></span>
          <ChevronDown size={15} />
        </div>
        <span className="nav-caption">COLLECTION</span>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} onClick={() => selectPage(label)} className={`nav-link ${activePage === label ? "active" : ""}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {label === "My Garage" && <span className="nav-count">{totalUnits}</span>}
            </button>
          ))}
        </nav>
        <span className="nav-caption tools-caption">TOOLS</span>
        <button className="nav-link" onClick={() => openScanner()}><Command size={18} strokeWidth={1.8} /><span>Scan a car</span><span className="shortcut">⌘ K</span></button>
        <button className={`nav-link ${activePage === "Series" ? "active" : ""}`} onClick={() => selectPage("Series")}><Tag size={18} strokeWidth={1.8} /><span>Series library</span></button>
        <button className="nav-link" onClick={() => notify("Settings will be available when your vault is connected")}><Settings2 size={18} strokeWidth={1.8} /><span>Settings</span></button>
        <div className="sidebar-bottom">
          <div className="vault-status"><span className="status-dot" /><span><b>{supabase ? "Private vault" : "Preview mode"}</b><small>{supabase ? "Synced to your account" : "Changes are session only"}</small></span></div>
          <button className="profile-row" onClick={() => supabase ? setIsAccountOpen((open) => !open) : notify("Add Supabase credentials to enable your account")}>
            <span className="profile-avatar">{(session?.user.user_metadata.display_name ?? session?.user.email ?? "SC").slice(0, 2).toUpperCase()}</span><span><b>{session?.user.user_metadata.display_name ?? "Collector"}</b><small>{session?.user.email ?? "Local preview"}</small></span><MoreHorizontal size={19} />
          </button>
        </div>
      </aside>

      {isMobileMenuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setIsMobileMenuOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" aria-label="Open navigation" onClick={() => setIsMobileMenuOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>VAULT</span><span className="breadcrumb-slash">/</span><strong>{activePage.toUpperCase()}</strong></div>
          <div className="topbar-actions">
            <label className="global-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your collection" aria-label="Search your collection" /><kbd>⌘ K</kbd></label>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => notify("You’re all caught up")}><Bell size={18} /><i /></button>
            <button className="topbar-avatar" aria-label="Open account" aria-expanded={isAccountOpen} onClick={() => supabase ? setIsAccountOpen((open) => !open) : notify("Connect Supabase to enable your profile")}>{(session?.user.user_metadata.display_name ?? session?.user.email ?? "SC").slice(0, 2).toUpperCase()}</button>
            <button className="button button-primary top-add" onClick={() => openAddCar()}><Plus size={16} /> Add car</button>
          </div>
        </header>

        <div className="mobile-title-row">
          <div><p className="eyebrow">MONDAY, NOVEMBER 02, 2026</p><h1>{pageTitle}</h1></div>
          <button className="icon-button mobile-search-button" aria-label="Search collection" onClick={() => document.querySelector<HTMLInputElement>(".global-search input")?.focus()}><Search size={19} /></button>
        </div>

        {activePage === "Overview" && (
          <section className="page-content dashboard-content">
            <div className="preview-notice"><span className="notice-indicator" /><span><strong>{supabase ? "Connected vault" : "Preview workspace"}</strong> &nbsp;{supabase ? "Your collection is saved to your private account." : "Examples and edits are temporary until Supabase is connected."}</span><button onClick={() => notify(supabase ? "Your data is protected by Supabase row-level security" : "See Supabase setup in the project README")} aria-label="About vault status"><CircleHelp size={15} /></button></div>
            <section className="welcome-panel">
              <div className="welcome-copy">
                <span className="eyebrow eyebrow-red"><span className="eyebrow-rule" /> THE COLLECTOR’S GARAGE</span>
                <h2>Every casting<br />has a <em>story.</em></h2>
                <p>Your collection. Your passion. Your vault.</p>
                <div className="welcome-actions"><button className="button button-primary" onClick={() => selectPage("My Garage")}>Explore my garage <ArrowRight size={16} /></button><button className="text-action" onClick={() => openScanner()}><Command size={15} /> Scan a barcode</button></div>
              </div>
              <div className="hero-art" aria-label="Illustration of a collectible diecast car">
                <div className="hero-grid" /><div className="hero-track-line" /><div className="hero-glow" />
                <div className="hero-edition"><span>GARAGE EDITION</span><b>01<span>/</span>26</b></div>
                <div className="hero-car car-vermilion"><div className="car-wing" /><div className="car-roof" /><div className="car-window" /><div className="car-body" /><div className="car-front" /><div className="car-wheel wheel-left" /><div className="car-wheel wheel-right" /><div className="car-stripe" /></div>
                <div className="hero-spec"><span>COLLECTOR’S PICK</span><b>1969 / CHARGER 500</b></div>
                <span className="hero-index">DV—001</span>
              </div>
            </section>

            <div className="section-heading stats-heading"><div><span className="eyebrow">AT A GLANCE</span><h2>Your vault, quantified</h2></div><span className="section-date"><Clock3 size={14} /> Updated just now</span></div>
            <section className="stats-grid" aria-label="Collection statistics">
              <StatCard label="Total cars" value={totalUnits.toLocaleString()} sub={`${uniqueModels} unique castings`} icon={<CarFront size={17} />} accent="red" />
              <StatCard label="Unique models" value={uniqueModels.toLocaleString()} sub="Across your collection" icon={<Grid2X2 size={17} />} accent="blue" />
              <StatCard label="Duplicates" value={duplicateUnits.toLocaleString()} sub="Extra castings" icon={<CopyIcon />} accent="yellow" />
              <StatCard label="Series" value={seriesCount.toLocaleString()} sub="Lines in your library" icon={<Tag size={17} />} accent="green" />
              <StatCard label="Treasure Hunts" value={cars.filter((car) => car.isTreasureHunt && !car.isSuperTreasureHunt).length.toLocaleString()} sub="Regular TH castings" icon={<Trophy size={17} />} accent="yellow" />
              <StatCard label="Super Treasure Hunts" value={superTreasureCount.toLocaleString()} sub="Super TH castings" icon={<Star size={17} />} accent="red" />
              <StatCard label="Recorded spend" value={`$${recordedSpend.toFixed(2)}`} sub="Purchase price only · CAD" icon={<Activity size={17} />} accent="green" />
              <StatCard label="Wishlist" value={wishlistCount.toLocaleString()} sub="Castings you’re chasing" icon={<Heart size={17} />} accent="blue" />
            </section>

            <section className="collection-section">
              <div className="section-heading collection-heading"><div><span className="eyebrow">FRESH FROM THE BLISTER</span><h2>Recently added</h2></div><button className="text-action view-all" onClick={() => selectPage("My Garage")}>View all <ArrowRight size={15} /></button></div>
              {cars.length ? <CarGrid cars={[...cars].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, 4)} onFavorite={toggleFavorite} onQuantity={changeQuantity} onRemove={removeCar} onEdit={openEditCar} /> : <div className="empty-state dashboard-empty"><span><CarFront size={22} /></span><h3>Your garage is ready.</h3><p>Add the first casting and start building your collection.</p><button className="button button-primary" onClick={() => openAddCar()}><Plus size={15} /> Add your first car</button></div>}
            </section>
            <div className="bottom-insight-row">
              <section className="series-panel"><div className="panel-heading"><div><span className="eyebrow">COLLECTION MIX</span><h2>Series breakdown</h2></div><button className="icon-button small-icon" aria-label="Series options"><MoreHorizontal size={19} /></button></div><SeriesBars cars={cars} /></section>
              <section className="hunt-panel"><div className="panel-heading"><div><span className="eyebrow">HARD TO FIND</span><h2>Treasure shelf</h2></div><span className="hunt-icon"><Trophy size={18} /></span></div><div className="hunt-count"><strong>{treasureCount.toString().padStart(2, "0")}</strong><span>rare finds in your vault</span></div><div className="hunt-progress"><span style={{ width: `${Math.min(100, treasureCount * 18)}%` }} /></div><div className="hunt-footer"><span>{cars.filter((car) => car.isSuperTreasureHunt).length} Super Treasure Hunts</span><button className="text-action" onClick={() => selectPage("My Garage")}>See all <ArrowRight size={14} /></button></div></section>
            </div>
            <footer className="page-footer"><span>Designed and developed by Saroop S Kesav</span><span>Diecast Vault <i>·</i> © SK Inc. {new Date().getFullYear()}</span></footer>
          </section>
        )}

        {activePage === "My Garage" && (
          <section className="page-content garage-content">
            <div className="preview-notice"><span className="notice-indicator" /><span><strong>{supabase ? "Connected vault" : "Preview workspace"}</strong> &nbsp;{supabase ? "Changes are saved to your private collection." : "Changes stay in this session and are not saved to a database."}</span><button onClick={() => notify(supabase ? "Your data is protected by Supabase row-level security" : "See Supabase setup in the project README")} aria-label="About vault status"><CircleHelp size={15} /></button></div>
            <div className="garage-intro"><div><span className="eyebrow">YOUR PRIVATE SHOWROOM</span><h2>My Garage <span>{totalUnits}</span></h2><p>{uniqueModels} castings on the shelf · ${recordedSpend.toFixed(2)} recorded purchase value</p></div><button className="button button-primary" onClick={() => openAddCar()}><Plus size={16} /> Add to garage</button></div>
            <div className="garage-toolbar"><label className="garage-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a casting, series, barcode..." aria-label="Filter collection" />{query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}</label><label className="filter-select"><SlidersHorizontal size={15} /><select value={seriesFilter} onChange={(event) => setSeriesFilter(event.target.value)} aria-label="Filter by series">{seriesOptions.map((series) => <option key={series}>{series}</option>)}</select><ChevronDown size={13} /></label><button className={`icon-button view-toggle ${!isListView ? "selected" : ""}`} aria-label="Grid view" onClick={() => setIsListView(false)}><Grid2X2 size={17} /></button><button className={`icon-button view-toggle ${isListView ? "selected" : ""}`} aria-label="List view" onClick={() => setIsListView(true)}><List size={18} /></button><div className="garage-advanced-filters"><label className="filter-select"><select value={manufacturerFilter} onChange={(event) => setManufacturerFilter(event.target.value)} aria-label="Filter by manufacturer">{manufacturerOptions.map((manufacturer) => <option key={manufacturer}>{manufacturer}</option>)}</select><ChevronDown size={13} /></label><label className="filter-select"><select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} aria-label="Filter by model year">{yearOptions.map((year) => <option key={year}>{year}</option>)}</select><ChevronDown size={13} /></label><label className="filter-select"><select value={colorFilter} onChange={(event) => setColorFilter(event.target.value)} aria-label="Filter by colour">{colorOptions.map((color) => <option key={color}>{color}</option>)}</select><ChevronDown size={13} /></label><label className="filter-select"><select value={conditionFilter} onChange={(event) => setConditionFilter(event.target.value)} aria-label="Filter by condition">{["All conditions", "Carded", "Loose", "Mint", "Opened", "Damaged"].map((condition) => <option key={condition}>{condition}</option>)}</select><ChevronDown size={13} /></label><button className={`filter-chip ${favoritesOnly ? "active" : ""}`} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)}><Heart size={13} /> Favourites</button><button className={`filter-chip ${duplicatesOnly ? "active" : ""}`} aria-pressed={duplicatesOnly} onClick={() => setDuplicatesOnly((value) => !value)}>Duplicates</button><button className={`filter-chip ${treasureOnly ? "active" : ""}`} aria-pressed={treasureOnly} onClick={() => setTreasureOnly((value) => !value)}>TH / STH</button></div><label className="sort-select"><ArrowDownUp size={14} /><select value={sortMode} onChange={(event) => setSortMode(event.target.value)} aria-label="Sort collection">{["Recently added", "Oldest added", "Name A–Z", "Name Z–A", "Model year", "Purchase price", "Quantity"].map((sort) => <option key={sort}>{sort}</option>)}</select></label></div>
            <p className="results-line">SHOWING <b>{sortedCars.length}</b> OF <b>{cars.length}</b> CASTINGS</p>
            {sortedCars.length ? <CarGrid cars={sortedCars} isListView={isListView} onFavorite={toggleFavorite} onQuantity={changeQuantity} onRemove={removeCar} onEdit={openEditCar} /> : <div className="empty-state"><span><Search size={22} /></span><h3>No castings found</h3><p>Try a different search or clear the active filters.</p><button className="text-action" onClick={() => { setQuery(""); setSeriesFilter("All series"); setManufacturerFilter("All manufacturers"); setYearFilter("All years"); setColorFilter("All colours"); setConditionFilter("All conditions"); setFavoritesOnly(false); setDuplicatesOnly(false); setTreasureOnly(false); }}>Clear filters <X size={14} /></button></div>}
          </section>
        )}

        {activePage === "Wishlist" && <WishlistView client={supabase} onNotify={notify} onMove={openWishInCollection} />}
        {activePage === "Analytics" && <AnalyticsView cars={cars} />}
        {activePage === "Series" && <SeriesManager client={supabase} onNotify={notify} />}
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <button className={activePage === "Overview" ? "mobile-active" : ""} onClick={() => selectPage("Overview")}><LayoutDashboard size={19} /><span>Home</span></button>
        <button className={activePage === "My Garage" ? "mobile-active" : ""} onClick={() => selectPage("My Garage")}><CarFront size={19} /><span>Garage</span></button>
        <button className="mobile-scan-action" onClick={() => openScanner()} aria-label="Scan a barcode"><span><Command size={20} /></span><small>Scan</small></button>
        <button className={activePage === "Wishlist" ? "mobile-active" : ""} onClick={() => selectPage("Wishlist")}><Heart size={19} /><span>Wishlist</span></button>
        <button onClick={supabase ? () => setIsAccountOpen(true) : () => notify("Connect Supabase to enable your profile")}><span className="mobile-profile">{(session?.user.email ?? "SC").slice(0, 2).toUpperCase()}</span><span>Profile</span></button>
      </nav>

      <AnimatePresence>
        {isAccountOpen && session && <motion.div className="account-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setIsAccountOpen(false); }}><motion.section className="account-panel" role="dialog" aria-modal="true" aria-labelledby="account-title" initial={{ opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5 }}><button className="icon-button account-close" aria-label="Close account panel" onClick={() => setIsAccountOpen(false)}><X size={17} /></button><span className="account-avatar">{(session.user.user_metadata.display_name ?? session.user.email ?? "SC").slice(0, 2).toUpperCase()}</span><span className="eyebrow">YOUR ACCOUNT</span><h2 id="account-title">{session.user.user_metadata.display_name ?? "Collector"}</h2><p>{session.user.email}</p><div className="account-security"><span className="status-dot" /> Private collection connected</div><button className="button button-quiet account-signout" onClick={() => void signOut()}><LogOut size={15} /> Sign out</button></motion.section></motion.div>}
        {isAddOpen && <AddCarModal form={form} setForm={setForm} photos={photoFiles} setPhotos={setPhotoFiles} saving={isSaving} editing={Boolean(editingCarId)} onScanBarcode={() => openScanner(true)} onClose={() => setIsAddOpen(false)} onSubmit={createCar} />}
        {duplicateCandidate && pendingCar && <DuplicateModal car={duplicateCandidate} pendingCar={pendingCar} onClose={dismissDuplicate} onAddQuantity={addDuplicateQuantity} onAddSeparate={confirmSeparateEntry} />}
        {isScannerOpen && <ScannerModal onClose={() => { setIsScannerOpen(false); setScanIntoCarForm(false); }} onDetected={handleBarcodeDetected} />}
      </AnimatePresence>
      <AnimatePresence>{toast && <motion.div className="toast-message" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><Check size={16} /> {toast}</motion.div>}</AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, sub, icon, accent }: { label: string; value: string; sub: string; icon: React.ReactNode; accent: string }) {
  return <motion.article className={`stat-card accent-${accent}`} whileHover={useReducedMotion() ? undefined : { y: -3 }} transition={{ duration: 0.18 }}><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong>{value}</strong><small>{sub}</small><span className="stat-corner" /></motion.article>;
}

function CarGrid({ cars, isListView = false, onFavorite, onQuantity, onRemove, onEdit }: { cars: CollectionCar[]; isListView?: boolean; onFavorite: (id: string) => void; onQuantity: (id: string, delta: number) => void; onRemove: (id: string) => void; onEdit: (car: CollectionCar) => void }) {
  const reduceMotion = useReducedMotion();
  return <div className={`car-grid ${isListView ? "car-list-view" : ""}`}>{cars.map((car, index) => <motion.article className="car-card" key={car.id} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(index * 0.035, 0.2) }}>
    <div className={`car-visual tone-${car.imageTone}`}><span className="visual-grain" />{car.imageUrl ? <span className="car-photo" role="img" aria-label={`${car.name} photo`} style={{ backgroundImage: `url("${car.imageUrl}")` }} /> : <><span className="visual-mark">HOT WHEELS <i>®</i></span><div className="mini-car"><div className="mini-roof" /><div className="mini-window" /><div className="mini-body" /><div className="mini-nose" /><div className="mini-wheel mini-left" /><div className="mini-wheel mini-right" /><div className="mini-flame" /></div></>}<span className="visual-number">{car.collectorNumber}</span>{car.isSuperTreasureHunt && <span className="hunt-badge super">$TH</span>}{car.isTreasureHunt && <span className="hunt-badge">TH</span>}<button className={`favorite-button ${car.isFavorite ? "is-favorite" : ""}`} aria-label={car.isFavorite ? "Remove from favourites" : "Add to favourites"} onClick={() => onFavorite(car.id)}><Heart size={16} fill={car.isFavorite ? "currentColor" : "none"} /></button><span className="quantity-badge">× {car.quantity}</span></div>
    <div className="car-card-body"><div className="car-card-heading"><span className="car-series">{car.series}</span><div className="card-actions"><button className="card-menu" aria-label={`Edit ${car.name}`} onClick={() => onEdit(car)}><Pencil size={14} /></button><button className="card-menu delete-card-button" aria-label={`Delete ${car.name}`} title={`Delete ${car.name}`} onClick={() => onRemove(car.id)}><Trash2 size={16} /></button></div></div><h3>{car.name}</h3><div className="car-meta"><span>{car.modelYear}</span><i /> <span>{car.collectorNumber}</span><i /> <span>{car.condition}</span></div><div className="car-card-footer"><span className="car-price">${car.purchasePrice.toFixed(2)} <small>each</small></span><div className="quantity-control"><button onClick={() => onQuantity(car.id, -1)} aria-label="Decrease quantity">−</button><span>{car.quantity}</span><button onClick={() => onQuantity(car.id, 1)} aria-label="Increase quantity">+</button></div></div></div>
  </motion.article>)}</div>;
}

function SeriesBars({ cars }: { cars: CollectionCar[] }) {
  const totals = cars.reduce<Record<string, number>>((acc, car) => { acc[car.series] = (acc[car.series] ?? 0) + car.quantity; return acc; }, {});
  const series = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const colors = ["#fb593e", "#41a8d7", "#c2cf4b", "#46a987"];
  return <div className="series-bars">{series.map(([name, count], index) => <div className="series-row" key={name}><span className="series-dot" style={{ backgroundColor: colors[index] }} /><span className="series-name">{name}</span><div className="series-bar-track"><span style={{ width: `${(count / Math.max(...series.map((item) => item[1]))) * 100}%`, backgroundColor: colors[index] }} /></div><b>{count}</b></div>)}</div>;
}

function DuplicateModal({ car, pendingCar, onClose, onAddQuantity, onAddSeparate }: { car: CollectionCar; pendingCar: CollectionCar; onClose: () => void; onAddQuantity: () => void; onAddSeparate: () => void }) {
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section className="duplicate-modal" role="dialog" aria-modal="true" aria-labelledby="duplicate-title" initial={{ opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}><span className="duplicate-icon"><ShieldCheck size={21} /></span><span className="eyebrow">COLLECTION CHECK</span><h2 id="duplicate-title">This car may already be in your collection.</h2><p>We found a similar casting. Barcodes and collector numbers can be shared, so the final call is yours.</p><div className="duplicate-match"><strong>{car.name}</strong><span>{car.series} · {car.modelYear} · #{car.collectorNumber}</span><small>Current quantity: {car.quantity} &nbsp;·&nbsp; Adding: {pendingCar.quantity}</small></div><div className="duplicate-actions"><button className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-quiet" onClick={onAddSeparate}>Add separate entry</button><button className="button button-primary" onClick={onAddQuantity}>Increase quantity</button></div></motion.section></motion.div>;
}

function AddCarModal({ form, setForm, photos, setPhotos, saving, editing, onScanBarcode, onClose, onSubmit }: { form: CarFormState; setForm: React.Dispatch<React.SetStateAction<CarFormState>>; photos: File[]; setPhotos: React.Dispatch<React.SetStateAction<File[]>>; saving: boolean; editing: boolean; onScanBarcode: () => void; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void> }) {
  const [photoError, setPhotoError] = useState("");
  const photoPreviews = useMemo(() => photos.map((photo) => URL.createObjectURL(photo)), [photos]);
  useEffect(() => () => photoPreviews.forEach((url) => URL.revokeObjectURL(url)), [photoPreviews]);
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><motion.section className="add-modal" role="dialog" aria-modal="true" aria-labelledby="add-car-title" initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.99 }} transition={{ duration: 0.2 }}>
    <div className="modal-header"><div><span className="eyebrow">{editing ? "EDIT CASTING" : "NEW CASTING"}</span><h2 id="add-car-title">{editing ? "Update your vault" : "Add to your vault"}</h2><p>{editing ? "Keep your collection details current." : "Record the details while they’re fresh."}</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
    <form onSubmit={onSubmit} className="add-car-form"><div className="photo-upload"><label className="upload-dropzone"><input type="file" accept="image/*" capture="environment" multiple onChange={(event) => { const selected = Array.from(event.target.files ?? []); if (selected.length > 5) { setPhotoError("Choose up to five photos."); return; } if (selected.some((file) => !file.type.startsWith("image/") || file.size > 8 * 1024 * 1024)) { setPhotoError("Each photo must be an image smaller than 8 MB."); return; } setPhotoError(""); setPhotos(selected); }} /><span><ImagePlus size={21} /></span><strong>{photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"} selected` : "Take a photo"}</strong><small>Use camera or choose up to five</small></label><div className="upload-guidance"><Upload size={15} /><span>{photoError || (photos.length ? "Photos resize before private upload. First image becomes the primary photo." : "Images are compressed and stored in your private vault when connected.")}</span></div>{photoPreviews.length > 0 && <div className="photo-preview-strip">{photoPreviews.map((url, index) => <div className="photo-preview" key={url}><span className="photo-preview-image" role="img" aria-label={`Selected car photo ${index + 1}`} style={{ backgroundImage: `url("${url}")` }} /><button type="button" onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} aria-label={`Remove photo ${index + 1}`}><X size={12} /></button></div>)}</div>}</div>
      <div className="form-section-title"><span>01</span><b>IDENTIFICATION</b></div><label className="form-field full-field"><span>Car name <i>*</i></span><input autoFocus required maxLength={120} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. '69 Dodge Charger 500" /></label><div className="form-grid"><label className="form-field"><span>Series <i>*</i></span><input required maxLength={80} value={form.series} onChange={(event) => setForm((current) => ({ ...current, series: event.target.value }))} placeholder="e.g. HW Muscle Mania" /></label><label className="form-field"><span>Manufacturer</span><input maxLength={80} value={form.manufacturer} onChange={(event) => setForm((current) => ({ ...current, manufacturer: event.target.value }))} placeholder="Dodge" /></label><label className="form-field"><span>Collector number</span><input maxLength={24} value={form.collectorNumber} onChange={(event) => setForm((current) => ({ ...current, collectorNumber: event.target.value }))} placeholder="088/250" /></label><label className="form-field"><span>Model year</span><input type="number" min="1968" max="2100" value={form.modelYear} onChange={(event) => setForm((current) => ({ ...current, modelYear: event.target.value }))} /></label><label className="form-field"><span>Colour</span><input maxLength={60} value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} placeholder="Spectraflame red" /></label><div className="form-field full-field"><span>Barcode <small>Optional · not unique to a casting</small></span><div className="barcode-input-row"><input inputMode="numeric" maxLength={32} value={form.barcode} onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))} placeholder="Scan or enter manually" aria-label="Barcode" /><button type="button" className="button button-quiet barcode-scan-button" onClick={onScanBarcode}><ScanLine size={15} /> Scan barcode</button></div></div></div>
      <div className="form-section-title details-title"><span>02</span><b>IN YOUR COLLECTION</b></div><div className="form-grid"><label className="form-field"><span>Quantity</span><input type="number" min="1" max="9999" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} /></label><label className="form-field"><span>Paid (CAD)</span><input type="number" min="0" step="0.01" value={form.purchasePrice} onChange={(event) => setForm((current) => ({ ...current, purchasePrice: event.target.value }))} placeholder="0.00" /></label><label className="form-field"><span>Purchase date</span><input type="date" value={form.purchaseDate} onChange={(event) => setForm((current) => ({ ...current, purchaseDate: event.target.value }))} /></label><label className="form-field"><span>Purchase location</span><input maxLength={120} value={form.purchaseLocation} onChange={(event) => setForm((current) => ({ ...current, purchaseLocation: event.target.value }))} placeholder="Shop or event" /></label><label className="form-field full-field"><span>Condition</span><select value={form.condition} onChange={(event) => setForm((current) => ({ ...current, condition: event.target.value as CollectionCar["condition"] }))}>{["Carded", "Loose", "Mint", "Opened", "Damaged"].map((condition) => <option key={condition}>{condition}</option>)}</select></label></div><div className="form-flags"><label><input type="checkbox" checked={form.isFavorite} onChange={(event) => setForm((current) => ({ ...current, isFavorite: event.target.checked }))} /><span>Favourite</span></label><label><input type="checkbox" checked={form.isTreasureHunt} onChange={(event) => setForm((current) => ({ ...current, isTreasureHunt: event.target.checked, isSuperTreasureHunt: event.target.checked ? current.isSuperTreasureHunt : false }))} /><span>Treasure Hunt</span></label><label><input type="checkbox" checked={form.isSuperTreasureHunt} onChange={(event) => setForm((current) => ({ ...current, isSuperTreasureHunt: event.target.checked, isTreasureHunt: event.target.checked || current.isTreasureHunt }))} /><span>Super Treasure Hunt</span></label></div><label className="form-field full-field"><span>Notes</span><textarea rows={3} maxLength={1000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="A detail worth remembering..." /></label>
      <div className="modal-footer"><button type="button" className="button button-quiet" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : <><Plus size={16} /> Add casting</>}</button></div>
    </form>
  </motion.section></motion.div>;
}

function CopyIcon() {
  return <span className="copy-icon"><CarFront size={14} /><CarFront size={14} /></span>;
}