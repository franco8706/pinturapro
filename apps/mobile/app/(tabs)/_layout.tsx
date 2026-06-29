import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "@/lib/theme";

function Icon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ fontSize: 18, color }}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.plaster },
        headerTitleStyle: { fontWeight: "700", color: colors.ink },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.concrete,
        tabBarStyle: { backgroundColor: colors.bone, borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Pintores", tabBarIcon: ({ color }) => <Icon glyph="◐" color={color} /> }}
      />
      <Tabs.Screen
        name="trabajos"
        options={{ title: "Trabajos", tabBarIcon: ({ color }) => <Icon glyph="▦" color={color} /> }}
      />
      <Tabs.Screen
        name="cuenta"
        options={{ title: "Cuenta", tabBarIcon: ({ color }) => <Icon glyph="◍" color={color} /> }}
      />
    </Tabs>
  );
}
