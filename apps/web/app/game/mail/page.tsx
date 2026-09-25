import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { markNotificationReadAction } from "@/lib/forms";
import { Mail, Bell } from "lucide-react";

export default async function MailPage() {
  const user = await getUser();
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user!.id },
    select: { id: true }
  });
  const [notifications, messages] = await Promise.all([
    prisma.notification.findMany({ where: { characterId: c.id }, take: 40, orderBy: { createdAt: "desc" } }),
    prisma.privateMessage.findMany({
      where: { receiverId: c.id },
      take: 40,
      orderBy: { createdAt: "desc" },
      include: { sender: { select: { name: true } } }
    })
  ]);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  return (
    <div className="p-5 lg:p-8">
      <header className="mb-5 border-b border-white/10 pb-4">
        <p className="text-xs font-bold uppercase text-jade">Hộp thư</p>
        <h1 className="mt-1 text-3xl font-black">Thư & Thông Báo</h1>
        <p className="muted mt-2">Đọc thông báo hệ thống và thư đã nhận từ các tu sĩ khác.</p>
      </header>

      <section className="grid gap-5 xl:grid-cols-[.95fr_1.05fr]">
        <Panel title="Thông báo" subtitle={`${unreadCount} chưa đọc`} icon={<Bell size={16} aria-hidden />}>
          <div className="activity-list">
            {notifications.map((notification) => (
              <article key={notification.id} className={notification.readAt ? "message-row" : "message-row unread"}>
                <div>
                  <b>{notification.title}</b>
                  <small>{notification.createdAt.toLocaleString("vi-VN")}</small>
                  <p>{notification.body}</p>
                </div>
                {!notification.readAt ? (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="id" value={notification.id} />
                    <button className="btn btn-secondary min-h-0 px-3 py-1 text-xs">Đã đọc</button>
                  </form>
                ) : null}
              </article>
            ))}
            {notifications.length === 0 ? (
              <div className="empty-state"><b>Không có thông báo.</b><p>Khi hệ thống tạo nhắc nhở hoặc sự kiện cá nhân, chúng sẽ xuất hiện ở đây.</p></div>
            ) : null}
          </div>
        </Panel>

        <Panel title="Thư nhận" subtitle={`${messages.length} thư`} icon={<Mail size={16} aria-hidden />}>
          <div className="activity-list">
            {messages.map((message) => (
              <article key={message.id} className="message-row">
                <div>
                  <b>{message.sender.name}</b>
                  <small>{message.createdAt.toLocaleString("vi-VN")}</small>
                  <p>{message.body}</p>
                </div>
              </article>
            ))}
            {messages.length === 0 ? (
              <div className="empty-state"><b>Chưa có thư.</b><p>Khi có tu sĩ gửi thư, nội dung sẽ xuất hiện tại đây.</p></div>
            ) : null}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Panel({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="dash-panel">
      <div className="dash-panel-title flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">{icon}{title}</span>
        <small className="text-paper/50">{subtitle}</small>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
