import { chooseSectIconAction } from "@/lib/forms";
import { sectIconCatalog } from "@ttg/game";
import { SectEmblem } from "./SectEmblem";

export function SectIconPicker({ sectId, currentIconKey }: { sectId: string; currentIconKey?: string | null }) {
  return (
    <details className="sect-icon-picker">
      <summary>
        <SectEmblem iconKey={currentIconKey} size="xl" label="Chọn biểu tượng tông môn" />
        <span>Chọn biểu tượng</span>
      </summary>
      <form action={chooseSectIconAction} className="sect-icon-picker-popover">
        <input type="hidden" name="sectId" value={sectId} />
        <div>
          <p className="eyebrow">BIỂU TƯỢNG SƠN MÔN</p>
          <h2>Xác lập đạo ấn</h2>
          <p className="muted">Chỉ chọn một lần. Sau khi xác nhận, biểu tượng và nền sơn môn sẽ khóa vĩnh viễn.</p>
        </div>
        <div className="sect-icon-grid">
          {sectIconCatalog.map((icon) => (
            <label key={icon.key} className="sect-icon-option">
              <input type="radio" name="iconKey" value={icon.key} defaultChecked={icon.key === currentIconKey} required />
              <SectEmblem iconKey={icon.key} size="lg" label={icon.name} />
              <span>{icon.name}</span>
            </label>
          ))}
        </div>
        <button className="btn" type="submit">Xác nhận biểu tượng</button>
      </form>
    </details>
  );
}
