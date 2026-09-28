import { createQuestTemplateAdminAction, updateQuestTemplateAdminAction } from "@/lib/admin-actions";
import { prisma, QuestObjectiveType, QuestTriggerType, QuestType } from "@ttg/db";

export default async function AdminQuestsPage() {
  const [quests, npcs] = await Promise.all([
    prisma.questTemplate.findMany({ include: { startNpc: true, turnInNpc: true }, orderBy: [{ active: "desc" }, { createdAt: "desc" }] }),
    prisma.npc.findMany({ orderBy: { name: "asc" } })
  ]);

  return (
    <div>
      <header className="admin-page-head"><div><p className="eyebrow">Quest Admin</p><h1>Quest Template</h1></div></header>
      <section className="admin-edit-grid">
        <form action={createQuestTemplateAdminAction} className="admin-form">
          <h2>Tạo Quest</h2>
          <QuestFields npcs={npcs} />
          <label>Lý do<input className="field" name="reason" defaultValue="Tạo quest mới" /></label>
          <button className="btn">Tạo</button>
        </form>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Quest</th><th>Objective</th><th>NPC</th><th>Sửa nhanh</th></tr></thead>
            <tbody>
              {quests.map((quest) => (
                <tr key={quest.id}>
                  <td><b>{quest.title}</b><small>{quest.key} · {quest.type} · {"★".repeat(quest.difficulty)}</small></td>
                  <td>{quest.objectiveType}<small>{quest.targetCount} mục tiêu</small></td>
                  <td>{quest.startNpc?.name ?? "Manual"}<small>Trả: {quest.turnInNpc?.name ?? "Auto"}</small></td>
                  <td>
                    <details>
                      <summary className="btn btn-secondary">Sửa</summary>
                      <form action={updateQuestTemplateAdminAction} className="admin-inline-editor">
                        <input type="hidden" name="id" value={quest.id} />
                        <QuestFields quest={quest} npcs={npcs} />
                        <label>Lý do<input className="field" name="reason" defaultValue="Cập nhật quest" required /></label>
                        <button className="btn">Lưu</button>
                      </form>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function QuestFields({ quest, npcs }: { quest?: any; npcs: Array<{ id: string; name: string; key: string }> }) {
  return (
    <>
      <label>Key<input className="field" name="key" defaultValue={quest?.key ?? ""} readOnly={Boolean(quest)} /></label>
      <label>Tiêu đề<input className="field" name="title" defaultValue={quest?.title ?? ""} required /></label>
      <label>Mô tả<textarea className="field" name="description" defaultValue={quest?.description ?? ""} required /></label>
      <div className="admin-form-row">
        <label>Type<select className="field" name="type" defaultValue={quest?.type ?? "NPC"}>{Object.values(QuestType).map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        <label>Độ khó<input className="field" name="difficulty" type="number" min="1" max="5" defaultValue={quest?.difficulty ?? 1} /></label>
      </div>
      <div className="admin-form-row">
        <label>Objective<select className="field" name="objectiveType" defaultValue={quest?.objectiveType ?? "TALK_TO_NPC"}>{Object.values(QuestObjectiveType).map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        <label>Số lượng<input className="field" name="targetCount" type="number" min="1" defaultValue={quest?.targetCount ?? 1} /></label>
      </div>
      <label>Trigger<select className="field" name="triggerType" defaultValue={quest?.triggerType ?? "TALK_TO_NPC"}>{Object.values(QuestTriggerType).map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
      <label>NPC bắt đầu<select className="field" name="startNpcId" defaultValue={quest?.startNpcId ?? ""}><option value="">Manual</option>{npcs.map((npc) => <option key={npc.id} value={npc.id}>{npc.name} · {npc.key}</option>)}</select></label>
      <label>NPC trả<select className="field" name="turnInNpcId" defaultValue={quest?.turnInNpcId ?? ""}><option value="">Auto</option>{npcs.map((npc) => <option key={npc.id} value={npc.id}>{npc.name} · {npc.key}</option>)}</select></label>
      <div className="admin-form-row">
        <label>Prerequisite key<input className="field" name="prerequisiteKey" defaultValue={quest?.prerequisiteKey ?? ""} /></label>
        <label>Next quest key<input className="field" name="nextQuestKey" defaultValue={quest?.nextQuestKey ?? ""} /></label>
      </div>
      <label>Objective JSON<textarea className="field code-field" name="objective" defaultValue={JSON.stringify(quest?.objective ?? { targetKey: "" }, null, 2)} /></label>
      <label>Reward JSON<textarea className="field code-field" name="reward" defaultValue={JSON.stringify(quest?.reward ?? { cultivation: 100, linhThach: 50 }, null, 2)} /></label>
      <label>Flags khi hoàn thành<input className="field" name="flagsOnComplete" defaultValue={(quest?.flagsOnComplete ?? []).join(", ")} /></label>
      <div className="admin-check-grid">
        <label className="admin-check"><input type="checkbox" name="active" defaultChecked={quest?.active ?? true} />Active</label>
        <label className="admin-check"><input type="checkbox" name="repeatable" defaultChecked={quest?.repeatable ?? false} />Repeatable</label>
      </div>
    </>
  );
}
