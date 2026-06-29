import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { getOpenServiceRequests, formatARS } from "@/lib/queries";
import type { ServiceRequest } from "@/lib/types";
import { SUPABASE_READY } from "@/lib/supabase";
import { Card, Mono } from "@/components/ui";
import { colors, space, type } from "@/lib/theme";

function budgetLabel(min: number | null, max: number | null): string {
  if (min && max) return `${formatARS(min)} – ${formatARS(max)}`;
  if (max) return `Hasta ${formatARS(max)}`;
  if (min) return `Desde ${formatARS(min)}`;
  return "A definir";
}

export default function TrabajosScreen() {
  const [items, setItems] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => setItems(await getOpenServiceRequests()), []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

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
        <View style={{ marginBottom: space.sm }}>
          <Mono>Marketplace</Mono>
          <Text style={[type.displayLg, { color: colors.ink, marginTop: 4 }]}>Trabajos para cotizar</Text>
        </View>
      }
      ListEmptyComponent={
        <Card style={{ padding: space.lg }}>
          <Text style={[type.bodyMd, { color: colors.concrete }]}>
            {SUPABASE_READY ? "Todavía no hay trabajos publicados." : "Configurá Supabase en .env para ver datos."}
          </Text>
        </Card>
      }
      renderItem={({ item }) => (
        <Card style={{ padding: space.md }}>
          <Text style={[type.displayMd, { color: colors.ink }]}>{item.title}</Text>
          {item.description ? (
            <Text style={[type.bodySm, { color: colors.concrete, marginTop: 4 }]}>{item.description}</Text>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md, marginTop: space.sm }}>
            {item.location ? <Text style={[type.bodySm, { color: colors.concrete }]}>📍 {item.location}</Text> : null}
            <Text style={[type.bodySm, { color: colors.concrete }]}>💰 {budgetLabel(item.budgetMin, item.budgetMax)}</Text>
            <Text style={[type.bodySm, { color: colors.concrete }]}>Cliente: {item.ownerName}</Text>
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.plaster },
});
