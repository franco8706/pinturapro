import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { publicarTrabajo } from "@/lib/mutations";
import { useAuth } from "@/context/auth";
import { Button, Field, Mono, Note } from "@/components/ui";
import { colors, space, type } from "@/lib/theme";

export default function PublicarScreen() {
  const { session } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError("");
    setLoading(true);
    const res = await publicarTrabajo({ title, description, location, budgetMin, budgetMax });
    setLoading(false);
    if (res.error) return setError(res.error);
    router.back();
  }

  if (!session) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: space.lg }}>
        <Text style={[type.bodyMd, { color: colors.concrete, marginBottom: space.md }]}>
          Tenés que iniciar sesión para publicar un trabajo.
        </Text>
        <Button label="Ingresar" onPress={() => router.replace("/login")} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
        <View>
          <Mono>Nuevo pedido</Mono>
          <Text style={[type.displayMd, { color: colors.ink, marginTop: 4 }]}>Publicá tu trabajo</Text>
          <Text style={[type.bodySm, { color: colors.concrete, marginTop: 4 }]}>
            Contanos qué necesitás. Los pintores verificados te van a enviar cotizaciones.
          </Text>
        </View>

        <Field label="Título" value={title} onChangeText={setTitle} placeholder="Ej: Pintar living y cocina" />
        <Field
          label="Descripción"
          value={description}
          onChangeText={setDescription}
          placeholder="Superficie, estado de las paredes, color, plazos…"
          multiline
        />
        <Field label="Zona" value={location} onChangeText={setLocation} placeholder="Ej: Caballito, CABA" />
        <View style={{ flexDirection: "row", gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Field label="Presup. mín" value={budgetMin} onChangeText={setBudgetMin} placeholder="$" keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Presup. máx" value={budgetMax} onChangeText={setBudgetMax} placeholder="$" keyboardType="numeric" />
          </View>
        </View>

        {error ? <Note>{error}</Note> : null}

        <Button label="Publicar trabajo" onPress={onSubmit} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
