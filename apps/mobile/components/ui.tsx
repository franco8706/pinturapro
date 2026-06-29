import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
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

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize = "sentences",
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words";
  hint?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[type.mono, { color: colors.concrete }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.concrete}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[
          styles.input,
          multiline && { height: 110, textAlignVertical: "top", paddingTop: space.sm },
        ]}
      />
      {hint ? <Text style={[type.bodySm, { color: colors.concrete }]}>{hint}</Text> : null}
    </View>
  );
}

export function Note({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "success" }) {
  const c = tone === "error" ? colors.danger ?? "#B4332B" : colors.success;
  return (
    <View style={{ borderLeftWidth: 3, borderLeftColor: c, paddingLeft: space.sm, paddingVertical: 4 }}>
      <Text style={[type.bodySm, { color: c }]}>{children}</Text>
    </View>
  );
}

export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: space.sm }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Text style={{ fontSize: 30, color: n <= value ? colors.amber : colors.line }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
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
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bone,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: colors.ink,
    fontSize: 16,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.mist,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
});
