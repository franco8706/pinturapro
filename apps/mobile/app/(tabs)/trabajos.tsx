import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getOpenServiceRequests, formatARS } from "@/lib/queries";
import type { ServiceRequest } from "@/lib/types";
import { SUPABASE_READY } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { Button, Card, Mono } from "@/components/ui";
import { colors, space, type } from "@/lib/theme";

function budgetLabel(min: number | null, max: number | null): string {
  if (min && max) return `${formatARS(min)} – ${formatARS(max)}`;
  if (max) return `Hasta ${formatARS(max)}`;
  if (min) return `Desde ${formatARS(min)}`;
  return "A definir";
}

export default function TrabajosScreen() {
  const { session, role } = useAuth();
  const [items, setItems] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isClient = role === "client";
  const isPainter = role === "painter" || role === "company";

  const load = useCallback(async () => setItems(await getOpenServiceRequests()), []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load().finally(() => active && setLoading(false));
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />}
      ListHeaderComponent={
        <View style={{ marginBottom: space.sm, gap: space.md }}>
          <View>
            <Mono>Marketplace</Mono>
            <Text style={[type.displayLg, { color: colors.ink, marginTop: 4 }]}>Trabajos para cotizar</Text>
          </View>
          {isClient && <Button label="+ Publicar un trabajo" onPress={() => router.push("/publicar")} />}
          {!session && (
            <Card style={{ padding: space.md }}>
              <Text style={[type.bodySm, { color: colors.concrete }]}>
                Ingresá para publicar un trabajo (cliente) o enviar cotizaciones (pintor).
              </Text>
            </Card>
          )}
        </View>
      }
      ListEmptyComponent={
        <Card style={{ padding: space.lg }}>
          <Text style={[type.bodyMd, { color: colors.concrete }]}>
            {SUPABASE_READY ? "Todavía no hay trabajos publicados." : "Configurá Supabase en .env para ver datos."}
          </Text>
        </Card>
      }
      renderItem={({ item }) => {
        const mine = session?.user?.id === item.ownerId;
        return (
          <Card style={{ padding: space.md, gap: space.sm }}>
            <Text style={[type.displayMd, { color: colors.ink }]}>{item.title}</Text>
            {item.description ? <Text style={[type.bodySm, { color: colors.concrete }]}>{item.description}</Text> : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
              {item.location ? <Text style={[type.bodySm, { color: colors.concrete }]}>📍 {item.location}</Text> : null}
              <Text style={[type.bodySm, { color: colors.concrete }]}>💰 {budgetLabel(item.budgetMin, item.budgetMax)}</Text>
              <Text style={[type.bodySm, { color: colors.concrete }]}>Cliente: {item.ownerName}</Text>
            </View>
            {isPainter && !mine && (
              <Button
                label="Cotizar este trabajo"
                onPress={() =>
                  router.push({
                    pathname: "/cotizar/[id]",
                    params: { id: item.id, clientId: item.ownerId, title: item.title },
                  })
                }
              />
            )}
            {mine && <Text style={[type.bodySm, { color: colors.amber }]}>Tu publicación</Text>}
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.plaster },
});
