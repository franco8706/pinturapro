import { PageSkeleton } from "@/components/features/page-skeleton";

export default function Loading() {
  return <PageSkeleton label cards={6} ratio="aspect-[4/5]" />;
}
