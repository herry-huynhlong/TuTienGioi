import { prisma } from "@ttg/db";

export default async function AdminMissionsPage() {
  const [missions, participants] = await Promise.all([
    prisma.sectMission.findMany({ take: 80, include: { sect: true }, orderBy: [{ status: "asc" }, { difficulty: "desc" }] }),
    prisma.sectMissionParticipant.findMany({ take: 40, include: { character: true, sect: true }, orderBy: { startedAt: "desc" } })
  ]);
  return (
    <div>
      <header className="admin-page-head"><div><p className="eyebrow">Mission Admin</p><h1>Nhiệm Vụ</h1></div></header>
      <section className="admin-table-wrap">
        <table className="admin-table"><thead><tr><th>Mission</th><th>Tông Môn</th><th>Type</th><th>Độ khó</th><th>Status</th><th>Reward</th></tr></thead><tbody>
          {missions.map((m) => <tr key={m.id}><td><b>{m.title}</b><small>{m.key}</small></td><td>{m.sect.name}</td><td>{m.type}</td><td>{m.difficulty}</td><td>{m.status}</td><td><code>{JSON.stringify(m.reward)}</code></td></tr>)}
        </tbody></table>
      </section>
      <section className="panel rounded-lg p-5 mt-5">
        <h2 className="text-xl font-bold text-gold">Participants gần đây</h2>
        <div className="admin-log-list mt-4">{participants.map((p) => <p key={p.id}><b>{p.character.name}</b><span>{p.sect.name} · {p.missionKey} · {p.status} · {p.progress}/{p.targetCount}</span></p>)}</div>
      </section>
    </div>
  );
}
