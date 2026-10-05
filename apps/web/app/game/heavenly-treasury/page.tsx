import { redirect } from "next/navigation";
import { Crown, Gem, Landmark, ScrollText, Sparkles } from "lucide-react";
import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { createTopupOrderAction, exchangeTienNgocAction } from "@/lib/forms";
import { ActionAlert } from "@/components/ActionAlert";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { HeavenlyTreasuryExchange } from "@/components/HeavenlyTreasuryExchange";

const packageSpecs = [
  { key: "jade-small", label: "Gói Nhập Môn", baseTienNgoc: 500, bonus: null, badge: null },
  { key: "jade-advance", label: "Gói Tiến Giai", baseTienNgoc: 1000, bonus: "+100 thưởng", badge: "+10% thưởng" },
  { key: "jade-breakthrough", label: "Gói Phá Cảnh", baseTienNgoc: 2000, bonus: "+400 thưởng", badge: "GIÁ TRỊ TỐT" }
] as const;

export default async function HeavenlyTreasuryPage({ searchParams }: { searchParams?: Promise<{ error?: string; ok?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/");
  const params = await searchParams;
  const character = await prisma.character.findUniqueOrThrow({ where: { userId: user.id }, select: { linhThach: true, tienNgoc: true } });
  const packages = await prisma.topupPackage.findMany({ where: { active: true, key: { in: packageSpecs.map((pack) => pack.key) } } });
  const packageByKey = new Map(packages.map((pack) => [pack.key, pack]));

  return (
    <div className="heavenly-treasury-page p-5 lg:p-8">
      <header className="heavenly-hero">
        <div>
          <p className="heavenly-kicker"><Sparkles size={15} /> THIÊN ĐẠO BẢO CÁC</p>
          <h1>Thiên Đạo Bảo Các</h1>
          <p>Thiên Đạo lưu chuyển, ngọc tụ thành tài.</p>
        </div>
        <div className="heavenly-balance-grid">
          <div>
            <span><Gem size={16} /> Tiên Ngọc</span>
            <b>{character.tienNgoc.toLocaleString("vi-VN")}</b>
          </div>
          <div>
            <span><Landmark size={16} /> Linh Thạch</span>
            <b><CurrencyAmount amount={character.linhThach} /></b>
          </div>
        </div>
      </header>

      <ActionAlert message={params?.error} />
      <ActionAlert message={params?.ok} />

      <section className="heavenly-section">
        <div className="heavenly-section-title">
          <Crown size={20} />
          <div>
            <p>Nạp Tiên Ngọc</p>
            <h2>Chọn pháp chỉ phù hợp</h2>
          </div>
        </div>
        <div className="heavenly-package-grid">
          {packageSpecs.map((spec) => {
            const pack = packageByKey.get(spec.key);
            const tienNgoc = pack?.tienNgoc ?? spec.baseTienNgoc;
            const amountVnd = pack?.amountVnd ?? 0;
            return (
              <article key={spec.key} className={spec.key === "jade-breakthrough" ? "heavenly-package-card featured" : "heavenly-package-card"}>
                {spec.badge ? <span className="heavenly-card-badge">{spec.badge}</span> : null}
                <div className="heavenly-package-icon"><Gem size={24} /></div>
                <p>{spec.label}</p>
                <h3>{amountVnd > 0 ? amountVnd.toLocaleString("vi-VN") : "--"}đ</h3>
                <strong>{tienNgoc.toLocaleString("vi-VN")} Tiên Ngọc</strong>
                {spec.bonus ? <span className="heavenly-bonus">{spec.bonus}</span> : <span className="heavenly-bonus muted">Không cộng thưởng</span>}
                <small>Tương đương {(tienNgoc * 10).toLocaleString("vi-VN")} Linh Thạch</small>
                <form action={createTopupOrderAction}>
                  <input type="hidden" name="packageKey" value={spec.key} />
                  <button className="btn w-full" disabled={!pack}>Nạp Ngay</button>
                </form>
              </article>
            );
          })}
        </div>
      </section>

      <div className="heavenly-bottom-grid">
        <HeavenlyTreasuryExchange balanceTienNgoc={character.tienNgoc.toString()} action={exchangeTienNgocAction} />
        <section className="heavenly-panel">
          <div className="heavenly-panel-head">
            <div>
              <p>Luật vận hành</p>
              <h2>Dòng chảy do server ghi nhận</h2>
            </div>
            <ScrollText size={22} />
          </div>
          <ul className="heavenly-rule-list">
            <li>Thanh toán chỉ tạo đơn chờ, Tiên Ngọc được cộng sau khi webhook xác nhận.</li>
            <li>Mỗi giao dịch thanh toán có idempotency riêng, tránh cộng trùng.</li>
            <li>Đổi Linh Thạch chạy trên backend và ghi sổ ví cả hai chiều.</li>
            <li>Không có chiều đổi Linh Thạch ngược về Tiên Ngọc.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
