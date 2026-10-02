CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  dock TEXT NOT NULL DEFAULT 'Dock 1',
  category TEXT NOT NULL DEFAULT 'General',
  on_hand INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 25,
  restock_date DATE,
  last_counted_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inventory is readable by everyone" ON public.inventory_items FOR SELECT USING (true);
CREATE POLICY "Inventory is insertable by everyone" ON public.inventory_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Inventory is updatable by everyone" ON public.inventory_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Inventory is deletable by everyone" ON public.inventory_items FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_inventory_items_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.inventory_items (sku, name, dock, category, on_hand, reorder_point, restock_date, last_counted_at) VALUES
  ('4471', 'Aluminum rail 900mm', 'Dock 1', 'Hardware', 412, 60, CURRENT_DATE + 21, CURRENT_DATE - 2),
  ('9023', 'Linen shirt — sand', 'Dock 2', 'Apparel', 88, 40, CURRENT_DATE + 14, CURRENT_DATE - 1),
  ('6610', 'LED driver 15W', 'Dock 1', 'Electronics', 24, 50, CURRENT_DATE + 5, CURRENT_DATE - 3),
  ('1180', 'Denim jacket M', 'Dock 2', 'Apparel', 0, 30, CURRENT_DATE + 9, CURRENT_DATE - 6),
  ('3355', 'Glass panel 4mm', 'Dock 1', 'Panels', 140, 45, CURRENT_DATE + 30, CURRENT_DATE - 4),
  ('2204', 'Copper coil 12AWG', 'Dock 1', 'Wire & cable', 4, 35, CURRENT_DATE + 2, CURRENT_DATE - 1),
  ('5518', 'Ceramic knob 25mm', 'Dock 2', 'Hardware', 19, 40, CURRENT_DATE + 7, CURRENT_DATE - 5),
  ('7740', 'Wool twill — charcoal', 'Dock 1', 'Apparel', 32, 50, CURRENT_DATE + 11, CURRENT_DATE - 2);