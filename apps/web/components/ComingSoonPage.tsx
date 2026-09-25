import Link from "next/link";

export function ComingSoonPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-5 lg:p-8">
      <header className="mb-5 border-b border-white/10 pb-4">
        <p className="text-xs font-bold uppercase text-jade">Coming soon</p>
        <h1 className="mt-1 text-3xl font-black">{title}</h1>
        <p className="muted mt-2 max-w-3xl">{description}</p>
      </header>
      <section className="panel rounded-lg p-6">
        <h2 className="text-xl font-bold text-gold">Chức năng đang phát triển</h2>
        <p className="muted mt-3">
          Route này được tách đúng tên để tránh mở nhầm sang chức năng khác. Khi backend và workflow hoàn chỉnh, menu sẽ được mở lại.
        </p>
        <Link href="/game" className="btn btn-secondary mt-5">Về Tổng Quan</Link>
      </section>
    </div>
  );
}
