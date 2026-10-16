import { View, type ColorValue } from "react-native";
import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";

const symbols = {
  violence: ["person.fill.xmark", "personal_injury"],
  blocked: ["signpost.right.fill", "traffic"],
  robbery: ["hand.raised.fill", "front_hand"],
  missing: ["person.crop.circle.badge.questionmark", "person_search"],
  other: ["ellipsis.circle", "more_horiz"],
  fire: ["flame.fill", "local_fire_department"],
  theft: ["bag.fill", "shopping_bag"],
  animal: ["pawprint.fill", "pets"],
  accident: ["car.fill", "car_crash"],
  map: ["map.fill", "map"],
  report: ["plus.circle.fill", "add_circle"],
  contribute: ["checkmark.bubble.fill", "fact_check"],
  history: ["list.bullet.rectangle", "format_list_bulleted"],
  profile: ["person.crop.circle", "person"],
  selected: ["checkmark.circle.fill", "check_circle"],
} as const satisfies Record<string, readonly [SFSymbol, AndroidSymbol]>;
export type IconName = keyof typeof symbols;
export function categoryIcon(id: string): IconName {
  return Object.hasOwn(symbols, id) &&
    !["map", "report", "contribute", "history", "profile", "selected"].includes(
      id,
    )
    ? (id as IconName)
    : "other";
}
// Labels are provided by the enclosing control; decorative icons stay silent.
export function AppIcon({
  name,
  color = "#173347",
  size = 24,
}: {
  name: IconName;
  color?: ColorValue;
  size?: number;
}) {
  const [ios, material] = symbols[name];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <SymbolView
        name={{ ios, android: material, web: material }}
        tintColor={color}
        size={size}
      />
    </View>
  );
}
