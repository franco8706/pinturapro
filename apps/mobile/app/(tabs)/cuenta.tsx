import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, RefreshControl, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/context/auth";
import { getQuotesForClient, getJobsForPainter, getMiAcceso, formatARS } from "@/lib/queries";
import { aceptarCotizacion, cancelarTrabajo, marcarCompletado } from "@/lib/mutations";
import type { Quote, PainterJob } from "@/lib/types";
import { Avatar, Badge, Button, Card, Mono, Stars, Note } from "@/components/ui";
import { colors, space, type } from "@/lib/theme";

const ROLE_LABEL: Record<string, string> = { client: "Cliente", painter: "Pintor", company: "Empresa" };
const STATUS_LABEL: Record<string, string> = {
  quoted: "Cotizado",
  accepted: "Aceptado",
  in_progress: "En curso",
  completed: "Completado",
  cancelled: "Cancelado",
};

export default function CuentaScreen() {
  const { session, role, loading, signOut } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [jobs, setJobs] = useState<PainterJob[]>([]);
  const [acceso, setAcceso] = useState<{ puedeCotizar: boolean; texto: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) return;
    if (role === "client") setQuotes(await getQuotesForClient(uid));
    else if (role === "painter" || role === "company") {
      const [trabajos, miAcceso] = await Promise.all([getJobsForPainter(uid), getMiAcceso(uid)]);
      setJobs(trabajos);
      setAcceso(miAcceso);
    }
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

  const [actionError, setActionError] = useState("");

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // El error se muestra: antes estas dos funciones hacían `if (!res.error) load()` y
  // descartaban el fallo entero. El botón volvía a habilitarse, nada cambiaba en pantalla y
  // la persona no tenía forma de saber por qué. Pasa de verdad: los triggers de la migración
  // 0009 rechazan transiciones cuando la pantalla quedó desactualizada.
  async function onAccept(id: string) {
    setActingId(id);
    setActionError("");
    const res = await aceptarCotizacion(id);
    setActingId(null);
    if (res.error) return setActionError(res.error);
    load();
  }

  async function onComplete(id: string) {
    setActingId(id);
    setActionError("");
    const res = await marcarCompletado(id);
    setActingId(null);
    if (res.error) return setActionError(res.error);
    load();
  }

  /**
   * Cancelar pide confirmación: no se deshace, y del otro lado hay alguien esperando. Un botón
   * que cancela con un toque, en una pantalla que se scrollea con el dedo, se aprieta sin querer.
   */
  function onCancel(id: string, titulo: string, detalle: string) {
    Alert.alert(titulo, detalle, [
      { text: "Volver", style: "cancel" },
      {
        text: "Sí, cancelar",
        style: "destructive",
        onPress: async () => {
          setActingId(id);
          setActionError("");
          const res = await cancelarTrabajo(id);
          setActingId(null);
          if (res.error) return setActionError(res.error);
          load();
        },
      },
    ]);
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

      {actionError ? <Note>{actionError}</Note> : null}

      {isClient && (
        <Button label="+ Publicar un trabajo" onPress={() => router.push("/publicar")} />
      )}
      {isPainter && (
        <Button label="Editar mi perfil" variant="ghost" onPress={() => router.push("/perfil")} />
      )}
      {/* El estado de la suscripción, en palabras y sin precio ni enlace: la app no la vende. */}
      {isPainter && acceso ? (
        <Text style={[type.bodySm, { color: acceso.puedeCotizar ? colors.concrete : colors.danger }]}>
          {acceso.texto}
        </Text>
      ) : null}

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
              {(q.status === "accepted" || q.status === "in_progress") && (
                <Button
                  label="Cancelar este trabajo"
                  variant="ghost"
                  loading={actingId === q.id}
                  onPress={() =>
                    onCancel(
                      q.id,
                      "¿Cancelar el trabajo?",
                      "El pintor lo va a ver en su panel y tu pedido vuelve a publicarse para recibir cotizaciones nuevas.",
                    )
                  }
                />
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
              {j.status === "quoted" && (
                <Button
                  label="Retirar cotización"
                  variant="ghost"
                  loading={actingId === j.id}
                  onPress={() => onCancel(j.id, "¿Retirar la cotización?", "El cliente deja de verla entre sus opciones.")}
                />
              )}
              {(j.status === "accepted" || j.status === "in_progress") && (
                <Button
                  label="No puedo tomarlo"
                  variant="ghost"
                  loading={actingId === j.id}
                  onPress={() =>
                    onCancel(
                      j.id,
                      "¿Dejar el trabajo?",
                      "El cliente lo va a ver en su panel y el pedido vuelve a publicarse para que lo tome otro pintor.",
                    )
                  }
                />
              )}
            </Card>
          ))
        )
      ) : (
        <Empty text="Tu rol no tiene panel de marketplace." />
      )}

      {/* Descargar los datos y eliminar la cuenta existen en la web y se hacen solos, sin
          pedirle nada a nadie (Ley 25.326). La app no los ofrecía ni decía dónde estaban. Se
          manda a la web en vez de duplicar las dos pantallas: la baja necesita la clave de
          servicio, que nunca va en una app. Sin la dirección del sitio configurada, se dice
          dónde está en vez de mostrar un botón que no lleva a ningún lado. */}
      <Card style={{ padding: space.md, gap: space.sm }}>
        <Text style={[type.bodyMd, { color: colors.ink }]}>Tus datos y tu cuenta</Text>
        <Text style={[type.bodySm, { color: colors.concrete }]}>
          Podés descargar todo lo que Pintura Pro tiene sobre vos, o eliminar tu cuenta, desde "Mis datos y mi
          cuenta" en la web, con el mismo email y contraseña.
        </Text>
        {process.env.EXPO_PUBLIC_SITE_URL ? (
          <Button
            label="Abrir mis datos y mi cuenta"
            variant="ghost"
            onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_SITE_URL}/mi-cuenta`)}
          />
        ) : null}
      </Card>

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
