import Link from "next/link";
import { CharacterVisual } from "@/components/CharacterVisual";
import { logoutAction } from "@/lib/forms";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { RealtimeBadge } from "@/components/RealtimeProvider";
import { WorldClock } from "@/components/WorldClock";
import {
  Backpack,
  BriefcaseBusiness,
  ChevronRight,
  Compass,
  Dumbbell,
  Gavel,
  Hammer,
  Landmark,
  MessageSquare,
  Mountain,
  Settings,
  ShoppingBag,
  Trophy,
  Users,
  Lock,
  ScrollText,
  type LucideIcon
} from "lucide-react";

type FeatureStatus = "implemented" | "partial" | "coming_soon" | "disabled";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  status: FeatureStatus;
  featureKey?: keyof FeatureUnlocks;
  adminOnly?: boolean;
  badge?: "messages" | "friends" | "notifications";
};

type NavGroup = {
  title: string;
  links: NavLink[];
};

type FeatureUnlocks = Record<string, { unlocked: boolean; reason: string }>;

const navGroups: NavGroup[] = [
  {
    title: "Truyện",
    links: [
      { href: "/game", label: "Tu Luyện", icon: Compass, status: "implemented", featureKey: "cultivation" },
      { href: "/game/training", label: "Rèn Luyện", icon: Dumbbell, status: "partial", featureKey: "character" },
      { href: "/game/location", label: "Lịch Luyện", icon: Mountain, status: "partial", featureKey: "exploration" },
      { href: "/game/quests", label: "Nhiệm Vụ", icon: ScrollText, status: "partial", featureKey: "world" },
      { href: "/game/sect", label: "Tông Môn", icon: Landmark, status: "partial", featureKey: "sect" },
      { href: "/game/inventory", label: "Túi Đồ", icon: Backpack, status: "partial", featureKey: "character" }
    ]
  },
  {
    title: "Kinh tế",
    links: [
      { href: "/game/market", label: "Vạn Bảo Lâu", icon: ShoppingBag, status: "partial", featureKey: "market" },
      { href: "/game/auction", label: "Đấu Giá", icon: Gavel, status: "partial", featureKey: "auction" },
      { href: "/game/profession", label: "Nghề Nghiệp", icon: BriefcaseBusiness, status: "partial", featureKey: "profession" }
    ]
  },
  {
    title: "Xã hội",
    links: [
      { href: "/game/friends", label: "Bạn Bè", icon: Users, status: "partial", badge: "friends" },
      { href: "/game/chat", label: "Tin Nhắn", icon: MessageSquare, status: "partial", badge: "messages" },
      { href: "/game/settings", label: "Cài Đặt", icon: Settings, status: "partial" }
    ]
  },
  {
    title: "Quản trị",
    links: [
      { href: "/game/world", label: "Thế Giới", icon: Mountain, status: "implemented", featureKey: "world" },
      { href: "/game/leaderboard", label: "Xếp Hạng", icon: Trophy, status: "implemented" },
      { href: "/game/heavenly", label: "Thiên Cơ Các", icon: ScrollText, status: "coming_soon" },
      { href: "/admin", label: "Admin", icon: Landmark, status: "implemented", adminOnly: true }
    ]
  }
] satisfies NavGroup[];

type ShellCharacter = {
  id: string;
  name: string;
  title: string;
  avatar: string | null;
  appearanceKey: string | null;
  hp: number;
  maxHp: number;
  qi: number;
  maxQi: number;
  energyStored: number;
  energyMax: number;
  energyUpdatedAt: Date;
  cultivation: bigint;
  linhThach: bigint;
  tienNgoc: bigint;
  reputation: number;
  realmStage: { name: string; requiredCultivation: bigint; realm: { name: string } };
  currentLocation: { name: string; zone: { region: { name: string } | null } } | null;
  location: { name: string } | null;
  sect: { name: string; tag: string } | null;
  notifications: unknown[];
} | null;

export function Shell({ children, user, character, featureUnlocks }: { children: React.ReactNode; user: { username: string; role: string }; character: ShellCharacter; featureUnlocks: FeatureUnlocks | null }) {
  const energy = character ? character.energyStored : 0;
  const cultivationProgress = character ? Number(character.cultivation % 1000n) / 10 : 0;
  const isClickable = (link: NavLink) => (link.status === "implemented" || link.status === "partial") && (!link.adminOnly || user.role === "ADMIN") && (!link.featureKey || featureUnlocks?.[link.featureKey]?.unlocked !== false);
  const statusText = (link: NavLink) => {
    if (link.adminOnly && user.role !== "ADMIN") return "Admin";
    if (link.status === "coming_soon") return "Sau";
    if (link.status === "disabled") return "Khóa";
    if (link.status === "partial") return "Một phần";
    return "";
  };
  const mobileNav = navGroups.flatMap((group) => group.links).filter(isClickable).slice(0, 5);
  return (
    <div className="game-frame min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="game-sidebar hidden lg:block">
        <div className="brand-block">
          <Link href="/game" className="brand-seal" aria-label="Về trang chính">
            <img src="/brand/tu-tien-gioi-seal.svg" alt="" />
            <span>TU TIÊN GIỚI</span>
          </Link>
          <details className="brand-menu">
            <summary>Menu</summary>
            <div>
              <Link href="/game">Trang Chính</Link>
              <Link href="/game/character">Nhân Vật</Link>
              <Link href="/game/world">Thế Giới</Link>
              <Link href="/game/settings">Cài Đặt</Link>
              {user.role === "ADMIN" ? <Link href="/admin">Quản Trị</Link> : null}
              <form action={logoutAction}><button>Đăng xuất</button></form>
            </div>
          </details>
        </div>
        <WorldClock serverNow={new Date().toISOString()} />

        <section className="sidebar-card">
          {character ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CharacterVisual character={character} mode="avatar" size={54} />
                <div>
                  <p className="font-bold text-gold">{character.name}</p>
                  <p className="text-xs text-paper/60">{character.realmStage.realm.name} {character.realmStage.name}</p>
                </div>
              </div>
              <ResourceBar label="HP" value={character.hp} max={character.maxHp} tone="life" title={`Hồi phục tự nhiên: ${Math.floor(character.maxHp * 0.15)} HP / ngày game`} />
              <ResourceBar label="Chân nguyên" value={character.qi} max={character.maxQi} tone="qi" title={`Hồi phục tự nhiên: ${Math.floor(character.maxQi * 0.2)} Chân nguyên / ngày game`} />
              <ResourceBar label="Thể lực" value={energy} max={character.energyMax} tone="energy" title={`Hồi phục tự nhiên: ${Math.floor(character.energyMax * 0.25)} Thể lực / ngày game`} />
              <ResourceBar label="Tu vi" value={Math.floor(cultivationProgress)} max={100} tone="cultivation" compact />
              <div className="sidebar-ledger">
                <div><span>Linh thạch</span><b><CurrencyAmount amount={character.linhThach} /></b></div>
                <div><span>Tiên ngọc</span><b>{character.tienNgoc.toString()}</b></div>
                <div><span>Danh vọng</span><b>{character.reputation}</b></div>
              </div>
              <div className="sidebar-location">
                <span>{character.currentLocation?.zone.region?.name ?? "Chưa rõ vực"}</span>
                <b>{character.currentLocation?.name ?? character.location?.name ?? "Vô định"}</b>
              </div>
              <div className="sidebar-alerts">
                <span>Thư</span><b>0</b>
                <span>Thông báo</span><b>{character.notifications.length}</b>
              </div>
            </div>
          ) : null}
        </section>

        <nav className="mt-3 space-y-3">
          {navGroups.map((group) => (
            <section key={group.title} className="nav-group">
              <h2>{group.title}</h2>
              <div className="space-y-1">
                {group.links.map((link) => {
                  const { href, label, icon: Icon } = link;
                  const clickable = isClickable(link);
                  const reason = link.featureKey && featureUnlocks?.[link.featureKey]?.unlocked === false ? featureUnlocks[link.featureKey]?.reason : statusText(link);
                  return clickable ? (
                    <Link key={label} href={href} className="nav-row">
                      <Icon size={15} />
                      <span>{label}</span>
                      {link.badge ? <RealtimeBadge type={link.badge} /> : null}
                      <ChevronRight size={13} className="ml-auto text-paper/35" />
                    </Link>
                  ) : (
                    <div key={label} className="nav-row nav-row-disabled" title={reason}>
                      <Lock size={14} />
                      <span>{label}</span>
                      <small>{reason || "Chưa mở"}</small>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <form action={logoutAction} className="mt-4">
          <button className="btn btn-secondary w-full">Đăng xuất</button>
        </form>
      </aside>
      <main className="game-main pb-20 lg:pb-0">
        <div className="top-strip lg:hidden">
          <Link href="/game" className="font-black text-gold">TU TIÊN GIỚI</Link>
          <span>{character?.name ?? "Chưa lập nhân vật"}</span>
        </div>
        {children}
      </main>
      <nav className="mobile-bottom-nav fixed inset-x-0 bottom-0 grid grid-cols-5 border-t border-white/10 p-2 lg:hidden">
        {mobileNav.map(({ href, label, icon: Icon, badge }) => (
          <Link key={href} href={href} className="relative flex flex-col items-center gap-1 rounded-md p-2 text-[11px] text-paper/75">
            <Icon size={18} /> {label}
            {badge ? <RealtimeBadge type={badge} /> : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function ResourceBar({ label, value, max, tone, compact = false, title }: { label: string; value: number; max: number; tone: "life" | "qi" | "energy" | "cultivation"; compact?: boolean; title?: string }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="resource-line" title={title}>
      <div className="resource-meta">
        <span>{label}</span>
        <b>{compact ? `${percent}%` : `${value}/${max}`}</b>
      </div>
      <div className="resource-track">
        <div className={`resource-fill resource-${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
