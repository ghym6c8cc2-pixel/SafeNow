import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { router } from "expo-router";
import type { Incident } from "../domain/types";
import { confidence, RISK, STATUS, resolutionNotice } from "../domain/rules";
import { AppIcon, type IconName } from "./icons";
export const colors = {
  navy: "#102c43",
  green: "#176748",
  light: "#f3f6f8",
  ink: "#173347",
  muted: "#506474",
  border: "#d6e0e6",
  white: "#ffffff",
};
export function Page({
  children,
  scroll = true,
  maxWidth = 900,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  maxWidth?: number;
}) {
  return scroll ? (
    <ScrollView
      style={s.page}
      contentContainerStyle={[s.content, { maxWidth }]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[s.page, s.content, { flex: 1, maxWidth }]}>{children}</View>
  );
}
export function Heading({
  children,
  sub,
}: {
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <View style={{ gap: 6, marginBottom: 8 }}>
      <Text accessibilityRole="header" style={s.heading}>
        {children}
      </Text>
      {!!sub && <Text style={s.muted}>{sub}</Text>}
    </View>
  );
}
export function Body({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return <Text style={muted ? s.muted : s.body}>{children}</Text>;
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  danger = false,
  hint,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  danger?: boolean;
  hint?: string;
}) {
  const [hovered, setHovered] = useState(false),
    [focused, setFocused] = useState(false),
    [pinned, setPinned] = useState(false);
  const held = useRef(false),
    pointerKind = useRef("touch");
  const visible = !!hint && (hovered || focused || pinned);
  function dismiss() {
    setHovered(false);
    setFocused(false);
    setPinned(false);
  }
  useEffect(() => {
    if (!pinned) return;
    const timer = setTimeout(() => setPinned(false), 6000);
    return () => clearTimeout(timer);
  }, [pinned]);
  useEffect(() => {
    if (!visible || typeof document === "undefined") return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHovered(false);
        setFocused(false);
        setPinned(false);
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [visible]);
  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
      disabled={disabled}
      onPress={() => {
        if (hint) dismiss();
        onPress();
      }}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        danger && { backgroundColor: "#b52c3e" },
        (pressed || disabled) && { opacity: 0.55 },
      ]}
    >
      <Text
        style={[
          s.buttonText,
          secondary && { color: colors.navy },
          hint && { paddingHorizontal: 30 },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
  if (!hint) return button;
  return (
    <View
      style={{ position: "relative", zIndex: visible ? 10 : 0 }}
      onAccessibilityEscape={dismiss}
    >
      {button}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sobre ${title}`}
        accessibilityHint="Mostra uma explicação breve, sem registrar uma contribuição."
        onPointerEnter={(event) => {
          if (event.nativeEvent.pointerType !== "touch") setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onPointerDown={(event) => {
          pointerKind.current = event.nativeEvent.pointerType;
        }}
        onPressIn={() => {
          held.current = false;
        }}
        onLongPress={() => {
          if (pointerKind.current !== "mouse") {
            held.current = true;
            setFocused(false);
            setPinned(true);
          }
        }}
        delayLongPress={450}
        onFocus={() =>
          setFocused(
            typeof document === "undefined" ||
              !!document.activeElement?.matches(":focus-visible"),
          )
        }
        onPress={() => {
          if (held.current || pointerKind.current === "mouse") return;
          setFocused(false);
          setPinned((value) => !value);
        }}
        onBlur={() => {
          setFocused(false);
          setPinned(false);
        }}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: secondary || disabled ? colors.navy : colors.white,
            fontSize: 16,
          }}
        >
          ⓘ
        </Text>
      </Pressable>
      {visible && (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{
            position: "absolute",
            bottom: "100%",
            left: 8,
            right: 8,
            maxWidth: 360,
            marginBottom: 6,
            backgroundColor: colors.navy,
            borderRadius: 8,
            padding: 10,
          }}
        >
          <Text style={{ color: colors.white, fontSize: 13, lineHeight: 19 }}>
            {hint}
          </Text>
        </View>
      )}
    </View>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 96, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Chips<T extends string | number>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.row}>
      {items.map((x) => (
        <Pressable
          key={x.value}
          accessibilityRole="button"
          accessibilityLabel={x.label}
          accessibilityState={{ selected: value === x.value }}
          onPress={() => onChange(x.value)}
          style={[
            s.chip,
            { flexDirection: "row", alignItems: "center", gap: 8 },
            value === x.value && s.chipActive,
          ]}
        >
          {x.icon && (
            <AppIcon
              name={x.icon}
              size={20}
              color={value === x.value ? "white" : colors.ink}
            />
          )}
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: value === x.value ? "white" : colors.ink,
            }}
          >
            {x.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Notice({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  return (
    <View
      accessibilityRole={error ? "alert" : "text"}
      accessibilityLiveRegion="polite"
      style={[
        s.notice,
        error && { backgroundColor: "#fcebed", borderColor: "#b52c3e" },
      ]}
    >
      <Text style={[s.body, { color: error ? "#912236" : colors.ink }]}>
        {text}
      </Text>
    </View>
  );
}
export function Loading() {
  return (
    <View style={{ padding: 32, gap: 10 }}>
      <ActivityIndicator size="large" color={colors.green} />
      <Body>Carregando informações…</Body>
    </View>
  );
}
export function IncidentCard({
  alert: a,
  category,
  extra,
}: {
  alert: Incident;
  category?: string;
  extra?: React.ReactNode;
}) {
  const r = RISK[a.risk];
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${a.title}. Risco ${r.label}. ${STATUS[a.status]}`}
        onPress={() => router.push(`/alert/${a.id}`)}
      >
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Text style={[s.eyebrow, { color: r.color }]}>
            RISCO {a.risk}/4 · {r.label.toUpperCase()} ·{" "}
            {category ?? a.category_id}
          </Text>
          <Text style={s.tag}>{STATUS[a.status]}</Text>
        </View>
        <Text style={s.cardTitle}>{a.title}</Text>
        <Text style={s.body} numberOfLines={3}>
          {a.description}
        </Text>
        <Text style={s.muted}>
          {a.region || "Região aproximada"} ·{" "}
          {new Date(a.occurred_at).toLocaleString("pt-BR")}
        </Text>
        <Text style={[s.label, { marginTop: 10 }]}>
          {confidence(a)} · {a.score}/100
        </Text>
        <Text style={s.muted}>Indicador comunitário, sujeito a erro.</Text>
        {resolutionNotice(a) && (
          <Text style={s.label}>{resolutionNotice(a)}</Text>
        )}
        <Text style={s.muted}>
          {a.evidence_count} evidência(s) · {a.confirmations} confirmações ·
          toque para detalhes
        </Text>
      </Pressable>
      {extra}
    </Card>
  );
}
export const s = StyleSheet.create({
  page: { backgroundColor: colors.light },
  content: {
    padding: 18,
    gap: 14,
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    paddingBottom: 36,
  },
  heading: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.5,
  },
  body: { fontSize: 16, lineHeight: 23, color: colors.ink },
  muted: { fontSize: 14, lineHeight: 21, color: colors.muted },
  label: { fontSize: 15, fontWeight: "600", color: colors.ink },
  card: {
    padding: 18,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "700",
    color: colors.navy,
    marginVertical: 8,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.green,
    justifyContent: "center",
    alignItems: "center",
  },
  secondary: {
    backgroundColor: "white",
    borderColor: colors.border,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "white",
    textAlign: "center",
  },
  input: {
    minHeight: 48,
    fontSize: 16,
    color: colors.ink,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    backgroundColor: "white",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 22,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: "white",
  },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  notice: {
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c4dcd2",
    backgroundColor: "#e9f4ef",
  },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  tag: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink,
    backgroundColor: colors.light,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 8,
  },
});
