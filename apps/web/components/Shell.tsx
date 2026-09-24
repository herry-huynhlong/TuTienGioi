import Link from "next/link";
import { logoutAction } from "@/lib/forms";
import { currentEnergy } from "@ttg/game";
import {
  Backpack,
  BookOpen,
  BriefcaseBusiness,
  ChevronRight,
  Hammer,
  Home,
  Landmark,
  Mail,
  Map,
  MessageSquare,
  Mountain,
  ScrollText,
  Settings,
  Shield,
  ShoppingBag,
  Swords,
  Trophy,
  User,
  Users,
  type LucideIcon
} from "lucide-react";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  enabled: boolean;
};

type NavGroup = {
  title: string;
  links: NavLink[];
};

const navGroups: NavGroup[] = [
  {
    title: "Tổng quan",
    links: [
      { href: "/game", label: "Tổng Quan", icon: Home, enabled: true },
      { href: "/game/character", label: "Nhân Vật", icon: User, enabled: true },
      { href: "/game/world", label: "Thế Giới", icon: Mountain, enabled: true },
      { href: "/game/leaderboard", label: "Xếp Hạng", icon: Trophy, enabled: true }
    ]
  },
  {
    title: "Tu luyện",
    links: [
      { href: "/game/character", label: "Túi Đồ", icon: Backpack, enabled: true },
      { href: "/game/character", label: "Công Pháp", icon: BookOpen, enabled: true },
      { href: "/game/world", label: "Yêu Thú", icon: Swords, enabled: true },
      { href: "/game/world", label: "Bí Cảnh", icon: Map, enabled: false }
    ]
  },
  {
    title: "Kinh tế",
    links: [
      { href: "/game/market", label: "Chợ", icon: ShoppingBag, enabled: true },
      { href: "/game/market", label: "Đấu Giá", icon: Hammer, enabled: false },
      { href: "/game/market", label: "Nghề Nghiệp", icon: BriefcaseBusiness, enabled: false }
    ]
  },
  {
    title: "Cộng đồng",
    links: [
      { href: "/game/sect", label: "Tông Môn", icon: Shield, enabled: true },
      { href: "/game/sect", label: "Bạn Bè", icon: Users, enabled: false },
      { href: "/game/sect", label: "Tin Nhắn", icon: Mail, enabled: false },
      { href: "/game/sect", label: "Chat", icon: MessageSquare, enabled: false }
    ]
  },
  {
    title: "Hệ thống",
    links: [
      { href: "/admin", label: "Admin", icon: Landmark, enabled: true },
      { href: "/game", label: "Nhật Ký", icon: ScrollText, enabled: false },
      { href: "/game", label: "Cài Đặt", icon: Settings, enabled: false }
    ]
  }
] satisfies NavGroup[];

type ShellCharacter = {
  name: string;
  title: string;
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

export function Shell({ children, user, character }: { children: React.ReactNode; user: { username: string; role: string }; character: ShellCharacter }) {
  const energy = character ? currentEnergy(character) : 0;
  const cultivationProgress = character ? Number(character.cultivation % 1000n) / 10 : 0;
  const mobileNav = navGroups.flatMap((group) => group.links).filter((link) => link.enabled).slice(0, 5);
  return (
    <div className="game-frame min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="game-sidebar hidden lg:block">
        <div className="brand-block">
          <Link href="/game" className="brand-title">TU TIÊN GIỚI</Link>
          <p className="brand-subtitle">Persistent tu tiên world</p>
        </div>

        <section className="sidebar-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase text-paper/45">Tài khoản</p>
              <p className="font-bold text-paper">/@{user.username}</p>
            </div>
            <span className="status-pill">{user.role}</span>
          </div>
          {character ? (
            <div className="mt-3 space-y-2">
              <div>
                <p className="font-bold text-gold">{character.name}</p>
                <p className="text-xs text-paper/60">{character.title} · {character.realmStage.realm.name} {character.realmStage.name}</p>
              </div>
              <ResourceBar label="HP" value={character.hp} max={character.maxHp} tone="life" />
              <ResourceBar label="Chân nguyên" value={character.qi} max={character.maxQi} tone="qi" />
              <ResourceBar label="Thể lực" value={energy} max={character.energyMax} tone="energy" />
              <ResourceBar label="Tu vi" value={Math.floor(cultivationProgress)} max={100} tone="cultivation" compact />
              <div className="sidebar-ledger">
                <div><span>Linh thạch</span><b>{character.linhThach.toString()}</b></div>
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
                {group.links.map(({ href, label, icon: Icon, enabled }) => (
                  enabled ? (
                    <Link key={label} href={href} className="nav-row">
                      <Icon size={15} />
                      <span>{label}</span>
                      <ChevronRight size={13} className="ml-auto text-paper/35" />
                    </Link>
                  ) : (
                    <div key={label} className="nav-row nav-row-disabled">
                      <Icon size={15} />
                      <span>{label}</span>
                      <small>Sau</small>
                    </div>
                  )
                ))}
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
          <span>{character?.name ?? user.username}</span>
        </div>
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 grid grid-cols-5 border-t border-white/10 bg-[#171a18]/95 p-2 lg:hidden">
        {mobileNav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-1 rounded-md p-2 text-[11px] text-paper/75">
            <Icon size={18} /> {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function ResourceBar({ label, value, max, tone, compact = false }: { label: string; value: number; max: number; tone: "life" | "qi" | "energy" | "cultivation"; compact?: boolean }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="resource-line">
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
