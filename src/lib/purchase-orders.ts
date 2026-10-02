import { supabase } from "@/integrations/supabase/client";
import type { EditorRef } from "@/lib/inventory";

export type PoStatus = "draft" | "submitted" | "received" | "cancelled";

export const PO_STATUSES: PoStatus[] = ["draft", "submitted", "received", "cancelled"];

export interface PurchaseOrderLine {
  id: string;
  purchase_order_id: string;
  inventory_item_id: string;
  quantity: number;
  expected_delivery: string | null;
  inventory_items?: { sku: string; name: string; dock: string } | null;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier: string;
  status: string;
  expected_delivery: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
  created_by_profile: EditorRef | null;
  updated_by_profile: EditorRef | null;
  purchase_order_items: PurchaseOrderLine[];
}

export async function fetchPurchaseOrders(): Promise<PurchaseOrder[]> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      "id, po_number, supplier, status, expected_delivery, received_at, notes, created_at, created_by_profile:profiles!purchase_orders_created_by_fkey(display_name, email), updated_by_profile:profiles!purchase_orders_updated_by_fkey(display_name, email), purchase_order_items(id, purchase_order_id, inventory_item_id, quantity, expected_delivery, inventory_items(sku, name, dock))",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PurchaseOrder[];
}

export interface NewOrderLine {
  inventory_item_id: string;
  quantity: number;
  expected_delivery: string | null;
}

export interface NewPurchaseOrder {
  po_number: string;
  supplier: string;
  status: string;
  expected_delivery: string | null;
  notes: string | null;
  lines: NewOrderLine[];
}

export async function createPurchaseOrder(order: NewPurchaseOrder, userId: string) {
  const { lines, ...header } = order;
  const { data, error } = await supabase
    .from("purchase_orders")
    .insert({ ...header, created_by: userId, updated_by: userId })
    .select("id")
    .single();
  if (error) throw error;

  const rows = lines.map((l) => ({
    purchase_order_id: data.id,
    inventory_item_id: l.inventory_item_id,
    quantity: l.quantity,
    expected_delivery: l.expected_delivery,
  }));

  if (rows.length) {
    const { error: lineError } = await supabase.from("purchase_order_items").insert(rows);
    if (lineError) {
      await supabase.from("purchase_orders").delete().eq("id", data.id);
      throw lineError;
    }
  }
  return data.id;
}

export async function updateOrderStatus(id: string, status: string, userId: string) {
  const { error } = await supabase
    .from("purchase_orders")
    .update({
      status,
      updated_by: userId,
      ...(status === "received" ? { received_at: new Date().toISOString().slice(0, 10) } : {}),
    })
    .eq("id", id);
  if (error) throw error;
}

/** Adds each line's quantity to the linked SKU's on-hand count. */
export async function receivePurchaseOrder(order: PurchaseOrder, userId: string) {
  for (const line of order.purchase_order_items) {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("on_hand")
      .eq("id", line.inventory_item_id)
      .single();
    if (error) throw error;
    const { error: upError } = await supabase
      .from("inventory_items")
      .update({ on_hand: (data?.on_hand ?? 0) + line.quantity, updated_by: userId })
      .eq("id", line.inventory_item_id);
    if (upError) throw upError;
  }
  await updateOrderStatus(order.id, "received", userId);
}

export async function deletePurchaseOrder(id: string) {
  const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
  if (error) throw error;
}

export function suggestPoNumber() {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 900 + 100);
  return `PO-${stamp}-${rand}`;
}
