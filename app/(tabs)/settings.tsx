import { useState } from "react";
import { Linking, Switch, View } from "react-native";
import { router } from "expo-router";
import {
  Page,
  Heading,
  Body,
  Button,
  Card,
  Field,
  Notice,
  s,
} from "../../src/components/ui";
import { useSession } from "../../src/state/session";
import { mayAdmin } from "../../src/services/auth-core";
import { friendlyError } from "../../src/services/supabase";
import { verifyConnection } from "../../src/services/connection";
export default function Settings() {
  const { profile, repository, refresh, logout, demoMode } = useSession(),
    [name, setName] = useState(profile?.name ?? ""),
    [anonymous, setAnonymous] = useState(profile?.anonymous_default ?? true),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await repository.updateProfile(name, anonymous);
      await refresh();
      setMessage("Preferências do perfil atualizadas.");
    } catch (e) {
      setMessage(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setBusy(true);
    try {
      setMessage(await verifyConnection());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await repository.deleteAccount();
      await logout();
      router.replace("/auth");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading
        sub={
          demoMode
            ? "Perfil local com dados fictícios."
            : "Papel e status são definidos pelo servidor."
        }
      >
        Seu perfil
      </Heading>
      <Card>
        <Body>
          Fonte dos dados:{" "}
          {demoMode ? "demonstração local" : "Supabase autenticado"}
        </Body>
        <Body muted>
          {demoMode
            ? "As alterações ficam apenas neste dispositivo."
            : "Verifique abaixo a sessão e a leitura das tabelas no servidor."}
        </Body>
        {!demoMode && (
          <Button
            secondary
            title="Verificar conexão real com Supabase"
            disabled={busy}
            onPress={() => void verify()}
          />
        )}
      </Card>
      <Card>
        <Body>
          Papel: {profile?.role === "admin" ? "Administrador" : "Usuário comum"}
        </Body>
        <Field
          label="Nome do perfil"
          value={name}
          onChangeText={setName}
          maxLength={80}
        />
        <View style={s.row}>
          <Switch
            accessibilityLabel="Relatos anônimos por padrão"
            value={anonymous}
            onValueChange={setAnonymous}
          />
          <Body>Relatos anônimos por padrão</Body>
        </View>
        <Button
          disabled={busy || name.trim().length < 2}
          title="Salvar perfil"
          onPress={() => void save()}
        />
      </Card>
      {message && <Notice text={message} />}
      <Button
        secondary
        title="Notificações e zona de interesse"
        onPress={() => router.push("/notifications")}
      />
      <Button
        secondary
        title="Permissões do dispositivo"
        onPress={() =>
          void Linking.openSettings().catch(() =>
            setMessage(
              "Abra as configurações de permissões do seu navegador ou dispositivo.",
            ),
          )
        }
      />
      <Button
        secondary
        title="Termos e política de privacidade"
        onPress={() => router.push("/legal")}
      />
      {mayAdmin(profile) && (
        <Button
          title="Painel administrativo"
          onPress={() => router.push("/admin")}
        />
      )}
      <Button
        secondary
        title="Encerrar sessão"
        onPress={() => void logout().then(() => router.replace("/auth"))}
      />
      <Card>
        <Body>Exclusão de conta</Body>
        <Body muted>
          O pedido bloqueia o acesso, remove tokens e anonimiza o nome público
          imediatamente. A exclusão definitiva deve ser concluída pelo
          responsável em até 30 dias.
        </Body>
        <Button
          secondary
          title={
            deleting ? "Cancelar solicitação" : "Solicitar exclusão da conta"
          }
          onPress={() => setDeleting(!deleting)}
        />
        {deleting && (
          <Button
            disabled={busy}
            danger
            title={
              demoMode
                ? "Apagar dados locais da demonstração"
                : "Confirmar pedido e encerrar acesso"
            }
            onPress={() => void remove()}
          />
        )}
      </Card>
    </Page>
  );
}
