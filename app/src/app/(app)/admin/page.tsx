import type { Metadata } from "next";
export const metadata: Metadata = { title: "Admin | AquaticPro" };
export default function AdminPage() {
  return <div><h1 className="text-2xl font-bold">Admin Panel</h1>{/* TODO Phase 2: require admin permission; port AdminPanel component */}</div>;
}
