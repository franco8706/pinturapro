import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { getPainters } from "@/lib/queries";
import type { Painter } from "@/lib/types";
import { SUPABASE_READY } from "@/lib/supabase";
import { Avatar, Badge, Card, Mono } from "@/components/ui";
import { colors, space, type } from "@/lib/theme";

export default function PintoresScreen() {
  const [painters, setPainters] = useState<Painter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getPainters();
    setPainters(data);
  }, []);

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
      data={painters}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />}
      ListHeaderComponent={
        <View style={{ marginBottom: space.sm }}>
          <Mono>Directorio</Mono>
          <Text style={[type.displayLg, { color: colors.ink, marginTop: 4 }]}>Pintores verificados</Text>
        </View>
      }
      ListEmptyComponent={
        <Card style={{ padding: space.lg }}>
          <Text style={[type.bodyMd, { color: colors.concrete }]}>
            {SUPABASE_READY ? "Todavía no hay pintores para mostrar." : "Configurá Supabase en .env para ver datos."}
          </Text>
        </Card>
      }
      renderItem={({ item }) => (
        <Link href={`/pintor/${item.id}`} asChild>
          <Pressable>
            {({ pressed }) => (
              <Card style={[{ padding: space.md, flexDirection: "row", gap: space.md }, pressed && { opacity: 0.85 }]}>
                <Avatar uri={item.image} name={item.name} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[type.displayMd, { color: colors.ink, flexShrink: 1 }]}>{item.name}</Text>
                    <Text style={[type.bodySm, { color: colors.ink }]}>★ {item.rating.toFixed(1)}</Text>
                  </View>
                  <Text style={[type.bodySm, { color: colors.concrete, marginTop: 2 }]}>
                    {item.zone} · {item.reviews} reseñas
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.sm }}>
                    <Badge>{item.level}</Badge>
                    {item.specialty.slice(0, 2).map((s) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                  </View>
                </View>
              </Card>
            )}
          </Pressable>
        </Link>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.plaster },
});
