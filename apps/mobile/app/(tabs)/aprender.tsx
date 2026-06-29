import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { getResources, getNews, getFaqs } from "@/lib/queries";
import type { Resource, ResourceKind, NewsItem, Faq } from "@/lib/types";
import { SUPABASE_READY } from "@/lib/supabase";
import { Badge, Card, Mono } from "@/components/ui";
import { colors, space, type } from "@/lib/theme";

type Tab = "guide" | "video" | "course" | "advice" | "faq" | "news";

const TABS: { key: Tab; label: string }[] = [
  { key: "guide", label: "Guías" },
  { key: "video", label: "Videos" },
  { key: "course", label: "Cursos" },
  { key: "advice", label: "Asesoramiento" },
  { key: "faq", label: "Antes de pedir" },
  { key: "news", label: "Novedades" },
];

export default function AprenderScreen() {
  const [tab, setTab] = useState<Tab>("guide");
  const [resources, setResources] = useState<Resource[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [r, n, f] = await Promise.all([getResources(), getNews(), getFaqs()]);
    setResources(r);
    setNews(n);
    setFaqs(f);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const open = (url: string) => url && Linking.openURL(url.startsWith("http") ? url : `https://pinturapro.app${url}`);

  return (
    <ScrollView
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />}
    >
      <View>
        <Mono>Centro de aprendizaje</Mono>
        <Text style={[type.displayLg, { color: colors.ink, marginTop: 4 }]}>Aprendé y mejorá</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                backgroundColor: active ? colors.ink : colors.bone,
                borderWidth: 1,
                borderColor: active ? colors.ink : colors.line,
              }}
            >
              <Text style={[type.bodySm, { color: active ? colors.bone : colors.ink }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.ink} style={{ marginTop: space.lg }} />
      ) : tab === "faq" ? (
        faqs.length === 0 ? (
          <EmptyState />
        ) : (
          faqs.map((f) => (
            <Card key={f.id} style={{ padding: space.md, gap: 6 }}>
              <Text style={[type.bodyMd, { color: colors.ink, fontWeight: "600" }]}>{f.question}</Text>
              <Text style={[type.bodySm, { color: colors.concrete }]}>{f.answer}</Text>
            </Card>
          ))
        )
      ) : tab === "news" ? (
        news.length === 0 ? (
          <EmptyState />
        ) : (
          news.map((n) => (
            <Pressable key={n.id} onPress={() => open(n.url)}>
              {({ pressed }) => (
                <Card style={[{ padding: space.md, gap: 6 }, pressed && { opacity: 0.85 }]}>
                  <Mono>{new Date(n.publishedAt).toLocaleDateString("es-AR")}</Mono>
                  <Text style={[type.displayMd, { color: colors.ink }]}>{n.title}</Text>
                  {n.excerpt ? <Text style={[type.bodySm, { color: colors.concrete }]}>{n.excerpt}</Text> : null}
                  {n.url ? <Text style={[type.bodySm, { color: colors.amber }]}>Leer más →</Text> : null}
                </Card>
              )}
            </Pressable>
          ))
        )
      ) : (
        (() => {
          const list = resources.filter((r) => r.kind === (tab as ResourceKind));
          if (list.length === 0) return <EmptyState />;
          return list.map((r) => (
            <Pressable key={r.id} onPress={() => r.mediaUrl && open(r.mediaUrl)} disabled={!r.mediaUrl}>
              {({ pressed }) => (
                <Card style={[{ padding: space.md, gap: 6 }, pressed && r.mediaUrl && { opacity: 0.85 }]}>
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                    {r.level ? <Badge>{r.level}</Badge> : null}
                    {r.duration ? <Badge>{r.duration}</Badge> : null}
                  </View>
                  <Text style={[type.displayMd, { color: colors.ink }]}>{r.title}</Text>
                  {r.summary ? <Text style={[type.bodySm, { color: colors.concrete }]}>{r.summary}</Text> : null}
                  {r.body ? <Text style={[type.bodyMd, { color: colors.ink }]}>{r.body}</Text> : null}
                  {r.mediaUrl ? <Text style={[type.bodySm, { color: colors.amber }]}>Ver recurso →</Text> : null}
                </Card>
              )}
            </Pressable>
          ));
        })()
      )}
    </ScrollView>
  );

  function EmptyState() {
    return (
      <Card style={{ padding: space.lg }}>
        <Text style={[type.bodyMd, { color: colors.concrete }]}>
          {SUPABASE_READY ? "Todavía no hay contenido en esta sección." : "Configurá Supabase en .env para ver el contenido."}
        </Text>
      </Card>
    );
  }
}
