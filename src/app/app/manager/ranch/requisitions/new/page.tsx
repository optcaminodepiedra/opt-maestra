import { redirect } from "next/navigation";

export default async function RanchRequisitionNewRedirect({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string; kind?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  if (sp.businessId) params.set("businessId", sp.businessId);
  if (sp.kind) params.set("kind", sp.kind);
  const qs = params.toString();
  redirect(`/app/inventory/requisitions/new${qs ? `?${qs}` : ""}`);
}
