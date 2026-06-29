import { useState } from "react";
import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase, SUPABASE_READY } from "@/lib/supabase";
import { Button, Mono } from "@/components/ui";
import { colors, space, type } from "@/lib/theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError("");
    if (!SUPABASE_READY) {
      setError("Falta configurar Supabase (.env).");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setError(/invalid login/i.test(error.message) ? "Email o contraseña incorrectos." : error.message);
      return;
    }
    router.back();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
      <View style={styles.inner}>
        <Mono>Pintura Pro</Mono>
        <Text style={[type.displayLg, { color: colors.ink, marginTop: space.sm, marginBottom: space.lg }]}>
          Ingresá a tu cuenta
        </Text>

        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />

        {error ? <Text style={[type.bodySm, { color: colors.danger, marginBottom: space.md }]}>{error}</Text> : null}

        <Button label="Ingresar" onPress={onSubmit} loading={loading} />
        <Text style={[type.bodySm, { color: colors.concrete, marginTop: space.md }]}>
          Demo: martin.rojas@pinturapro.demo · Demo1234!
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <View style={{ marginBottom: space.md }}>
      <Mono style={{ marginBottom: 6 }}>{label}</Mono>
      <TextInput
        {...rest}
        placeholderTextColor={colors.concrete}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.plaster },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: space.lg },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bone,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
});
