import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { cotizar } from "@/lib/mutations";
import { useAuth } from "@/context/auth";
import { Button, Field, Mono, Note } from "@/components/ui";
import { colors, space, type } from "@/lib/theme";

export default function CotizarScreen() {
  const { id, clientId, title } = useLocalSearchParams<{ id: string; clientId: string; title: string }>();
  const { session } = useAuth();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError("");
    setLoading(true);
    const res = await cotizar({ projectId: id, clientId, amount, note });
    setLoading(false);
    if (res.error) return setError(res.error);
    router.back();
  }

  if (!session) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: space.lg }}>
        <Text style={[type.bodyMd, { color: colors.concrete, marginBottom: space.md }]}>
          Tenés que iniciar sesión para cotizar.
        </Text>
        <Button label="Ingresar" onPress={() => router.replace("/login")} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
        <View>
          <Mono>Tu cotización</Mono>
          <Text style={[type.displayMd, { color: colors.ink, marginTop: 4 }]}>{title ?? "Trabajo"}</Text>
          <Text style={[type.bodySm, { color: colors.concrete, marginTop: 4 }]}>
            Enviá un monto claro y un mensaje breve. El cliente compara y elige.
          </Text>
        </View>

        <Field
          label="Monto (ARS)"
          value={amount}
          onChangeText={setAmount}
          placeholder="$"
          keyboardType="numeric"
          hint="Incluí mano de obra y materiales. Se aplica 10% de comisión."
        />
        <Field
          label="Mensaje al cliente"
          value={note}
          onChangeText={setNote}
          placeholder="Qué incluye, plazos, manos de pintura, marca…"
          multiline
        />

        {error ? <Note>{error}</Note> : null}

        <Button label="Enviar cotización" onPress={onSubmit} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
