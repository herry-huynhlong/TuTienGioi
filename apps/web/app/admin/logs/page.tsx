import { prisma } from "@ttg/db";

export default async function AdminLogsPage() {
  const logs = await prisma.adminAuditLog.findMany({ take: 100, include: { actor: true }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <header className="admin-page-head"><div><p className="eyebrow">Audit</p><h1>Admin Logs</h1></div></header>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Thời gian</th><th>Admin</th><th>Action</th><th>Target</th><th>Metadata</th></tr></thead>
          <tbody>{logs.map((log) => <tr key={log.id}><td>{log.createdAt.toLocaleString("vi-VN")}</td><td>{log.actor.username}</td><td>{log.action}</td><td>{log.target}</td><td><code>{JSON.stringify(log.metadata)}</code></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
