import { ActionAlert } from "@/components/ActionAlert";
import { getUser } from "@/lib/auth";
import { acceptQuestAction, completeQuestAction, talkToNpcAction } from "@/lib/forms";
import { prisma, QuestStatus } from "@ttg/db";
import { getAvailableQuestTemplates, QuestError, talkToNpc } from "@ttg/game";
import { ArrowLeft, CheckCircle2, CircleDot, Gift, MapPin, MessageCircle, ScrollText, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function NpcPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams?: Promise<{ error?: string; ok?: string }> }) {
  const [{ key }, query] = await Promise.all([params, searchParams]);
  const user = await getUser();
  if (!user?.character) redirect("/");
  const data = await talkToNpc(prisma, user.character.id, key).catch((error) => {
    if (error instanceof QuestError) redirect(`/game/location?error=${encodeURIComponent(error.message)}`);
    throw error;
  });
  const activeQuests = data.quests.filter((quest) => quest.status === QuestStatus.ACTIVE || quest.status === QuestStatus.READY_TO_TURN_IN);
  const completedQuests = data.quests.filter((quest) => quest.status === QuestStatus.COMPLETED).slice(0, 3);
  const hasQuestPanel = data.available.length > 0 || activeQuests.length > 0 || completedQuests.length > 0;

  return (
    <div className="p-5 lg:p-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-xs font-bold uppercase text-jade">NPC</p>
          <h1 className="mt-1 text-3xl font-black">{data.npc.name}</h1>
          <p className="muted mt-2">{data.npc.title} · {data.currentLocation.name}</p>
        </div>
        <Link href="/game/location" className="btn btn-secondary"><ArrowLeft size={16} aria-hidden /> Quay lại</Link>
      </header>
      <ActionAlert message={query?.error} />
      {query?.ok ? <ActionAlert message={query.ok === "accepted" ? "Đã nhận nhiệm vụ." : "Đã nộp nhiệm vụ."} /> : null}

      <section className="npc-dialogue-layout">
        <aside className="npc-profile-panel panel">
          <div className="npc-profile-portrait">
            {data.npc.portraitUrl ? <img src={data.npc.portraitUrl} alt="" /> : <UserRound size={54} aria-hidden />}
          </div>
          <h2>{data.npc.name}</h2>
          <p className="text-gold">{data.npc.title}</p>
          <p className="muted mt-3">{data.npc.description}</p>
          <div className="npc-profile-meta">
            <span><MapPin size={14} aria-hidden />{data.currentLocation.name}</span>
            <span>{data.playerNpcState.relationshipState}</span>
            <span>Đã gặp {data.playerNpcState.timesMet} lần</span>
          </div>
          <div className="npc-type-list">
            {data.npc.npcTypes.map((type) => <span key={type}>{formatNpcType(type)}</span>)}
          </div>
        </aside>

        <main className="grid gap-5">
          <section className="panel rounded-lg p-5">
            <div className="dialogue-box">
              <MessageCircle size={20} aria-hidden />
              <div>
                <b>{data.dialogue.speaker}</b>
                <p>{data.dialogue.text}</p>
              </div>
            </div>
            {data.dialogue.choices.length ? (
              <div className="dialogue-choice-list">
                {data.dialogue.choices.map((choice) => <span key={choice.id}>{choice.label}</span>)}
              </div>
            ) : null}
            <form action={talkToNpcAction} className="mt-4">
              <input type="hidden" name="npcKey" value={data.npc.key} />
              <button className="btn btn-secondary">Ghi nhận đã trò chuyện</button>
            </form>
          </section>

          {hasQuestPanel ? (
            <section className="panel rounded-lg p-5">
              <h2 className="text-xl font-bold text-gold">Nhiệm vụ</h2>
              <div className="quest-list mt-4">
                {data.available.map((quest) => (
                  <QuestTemplateCard key={quest.id} npcKey={data.npc.key} quest={quest} />
                ))}
                {activeQuests.map((quest) => (
                  <CharacterQuestCard key={quest.id} npcKey={data.npc.key} quest={quest} />
                ))}
                {completedQuests.map((quest) => (
                  <article key={quest.id} className="quest-card quest-card-done">
                    <CheckCircle2 size={18} aria-hidden />
                    <div><b>{quest.template.title}</b><p>Đã hoàn thành.</p></div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </main>
      </section>
    </div>
  );
}

function QuestTemplateCard({ npcKey, quest }: { npcKey: string; quest: Awaited<ReturnType<typeof getAvailableQuestTemplates>>[number] }) {
  return (
    <article className="quest-card">
      <CircleDot size={18} aria-hidden />
      <div>
        <b>{quest.title}</b>
        <p>{quest.description}</p>
        <small>{formatObjective(quest.objectiveType, quest.targetCount)} · {"★".repeat(quest.difficulty)}</small>
      </div>
      <form action={acceptQuestAction}>
        <input type="hidden" name="npcKey" value={npcKey} />
        <input type="hidden" name="questKey" value={quest.key} />
        <button className="btn">Nhận</button>
      </form>
    </article>
  );
}

function CharacterQuestCard({ npcKey, quest }: { npcKey: string; quest: { id: string; status: string; progress: number; targetCount: number; template: { title: string; description: string; objectiveType: string; reward: unknown } } }) {
  const ready = quest.status === "READY_TO_TURN_IN";
  return (
    <article className={`quest-card ${ready ? "quest-card-ready" : ""}`}>
      {ready ? <Gift size={18} aria-hidden /> : <ScrollText size={18} aria-hidden />}
      <div>
        <b>{quest.template.title}</b>
        <p>{quest.template.description}</p>
        <small>{ready ? "Có thể nộp" : `Tiến độ ${quest.progress}/${quest.targetCount}`}</small>
      </div>
      {ready ? (
        <form action={completeQuestAction}>
          <input type="hidden" name="npcKey" value={npcKey} />
          <input type="hidden" name="questId" value={quest.id} />
          <button className="btn">Nộp</button>
        </form>
      ) : null}
    </article>
  );
}

function formatNpcType(type: string) {
  const labels: Record<string, string> = { GUIDE: "Dẫn đường", SECT: "Tông môn", QUEST: "Nhiệm vụ", MERCHANT: "Thương nhân", CRAFTSMAN: "Nghề nghiệp", GUARD: "Hộ vệ", ELDER: "Trưởng lão", WANDERER: "Du phương", EVENT: "Sự kiện", LORE: "Điển cố" };
  return labels[type] ?? type;
}

function formatObjective(type: string, count: number) {
  const labels: Record<string, string> = { TALK_TO_NPC: "Trò chuyện", VISIT_LOCATION: "Tới địa điểm", KILL_MONSTER: "Săn yêu", COLLECT_ITEM: "Thu thập", VISIT_SECT_PAGE: "Tìm hiểu tông môn" };
  return `${labels[type] ?? type} ${count > 1 ? count : ""}`.trim();
}
