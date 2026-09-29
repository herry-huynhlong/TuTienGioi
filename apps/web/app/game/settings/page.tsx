import { ActionAlert } from "@/components/ActionAlert";
import { getUser } from "@/lib/auth";
import { unblockPlayerAction, updatePlayerSettingsAction } from "@/lib/forms";
import { prisma } from "@ttg/db";
import { ensurePlayerSettings } from "@ttg/game";
import { Bell, Eye, Lock, MonitorCog, ShieldOff } from "lucide-react";
import { redirect } from "next/navigation";

export default async function SettingsPage({ searchParams }: { searchParams?: Promise<{ error?: string; ok?: string }> }) {
  const params = await searchParams;
  const user = await getUser();
  if (!user?.character) redirect("/");
  const characterId = user.character.id;
  const settings = await ensurePlayerSettings(prisma, characterId);
  const blocked = await prisma.blockedPlayer.findMany({ where: { blockerId: characterId }, include: { blocked: true }, orderBy: { createdAt: "desc" } });

  return (
    <div className="settings-page p-5 lg:p-8">
      <header className="mb-5 border-b border-white/10 pb-4">
        <p className="text-xs font-bold uppercase text-jade">Xã Hội</p>
        <h1 className="mt-1 text-3xl font-black">Cài Đặt</h1>
        <p className="muted mt-2">Điều chỉnh giao diện, thông báo, quyền riêng tư và xác nhận thao tác nguy hiểm.</p>
      </header>
      <ActionAlert message={params?.error} />
      {params?.ok ? <ActionAlert message={okMessage(params.ok)} /> : null}

      <form action={updatePlayerSettingsAction} className="settings-grid">
        <Panel title="Hiển thị" icon={<MonitorCog size={18} aria-hidden />}>
          <Toggle name="animationEnabled" label="Hiệu ứng giao diện" description="Bật hiệu ứng nhỏ khi chuyển trạng thái và thao tác." checked={settings.animationEnabled} />
          <label className="setting-range">
            <span>Cỡ chữ</span>
            <input name="fontScale" type="range" min={90} max={115} step={5} defaultValue={settings.fontScale} />
            <b>{settings.fontScale}%</b>
          </label>
        </Panel>

        <Panel title="Thông báo" icon={<Bell size={18} aria-hidden />}>
          <Toggle name="messageNotifications" label="Tin nhắn" description="Báo khi có tin nhắn chưa đọc." checked={settings.messageNotifications} />
          <Toggle name="friendNotifications" label="Bạn bè" description="Báo khi có lời mời kết bạn." checked={settings.friendNotifications} />
          <Toggle name="transferNotifications" label="Tài sản" description="Báo khi có giao dịch Linh Thạch hoặc vật phẩm." checked={settings.transferNotifications} />
        </Panel>

        <Panel title="Quyền riêng tư" icon={<Eye size={18} aria-hidden />}>
          <Toggle name="allowStrangerMessages" label="Nhận tin từ người lạ" description="Tắt mục này nếu chỉ muốn bạn bè nhắn tin." checked={settings.allowStrangerMessages} />
          <Toggle name="allowFriendRequests" label="Nhận lời mời kết bạn" description="Cho phép người chơi khác gửi lời mời." checked={settings.allowFriendRequests} />
          <Toggle name="showOnlineStatus" label="Hiện trạng thái online" description="Cho người khác biết bạn đang hoạt động." checked={settings.showOnlineStatus} />
        </Panel>

        <Panel title="Xác nhận thao tác" icon={<Lock size={18} aria-hidden />}>
          <Toggle name="confirmRareSell" label="Bán vật phẩm quý" description="Yêu cầu xác nhận trước khi bán đồ phẩm cao." checked={settings.confirmRareSell} />
          <Toggle name="confirmItemTransfer" label="Gửi vật phẩm" description="Yêu cầu xác nhận trước khi gửi vật phẩm cho bạn bè." checked={settings.confirmItemTransfer} />
          <Toggle name="confirmCurrencyTransfer" label="Gửi Linh Thạch" description="Yêu cầu xác nhận trước khi chuyển Linh Thạch." checked={settings.confirmCurrencyTransfer} />
        </Panel>

        <div className="settings-submit">
          <button className="btn">Lưu cài đặt</button>
        </div>
      </form>

      <section className="panel rounded-lg p-5 mt-5">
        <h2 className="social-panel-title"><ShieldOff size={18} aria-hidden /> Danh sách chặn</h2>
        <div className="social-list mt-4">
          {blocked.map((row) => (
            <article key={row.id} className="social-row">
              <div className="social-avatar">{row.blocked.name.slice(0, 1)}</div>
              <div>
                <b>{row.blocked.name}</b>
                <small>Bị chặn từ {row.createdAt.toLocaleDateString("vi-VN")}</small>
              </div>
              <div className="social-actions">
                <form action={unblockPlayerAction}>
                  <input type="hidden" name="targetId" value={row.blockedId} />
                  <button className="btn btn-secondary">Bỏ chặn</button>
                </form>
              </div>
            </article>
          ))}
          {blocked.length === 0 ? <p className="muted">Chưa chặn người chơi nào.</p> : null}
        </div>
      </section>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel rounded-lg p-5">
      <h2 className="social-panel-title">{icon}{title}</h2>
      <div className="settings-list mt-4">{children}</div>
    </section>
  );
}

function Toggle({ name, label, description, checked }: { name: string; label: string; description: string; checked: boolean }) {
  return (
    <label className="setting-toggle">
      <input type="checkbox" name={name} defaultChecked={checked} />
      <span />
      <div>
        <b>{label}</b>
        <small>{description}</small>
      </div>
    </label>
  );
}

function okMessage(ok: string) {
  return ({ saved: "Đã lưu cài đặt.", unblocked: "Đã bỏ chặn người chơi." } as Record<string, string>)[ok] ?? ok;
}
