import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { getMyProfile } from "@/lib/queries";
import { updateMyProfile } from "@/lib/mutations";
import { useAuth } from "@/context/auth";
import { Button, Field, Mono, Note } from "@/components/ui";
import { colors, space, type } from "@/lib/theme";

/** Convierte líneas/comas en array y viceversa. */
const toList = (s: string) =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);
const fromList = (a: string[]) => a.join("\n");

export default function PerfilScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }
    getMyProfile(uid)
      .then((p) => {
        if (!p) return;
        setFullName(p.fullName);
        setBio(p.bio);
        setLocation(p.location);
        setSpecialties(fromList(p.specialties));
        setPros(fromList(p.pros));
        setCons(fromList(p.cons));
      })
      .finally(() => setLoading(false));
  }, [session?.user?.id]);

  async function onSave() {
    const uid = session?.user?.id;
    if (!uid) return;
    setError("");
    setOk(false);
    setSaving(true);
    const res = await updateMyProfile(uid, {
      fullName,
      bio,
      location,
      specialties: toList(specialties),
      pros: toList(pros),
      cons: toList(cons),
    });
    setSaving(false);
    if (res.error) return setError(res.error);
    setOk(true);
    setTimeout(() => router.back(), 700);
  }

  if (!session) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: space.lg }}>
        <Text style={[type.bodyMd, { color: colors.concrete, marginBottom: space.md }]}>
          Tenés que iniciar sesión para editar tu perfil.
        </Text>
        <Button label="Ingresar" onPress={() => router.replace("/login")} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
        <View>
          <Mono>Tu perfil</Mono>
          <Text style={[type.displayMd, { color: colors.ink, marginTop: 4 }]}>Editar perfil profesional</Text>
        </View>

        <Field label="Nombre" value={fullName} onChangeText={setFullName} placeholder="Nombre y apellido" autoCapitalize="words" />
        <Field label="Bio" value={bio} onChangeText={setBio} placeholder="Tu experiencia, estilo y trayectoria…" multiline />
        <Field label="Zona" value={location} onChangeText={setLocation} placeholder="Ej: Zona Norte, GBA" />
        <Field
          label="Especialidades"
          value={specialties}
          onChangeText={setSpecialties}
          placeholder={"Interiores\nExteriores\nImpermeabilización"}
          multiline
          hint="Una por línea (o separadas por coma)."
        />
        <Field
          label="Puntos a favor"
          value={pros}
          onChangeText={setPros}
          placeholder={"Puntualidad\nProlijidad\nPresupuesto claro"}
          multiline
          hint="Una por línea. Se muestran como ✓ en tu perfil."
        />
        <Field
          label="A tener en cuenta"
          value={cons}
          onChangeText={setCons}
          placeholder={"Solo trabaja días de semana"}
          multiline
          hint="Opcional. Honestidad genera confianza."
        />

        {error ? <Note>{error}</Note> : null}
        {ok ? <Note tone="success">Perfil actualizado.</Note> : null}

        <Button label="Guardar cambios" onPress={onSave} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
