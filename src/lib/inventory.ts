import { supabase } from "@/integrations/supabase/client";

export type Status = "in-stock" | "low" | "out";

export interface EditorRef {
  display_name: string | null;
  email: string | null;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  dock: string;
  category: string;
  on_hand: number;
  reorder_point: number;
  restock_date: string | null;
  last_counted_at: string;
  updated_at: string;
  updated_by: string | null;
  updated_by_profile: EditorRef | null;
}

const COLUMNS =
  "id, sku, name, dock, category, on_hand, reorder_point, restock_date, last_counted_at, updated_at, updated_by, updated_by_profile:profiles!inventory_items_updated_by_fkey(display_name, email)";

export function editorLabel(profile: EditorRef | null | undefined) {
  if (!profile) return null;
  return profile.display_name || profile.email?.split("@")[0] || null;
}

export function statusOf(item: InventoryItem): Status {
  if (item.on_hand <= 0) return "out";
  if (item.on_hand <= item.reorder_point) return "low";
  return "in-stock";
}

export async function fetchInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select(COLUMNS)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as InventoryItem[];
}

export interface ItemPatch {
  on_hand?: number;
  reorder_point?: number;
  restock_date?: string | null;
  last_counted_at?: string;
}

export async function updateItem(id: string, patch: ItemPatch, userId: string) {
  const { error } = await supabase
    .from("inventory_items")
    .update({ ...patch, updated_by: userId })
    .eq("id", id);
  if (error) throw error;
}

export interface NewItem {
  sku: string;
  name: string;
  dock: string;
  category: string;
  on_hand: number;
  reorder_point: number;
  restock_date: string | null;
}

export async function createItem(item: NewItem, userId: string) {
  const { error } = await supabase
    .from("inventory_items")
    .insert({ ...item, created_by: userId, updated_by: userId });
  if (error) throw error;
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) throw error;
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}
