import { Tabs } from "expo-router";
import { type ColorValue } from "react-native";
import { AppIcon, type IconName } from "../../src/components/icons";
import { colors } from "../../src/components/ui";
const icon = (name: IconName) =>
  function TabIcon(props: { color: ColorValue }) {
    return <AppIcon name={name} size={25} color={props.color} />;
  };
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTitle: "SafeNow  ✓",
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: "white",
        tabBarActiveTintColor: colors.green,
        tabBarStyle: { minHeight: 66, paddingTop: 5 },
        tabBarLabelStyle: { fontSize: 11, paddingBottom: 5 },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{ title: "Mapa", tabBarIcon: icon("map") }}
      />
      <Tabs.Screen
        name="report"
        options={{ title: "Relatar", tabBarIcon: icon("report") }}
      />
      <Tabs.Screen
        name="pending"
        options={{ title: "Contribuir", tabBarIcon: icon("contribute") }}
      />
      <Tabs.Screen
        name="mine"
        options={{ title: "Meus alertas", tabBarIcon: icon("history") }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Perfil", tabBarIcon: icon("profile") }}
      />
    </Tabs>
  );
}
