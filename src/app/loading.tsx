import PageSkeleton from "@/components/PageSkeleton";

// Root boundary for routes without their own loading.tsx, so their server work streams a skeleton instead of a blank page.
export default function Loading() {
  return <PageSkeleton cards={3} />;
}
