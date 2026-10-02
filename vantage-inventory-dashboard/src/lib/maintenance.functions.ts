import { createServerFn } from "@tanstack/react-start";

/**
 * Applies any purchase-order lines whose expected delivery date has arrived:
 * quantities are added to the linked SKU and the order is marked received.
 * Also runs nightly on a database schedule.
 */
export const runAutoReceive = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("auto_receive_due_orders");
  if (error) throw new Error(error.message);
  return { receivedLines: (data as number | null) ?? 0 };
});
