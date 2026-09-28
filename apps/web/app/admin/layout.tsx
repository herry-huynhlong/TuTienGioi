import Link from "next/link";
import { requireAdmin } from "@/lib/admin-actions";

const links: Array<[string, string]> = [
  ["/admin", "Dashboard"],
  ["/admin/items", "Vật Phẩm"],
  ["/admin/market", "Chợ"],
  ["/admin/npcs", "NPC"],
  ["/admin/quests", "Quest"],
  ["/admin/sects", "Tông Môn"],
  ["/admin/missions", "Nhiệm Vụ"],
  ["/admin/world", "Thế Giới"],
  ["/admin/users", "Người Chơi"],
  ["/admin/logs", "Logs"]
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/game" className="admin-brand">TU TIÊN GIỚI</Link>
        <b>Admin Control</b>
        <nav>
          {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
