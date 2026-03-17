import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seasonal Return | AquaticPro",
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ReturnPage({ params }: Props) {
  const { token } = await params;

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Seasonal Return Form</h1>
      {/* TODO Phase 6: validate token, render seasonal return form */}
      <p className="text-gray-500 text-sm">Token: {token}</p>
    </main>
  );
}
