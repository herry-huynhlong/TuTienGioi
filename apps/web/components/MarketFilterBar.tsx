"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

type Option = readonly [string, string];

export function MarketFilterBar({
  q,
  grade,
  category,
  grades,
  categories
}: {
  q: string;
  grade: string;
  category: string;
  grades: readonly Option[];
  categories: readonly Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [text, setText] = useState(q);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setText(q), [q]);

  const baseParams = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  const updateFilter = useCallback((next: Record<string, string>) => {
    const params = new URLSearchParams(baseParams.toString());
    params.set("tab", "buy");
    params.delete("detail");
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }, [baseParams, pathname, router]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (text !== q) updateFilter({ q: text.trim() });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [text, q, updateFilter]);

  return (
    <div className="market-toolbar">
      <input className="field" name="q" placeholder="Tìm vật phẩm..." value={text} onChange={(event) => setText(event.target.value)} />
      <select className="field" name="grade" value={grade} onChange={(event) => updateFilter({ grade: event.target.value })}>
        {grades.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select className="field" name="category" value={category} onChange={(event) => updateFilter({ category: event.target.value })}>
        {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <span className="market-filter-status" aria-live="polite">{isPending ? "Đang tải..." : "Tự cập nhật"}</span>
    </div>
  );
}
