import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { getPainterById, getProjectsByOwner } from "@/lib/queries";
import type { PainterDetail, Project } from "@/lib/types";
import { Avatar, Badge, Card, Mono, Stars } from "@/components/ui";
import { colors, space, type } from "@/lib/theme";

export default function PintorDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [painter, setPainter] = useState<PainterDetail | null>(null);
  const [portfolio, setPortfolio] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([getPainterById(id), getProjectsByOwner(id)])
      .then(([p, proj]) => {
        setPainter(p);
        setPortfolio(proj);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  if (!painter) {
    return (
      <View style={styles.center}>
        <Text style={[type.bodyMd, { color: colors.concrete }]}>No encontramos este pintor.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <Stack.Screen options={{ title: painter.name }} />

      <View style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
        <Avatar uri={painter.image} name={painter.name} size={72} />
        <View style={{ flex: 1 }}>
          <Text style={[type.displayMd, { color: colors.ink }]}>{painter.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: 4 }}>
            <Stars rating={painter.rating} />
            <Text style={[type.bodySm, { color: colors.concrete }]}>
              {painter.rating.toFixed(1)} · {painter.reviews} reseñas
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6, marginTop: space.sm }}>
            <Badge>{painter.level}</Badge>
            {painter.zone ? <Badge>{painter.zone}</Badge> : null}
          </View>
        </View>
      </View>

      {painter.bio ? <Text style={[type.bodyLg, { color: colors.concrete }]}>{painter.bio}</Text> : null}

      {painter.specialty.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {painter.specialty.map((s) => (
            <Badge key={s}>{s}</Badge>
          ))}
        </View>
      )}

      {painter.pros.length > 0 && (
        <View>
          <Mono style={{ marginBottom: space.sm }}>Puntos a favor</Mono>
          {painter.pros.map((p) => (
            <Text key={p} style={[type.bodyMd, { color: colors.ink, marginBottom: 4 }]}>
              <Text style={{ color: colors.success }}>✓ </Text>
              {p}
            </Text>
          ))}
        </View>
      )}

      {painter.cons.length > 0 && (
        <View>
          <Mono style={{ marginBottom: space.sm }}>A tener en cuenta</Mono>
          {painter.cons.map((c) => (
            <Text key={c} style={[type.bodyMd, { color: colors.concrete, marginBottom: 4 }]}>
              <Text style={{ color: colors.amber }}>− </Text>
              {c}
            </Text>
          ))}
        </View>
      )}

      {portfolio.length > 0 && (
        <View>
          <Mono style={{ marginBottom: space.sm }}>Portfolio</Mono>
          <View style={{ gap: space.md }}>
            {portfolio.map((proj) => (
              <Card key={proj.id} style={{ overflow: "hidden" }}>
                {proj.cover?.startsWith("http") ? (
                  <Image source={{ uri: proj.cover }} style={{ width: "100%", height: 180, backgroundColor: colors.mist }} />
                ) : (
                  <View style={{ height: 180, backgroundColor: colors.mist, alignItems: "center", justifyContent: "center" }}>
                    <Mono>{proj.title}</Mono>
                  </View>
                )}
                <View style={{ padding: space.md }}>
                  <Text style={[type.displayMd, { color: colors.ink }]}>{proj.title}</Text>
                  {proj.location ? <Text style={[type.bodySm, { color: colors.concrete }]}>{proj.location}</Text> : null}
                </View>
              </Card>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.plaster },
});
