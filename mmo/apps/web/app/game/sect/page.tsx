import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { createSectAction } from "@/lib/forms";

export default async function SectPage() {
  const user = await getUser();
  const c = await prisma.character.findUniqueOrThrow({ where: { userId: user!.id }, include: { sect: { include: { members: { include: { character: true } }, buildings: true } } } });
  return (
    <div className="p-5 lg:p-8">
      <h1 className="text-3xl font-black">Tông Môn</h1>
      {c.sect ? (
        <section className="panel mt-6 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gold">{c.sect.name} [{c.sect.tag}]</h2>
          <p className="muted mt-2">{c.sect.description}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div><h3 className="font-bold">Thành viên</h3>{c.sect.members.map((m) => <p key={m.id} className="muted">{m.character.name} · {m.role}</p>)}</div>
            <div><h3 className="font-bold">Công trình</h3>{c.sect.buildings.map((b) => <p key={b.id} className="muted">{b.name} cấp {b.level}</p>)}</div>
          </div>
        </section>
      ) : (
        <form action={createSectAction} className="panel mt-6 grid max-w-xl gap-3 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gold">Lập tông môn</h2>
          <input className="field" name="name" placeholder="Tên tông môn" required />
          <input className="field" name="tag" placeholder="Ký hiệu" required />
          <button className="btn">Chi 5.000 Linh Thạch để thành lập</button>
        </form>
      )}
    </div>
  );
}
