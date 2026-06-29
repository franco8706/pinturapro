import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { dejarResena } from "@/lib/mutations";
import { Button, Field, Mono, Note, StarPicker } from "@/components/ui";
import { colors, space, type } from "@/lib/theme";

export default function ResenaScreen() {
  const { jobId, painterId, painterName } = useLocalSearchParams<{
    jobId: string;
    painterId: string;
    painterName: string;
  }>();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError("");
    setLoading(true);
    const res = await dejarResena({ jobId, painterId, rating, comment });
    setLoading(false);
    if (res.error) return setError(res.error);
    router.back();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View>
          <Mono>Tu reseña</Mono>
          <Text style={[type.displayMd, { color: colors.ink, marginTop: 4 }]}>
            ¿Cómo fue trabajar con {painterName ?? "el pintor"}?
          </Text>
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={[type.mono, { color: colors.concrete }]}>Calificación</Text>
          <StarPicker value={rating} onChange={setRating} />
        </View>

        <Field
          label="Comentario (opcional)"
          value={comment}
          onChangeText={setComment}
          placeholder="Puntualidad, prolijidad, terminación…"
          multiline
        />

        {error ? <Note>{error}</Note> : null}

        <Button label="Publicar reseña" onPress={onSubmit} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
