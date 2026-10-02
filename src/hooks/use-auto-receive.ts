import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { runAutoReceive } from "@/lib/maintenance.functions";

/** Applies any purchase-order lines whose delivery date has arrived, then refreshes. */
export function useAutoReceive() {
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
