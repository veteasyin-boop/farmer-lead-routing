import { LeadForm } from "@/components/lead-form";

type PageProps = { searchParams: Promise<{ ad?: string | string[] }> };

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawAd = Array.isArray(params.ad) ? params.ad[0] : params.ad;
  const adSource = (rawAd ?? "organic").slice(0, 120);
  return <LeadForm adSource={adSource} />;
}
