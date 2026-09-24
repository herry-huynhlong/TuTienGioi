import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@ttg/db";

export default async function AdminPage() {
  const user = await getUser();
  if (user?.role !== "ADMIN") redirect("/game");
  const [users, supply, txs, reports] = await Promise.all([
    prisma.user.count(),
    prisma.character.aggregate({ _sum: { linhThach: true, tienNgoc: true }, _max: { linhThach: true } }),
    prisma.walletTransaction.findMany({ take: 20, orderBy: { createdAt: "desc" }, include: { character: true } }),
    prisma.report.findMany({ take: 20, orderBy: { createdAt: "desc" } })
  ]);
  return (
    <div className="p-5 lg:p-8">
      <h1 className="text-3xl font-black">Admin</h1>
      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <Box label="Users" value={String(users)} />
        <Box label="Tổng Linh Thạch" value={supply._sum.linhThach?.toString() ?? "0"} />
        <Box label="Top Wealth" value={supply._max.linhThach?.toString() ?? "0"} />
        <Box label="Reports" value={String(reports.length)} />
      </section>
      <section className="panel mt-6 rounded-lg p-6">
        <h2 className="text-xl font-bold text-gold">Ledger gần đây</h2>
        <div className="mt-4 space-y-2">{txs.map((tx) => <p key={tx.id} className="muted">{tx.character.name} · {tx.type} · {tx.amount.toString()} · {tx.currency}</p>)}</div>
      </section>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return <div className="panel rounded-lg p-4"><p className="muted text-sm">{label}</p><p className="font-bold">{value}</p></div>;
}
