export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <h1>Accept invite ({token})</h1>;
}
