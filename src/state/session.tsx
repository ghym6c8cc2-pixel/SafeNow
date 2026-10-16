import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { db, supabase } from "../services/supabase";
import { loadProfile } from "../services/auth";
import { demoProfile, demo } from "../services/demo";
import { remote, type Repository } from "../services/repository";
import { draftStorage } from "../services/drafts";
import type { Profile } from "../domain/types";
interface Session {
  profile: Profile | null;
  ready: boolean;
  demoMode: boolean;
  notice: string;
  repository: Repository;
  enterDemo(): void;
  refresh(): Promise<void>;
  logout(): Promise<void>;
}
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null),
    [ready, setReady] = useState(!supabase),
    [demoMode, setDemo] = useState(false),
    [notice, setNotice] = useState("");
  const cache = useQueryClient();
  async function refresh() {
    if (demoMode) {
      setProfile({ ...demoProfile });
      return;
    }
    if (!supabase) return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      setProfile(null);
      cache.clear();
      return;
    }
    try {
      const p = await loadProfile(data.user.id);
      setProfile(p.status === "active" ? p : null);
      if (p.status !== "active") {
        await supabase.auth.signOut();
        cache.clear();
      }
    } catch {
      setProfile(null);
      cache.clear();
    }
  }
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    async function init() {
      try {
        const { data } = await supabase!.auth.getSession();
        if (data.session) {
          const p = await loadProfile(data.session.user.id);
          if (alive) setProfile(p.status === "active" ? p : null);
        }
      } catch {
        if (alive) setProfile(null);
      } finally {
        if (alive) setReady(true);
      }
    }
    void init();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setNotice(
          "Sessão encerrada ou expirada. Entre novamente para continuar.",
        );
        setProfile(null);
        cache.clear();
      } else if (session && event !== "INITIAL_SESSION")
        setTimeout(() => {
          void loadProfile(session.user.id)
            .then((p) => {
              if (alive) {
                if (p.status === "active") setNotice("");
                setProfile(p.status === "active" ? p : null);
                if (p.status !== "active") void supabase?.auth.signOut();
              }
            })
            .catch(() => {
              if (alive) setProfile(null);
            });
        }, 0);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [cache]);
  useEffect(() => {
    if (demoMode || !profile) return;
    const timer = setInterval(() => {
      void refresh();
    }, 30000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  });
  async function logout() {
    if (profile)
      await draftStorage.removeItem(`draft-${demoMode ? "demo" : profile.id}`);
    cache.clear();
    setProfile(null);
    if (!demoMode && supabase) {
      const { data } = await db().auth.getSession();
      if (data.session)
        await db()
          .from("push_tokens")
          .delete()
          .eq("user_id", data.session.user.id);
      await db().auth.signOut();
    }
    setDemo(false);
  }
  return (
    <Context.Provider
      value={{
        profile,
        ready,
        demoMode,
        notice,
        repository: demoMode ? demo : remote,
        enterDemo() {
          cache.clear();
          setDemo(true);
          setProfile({ ...demoProfile });
        },
        refresh,
        logout,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const x = useContext(Context);
  if (!x) throw new Error("Sessão não inicializada.");
  return x;
}
