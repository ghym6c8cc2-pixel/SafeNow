import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { Page, Heading, Field, Button, Notice } from "../../src/components/ui";
import { db } from "../../src/services/supabase";
import { changePassword } from "../../src/services/auth";
import { parseAuthCallback } from "../../src/services/auth-links";
export default function Callback() {
  const url = Linking.useURL(),
    [ready, setReady] = useState(false),
    [recovery, setRecovery] = useState(false),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState("Validando o link…"),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!url) return;
    let active = true;
    let recoveryEvent = false;
    const listener = db().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") recoveryEvent = true;
    });
    async function handle() {
      try {
        const incoming = parseAuthCallback(url!);
        if (incoming.code) {
          const { error } = await db().auth.exchangeCodeForSession(
            incoming.code,
          );
          if (error) throw error;
        } else if (incoming.tokens) {
          const { error } = await db().auth.setSession(incoming.tokens);
          if (error) throw error;
        } else throw new Error();
        if (active) {
          const isRecovery = incoming.recovery || recoveryEvent;
          setRecovery(isRecovery);
          setReady(true);
          setMessage(
            isRecovery
              ? "Link validado. Defina uma nova senha."
              : "E-mail confirmado. Você pode continuar para o mapa.",
          );
          if (typeof window !== "undefined")
            window.history.replaceState(null, "", "/auth/callback");
        }
      } catch {
        if (active)
          setMessage(
            "Link inválido ou expirado. Solicite outro na tela de acesso.",
          );
      }
    }
    void handle();
    return () => {
      active = false;
      listener.data.subscription.unsubscribe();
    };
  }, [url]);
  async function update() {
    if (password.length < 10) {
      setMessage("Use pelo menos 10 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await changePassword(password);
      setMessage("Senha atualizada.");
      router.replace("/(tabs)/map");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha ao atualizar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading>Confirmação de acesso</Heading>
      <Notice text={message} />
      {ready && (
        <>
          {recovery && (
            <>
              <Field
                label="Nova senha (mínimo 10 caracteres)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Button
                disabled={busy}
                title="Salvar nova senha"
                onPress={() => void update()}
              />
            </>
          )}
          <Button
            secondary
            title="Continuar para o mapa"
            onPress={() => router.replace("/(tabs)/map")}
          />
        </>
      )}
      <Button
        secondary
        title="Voltar ao acesso"
        onPress={() => router.replace("/auth")}
      />
    </Page>
  );
}
