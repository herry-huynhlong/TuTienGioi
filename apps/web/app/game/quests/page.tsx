import { getUser } from "@/lib/auth";
import { prisma } from "@ttg/db";
import { CheckCircle2, CircleDot, Gift, ScrollText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function QuestLogPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const query = await searchParams;
  const user = await getUser();
  if (!user?.character) redirect("/");
  const tab = query?.tab ?? "active";
  const quests = await prisma.characterQuest.findMany({
    where: {
      characterId: user.character.id,
      ...(tab === "ready" ? { status: "READY_TO_TURN_IN" } : tab === "done" ? { status: "COMPLETED" } : { status: "ACTIVE" })
    },
    include: { template: { include: { startNpc: { include: { location: true } }, turnInNpc: { include: { location: true } } } } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
  });

  return (
    <div className="p-5 lg:p-8">
      <header className="mb-5 border-b border-white/10 pb-4">
        <p className="text-xs font-bold uppercase text-jade">Quest Log</p>
        <h1 className="mt-1 text-3xl font-black">Nhiệm Vụ</h1>
        <p className="muted mt-2">Theo dõi nhiệm vụ NPC, thế giới và tuyến dẫn đạo.</p>
      </header>
      <nav className="tab-strip mb-5">
        <Link className={tab === "active" ? "active" : ""} href="/game/quests?tab=active">Đang làm</Link>
        <Link className={tab === "ready" ? "active" : ""} href="/game/quests?tab=ready">Có thể nộp</Link>
        <Link className={tab === "done" ? "active" : ""} href="/game/quests?tab=done">Đã hoàn thành</Link>
      </nav>
      <section className="quest-log-list">
        {quests.map((quest) => (
          <article key={quest.id} className="quest-log-card">
            <QuestIcon status={quest.status} />
            <div>
              <p className="eyebrow">{formatQuestType(quest.template.type)}</p>
              <h2>{quest.template.title}</h2>
              <p>{quest.template.description}</p>
              <div className="quest-log-meta">
                <span>Tiến độ <b>{quest.progress}/{quest.targetCount}</b></span>
                <span>Trả nhiệm vụ <b>{quest.template.turnInNpc?.name ?? "Tự hoàn thành"}</b></span>
                <span>Độ khó <b>{"★".repeat(quest.template.difficulty)}</b></span>
              </div>
            </div>
            {quest.status === "READY_TO_TURN_IN" && quest.template.turnInNpc ? <Link href={`/game/npc/${quest.template.turnInNpc.key}`} className="btn">Tới NPC</Link> : null}
            {quest.status === "ACTIVE" && quest.template.startNpc ? <Link href="/game/location" className="btn btn-secondary">Xem địa điểm</Link> : null}
          </article>
        ))}
        {quests.length === 0 ? <div className="empty-state"><b>Không có nhiệm vụ trong mục này.</b><p>Hãy nói chuyện với NPC ở địa điểm hiện tại để nhận nhiệm vụ mới.</p></div> : null}
      </section>
    </div>
  );
}

function QuestIcon({ status }: { status: string }) {
  if (status === "READY_TO_TURN_IN") return <Gift size={22} aria-hidden />;
  if (status === "COMPLETED") return <CheckCircle2 size={22} aria-hidden />;
  if (status === "ACTIVE") return <ScrollText size={22} aria-hidden />;
  return <CircleDot size={22} aria-hidden />;
}

function formatQuestType(type: string) {
  const labels: Record<string, string> = { MAIN: "Chính tuyến", SIDE: "Phụ tuyến", NPC: "NPC", SECT: "Tông môn", WORLD: "Thế giới", EVENT: "Sự kiện" };
  return labels[type] ?? type;
}
