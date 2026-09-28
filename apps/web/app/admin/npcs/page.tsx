import { createNpcAdminAction, updateNpcAdminAction } from "@/lib/admin-actions";
import { prisma, NpcSpawnMode, NpcType } from "@ttg/db";

export default async function AdminNpcsPage() {
  const [npcs, locations, regions, sects, dialogueSets] = await Promise.all([
    prisma.npc.findMany({ include: { location: true, region: true, sect: true }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.region.findMany({ orderBy: { order: "asc" } }),
    prisma.sect.findMany({ orderBy: { name: "asc" } }),
    prisma.dialogueSet.findMany({ orderBy: { title: "asc" } })
  ]);

  return (
    <div>
      <header className="admin-page-head"><div><p className="eyebrow">NPC Admin</p><h1>NPC</h1></div></header>
      <section className="admin-edit-grid">
        <form action={createNpcAdminAction} className="admin-form">
          <h2>Tạo NPC</h2>
          <NpcFields locations={locations} regions={regions} sects={sects} dialogueSets={dialogueSets} />
          <label>Lý do<input className="field" name="reason" defaultValue="Tạo NPC mới" /></label>
          <button className="btn">Tạo</button>
        </form>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>NPC</th><th>Vị trí</th><th>Type</th><th>Sửa nhanh</th></tr></thead>
            <tbody>
              {npcs.map((npc) => (
                <tr key={npc.id}>
                  <td><b>{npc.name}</b><small>{npc.key} · {npc.title}</small></td>
                  <td>{npc.location.name}<small>{npc.region?.name ?? "Không rõ vùng"}</small></td>
                  <td>{npc.npcTypes.join(", ")}<small>{npc.active ? "Đang bật" : "Đang tắt"}</small></td>
                  <td>
                    <details>
                      <summary className="btn btn-secondary">Sửa</summary>
                      <form action={updateNpcAdminAction} className="admin-inline-editor">
                        <input type="hidden" name="id" value={npc.id} />
                        <NpcFields npc={npc} locations={locations} regions={regions} sects={sects} dialogueSets={dialogueSets} />
                        <label>Lý do<input className="field" name="reason" defaultValue="Cập nhật NPC" required /></label>
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

function NpcFields({
  npc,
  locations,
  regions,
  sects,
  dialogueSets
}: {
  npc?: any;
  locations: Array<{ id: string; name: string }>;
  regions: Array<{ id: string; name: string }>;
  sects: Array<{ id: string; name: string }>;
  dialogueSets: Array<{ id: string; title: string }>;
}) {
  return (
    <>
      <label>Key<input className="field" name="key" defaultValue={npc?.key ?? ""} readOnly={Boolean(npc)} /></label>
      <label>Tên<input className="field" name="name" defaultValue={npc?.name ?? ""} required /></label>
      <label>Danh xưng<input className="field" name="title" defaultValue={npc?.title ?? ""} required /></label>
      <label>Mô tả<textarea className="field" name="description" defaultValue={npc?.description ?? ""} required /></label>
      <label>Portrait URL<input className="field" name="portraitUrl" defaultValue={npc?.portraitUrl ?? ""} /></label>
      <label>Icon key<input className="field" name="iconKey" defaultValue={npc?.iconKey ?? "user"} /></label>
      <label>Location<select className="field" name="locationId" defaultValue={npc?.locationId ?? locations[0]?.id} required>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
      <label>Region<select className="field" name="regionId" defaultValue={npc?.regionId ?? ""}><option value="">Theo location</option>{regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></label>
      <label>Sect<select className="field" name="sectId" defaultValue={npc?.sectId ?? ""}><option value="">Không</option>{sects.map((sect) => <option key={sect.id} value={sect.id}>{sect.name}</option>)}</select></label>
      <label>Dialogue<select className="field" name="dialogueSetId" defaultValue={npc?.dialogueSetId ?? ""}><option value="">Không</option>{dialogueSets.map((set) => <option key={set.id} value={set.id}>{set.title}</option>)}</select></label>
      <div className="admin-check-grid">
        {Object.values(NpcType).map((type) => <label key={type} className="admin-check"><input type="checkbox" name="npcTypes" value={type} defaultChecked={npc?.npcTypes?.includes(type)} />{type}</label>)}
      </div>
      <label>Spawn<select className="field" name="spawnMode" defaultValue={npc?.spawnMode ?? "STATIC"}>{Object.values(NpcSpawnMode).map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></label>
      <div className="admin-check-grid">
        <label className="admin-check"><input type="checkbox" name="active" defaultChecked={npc?.active ?? true} />Active</label>
        <label className="admin-check"><input type="checkbox" name="questProvider" defaultChecked={npc?.questProvider ?? false} />Quest</label>
        <label className="admin-check"><input type="checkbox" name="shopProvider" defaultChecked={npc?.shopProvider ?? false} />Shop</label>
        <label className="admin-check"><input type="checkbox" name="serviceProvider" defaultChecked={npc?.serviceProvider ?? false} />Service</label>
      </div>
      <label>Metadata JSON<textarea className="field code-field" name="metadata" defaultValue={JSON.stringify(npc?.metadata ?? {}, null, 2)} /></label>
    </>
  );
}
