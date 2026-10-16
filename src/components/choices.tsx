import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Category, Risk } from "../domain/types";
import { RISK } from "../domain/rules";
import { AppIcon, categoryIcon } from "./icons";
import { colors } from "./ui";
import { orderedCategories } from "../domain/categories";

export function CategoryChoices({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <View testID="category-choices" style={{ gap: 16 }}>
      {([4, 3, 2, 1] as const).map((level) => {
        const group = orderedCategories(categories).filter(
          (c) => c.default_risk === level,
        );
        if (!group.length) return null;
        return (
          <View key={level} style={{ gap: 8 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: RISK[level].color,
              }}
            >
              Sugestão: {RISK[level].label} · {level}/4
            </Text>
            <View style={styles.grid}>
              {group.map((c) => {
                const selected = value === c.id;
                return (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityLabel={c.name}
                    accessibilityState={{ selected }}
                    onPress={() => onChange(c.id)}
                    style={({ pressed }) => [
                      styles.category,
                      selected && styles.selected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.iconBox,
                        selected && { backgroundColor: colors.green },
                      ]}
                    >
                      <AppIcon
                        name={categoryIcon(c.id)}
                        color={selected ? colors.white : colors.navy}
                        size={26}
                      />
                    </View>
                    <Text style={styles.categoryText}>{c.name}</Text>
                    {selected && (
                      <View style={styles.check}>
                        <AppIcon
                          name="selected"
                          color={colors.green}
                          size={18}
                        />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function RiskChoices({
  value,
  onChange,
}: {
  value: Risk;
  onChange: (risk: Risk) => void;
}) {
  return (
    <View style={styles.grid}>
      {([1, 2, 3, 4] as const).map((level) => {
        const selected = value === level,
          risk = RISK[level];
        return (
          <Pressable
            key={level}
            accessibilityRole="button"
            accessibilityLabel={`Risco ${level} de 4: ${risk.label}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(level)}
            style={({ pressed }) => [
              styles.risk,
              selected && {
                borderColor: risk.color,
                backgroundColor: ["#edf7f1", "#fff9e8", "#fff2e8", "#fff0f2"][
                  level - 1
                ],
              },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.riskHeading}>
              <Text style={[styles.level, { color: risk.color }]}>
                {level}
                <Text style={styles.total}> / 4</Text>
              </Text>
              {selected && (
                <AppIcon name="selected" color={risk.color} size={18} />
              )}
            </View>
            <Text style={[styles.riskText, { color: risk.color }]}>
              {risk.label}
            </Text>
            <View
              style={styles.meter}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {[1, 2, 3, 4].map((n) => (
                <View
                  key={n}
                  style={[
                    styles.segment,
                    {
                      backgroundColor: n <= level ? risk.color : colors.border,
                    },
                  ]}
                />
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  category: {
    flexBasis: "30%",
    flexGrow: 1,
    minWidth: 140,
    minHeight: 82,
    padding: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selected: { borderColor: colors.green, backgroundColor: "#edf7f2" },
  pressed: { opacity: 0.7 },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.light,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
    color: colors.navy,
    paddingRight: 6,
  },
  check: { position: "absolute", top: 5, right: 5 },
  risk: {
    flexBasis: "20%",
    flexGrow: 1,
    minWidth: 120,
    minHeight: 100,
    padding: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: 7,
  },
  riskHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 24,
  },
  level: { fontSize: 18, fontWeight: "800" },
  total: { fontSize: 12, fontWeight: "500", color: colors.muted },
  riskText: { fontSize: 16, fontWeight: "700" },
  meter: { flexDirection: "row", gap: 4, marginTop: 3 },
  segment: { height: 4, flex: 1, borderRadius: 3 },
});
