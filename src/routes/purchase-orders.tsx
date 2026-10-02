import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PackageCheck, Plus, Trash2 } from "lucide-react";
import { editorLabel, fetchInventory, formatDate } from "@/lib/inventory";
import { useAuth } from "@/hooks/use-auth";
import { AccountControls, useAutoReceive } from "@/routes/index";
import {
  PO_STATUSES,
  createPurchaseOrder,
  deletePurchaseOrder,
  fetchPurchaseOrders,
  receivePurchaseOrder,
  suggestPoNumber,
  type PurchaseOrder,
} from "@/lib/purchase-orders";

export const Route = createFileRoute("/purchase-orders")({
  head: () => ({
    meta: [
      { title: "Purchase Orders — Vantage Inventory" },
      {
        name: "description",
        content:
          "Create purchase orders with line items, quantities and expected delivery dates linked to live inventory SKUs.",
      },
      { property: "og:title", content: "Purchase Orders — Vantage Inventory" },
      {
        property: "og:description",
        content: "Raise and receive purchase orders linked to your live inventory SKUs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PurchaseOrdersPage,
});

const inputCls =
  "w-full rounded-md bg-surface-raised px-2.5 py-1.5 font-mono text-[12px] text-foreground outline-none ring-1 ring-border focus:ring-amber/60";
const fieldLabel = "label-cond mb-1 block text-[10px] text-mist";

const statusCls: Record<string, string> = {
  draft: "text-steel bg-steel/12",
  submitted: "text-amber bg-amber/12",
  received: "text-teal bg-teal/12",
  cancelled: "text-rose bg-rose/12",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface DraftLine {
  key: string;
  inventory_item_id: string;
  quantity: string;
  expected_delivery: string;
}

function newLine(): DraftLine {
  return {
    key: Math.random().toString(36).slice(2),
    inventory_item_id: "",
    quantity: "1",
    expected_delivery: "",
  };
}

function CreateOrderForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: fetchInventory,
  });

  const [poNumber, setPoNumber] = useState(suggestPoNumber);
  const [supplier, setSupplier] = useState("");
  const [status, setStatus] = useState("draft");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);

  const setLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const create = useMutation({
    mutationFn: () =>
      createPurchaseOrder({
        po_number: poNumber.trim(),
        supplier: supplier.trim() || "Unassigned",
        status,
        expected_delivery: expected || null,
        notes: notes.trim() || null,
        lines: lines
          .filter((l) => l.inventory_item_id)
          .map((l) => ({
            inventory_item_id: l.inventory_item_id,
            quantity: Math.max(1, Number(l.quantity) || 1),
            expected_delivery: l.expected_delivery || expected || null,
          })),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      onDone();
    },
  });

  const validLines = lines.filter((l) => l.inventory_item_id).length;

  return (
    <div className="rounded-lg border border-border bg-surface p-3.5">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <div>
          <label className={fieldLabel} htmlFor="po-number">
            PO number
          </label>
          <input
            id="po-number"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="po-supplier">
            Supplier
          </label>
          <input
            id="po-supplier"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Acme Supply"
            className={inputCls}
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="po-expected">
            Expected delivery
          </label>
          <input
            id="po-expected"
            type="date"
            min={todayISO()}
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="po-status">
            Status
          </label>
          <select
            id="po-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputCls}
          >
            {PO_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <div className="label-cond mb-2 text-[11px] text-mist">Line items</div>
        <div className="space-y-2">
          {lines.map((line) => (
            <div
              key={line.key}
              className="grid grid-cols-2 gap-2 md:grid-cols-[2fr_0.8fr_1fr_auto]"
            >
              <div>
                <label className={fieldLabel} htmlFor={`sku-${line.key}`}>
                  SKU
                </label>
                <select
                  id={`sku-${line.key}`}
                  value={line.inventory_item_id}
                  onChange={(e) => setLine(line.key, { inventory_item_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Select SKU…</option>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} · {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabel} htmlFor={`qty-${line.key}`}>
                  Qty
                </label>
                <input
                  id={`qty-${line.key}`}
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={fieldLabel} htmlFor={`eta-${line.key}`}>
                  ETA
                </label>
                <input
                  id={`eta-${line.key}`}
                  type="date"
                  value={line.expected_delivery}
                  onChange={(e) => setLine(line.key, { expected_delivery: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="flex items-end">
                <button
                  aria-label="Remove line"
                  onClick={() =>
                    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== line.key) : ls))
                  }
                  className="grid size-8 place-items-center rounded-md text-rose ring-1 ring-border"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setLines((ls) => [...ls, newLine()])}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-foreground/80 ring-1 ring-border transition-colors hover:bg-secondary"
        >
          <Plus className="size-3.5" /> Add line
        </button>
      </div>

      <div className="mt-4">
        <label className={fieldLabel} htmlFor="po-notes">
          Notes
        </label>
        <input
          id="po-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Dock 2 delivery window 9–11am"
          className={inputCls}
        />
      </div>

      {create.error && (
        <p className="mt-2 text-[11px] text-rose">
          Could not create order: {(create.error as Error).message}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending || !poNumber.trim() || validLines === 0}
          className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground disabled:opacity-60"
        >
          {create.isPending ? "Creating…" : "Create order"}
        </button>
        <button
          onClick={onDone}
          className="rounded-md px-3 py-1.5 text-[12px] font-medium text-foreground/70 ring-1 ring-border"
        >
          Cancel
        </button>
        <span className="ml-auto font-mono text-[11px] text-mist">{validLines} line(s)</span>
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: PurchaseOrder }) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
    ]);

  const receive = useMutation({
    mutationFn: () => receivePurchaseOrder(order),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: () => deletePurchaseOrder(order.id),
    onSuccess: invalidate,
  });

  const units = order.purchase_order_items.reduce((sum, l) => sum + l.quantity, 0);
  const error = receive.error ?? remove.error;

  return (
    <article className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3.5 py-3">
        <span className="font-mono text-[13px] text-foreground">{order.po_number}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${statusCls[order.status] ?? "text-steel bg-steel/12"}`}
        >
          {order.status}
        </span>
        <span className="text-[12px] text-mist">{order.supplier}</span>
        <span className="ml-auto font-mono text-[11px] text-mist">
          {order.purchase_order_items.length} items · {units} units · ETA{" "}
          {formatDate(order.expected_delivery)}
        </span>
      </div>

      <ul className="divide-y divide-border/50">
        {order.purchase_order_items.map((line) => (
          <li key={line.id} className="flex items-center gap-3 px-3.5 py-2">
            <span className="font-mono text-[11px] text-mist">
              {line.inventory_items?.sku ?? "—"}
            </span>
            <span className="truncate text-[12px] text-foreground">
              {line.inventory_items?.name ?? "Unknown SKU"}
            </span>
            <span className="ml-auto font-mono text-[12px] text-foreground">×{line.quantity}</span>
            <span className="font-mono text-[11px] text-mist">
              {formatDate(line.expected_delivery)}
            </span>
          </li>
        ))}
        {order.purchase_order_items.length === 0 && (
          <li className="px-3.5 py-2 text-[12px] text-mist">No line items</li>
        )}
      </ul>

      {order.notes && (
        <p className="border-t border-border/50 px-3.5 py-2 text-[11px] text-mist">{order.notes}</p>
      )}

      {error && <p className="px-3.5 pb-2 text-[11px] text-rose">{(error as Error).message}</p>}

      <div className="flex items-center gap-2 border-t border-border/60 px-3.5 py-2.5">
        <button
          onClick={() => receive.mutate()}
          disabled={
            receive.isPending ||
            order.status === "received" ||
            order.purchase_order_items.length === 0
          }
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-teal ring-1 ring-border disabled:opacity-50"
        >
          <PackageCheck className="size-3.5" />
          {order.status === "received"
            ? "Received"
            : receive.isPending
              ? "Receiving…"
              : "Receive into stock"}
        </button>
        <button
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
          aria-label="Delete order"
          className="ml-auto grid size-8 place-items-center rounded-md text-rose ring-1 ring-border disabled:opacity-50"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </article>
  );
}

function PurchaseOrdersPage() {
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const {
    data: orders = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: fetchPurchaseOrders,
  });

  const visible = useMemo(
    () => (filter === "all" ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] text-mist ring-1 ring-border transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="size-3.5" /> Dashboard
          </Link>
          <span className="font-cond text-[13px] uppercase tracking-[0.18em]">Purchase Orders</span>
          <button
            onClick={() => setCreating((v) => !v)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground"
          >
            <Plus className="size-3.5" /> {creating ? "Close" : "New order"}
          </button>
        </div>
        <div className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto px-4 pb-3">
          {["all", ...PO_STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={
                s === filter
                  ? "shrink-0 rounded-full bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground"
                  : "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium text-foreground/70 ring-1 ring-border transition-colors hover:bg-secondary"
              }
            >
              {s}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-3 px-4 py-4">
        <h1 className="sr-only">Purchase orders</h1>
        {creating && <CreateOrderForm onDone={() => setCreating(false)} />}

        {isLoading && <p className="text-[12px] text-mist">Loading orders…</p>}
        {error && <p className="text-[12px] text-rose">{(error as Error).message}</p>}
        {!isLoading && visible.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[12px] text-mist">
            No purchase orders yet. Create one to restock your SKUs.
          </p>
        )}

        {visible.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </main>
    </div>
  );
}
