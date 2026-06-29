import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { colors, radius, space, type } from "@/lib/theme";

export function Mono({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.mono, style]}>{children}</Text>;
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[type.displayLg, { color: colors.ink }, style]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
}) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        isPrimary ? styles.btnPrimary : styles.btnGhost,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.bone : colors.ink} />
      ) : (
        <Text style={[type.bodyMd, { color: isPrimary ? colors.bone : colors.ink, fontWeight: "500" }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <View style={styles.badge}>
      <Text style={[type.mono, { color: colors.ink }]}>{children}</Text>
    </View>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <Text style={{ color: colors.amber, fontSize: 14 }}>
      {"★".repeat(Math.round(rating))}
      <Text style={{ color: colors.line }}>{"★".repeat(5 - Math.round(rating))}</Text>
    </Text>
  );
}

export function Avatar({ uri, name, size = 56 }: { uri?: string; name: string; size?: number }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  if (uri && uri.startsWith("http")) {
    return (
      <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius.full, backgroundColor: colors.mist }} />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: colors.mist,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={[type.displayMd, { color: colors.concrete }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mono: { ...type.mono, color: colors.concrete },
  btn: {
    height: 50,
    borderRadius: radius.none,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  btnPrimary: { backgroundColor: colors.ink },
  btnGhost: { borderWidth: 1, borderColor: colors.line, backgroundColor: "transparent" },
  card: {
    backgroundColor: colors.bone,
    borderWidth: 1,
    borderColor: colors.line,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.mist,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
});
