CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  supplier TEXT NOT NULL DEFAULT 'Unassigned',
  status TEXT NOT NULL DEFAULT 'draft',
  expected_delivery DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO anon, authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "POs readable by everyone" ON public.purchase_orders FOR SELECT USING (true);
CREATE POLICY "POs insertable by everyone" ON public.purchase_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "POs updatable by everyone" ON public.purchase_orders FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "POs deletable by everyone" ON public.purchase_orders FOR DELETE USING (true);

CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  expected_delivery DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO anon, authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PO items readable by everyone" ON public.purchase_order_items FOR SELECT USING (true);
CREATE POLICY "PO items insertable by everyone" ON public.purchase_order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "PO items updatable by everyone" ON public.purchase_order_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "PO items deletable by everyone" ON public.purchase_order_items FOR DELETE USING (true);

CREATE INDEX idx_po_items_po ON public.purchase_order_items(purchase_order_id);

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();