"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, Check, Heart, Plus, Tag, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { createClient } from "@/lib/supabase/client";

type Client = ReturnType<typeof createClient>;
type Priority = "Low" | "Medium" | "High" | "Must Have";
type Wish = { id: string; car_name: string; target_price: number | null; priority: Priority; notes: string | null; created_at: string; series: { name: string } | { name: string }[] | null };
type WishDraft = { carName: string; series: string; targetPrice: string; priority: Priority; notes: string };
type SeriesRecord = { id: string; name: string; category: string | null; description: string | null; created_at: string; cars: { count: number }[] };

const priorities: Priority[] = ["Low", "Medium", "High", "Must Have"];
const starterSeries = ["HW J-Imports", "HW Exotics", "HW Dream Garage", "HW Metro", "HW Race Day", "HW Screen Time", "HW Green Speed", "Hot Wheels Premium", "Car Culture", "Boulevard", "Team Transport"];

export function WishlistView({ client, onNotify, onMove }: { client: Client; onNotify: (message: string) => void; onMove: (draft: WishDraft) => void }) {
  const notifyRef = useRef(onNotify);
  const [entries, setEntries] = useState<Wish[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<WishDraft>({ carName: "", series: "", targetPrice: "", priority: "Medium", notes: "" });

  useEffect(() => { notifyRef.current = onNotify; }, [onNotify]);

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.from("wishlist").select("id, car_name, target_price, priority, notes, created_at, series(name)").is("acquired_at", null).order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      if (error) notifyRef.current("Could not load your wishlist. Check the Supabase migration and RLS policies.");
      else setEntries((data ?? []) as unknown as Wish[]);
    });
    return () => { active = false; };
  }, [client]);

  async function addWish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const carName = draft.carName.trim();
    const seriesName = draft.series.trim();
    if (!carName || !seriesName) return;
    setIsSaving(true);
    if (client) {
      let seriesId: string | null = null;
      const { data: series, error: seriesError } = await client.from("series").select("id").eq("name", seriesName).maybeSingle();
      if (seriesError) {
        onNotify("Could not check the series. Please try again.");
        setIsSaving(false);
        return;
      }
      seriesId = series?.id ?? null;
      if (!seriesId) {
        const { data: created, error } = await client.from("series").insert({ name: seriesName }).select("id").single();
        if (error) {
          onNotify("Could not save this series. Please try again.");
          setIsSaving(false);
          return;
        }
        seriesId = created.id;
      }
      const { data, error } = await client.from("wishlist").insert({ car_name: carName, series_id: seriesId, target_price: draft.targetPrice ? Number(draft.targetPrice) : null, priority: draft.priority, notes: draft.notes.trim() || null }).select("id, car_name, target_price, priority, notes, created_at, series(name)").single();
      if (error) {
        onNotify("Wishlist item could not be saved.");
        setIsSaving(false);
        return;
      }
      setEntries((current) => [data as unknown as Wish, ...current]);
    } else {
      setEntries((current) => [{ id: crypto.randomUUID(), car_name: carName, target_price: draft.targetPrice ? Number(draft.targetPrice) : null, priority: draft.priority, notes: draft.notes.trim() || null, created_at: new Date().toISOString(), series: { name: seriesName } }, ...current]);
    }
    setDraft({ carName: "", series: "", targetPrice: "", priority: "Medium", notes: "" });
    setIsOpen(false);
    setIsSaving(false);
    onNotify(client ? "Added to your wishlist" : "Added to this preview wishlist");
  }

  async function removeWish(wish: Wish) {
    if (!window.confirm(`Remove ${wish.car_name} from your wishlist?`)) return;
    if (client) {
      const { error } = await client.from("wishlist").delete().eq("id", wish.id);
      if (error) {
        onNotify("Wishlist item could not be removed.");
        return;
      }
    }
    setEntries((current) => current.filter((entry) => entry.id !== wish.id));
    onNotify(client ? "Removed from your wishlist" : "Removed from this preview wishlist");
  }

  return <section className="page-content library-content">
    <div className="preview-notice"><span className="notice-indicator" /><span><strong>{client ? "Private wishlist" : "Preview workspace"}</strong> &nbsp;{client ? "Saved to your account." : "Wishlist changes are temporary until Supabase is connected."}</span></div>
    <div className="library-intro"><div><span className="eyebrow">THE NEXT ONE</span><h2>Your want list <span>{entries.length}</span></h2><p>Keep track of the castings you’re chasing.</p></div><button className="button button-primary" onClick={() => setIsOpen(true)}><Plus size={16} /> Add a want</button></div>
    {entries.length ? <div className="wishlist-list">{entries.map((wish, index) => {
      const seriesName = Array.isArray(wish.series) ? wish.series[0]?.name : wish.series?.name;
      return <motion.article className="wishlist-row" key={wish.id} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .04, .2) }}><div className="wishlist-thumb"><Heart size={20} /></div><div className="wishlist-details"><span className="eyebrow">{seriesName ?? "UNASSIGNED SERIES"}</span><h3>{wish.car_name}</h3>{wish.notes && <p>{wish.notes}</p>}<span className={`priority priority-${wish.priority.toLowerCase().replace(" ", "-")}`}>{wish.priority}</span></div><div className="wishlist-target"><small>TARGET PRICE</small><b>{wish.target_price === null ? "Not set" : `$${Number(wish.target_price).toFixed(2)}`}</b><span>CAD</span></div><div className="wishlist-actions"><button className="button button-quiet" onClick={() => onMove({ carName: wish.car_name, series: seriesName ?? "", targetPrice: wish.target_price?.toString() ?? "", priority: wish.priority, notes: wish.notes ?? "" })}><Check size={14} /> Move to collection</button><button className="icon-button" onClick={() => void removeWish(wish)} aria-label={`Remove ${wish.car_name}`}><Trash2 size={16} /></button></div></motion.article>;
    })}</div> : <div className="library-empty"><span><Bookmark size={22} /></span><h3>The hunt starts here.</h3><p>Save a casting you’re looking for and keep your target price close.</p><button className="button button-primary" onClick={() => setIsOpen(true)}><Plus size={15} /> Add your first want</button></div>}
    <AnimatePresence>{isOpen && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setIsOpen(false); }}><motion.section className="add-modal wish-modal" role="dialog" aria-modal="true" aria-labelledby="wish-title" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><div className="modal-header"><div><span className="eyebrow">THE CHASE</span><h2 id="wish-title">Add to wishlist</h2><p>Keep the next great find on your radar.</p></div><button className="icon-button" onClick={() => setIsOpen(false)} aria-label="Close"><X size={19} /></button></div><form className="add-car-form" onSubmit={addWish}><div className="form-grid"><label className="form-field full-field"><span>Car name <i>*</i></span><input required maxLength={120} value={draft.carName} onChange={(event) => setDraft((current) => ({ ...current, carName: event.target.value }))} placeholder="e.g. '67 Camaro" /></label><label className="form-field"><span>Series <i>*</i></span><input required maxLength={80} value={draft.series} onChange={(event) => setDraft((current) => ({ ...current, series: event.target.value }))} placeholder="e.g. Car Culture" /></label><label className="form-field"><span>Target price (CAD)</span><input type="number" min="0" step="0.01" value={draft.targetPrice} onChange={(event) => setDraft((current) => ({ ...current, targetPrice: event.target.value }))} placeholder="0.00" /></label><label className="form-field"><span>Priority</span><select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as Priority }))}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label><label className="form-field"><span>Notes</span><input maxLength={500} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Variant, seller, where you spotted it..." /></label></div><div className="modal-footer"><button type="button" className="button button-quiet" onClick={() => setIsOpen(false)}>Cancel</button><button className="button button-primary" disabled={isSaving}>{isSaving ? "Saving..." : <><Plus size={15} /> Save want</>}</button></div></form></motion.section></motion.div>}</AnimatePresence>
  </section>;
}

export function SeriesManager({ client, onNotify }: { client: Client; onNotify: (message: string) => void }) {
  const notifyRef = useRef(onNotify);
  const [series, setSeries] = useState<SeriesRecord[]>(() => client ? [] : starterSeries.map((name, index) => ({ id: `preview-${index}`, name, category: index < 7 ? "Mainline" : "Premium", description: null, created_at: "", cars: [{ count: 0 }] })));
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Mainline");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");

  useEffect(() => { notifyRef.current = onNotify; }, [onNotify]);

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.from("series").select("id, name, category, description, created_at, cars(count)").order("name").then(({ data, error }) => {
      if (!active) return;
      if (error) notifyRef.current("Could not load series. Check your Supabase migration and RLS policies.");
      else setSeries((data ?? []) as unknown as SeriesRecord[]);
    });
    return () => { active = false; };
  }, [client]);

  async function addSeries(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (client) {
      const { data, error } = await client.from("series").insert({ name, category: newCategory }).select("id, name, category, description, created_at, cars(count)").single();
      if (error) {
        onNotify(error.code === "23505" ? "That series already exists." : "Could not add that series.");
        return;
      }
      setSeries((current) => [...current, data as unknown as SeriesRecord[]].flat().sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      setSeries((current) => current.some((item) => item.name.toLowerCase() === name.toLowerCase()) ? current : [...current, { id: crypto.randomUUID(), name, category: newCategory, description: null, created_at: new Date().toISOString(), cars: [{ count: 0 }] }].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setNewName("");
    onNotify(client ? "Series added to your library" : "Series added to this preview session");
  }

  async function saveEdit(item: SeriesRecord) {
    const name = editingName.trim();
    if (!name || name === item.name) { setEditingId(""); return; }
    if (client) {
      const { error } = await client.from("series").update({ name }).eq("id", item.id);
      if (error) { onNotify(error.code === "23505" ? "A series with that name already exists." : "Could not update the series."); return; }
    }
    setSeries((current) => current.map((entry) => entry.id === item.id ? { ...entry, name } : entry).sort((a, b) => a.name.localeCompare(b.name)));
    setEditingId("");
    onNotify("Series name updated");
  }

  async function deleteSeries(item: SeriesRecord) {
    const count = item.cars?.[0]?.count ?? 0;
    if (count) { onNotify(`This series is used by ${count} car${count === 1 ? "" : "s"} and cannot be deleted.`); return; }
    if (!window.confirm(`Delete the unused series “${item.name}”?`)) return;
    if (client) {
      const { error } = await client.from("series").delete().eq("id", item.id);
      if (error) { onNotify("This series could not be deleted. It may still be in use."); return; }
    }
    setSeries((current) => current.filter((entry) => entry.id !== item.id));
    onNotify("Series removed");
  }

  return <section className="page-content library-content series-content"><div className="preview-notice"><span className="notice-indicator" /><span><strong>{client ? "Your series library" : "Preview library"}</strong> &nbsp;{client ? "Changes apply only to your account." : "Starter lines and edits are temporary in preview mode."}</span></div><div className="library-intro"><div><span className="eyebrow">KNOW YOUR LINES</span><h2>Series library <span>{series.length}</span></h2><p>Group your garage by the lines you collect.</p></div></div><form className="series-create" onSubmit={addSeries}><div className="series-create-title"><span className="series-icon"><Tag size={18} /></span><div><b>Create a series</b><small>Add a line to your personal library.</small></div></div><input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={80} required placeholder="Series name" aria-label="New series name" /><select value={newCategory} onChange={(event) => setNewCategory(event.target.value)} aria-label="Series category"><option>Mainline</option><option>Premium</option><option>Special edition</option><option>Custom</option></select><button className="button button-primary"><Plus size={15} /> Add series</button></form><div className="series-list-head"><span>SERIES NAME</span><span>CATEGORY</span><span>CASTINGS</span><span>ACTIONS</span></div><div className="series-list">{series.map((item) => <div className="series-list-row" key={item.id}><div className="series-list-name"><span className="series-mini-icon"><Tag size={15} /></span>{editingId === item.id ? <input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveEdit(item); if (event.key === "Escape") setEditingId(""); }} /> : <b>{item.name}</b>}</div><span className="series-category">{item.category ?? "Custom"}</span><span className="series-count">{item.cars?.[0]?.count ?? 0} cars</span><div className="series-row-actions">{editingId === item.id ? <><button onClick={() => void saveEdit(item)} aria-label="Save series name"><Check size={15} /></button><button onClick={() => setEditingId("")} aria-label="Cancel series edit"><X size={15} /></button></> : <><button onClick={() => { setEditingId(item.id); setEditingName(item.name); }} aria-label={`Edit ${item.name}`}>Edit</button><button onClick={() => void deleteSeries(item)} aria-label={`Delete ${item.name}`}><Trash2 size={14} /></button></>}</div></div>)}</div></section>;
}