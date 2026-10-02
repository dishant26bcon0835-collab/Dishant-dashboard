import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Clock, LogOut, Plus, Search, Trash2, X } from "lucide-react";
import {
  createItem,
  deleteItem,
  editorLabel,
  fetchInventory,
  formatDate,
  statusOf,
  updateItem,
  type InventoryItem,
  type Status,
} from "@/lib/inventory";
import { runAutoReceive } from "@/lib/maintenance.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/** Applies any purchase orders whose delivery date has arrived, then refreshes. */
function useAutoReceive() {
  const queryClient = useQueryClient();
  const tick = useServerFn(runAutoReceive);
  useEffect(() => {
    let cancelled = false;
    tick()
      .then((res) => {
        if (!cancelled && res.receivedLines > 0) {
          queryClient.invalidateQueries({ queryKey: ["inventory"] });
          queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tick, queryClient]);
}

export { useAutoReceive };

function AccountControls() {
  const { isSignedIn, name } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!isSignedIn) {
    return (
      <Link
        to="/auth"
        className="rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden font-mono text-[11px] text-mist sm:inline">{name}</span>
      <button
        aria-label="Sign out"
        onClick={async () => {
          await queryClient.cancelQueries();
          queryClient.clear();
          await supabase.auth.signOut();
          navigate({ to: "/auth", replace: true });
        }}
        className="grid size-9 place-items-center rounded-md text-mist ring-1 ring-border transition-colors hover:bg-secondary"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

export { AccountControls };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vantage — Inventory Operations Dashboard" },
      {
        name: "description",
        content:
          "Live inventory operations: edit stock quantities and restock dates, track low-stock alerts and movement across docks.",
      },
      { property: "og:title", content: "Vantage — Inventory Operations Dashboard" },
      {
        property: "og:description",
        content:
          "Edit real stock quantities and dates, track low-stock alerts and movement across docks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const MOVEMENT = [
  { day: "M", h: 38 },
  { day: "T", h: 52 },
  { day: "W", h: 74, peak: true },
  { day: "T", h: 60 },
  { day: "F", h: 44 },
  { day: "S", h: 30 },
  { day: "S", h: 48 },
];

const ORDERS = [
  {
    id: "#A-20931",
    initials: "4M",
    meta: "3 items · Dock 1 pickup",
    total: "$128.40",
    tone: "steel" as const,
  },
  {
    id: "#A-20930",
    initials: "RK",
    meta: "12 items · Shipped",
    total: "$641.00",
    tone: "teal" as const,
  },
  {
    id: "#A-20929",
    initials: "TJ",
    meta: "2 items · Pending",
    total: "$54.90",
    tone: "amber" as const,
  },
];

const FILTERS = ["All", "Dock 1", "Dock 2", "Electronics", "Apparel"] as const;

const statusBadge: Record<Status, { label: string; cls: string }> = {
  "in-stock": { label: "In stock", cls: "text-teal bg-teal/12" },
  low: { label: "Low", cls: "text-amber bg-amber/12" },
  out: { label: "Out", cls: "text-rose bg-rose/12" },
};

const toneText = { teal: "text-teal", rose: "text-rose", amber: "text-amber" };
const orderTone = { steel: "text-steel", teal: "text-teal", amber: "text-amber" };

const inputCls =
  "w-full rounded-md bg-surface-raised px-2.5 py-1.5 font-mono text-[12px] text-foreground outline-none ring-1 ring-border focus:ring-amber/60";
const fieldLabel = "label-cond mb-1 block text-[10px] text-mist";

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="label-cond font-cond text-[13px] tracking-[0.16em] text-foreground">
      {children}
    </h2>
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function RowEditor({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [onHand, setOnHand] = useState(String(item.on_hand));
  const [reorder, setReorder] = useState(String(item.reorder_point));
  const [restock, setRestock] = useState(item.restock_date ?? "");
  const [counted, setCounted] = useState(item.last_counted_at);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["inventory"] });

  const save = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("Sign in to edit inventory.");
      return updateItem(
        item.id,
        {
          on_hand: Number(onHand) || 0,
          reorder_point: Number(reorder) || 0,
          restock_date: restock || null,
          last_counted_at: counted || todayISO(),
        },
        user.id,
      );
    },
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteItem(item.id),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });

  const busy = save.isPending || remove.isPending;
  const error = save.error ?? remove.error;

  return (
    <div className="border-t border-border/60 bg-surface-raised/40 px-3.5 py-3">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <div>
          <label className={fieldLabel} htmlFor={`oh-${item.id}`}>
            On hand
          </label>
          <input
            id={`oh-${item.id}`}
            type="number"
            min={0}
            value={onHand}
            onChange={(e) => setOnHand(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor={`rp-${item.id}`}>
            Reorder at
          </label>
          <input
            id={`rp-${item.id}`}
            type="number"
            min={0}
            value={reorder}
            onChange={(e) => setReorder(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor={`rd-${item.id}`}>
            Restock date
          </label>
          <input
            id={`rd-${item.id}`}
            type="date"
            value={restock}
            onChange={(e) => setRestock(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor={`lc-${item.id}`}>
            Last counted
          </label>
          <input
            id={`lc-${item.id}`}
            type="date"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>
      {error && (
        <p className="mt-2 text-[11px] text-rose">
          Could not save: {String((error as Error).message)}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => save.mutate()}
          disabled={busy}
          className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground disabled:opacity-60"
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </button>
        <button
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-[12px] font-medium text-foreground/70 ring-1 ring-border"
        >
          Cancel
        </button>
        <button
          onClick={() => remove.mutate()}
          disabled={busy}
          aria-label="Delete SKU"
          className="ml-auto grid size-8 place-items-center rounded-md text-rose ring-1 ring-border disabled:opacity-60"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function AddSkuForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState({
    sku: "",
    name: "",
    dock: "Dock 1",
    category: "Hardware",
    on_hand: "0",
    reorder_point: "25",
    restock_date: "",
  });

  const create = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("Sign in to add SKUs.");
      return createItem(
        {
          sku: form.sku.trim(),
          name: form.name.trim(),
          dock: form.dock,
          category: form.category.trim() || "General",
          on_hand: Number(form.on_hand) || 0,
          reorder_point: Number(form.reorder_point) || 0,
          restock_date: form.restock_date || null,
        },
        user.id,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onClose();
    },
  });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid = form.sku.trim() !== "" && form.name.trim() !== "";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) create.mutate();
      }}
      className="border-b border-border/60 bg-surface-raised/40 px-3.5 py-3"
    >
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <div>
          <label className={fieldLabel} htmlFor="new-sku">
            SKU
          </label>
          <input
            id="new-sku"
            value={form.sku}
            onChange={set("sku")}
            className={inputCls}
            placeholder="4472"
          />
        </div>
        <div className="col-span-2">
          <label className={fieldLabel} htmlFor="new-name">
            Item name
          </label>
          <input
            id="new-name"
            value={form.name}
            onChange={set("name")}
            className={inputCls}
            placeholder="Steel bracket 60mm"
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="new-dock">
            Dock
          </label>
          <select id="new-dock" value={form.dock} onChange={set("dock")} className={inputCls}>
            <option>Dock 1</option>
            <option>Dock 2</option>
          </select>
        </div>
        <div>
          <label className={fieldLabel} htmlFor="new-cat">
            Category
          </label>
          <input
            id="new-cat"
            value={form.category}
            onChange={set("category")}
            className={inputCls}
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="new-oh">
            On hand
          </label>
          <input
            id="new-oh"
            type="number"
            min={0}
            value={form.on_hand}
            onChange={set("on_hand")}
            className={inputCls}
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="new-rp">
            Reorder at
          </label>
          <input
            id="new-rp"
            type="number"
            min={0}
            value={form.reorder_point}
            onChange={set("reorder_point")}
            className={inputCls}
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="new-rd">
            Restock date
          </label>
          <input
            id="new-rd"
            type="date"
            value={form.restock_date}
            onChange={set("restock_date")}
            className={inputCls}
          />
        </div>
      </div>
      {create.error && (
        <p className="mt-2 text-[11px] text-rose">
          Could not add: {(create.error as Error).message}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={!valid || create.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground disabled:opacity-60"
        >
          {create.isPending ? "Adding…" : "Add SKU"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-[12px] font-medium text-foreground/70 ring-1 ring-border"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Index() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { isSignedIn } = useAuth();
  useAutoReceive();

  const {
    data: items = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["inventory"],
    queryFn: fetchInventory,
  });

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (filter === "Dock 1" || filter === "Dock 2") {
        if (item.dock !== filter) return false;
      } else if (filter !== "All" && item.category !== filter) {
        return false;
      }
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        return item.name.toLowerCase().includes(q) || item.sku.includes(q);
      }
      return true;
    });
  }, [items, filter, query]);

  const lowItems = useMemo(() => items.filter((i) => statusOf(i) !== "in-stock"), [items]);

  const kpis = useMemo(() => {
    const units = items.reduce((sum, i) => sum + i.on_hand, 0);
    const critical = items.filter((i) => statusOf(i) === "out").length;
    const dueSoon = items.filter(
      (i) =>
        i.restock_date &&
        i.restock_date <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
    ).length;
    return [
      {
        label: "Total SKUs",
        value: String(items.length),
        delta: "live from database",
        tone: "teal" as const,
      },
      {
        label: "Units on hand",
        value: units.toLocaleString(),
        delta: "across all docks",
        tone: "teal" as const,
      },
      {
        label: "Low stock",
        value: String(lowItems.length),
        delta: `${critical} critical`,
        tone: "amber" as const,
        highlight: true,
      },
      {
        label: "Restock ≤ 7d",
        value: String(dueSoon),
        delta: "scheduled arrivals",
        tone: "rose" as const,
      },
    ];
  }, [items, lowItems]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-md bg-primary font-cond text-sm font-semibold text-primary-foreground">
              V
            </div>
            <span className="font-cond text-[13px] uppercase tracking-[0.18em]">Vantage</span>
          </div>
          <span className="font-mono text-[11px] text-mist">OPS / LIVE</span>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/purchase-orders"
              className="rounded-md px-2.5 py-1.5 text-[12px] font-medium text-foreground/80 ring-1 ring-border transition-colors hover:bg-secondary"
            >
              Purchase orders
            </Link>
            <button
              aria-label="Search"
              className="grid size-9 place-items-center rounded-md text-mist ring-1 ring-border transition-colors hover:bg-secondary"
            >
              <Search className="size-4" />
            </button>
            <button
              aria-label="Alerts"
              className="relative grid size-9 place-items-center rounded-md text-mist ring-1 ring-border transition-colors hover:bg-secondary"
            >
              <Bell className="size-4" />
              {lowItems.length > 0 && (
                <span className="absolute -right-1 -top-1 size-2 rounded-full bg-rose" />
              )}
            </button>
            <AccountControls />
          </div>
        </div>
        <div className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto px-4 pb-3">
          <span className="label-cond shrink-0 border-r border-border py-1.5 pr-3 text-[11px] text-mist">
            Filters
          </span>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                f === filter
                  ? "shrink-0 rounded-full bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground"
                  : "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium text-foreground/70 ring-1 ring-border transition-colors hover:bg-secondary"
              }
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        <section aria-label="Key metrics">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-lg bg-card p-3 ring-1 ring-border">
                <p className="label-cond text-[11px] text-mist">{kpi.label}</p>
                <p
                  className={`mt-1 font-cond text-3xl leading-none ${
                    kpi.highlight ? "text-amber" : "text-foreground"
                  }`}
                >
                  {kpi.value}
                </p>
                <p className={`mt-1.5 text-[11px] font-medium ${toneText[kpi.tone]}`}>
                  {kpi.delta}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <section className="overflow-hidden rounded-lg bg-card ring-1 ring-border">
              <div className="flex items-center gap-2 px-3.5 pb-2.5 pt-3.5">
                <SectionHeading>Inventory</SectionHeading>
                <span className="font-mono text-[11px] text-mist">{items.length}</span>
                {isSignedIn ? (
                  <button
                    onClick={() => setAdding((v) => !v)}
                    className="ml-auto flex items-center gap-1 text-[11px] font-medium text-amber"
                  >
                    {adding ? <X className="size-3" /> : <Plus className="size-3" />}
                    {adding ? "Close" : "Add SKU"}
                  </button>
                ) : (
                  <Link to="/auth" className="ml-auto text-[11px] font-medium text-amber">
                    Sign in to edit
                  </Link>
                )}
              </div>
              <div className="px-3.5 pb-3">
                <div className="flex items-center gap-2 rounded-md bg-surface-raised px-3 py-2 ring-1 ring-border">
                  <Search className="size-4 text-mist" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-mist"
                    placeholder="Search SKU, name, barcode"
                  />
                </div>
              </div>

              {adding && <AddSkuForm onClose={() => setAdding(false)} />}

              <div className="label-cond grid grid-cols-[1fr_auto_auto] gap-2 border-y border-border/70 bg-surface-raised/40 px-3.5 py-1.5 text-[10px] text-mist">
                <span>Item</span>
                <span className="w-10 text-right">On hand</span>
                <span className="w-16 text-right">Status</span>
              </div>
              <div className="divide-y divide-border/60">
                {isLoading && (
                  <p className="px-3.5 py-6 text-center text-[12px] text-mist">
                    Loading inventory…
                  </p>
                )}
                {error && (
                  <p className="px-3.5 py-6 text-center text-[12px] text-rose">
                    Could not load inventory: {(error as Error).message}
                  </p>
                )}
                {!isLoading && !error && visible.length === 0 && (
                  <p className="px-3.5 py-6 text-center text-[12px] text-mist">
                    No items match this filter.
                  </p>
                )}
                {visible.map((item) => {
                  const badge = statusBadge[statusOf(item)];
                  const open = editingId === item.id;
                  return (
                    <div key={item.id}>
                      <button
                        onClick={() => isSignedIn && setEditingId(open ? null : item.id)}
                        aria-expanded={open}
                        className={`grid w-full grid-cols-[1fr_auto_auto] items-center gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-raised/50 ${
                          open ? "bg-surface-raised/60" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-foreground">
                            {item.name}
                          </p>
                          <p className="font-mono text-[11px] text-mist">
                            SKU {item.sku} · {item.dock} · restock {formatDate(item.restock_date)} ·
                            counted {formatDate(item.last_counted_at)}
                          </p>
                          {editorLabel(item.updated_by_profile) && (
                            <p className="text-[10px] text-steel">
                              Last edited by {editorLabel(item.updated_by_profile)} ·{" "}
                              {new Date(item.updated_at).toLocaleString(undefined, {
                                month: "short",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                        </div>
                        <span className="w-10 text-right font-mono text-[13px] text-foreground/90">
                          {item.on_hand}
                        </span>
                        <span className="w-16 text-right">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </span>
                      </button>
                      {open && isSignedIn && (
                        <RowEditor item={item} onClose={() => setEditingId(null)} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border/60 px-3.5 py-2.5 text-center">
                <span className="text-[11px] font-medium text-mist">
                  Showing {visible.length} of {items.length} SKUs ·{" "}
                  {isSignedIn ? "tap a row to edit" : "sign in to edit"}
                </span>
              </div>
            </section>

            <section className="rounded-lg bg-card p-3.5 ring-1 ring-border">
              <div className="mb-3 flex items-center justify-between">
                <SectionHeading>Stock movement</SectionHeading>
                <span className="font-mono text-[10px] text-mist">7 days</span>
              </div>
              <div className="flex h-24 items-end gap-1.5">
                {MOVEMENT.map((b, i) => (
                  <div
                    key={i}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                  >
                    <div
                      className={`w-full rounded-sm ${b.peak ? "bg-amber" : "bg-steel/70"}`}
                      style={{ height: `${b.h}%` }}
                    />
                    <span className="font-mono text-[9px] text-mist">{b.day}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="overflow-hidden rounded-lg bg-card ring-1 ring-border">
              <div className="flex items-center justify-between px-3.5 pb-2.5 pt-3.5">
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-amber" />
                  <SectionHeading>Low-stock alerts</SectionHeading>
                  <span className="font-mono text-[11px] text-amber">{lowItems.length}</span>
                </div>
              </div>
              <div className="divide-y divide-border/70">
                {lowItems.length === 0 && (
                  <p className="px-3.5 py-5 text-center text-[12px] text-mist">
                    All SKUs above reorder point.
                  </p>
                )}
                {lowItems.slice(0, 5).map((a) => {
                  const crit = statusOf(a) === "out";
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-3.5 py-2.5">
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          crit ? "bg-rose/12 text-rose" : "bg-amber/12 text-amber"
                        }`}
                      >
                        {crit ? "crit" : "low"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-foreground">{a.name}</p>
                        <p className="text-[11px] text-mist">
                          {a.dock} · restock {formatDate(a.restock_date)}
                        </p>
                      </div>
                      <span
                        className={`ml-auto shrink-0 font-mono text-[12px] ${crit ? "text-rose" : "text-amber"}`}
                      >
                        {a.on_hand}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="overflow-hidden rounded-lg bg-card ring-1 ring-border">
              <div className="flex items-center justify-between px-3.5 pb-2.5 pt-3.5">
                <SectionHeading>Recent orders</SectionHeading>
                <button className="flex items-center gap-1 text-[11px] font-medium text-mist">
                  <Clock className="size-3" /> Activity
                </button>
              </div>
              <div className="divide-y divide-border/60">
                {ORDERS.map((o) => (
                  <div key={o.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-md bg-surface-raised font-cond text-[12px] ring-1 ring-border ${orderTone[o.tone]}`}
                    >
                      {o.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground">Order {o.id}</p>
                      <p className="text-[11px] text-mist">{o.meta}</p>
                    </div>
                    <span className="ml-auto shrink-0 font-mono text-[12px] text-foreground/90">
                      {o.total}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
