import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/context/auth";
import { getQuotesForClient, getJobsForPainter, formatARS } from "@/lib/queries";
import { aceptarCotizacion, marcarCompletado } from "@/lib/mutations";
import type { Quote, PainterJob } from "@/lib/types";
import { Avatar, Badge, Button, Card, Mono, Stars } from "@/components/ui";
import { colors, space, type } from "@/lib/theme";

const ROLE_LABEL: Record<string, string> = { client: "Cliente", painter: "Pintor", company: "Empresa" };
const STATUS_LABEL: Record<string, string> = {
  quoted: "Cotizado",
  accepted: "Aceptado",
  completed: "Completado",
  cancelled: "Cancelado",
};

export default function CuentaScreen() {
  const { session, role, loading, signOut } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [jobs, setJobs] = useState<PainterJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) return;
    if (role === "client") setQuotes(await getQuotesForClient(uid));
    else if (role === "painter" || role === "company") setJobs(await getJobsForPainter(uid));
  }, [session?.user?.id, role]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setBusy(true);
      load().finally(() => active && setBusy(false));
      return () => {
        active = false;
      };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function onAccept(id: string) {
    setActingId(id);
    const res = await aceptarCotizacion(id);
    setActingId(null);
    if (!res.error) load();
  }

  async function onComplete(id: string) {
    setActingId(id);
    const res = await marcarCompletado(id);
    setActingId(null);
    if (!res.error) load();
  }

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
  const isClient = role === "client";
  const isPainter = role === "painter" || role === "company";

  return (
    <ScrollView
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />}
    >
      <View>
        <Mono>Tu cuenta</Mono>
        <Text style={[type.displayLg, { color: colors.ink, marginTop: 4 }]}>Hola de nuevo</Text>
      </View>

      <Card style={{ padding: space.md, gap: 6 }}>
        <Text style={[type.bodyMd, { color: colors.ink }]}>{email}</Text>
        {role ? <Mono>{ROLE_LABEL[role] ?? role}</Mono> : null}
      </Card>

      {isClient && (
        <Button label="+ Publicar un trabajo" onPress={() => router.push("/publicar")} />
      )}
      {isPainter && (
        <Button label="Editar mi perfil" variant="ghost" onPress={() => router.push("/perfil")} />
      )}

      <View style={{ marginTop: space.sm }}>
        <Text style={[type.displayMd, { color: colors.ink }]}>
          {isClient ? "Cotizaciones recibidas" : "Mis trabajos"}
        </Text>
      </View>

      {busy ? (
        <ActivityIndicator color={colors.ink} style={{ marginTop: space.lg }} />
      ) : isClient ? (
        quotes.length === 0 ? (
          <Empty text="Todavía no recibiste cotizaciones. Publicá un trabajo para empezar." />
        ) : (
          quotes.map((q) => (
            <Card key={q.id} style={{ padding: space.md, gap: space.sm }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={[type.displayMd, { color: colors.ink, flex: 1, paddingRight: space.sm }]}>{q.projectTitle}</Text>
                <Badge>{STATUS_LABEL[q.status] ?? q.status}</Badge>
              </View>
              <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
                <Avatar uri={q.painterImage} name={q.painterName} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyMd, { color: colors.ink }]}>{q.painterName}</Text>
                  <Stars rating={q.painterRating} />
                </View>
                <Text style={[type.displayMd, { color: colors.ink }]}>{formatARS(q.amount)}</Text>
              </View>
              {q.note ? <Text style={[type.bodySm, { color: colors.concrete }]}>“{q.note}”</Text> : null}

              {q.status === "quoted" && (
                <Button label="Aceptar cotización" loading={actingId === q.id} onPress={() => onAccept(q.id)} />
              )}
              {q.status === "completed" && !q.reviewed && (
                <Button
                  label="Dejar reseña"
                  variant="ghost"
                  onPress={() =>
                    router.push({
                      pathname: "/resena/[jobId]",
                      params: { jobId: q.id, painterId: q.painterId, painterName: q.painterName },
                    })
                  }
                />
              )}
              {q.status === "completed" && q.reviewed && (
                <Text style={[type.bodySm, { color: colors.success }]}>✓ Ya dejaste tu reseña</Text>
              )}
            </Card>
          ))
        )
      ) : isPainter ? (
        jobs.length === 0 ? (
          <Empty text="Todavía no enviaste cotizaciones. Mirá la pestaña Trabajos para cotizar." />
        ) : (
          jobs.map((j) => (
            <Card key={j.id} style={{ padding: space.md, gap: space.sm }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={[type.displayMd, { color: colors.ink, flex: 1, paddingRight: space.sm }]}>{j.projectTitle}</Text>
                <Badge>{STATUS_LABEL[j.status] ?? j.status}</Badge>
              </View>
              <Text style={[type.bodySm, { color: colors.concrete }]}>Cliente: {j.clientName}</Text>
              <Text style={[type.displayMd, { color: colors.ink }]}>{formatARS(j.amount)}</Text>
              {j.note ? <Text style={[type.bodySm, { color: colors.concrete }]}>“{j.note}”</Text> : null}

              {j.status === "accepted" && (
                <Button label="Marcar como completado" loading={actingId === j.id} onPress={() => onComplete(j.id)} />
              )}
            </Card>
          ))
        )
      ) : (
        <Empty text="Tu rol no tiene panel de marketplace." />
      )}

      <Button label="Cerrar sesión" variant="ghost" onPress={signOut} />
    </ScrollView>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Card style={{ padding: space.lg }}>
      <Text style={[type.bodyMd, { color: colors.concrete }]}>{text}</Text>
    </Card>
  );
}
