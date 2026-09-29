import { ItemCategory, Rarity } from "@ttg/db";
import { getItemEconomy, jsonRecord } from "@ttg/game";
import { createItemTemplateAction, updateItemTemplateAction, uploadItemImageAction } from "@/lib/admin-actions";
import { formatCurrency, ItemDetailPanel } from "@/components/ItemCard";

type ItemLike = {
  id?: string;
  key: string;
  itemFamily?: string | null;
  name: string;
  category: string;
  rarity: string;
  description: string;
  stackable: boolean;
  maxStack: number;
  tradeable: boolean;
  baseModifiers: unknown;
  bindRules: unknown;
};

export function ItemAdminForm({ item }: { item?: ItemLike }) {
  const meta = jsonRecord(item?.bindRules);
  const economy = item ? getItemEconomy(item) : null;
  const action = item?.id ? updateItemTemplateAction : createItemTemplateAction;
  return (
    <div className="admin-edit-grid">
      <section className="panel rounded-lg p-5">
        <h2 className="text-xl font-bold text-gold">Preview</h2>
        {item ? (
          <div className="mt-4">
            <ItemDetailPanel
              template={item}
              details={[
                { label: "Giá", value: `${formatCurrency(economy!.systemBasePrice)} Linh Thạch` },
                { label: "Market", value: economy!.systemMarketEnabled ? "Bán hệ thống" : "Không bán hệ thống" }
              ]}
            />
          </div>
        ) : <p className="muted mt-4">Lưu vật phẩm để xem preview đầy đủ.</p>}
        {item?.id ? (
          <form action={uploadItemImageAction} className="admin-upload-box mt-5">
            <input type="hidden" name="itemId" value={item.id} />
            <label>Upload ảnh PNG/JPG/WEBP<input className="field" type="file" name="image" accept="image/png,image/jpeg,image/webp" /></label>
            <button className="btn btn-secondary" type="submit">Upload ảnh</button>
            <small className="muted">Production cần mount volume `/app/apps/web/public/uploads` để ảnh không mất khi rebuild.</small>
          </form>
        ) : null}
      </section>

      <form action={action} className="panel rounded-lg p-5 admin-form">
        {item?.id ? <input type="hidden" name="id" value={item.id} /> : null}
        <AdminSection title="Thông Tin Chung">
          <label>Tên<input className="field" name="name" defaultValue={item?.name ?? ""} required /></label>
          <label>Key<input className="field" name="key" defaultValue={item?.key ?? ""} readOnly={Boolean(item?.id)} required /></label>
          <label>Item family<input className="field" name="itemFamily" defaultValue={item?.itemFamily ?? ""} /></label>
          <label>Phẩm<select className="field" name="rarity" defaultValue={item?.rarity ?? "HA"}>{Object.values(Rarity).map((v) => <option key={v}>{v}</option>)}</select></label>
          <label>Category<select className="field" name="category" defaultValue={item?.category ?? "MATERIAL"}>{Object.values(ItemCategory).map((v) => <option key={v}>{v}</option>)}</select></label>
          <label>Mô tả<textarea className="field" name="description" defaultValue={item?.description ?? ""} rows={3} /></label>
          <label>Công dụng<textarea className="field" name="usage" defaultValue={String(meta.usage ?? "")} rows={3} /></label>
          <label>Base modifiers JSON<textarea className="field" name="baseModifiers" defaultValue={JSON.stringify(item?.baseModifiers ?? {}, null, 2)} rows={4} /></label>
        </AdminSection>
        <AdminSection title="Hình Ảnh">
          <label>Icon key<input className="field" name="icon" defaultValue={String(meta.icon ?? "box")} /></label>
          <label>Visual key<input className="field" name="visualKey" defaultValue={String(meta.visualKey ?? item?.key ?? "")} /></label>
          <label>Image URL<input className="field" name="imageUrl" defaultValue={String(meta.imageUrl ?? "")} /></label>
          <label>Subtype<input className="field" name="subType" defaultValue={String(meta.subType ?? "")} /></label>
        </AdminSection>
        <AdminSection title="Kinh Tế / Market">
          <label>Base price<input className="field" name="systemBasePrice" inputMode="numeric" defaultValue={String(meta.systemBasePrice ?? economy?.systemBasePrice ?? 0)} /></label>
          <label>NPC buy price<input className="field" name="npcBuyPrice" inputMode="numeric" defaultValue={String(meta.npcBuyPrice ?? economy?.npcBuyPrice ?? 0)} /></label>
          <Check name="tradeable" label="Tradeable" checked={item?.tradeable ?? true} />
          <Check name="sellableToNpc" label="Vạn Bảo Lâu thu mua" checked={Boolean(meta.sellableToNpc ?? true)} />
          <Check name="marketEnabled" label="Cho giao dịch người chơi" checked={Boolean(meta.marketEnabled ?? true)} />
          <Check name="systemMarketEnabled" label="Bán tại Vạn Bảo Lâu" checked={Boolean(meta.systemMarketEnabled)} />
          <Check name="auctionEligible" label="Auction eligible" checked={Boolean(meta.auctionEligible)} />
        </AdminSection>
        <AdminSection title="Tông Môn / Điều Kiện">
          <Check name="sectExchangeEnabled" label="Sect exchange enabled" checked={Boolean(meta.sectExchangeEnabled ?? true)} />
          <label>Sect contribution price<input className="field" name="sectContributionPrice" inputMode="numeric" defaultValue={String(meta.sectContributionPrice ?? economy?.sectContributionPrice ?? 1)} /></label>
          <label>Donation contribution<input className="field" name="donationContributionValue" inputMode="numeric" defaultValue={String(meta.donationContributionValue ?? economy?.donationContributionValue ?? 1)} /></label>
          <label>Required realm order<input className="field" name="requiredRealmOrder" inputMode="numeric" defaultValue={String(meta.requiredRealmOrder ?? "")} /></label>
          <label>Required sect rank<input className="field" name="requiredSectRank" inputMode="numeric" defaultValue={String(meta.requiredSectRank ?? "")} /></label>
          <Check name="stackable" label="Stackable" checked={item?.stackable ?? true} />
          <label>Max stack<input className="field" name="maxStack" inputMode="numeric" defaultValue={String(item?.maxStack ?? 999)} /></label>
        </AdminSection>
        <label>Lý do thay đổi<input className="field" name="reason" required defaultValue={item ? "Cập nhật content item" : "Tạo item admin"} /></label>
        <button className="btn" type="submit">Lưu thay đổi</button>
      </form>
    </div>
  );
}

function AdminSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="admin-fieldset"><legend>{title}</legend>{children}</fieldset>;
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return <label className="admin-check"><input type="checkbox" name={name} defaultChecked={checked} /> {label}</label>;
}
