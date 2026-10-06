export default async function Page({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <h1>Dashboard for {organizationId}</h1>;
}
