import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { formatItemCategory, formatRarity } from "@/lib/format";
import { recordOnboardingEvent } from "@ttg/game";

const equipmentSlots = [
  ["WEAPON", "Vũ khí"],
  ["ARMOR", "Áo giáp"],
  ["HELMET", "Mũ"],
  ["BOOTS", "Giày"],
  ["RING", "Nhẫn"],
  ["TALISMAN", "Phù"],
  ["ARTIFACT", "Pháp bảo"]
];

export default async function CharacterPage() {
  const user = await getUser();
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user!.id },
    include: {
      realmStage: { include: { realm: true } },
      spiritualRoot: true,
      talents: { include: { talent: true } },
      techniques: { include: { technique: true } },
      items: { include: { template: true }, orderBy: { createdAt: "desc" } },
      sect: true,
      currentLocation: { include: { zone: { include: { region: true } } } }
    }
  });
  await recordOnboardingEvent(prisma, c.id, "VIEW_CHARACTER");

  const equipped = c.items.filter((item) => item.equippedSlot);
  const inventory = c.items.filter((item) => !item.equippedSlot);

  return (
    <div className="p-5 lg:p-8">
      <header className="mb-5 border-b border-white/10 pb-4">
        <p className="text-xs font-bold uppercase text-jade">Hồ sơ nhân vật</p>
        <h1 className="mt-1 text-3xl font-black">Nhân Vật</h1>
        <p className="muted mt-2">Thông tin tu sĩ, căn cơ, chiến lực, công pháp, trang bị và túi đồ.</p>
      </header>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Thông tin">
          <div className="info-table">
            <Info label="Tên" value={c.name} />
            <Info label="Danh hiệu" value={c.title} />
            <Info label="Cảnh giới" value={`${c.realmStage.realm.name} ${c.realmStage.name}`} accent />
            <Info label="Tông môn" value={c.sect?.name ?? "Tán tu"} />
            <Info label="Địa điểm" value={c.currentLocation?.name ?? "Chưa rõ"} />
            <Info label="Địa vực" value={c.currentLocation?.zone.region?.name ?? "Chưa rõ"} />
          </div>
        </Panel>

        <Panel title="Chiến lực">
          <div className="info-table">
            <Info label="HP" value={`${c.hp}/${c.maxHp}`} />
            <Info label="Chân nguyên" value={`${c.qi}/${c.maxQi}`} />
            <Info label="Công kích" value={c.attack.toString()} />
            <Info label="Phòng ngự" value={c.defense.toString()} />
            <Info label="Tốc độ" value={c.speed.toString()} />
            <Info label="Khí vận" value={c.luck.toString()} accent />
          </div>
        </Panel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-3">
        <Panel title="Linh căn">
          <div className="stat-card">
            <b>{c.spiritualRoot.name}</b>
            <span>Hệ số tu luyện {Math.round(c.spiritualRoot.multiplierBps / 100)}%</span>
            <p>{c.spiritualRoot.description}</p>
          </div>
        </Panel>

        <Panel title="Thiên phú">
          <div className="event-list">
            {c.talents.map((t) => <p key={t.talentId}><b>{t.talent.name}</b><br />{t.talent.description}</p>)}
            {c.talents.length === 0 ? <p className="muted">Chưa thức tỉnh thiên phú.</p> : null}
          </div>
        </Panel>

        <Panel title="Công pháp">
          <div className="event-list">
            {c.techniques.map((t) => <p key={t.id}><b>{t.technique.name}</b><br />Cấp {t.level} · {t.equipped ? "Đang vận chuyển" : "Chưa trang bị"}</p>)}
            {c.techniques.length === 0 ? <p className="muted">Chưa học công pháp.</p> : null}
          </div>
        </Panel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Panel title="Trang bị">
          <div className="equipment-grid">
            {equipmentSlots.map(([slot, label]) => {
              const item = equipped.find((entry) => entry.equippedSlot === slot);
              return (
                <div key={slot} className="equipment-slot">
                  <span>{label}</span>
                  <b>{item ? item.template.name : "Trống"}</b>
                  <small>{item ? `${formatRarity(item.template.rarity)} · +${item.enhancement}` : "Chưa trang bị"}</small>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title={`Túi đồ (${inventory.length})`}>
          {inventory.length > 0 ? (
            <div className="item-grid">
              {inventory.map((item) => (
                <div key={item.id} className="item-card">
                  <b>{item.template.name} x{item.quantity}</b>
                  <span>{formatItemCategory(item.template.category)} · {formatRarity(item.template.rarity)}</span>
                  <p>{item.template.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <b>Túi đồ đang trống.</b>
              <p>Lịch luyện ngoài địa vực hoặc đi chợ để có vật phẩm đầu tiên.</p>
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel rounded-lg p-5">
      <h2 className="text-xl font-bold text-gold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Info({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <span>{label}</span>
      <b className={accent ? "text-gold" : ""}>{value}</b>
    </div>
  );
}
