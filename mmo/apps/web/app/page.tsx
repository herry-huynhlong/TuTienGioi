import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { loginAction, registerAction } from "@/lib/forms";
import { prisma } from "@ttg/db";

export default async function Landing() {
  if (await getUser()) redirect("/game");
  const [news, leaders] = process.env.DATABASE_URL
    ? await Promise.all([
        prisma.worldNews.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
        prisma.character.findMany({ take: 5, orderBy: { cultivation: "desc" }, include: { realmStage: { include: { realm: true } } } })
      ])
    : [[], []];
  return (
    <main>
      <section className="min-h-[92vh] bg-[radial-gradient(circle_at_30%_20%,rgba(45,212,191,.18),transparent_30%),linear-gradient(135deg,#0b100e,#17201b_58%,#312616)] px-5 py-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.2fr_.8fr]">
          <div className="flex min-h-[70vh] flex-col justify-center">
            <p className="text-sm uppercase tracking-[.28em] text-jade">Persistent text MMORPG</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-black leading-tight text-paper md:text-7xl">TU TIÊN GIỚI</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-paper/78">
              Một thế giới tu tiên online vận hành bằng hệ thống, kinh tế người chơi, tông môn, lịch sử và cơ duyên dài hạn. Không reset mùa, không bản đồ 3D, không sao chép nội dung Torn.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn" href="#join">Nhập Đạo</Link>
              <Link className="btn btn-secondary" href="#world">Xem thế giới</Link>
            </div>
          </div>
          <div id="join" className="grid content-center gap-4">
            <AuthCard title="Đăng nhập" action={loginAction} fields={["email", "password"]} />
            <AuthCard title="Đăng ký" action={registerAction} fields={["username", "email", "password"]} />
          </div>
        </div>
      </section>
      <section id="world" className="px-5 py-12">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          {["Tu luyện theo thời gian", "Kinh tế người chơi", "Tông môn và lịch sử"].map((title) => (
            <article key={title} className="panel rounded-lg p-6">
              <h2 className="text-xl font-bold text-gold">{title}</h2>
              <p className="mt-3 muted">Dữ liệu nằm trong PostgreSQL, worker xử lý sự kiện toàn server, hành động dài hạn dùng startedAt/endsAt/status.</p>
            </article>
          ))}
        </div>
      </section>
      <section className="px-5 pb-16">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          <div className="panel rounded-lg p-6">
            <h2 className="text-xl font-bold text-gold">Thiên Cơ Các</h2>
            <div className="mt-4 space-y-3">{news.map((n) => <p key={n.id} className="muted">{n.title}</p>)}</div>
          </div>
          <div className="panel rounded-lg p-6">
            <h2 className="text-xl font-bold text-gold">Leaderboard Preview</h2>
            <div className="mt-4 space-y-3">{leaders.map((c) => <p key={c.id} className="muted">{c.name} · {c.realmStage.realm.name} {c.realmStage.name} · {c.cultivation.toString()} tu vi</p>)}</div>
          </div>
        </div>
      </section>
    </main>
  );
}

function AuthCard({ title, action, fields }: { title: string; action: (formData: FormData) => Promise<void>; fields: string[] }) {
  return (
    <form action={action} className="panel rounded-lg p-5">
      <h2 className="text-lg font-bold text-gold">{title}</h2>
      <div className="mt-4 grid gap-3">
        {fields.map((field) => <input key={field} className="field" name={field} type={field === "password" ? "password" : field === "email" ? "email" : "text"} placeholder={field} required />)}
        <button className="btn">{title}</button>
      </div>
    </form>
  );
}
