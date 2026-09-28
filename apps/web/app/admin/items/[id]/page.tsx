import { notFound } from "next/navigation";
import { prisma } from "@ttg/db";
import { ActionAlert } from "@/components/ActionAlert";
import { ItemAdminForm } from "../ItemAdminForm";

export default async function EditItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const item = await prisma.itemTemplate.findUnique({ where: { id } });
  if (!item) notFound();
  return (
    <div>
      <header className="admin-page-head"><div><p className="eyebrow">Edit Item</p><h1>{item.name}</h1></div></header>
      <ActionAlert message={query?.error ?? (query?.ok ? "Đã lưu thay đổi." : undefined)} />
      <ItemAdminForm item={item} />
    </div>
  );
}
