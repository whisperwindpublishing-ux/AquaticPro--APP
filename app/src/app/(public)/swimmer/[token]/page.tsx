import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Swimmer Progress | AquaticPro",
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SwimmerProgressPage({ params }: Props) {
  const { token } = await params;

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Swimmer Progress</h1>
      {/* TODO Phase 6: validate token, render public swimmer progress */}
      <p className="text-gray-500 text-sm">Token: {token}</p>
    </main>
  );
}
