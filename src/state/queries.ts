import { useEffect } from "react";
import { AppState } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "./session";
import { supabase } from "../services/supabase";
import { orderedCategories } from "../domain/categories";
export function useAlerts() {
  const { repository, profile } = useSession();
  return useQuery({
    queryKey: ["alerts"],
    queryFn: () => repository.alerts(),
    enabled: !!profile,
    refetchInterval: 60000,
  });
}
export function useCategories() {
  const { repository, profile } = useSession();
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => repository.categories(),
    select: orderedCategories,
    enabled: !!profile,
    staleTime: 3600000,
  });
}
export function useMine() {
  const { repository, profile } = useSession();
  return useQuery({
    queryKey: ["mine"],
    queryFn: () => repository.mine(),
    enabled: !!profile,
  });
}
export function useRealtime() {
  const { profile, demoMode } = useSession(),
    cache = useQueryClient();
  const userId = profile?.id;
  useEffect(() => {
    if (!supabase || !userId || demoMode) return;
    const channel = supabase
      .channel("alerts:" + userId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        () => {
          void cache.invalidateQueries({ queryKey: ["alerts"] });
          void cache.invalidateQueries({ queryKey: ["alert"] });
          void cache.invalidateQueries({ queryKey: ["detail"] });
          void cache.invalidateQueries({ queryKey: ["contribution"] });
        },
      )
      .subscribe();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void cache.invalidateQueries();
    });
    return () => {
      void supabase!.removeChannel(channel);
      sub.remove();
    };
  }, [userId, demoMode, cache]);
}
