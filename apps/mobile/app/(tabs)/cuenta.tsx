import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useAuth } from "@/context/auth";
import { Button, Card, Mono } from "@/components/ui";
import { colors, space, type } from "@/lib/theme";

const ROLE_LABEL: Record<string, string> = {
  client: "Cliente",
  painter: "Pintor",
  company: "Empresa",
};

export default function CuentaScreen() {
  const { session, role, loading, signOut } = useAuth();

  if (loading) return null;

  if (!session) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: space.lg, backgroundColor: colors.plaster }}>
        <Mono>Tu cuenta</Mono>
        <Text style={[type.displayLg, { color: colors.ink, marginTop: space.sm, marginBottom: space.md }]}>
          Ingresá para gestionar tu actividad
        </Text>
        <Text style={[type.bodyMd, { color: colors.concrete, marginBottom: space.lg }]}>
          Como cliente publicás trabajos y recibís cotizaciones. Como pintor cotizás y gestionás tu portfolio.
        </Text>
        <Button label="Ingresar" onPress={() => router.push("/login")} />
      </View>
    );
  }

  const email = session.user.email ?? "";

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
      <View>
        <Mono>Tu cuenta</Mono>
        <Text style={[type.displayLg, { color: colors.ink, marginTop: 4 }]}>Hola de nuevo</Text>
      </View>

      <Card style={{ padding: space.md, gap: 6 }}>
        <Text style={[type.bodyMd, { color: colors.ink }]}>{email}</Text>
        {role ? <Mono>{ROLE_LABEL[role] ?? role}</Mono> : null}
      </Card>

      <Card style={{ padding: space.md, gap: space.sm }}>
        <Text style={[type.bodySm, { color: colors.concrete }]}>
          Próximamente desde la app: {role === "client" ? "publicar trabajos y aceptar cotizaciones" : "cotizar trabajos y editar tu perfil"}.
        </Text>
      </Card>

      <Button label="Cerrar sesión" variant="ghost" onPress={signOut} />
    </ScrollView>
  );
}
