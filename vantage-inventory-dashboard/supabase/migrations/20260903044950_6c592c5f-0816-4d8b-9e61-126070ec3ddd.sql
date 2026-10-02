-- 1. profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are readable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. audit columns
ALTER TABLE public.inventory_items
  ADD COLUMN created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.purchase_orders
  ADD COLUMN created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN received_at DATE;

-- 3. tighten write access to signed-in team members
DROP POLICY IF EXISTS "Inventory is insertable by everyone" ON public.inventory_items;
DROP POLICY IF EXISTS "Inventory is updatable by everyone" ON public.inventory_items;
DROP POLICY IF EXISTS "Inventory is deletable by everyone" ON public.inventory_items;
CREATE POLICY "Signed-in users can insert inventory" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users can update inventory" ON public.inventory_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in users can delete inventory" ON public.inventory_items FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "POs insertable by everyone" ON public.purchase_orders;
DROP POLICY IF EXISTS "POs updatable by everyone" ON public.purchase_orders;
DROP POLICY IF EXISTS "POs deletable by everyone" ON public.purchase_orders;
CREATE POLICY "Signed-in users can insert POs" ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users can update POs" ON public.purchase_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in users can delete POs" ON public.purchase_orders FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "PO items insertable by everyone" ON public.purchase_order_items;
DROP POLICY IF EXISTS "PO items updatable by everyone" ON public.purchase_order_items;
DROP POLICY IF EXISTS "PO items deletable by everyone" ON public.purchase_order_items;
CREATE POLICY "Signed-in users can insert PO items" ON public.purchase_order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users can update PO items" ON public.purchase_order_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in users can delete PO items" ON public.purchase_order_items FOR DELETE TO authenticated USING (true);

-- 4. automatic receiving when the delivery date arrives
CREATE OR REPLACE FUNCTION public.auto_receive_due_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  line RECORD;
  received_count integer := 0;
BEGIN
  FOR line IN
    SELECT poi.id, poi.inventory_item_id, poi.quantity, poi.purchase_order_id
    FROM public.purchase_order_items poi
    JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
    WHERE po.status IN ('draft', 'submitted')
      AND COALESCE(poi.expected_delivery, po.expected_delivery) IS NOT NULL
      AND COALESCE(poi.expected_delivery, po.expected_delivery) <= CURRENT_DATE
  LOOP
    UPDATE public.inventory_items
      SET on_hand = on_hand + line.quantity,
          last_counted_at = CURRENT_DATE
      WHERE id = line.inventory_item_id;
    received_count := received_count + 1;
  END LOOP;

  UPDATE public.purchase_orders po
    SET status = 'received', received_at = CURRENT_DATE
    WHERE po.status IN ('draft', 'submitted')
      AND EXISTS (
        SELECT 1 FROM public.purchase_order_items poi
        WHERE poi.purchase_order_id = po.id
          AND COALESCE(poi.expected_delivery, po.expected_delivery) IS NOT NULL
          AND COALESCE(poi.expected_delivery, po.expected_delivery) <= CURRENT_DATE
      );

  RETURN received_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_receive_due_orders() TO anon, authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'auto-receive-due-purchase-orders',
  '10 0 * * *',
  $$SELECT public.auto_receive_due_orders();$$
);