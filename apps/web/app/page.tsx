import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { loginAction, registerAction } from "@/lib/forms";
import { prisma } from "@ttg/db";

const worldHighlights = [
  {
    title: "Tu luyện dài hạn",
    body: "Bế quan, tích lũy tu vi, tìm thời cơ đột phá và từng bước vượt qua các đại cảnh giới."
  },
  {
    title: "Giang hồ người chơi",
    body: "Linh thạch, vật phẩm, chợ giao dịch và những lựa chọn nhỏ mỗi ngày dần tạo thành thế lực riêng."
  },
  {
    title: "Tông môn và cơ duyên",
    body: "Lập tông môn, chiêu mộ đồng đạo, đi qua bí địa, gặp biến cố và để lại dấu vết trong lịch sử server."
  }
];

type LandingProps = {
  searchParams?: Promise<{ registered?: string; email?: string; error?: string }>;
};

const fieldLabels: Record<string, string> = {
  username: "tên nhân vật",
  email: "email",
  password: "mật khẩu"
};

export default async function Landing({ searchParams }: LandingProps) {
  if (await getUser()) redirect("/game");
  const params = await searchParams;
  const loginEmail = params?.registered === "1" ? params.email ?? "" : "";
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
            <p className="text-sm uppercase tracking-[.28em] text-jade">Tu tiên online dài hạn</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-black leading-tight text-paper md:text-7xl">TU TIÊN GIỚI</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-paper/78">
              Bước vào một thế giới tu chân nơi mỗi lần bế quan, mỗi chuyến du lịch, mỗi món linh vật và mỗi tông môn đều góp phần viết nên lịch sử riêng của server.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn" href="#join">Nhập Đạo</Link>
              <Link className="btn btn-secondary" href="#world">Xem thế giới</Link>
            </div>
          </div>
          <div id="join" className="grid content-center gap-4">
            {params?.registered === "1" ? (
              <div className="panel rounded-lg border-jade/30 p-4 text-sm text-paper/78">
                Tài khoản đã được tạo. Email đã được điền vào ô đăng nhập, hãy nhập mật khẩu để vào game.
              </div>
            ) : null}
            {params?.error === "exists" ? <div className="panel rounded-lg border-red-400/30 p-4 text-sm text-paper/78">Email hoặc tên nhân vật đã tồn tại.</div> : null}
            {params?.error === "login" ? <div className="panel rounded-lg border-red-400/30 p-4 text-sm text-paper/78">Email hoặc mật khẩu không đúng.</div> : null}
            <AuthCard title="Đăng nhập" action={loginAction} fields={["email", "password"]} defaults={{ email: loginEmail }} />
            <AuthCard title="Đăng ký" action={registerAction} fields={["username", "email", "password"]} />
          </div>
        </div>
      </section>
      <section id="world" className="px-5 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[.24em] text-jade">Thế giới</p>
            <h2 className="mt-3 text-3xl font-black text-paper md:text-5xl">Một cõi tu chân sống cùng người chơi</h2>
            <p className="mt-5 text-lg leading-8 text-paper/72">
              Tu Tiên Giới được xây để chơi lâu dài: nhân vật tăng trưởng bằng thời gian, bản đồ mở theo tuyến đường, sự kiện được ghi lại thành tin tức và bảng xếp hạng phản ánh những người thật đang vươn lên.
            </p>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {worldHighlights.map((item) => (
              <article key={item.title} className="panel rounded-lg p-6">
                <h2 className="text-xl font-bold text-gold">{item.title}</h2>
                <p className="mt-3 muted">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="px-5 pb-16">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          <div className="panel rounded-lg p-6">
            <h2 className="text-xl font-bold text-gold">Thiên Cơ Các</h2>
            <div className="mt-4 space-y-3">
              {news.length > 0 ? news.map((n) => <p key={n.id} className="muted">{n.title}</p>) : <p className="muted">Thiên cơ chưa động, hãy trở thành người đầu tiên lưu danh.</p>}
            </div>
          </div>
          <div className="panel rounded-lg p-6">
            <h2 className="text-xl font-bold text-gold">Cao thủ đang nổi danh</h2>
            <div className="mt-4 space-y-3">
              {leaders.length > 0 ? leaders.map((c) => <p key={c.id} className="muted">{c.name} · {c.realmStage.realm.name} {c.realmStage.name} · {c.cultivation.toString()} tu vi</p>) : <p className="muted">Bảng xếp hạng đang chờ những đạo hữu đầu tiên.</p>}
            </div>
          </div>
        </div>
      </section>
      <section className="border-t border-white/10 bg-[#111512] px-5 py-12">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          {[
            ["Bắt đầu", "Tạo nhân vật, nhận linh căn và bước vào thành đầu tiên."],
            ["Khám phá", "Đi qua các vùng đất, gặp yêu thú, tài nguyên và cơ duyên bất ngờ."],
            ["Lưu danh", "Tăng cảnh giới, lập tông môn và cạnh tranh vị trí trên bảng xếp hạng."]
          ].map(([title, body]) => (
            <article key={title}>
              <h2 className="text-xl font-bold text-gold">{title}</h2>
              <p className="mt-3 muted">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function AuthCard({ title, action, fields, defaults = {} }: { title: string; action: (formData: FormData) => Promise<void>; fields: string[]; defaults?: Record<string, string> }) {
  return (
    <form action={action} className="panel rounded-lg p-5">
      <h2 className="text-lg font-bold text-gold">{title}</h2>
      <div className="mt-4 grid gap-3">
        {fields.map((field) => (
          <input
            key={field}
            className="field"
            name={field}
            type={field === "password" ? "password" : field === "email" ? "email" : "text"}
            placeholder={fieldLabels[field] ?? field}
            defaultValue={defaults[field] ?? ""}
            autoComplete={field === "password" ? "current-password" : field === "email" ? "email" : "username"}
            required
          />
        ))}
        <button className="btn">{title}</button>
      </div>
    </form>
  );
}
