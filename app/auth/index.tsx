import { useState } from "react";
import {
  View,
  Text,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import {
  Page,
  Heading,
  Body,
  Button,
  Card,
  Field,
  Notice,
  Chips,
  colors,
  s,
} from "../../src/components/ui";
import { validateAuth } from "../../src/domain/rules";
import { signIn, signUp, resetPassword } from "../../src/services/auth";
import { configured } from "../../src/services/supabase";
import { useSession } from "../../src/state/session";
export default function Access() {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [terms, setTerms] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [isError, setError] = useState(false);
  const session = useSession();
  async function submit() {
    if (busy) return;
    setError(false);
    setMessage("");
    const validation =
      mode === "reset"
        ? validateAuth(email, "x")
        : validateAuth(email, password, mode === "signup", name, terms);
    if (validation) {
      setError(true);
      setMessage(validation);
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        await session.refresh();
        router.replace("/(tabs)/map");
      } else if (mode === "signup") {
        const result = await signUp(email, password, name);
        if (result.signedIn) {
          await session.refresh();
          router.replace("/(tabs)/map");
        } else {
          setMessage(
            "Cadastro recebido. Este servidor está exigindo confirmação de e-mail; confira sua caixa de entrada para entrar.",
          );
          setMode("login");
        }
      } else {
        await resetPassword(email);
        setMessage(
          "Se houver uma conta com esse e-mail, você receberá um link de recuperação.",
        );
      }
    } catch (e) {
      setError(true);
      setMessage(
        e instanceof Error
          ? e.message
          : "Não foi possível acessar. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page>
        <View style={{ paddingTop: 50, paddingBottom: 15, gap: 10 }}>
          <View
            style={{
              width: 58,
              height: 64,
              borderRadius: 18,
              borderBottomLeftRadius: 30,
              borderBottomRightRadius: 30,
              backgroundColor: colors.green,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 36, color: "white", fontWeight: "800" }}>
              ✓
            </Text>
          </View>
          <Text style={{ fontSize: 38, fontWeight: "800", color: colors.navy }}>
            SafeNow
          </Text>
          <Body muted>Informação próxima. Cuidado em comunidade.</Body>
        </View>
        <Heading sub="Relatos comunitários podem estar incompletos ou incorretos.">
          {mode === "login"
            ? "Entre para acompanhar"
            : mode === "signup"
              ? "Crie sua conta"
              : "Recupere seu acesso"}
        </Heading>
        {session.notice && <Notice text={session.notice} />}
        {!configured && (
          <Notice text="Supabase ainda não configurado. Use a demonstração local para explorar os fluxos com dados fictícios." />
        )}
        <Card>
          <Chips
            items={[
              { value: "login", label: "Entrar" },
              { value: "signup", label: "Cadastrar" },
              { value: "reset", label: "Recuperar" },
            ]}
            value={mode}
            onChange={(v) => {
              setMode(v);
              setMessage("");
            }}
          />
          {mode === "signup" && (
            <Field
              label="Nome"
              value={name}
              onChangeText={setName}
              maxLength={80}
              autoComplete="name"
            />
          )}
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          {mode !== "reset" && (
            <Field
              label="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              maxLength={128}
            />
          )}
          {mode === "signup" && (
            <>
              <Body muted>
                Sua conta será de Usuário comum. Você pode relatar e contribuir.
                Administradores são definidos somente no servidor.
              </Body>
              <View style={s.row}>
                <Switch
                  accessibilityLabel="Aceito os termos e a política de privacidade"
                  value={terms}
                  onValueChange={setTerms}
                />
                <Body>Aceito os termos e a política.</Body>
              </View>
              <Button
                secondary
                title="Ler termos e política"
                onPress={() => router.push("/legal")}
              />
            </>
          )}
          {message && <Notice text={message} error={isError} />}
          <Button
            title={
              busy
                ? "Aguarde…"
                : mode === "login"
                  ? "Entrar"
                  : mode === "signup"
                    ? "Cadastrar"
                    : "Enviar recuperação"
            }
            onPress={() => void submit()}
            disabled={busy || !configured}
          />
        </Card>
        {(!configured || process.env.EXPO_PUBLIC_DEMO_MODE === "true") && (
          <Button
            secondary
            title="Explorar demonstração local"
            onPress={() => {
              session.enterDemo();
              router.replace("/(tabs)/map");
            }}
          />
        )}
        <Button
          secondary
          title="Termos, privacidade e uso responsável"
          onPress={() => router.push("/legal")}
        />
        <Body muted>
          Protótipo acadêmico. Em uma emergência, procure os serviços oficiais.
          Não se aproxime de uma ocorrência para registrar ou validar
          informações.
        </Body>
      </Page>
    </KeyboardAvoidingView>
  );
}
