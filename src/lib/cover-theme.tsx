import type { LucideIcon } from "lucide-react";
import {
  Shield,
  Home,
  Scale,
  FileText,
  Building2,
  ClipboardCheck,
  Banknote,
  Search as SearchIcon,
  UserCheck,
  Lock,
  Wifi,
  Smartphone,
  KeyRound,
  Mail,
  Handshake,
  Landmark,
  BookOpen,
  GraduationCap,
  Users,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CoverTheme = { icon: LucideIcon; gradient: string };

// Order matters — first matching pattern wins, so more specific rules go first.
const RULES: { pattern: RegExp; icon: LucideIcon; gradient: string }[] = [
  { pattern: /password/i, icon: KeyRound, gradient: "from-violet-500 to-purple-600" },
  { pattern: /phish/i, icon: Mail, gradient: "from-rose-500 to-red-600" },
  { pattern: /device security/i, icon: Smartphone, gradient: "from-cyan-500 to-blue-600" },
  { pattern: /remote work/i, icon: Wifi, gradient: "from-sky-500 to-cyan-600" },
  { pattern: /cyber security/i, icon: Lock, gradient: "from-slate-600 to-slate-800" },
  { pattern: /privacy|confidential|australian privacy/i, icon: Shield, gradient: "from-indigo-500 to-blue-600" },
  { pattern: /checkpoint|compliance assessment|phase \d+ assessment|knowledge check/i, icon: ClipboardCheck, gradient: "from-amber-500 to-orange-600" },
  { pattern: /mandatory compliance/i, icon: ShieldCheck, gradient: "from-amber-600 to-red-600" },
  { pattern: /finance/i, icon: Banknote, gradient: "from-emerald-500 to-green-600" },
  { pattern: /search/i, icon: SearchIcon, gradient: "from-teal-500 to-cyan-600" },
  { pattern: /client verification/i, icon: UserCheck, gradient: "from-blue-500 to-indigo-600" },
  { pattern: /conflict check/i, icon: Scale, gradient: "from-red-500 to-rose-600" },
  { pattern: /contract|disclosure|document/i, icon: FileText, gradient: "from-orange-500 to-amber-600" },
  { pattern: /settlement/i, icon: Handshake, gradient: "from-fuchsia-500 to-pink-600" },
  { pattern: /freehold|leasehold|property law|title/i, icon: Home, gradient: "from-lime-500 to-green-600" },
  { pattern: /parties|responsibilities|buyer|seller/i, icon: Users, gradient: "from-blue-500 to-sky-600" },
  { pattern: /terminology|glossary/i, icon: BookOpen, gradient: "from-teal-500 to-emerald-600" },
  { pattern: /onboarding|welcome|corporate foundation/i, icon: Building2, gradient: "from-primary to-purple-700" },
  { pattern: /matter opening/i, icon: Landmark, gradient: "from-blue-600 to-indigo-700" },
  { pattern: /queensland|conveyancing|timeline|process/i, icon: Scale, gradient: "from-purple-500 to-violet-600" },
];

const DEFAULT_THEME: CoverTheme = { icon: GraduationCap, gradient: "from-primary to-violet-700" };

export function getCoverTheme(title: string): CoverTheme {
  for (const rule of RULES) {
    if (rule.pattern.test(title)) return { icon: rule.icon, gradient: rule.gradient };
  }
  return DEFAULT_THEME;
}

/**
 * A large cover banner for card grids (programs, courses). Renders a custom
 * uploaded image when `imageUrl` is set, otherwise falls back to an
 * auto-generated gradient + icon based on the title.
 */
export function CoverBanner({
  title,
  imageUrl,
  className,
}: {
  title: string;
  imageUrl?: string | null;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-provided URLs, not a static/local asset
      <img
        src={imageUrl}
        alt=""
        className={cn("w-full object-cover", className)}
      />
    );
  }

  const { icon: Icon, gradient } = getCoverTheme(title);
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br",
        gradient,
        className
      )}
    >
      <Icon className="size-10 text-white/90" strokeWidth={1.5} />
    </div>
  );
}

/**
 * A small square cover badge — for list rows (lessons within a course, or
 * compact program lists on the dashboards). Renders a custom image when
 * `imageUrl` is set, otherwise an auto-generated gradient + icon.
 */
export function CoverIcon({
  title,
  imageUrl,
  className,
}: {
  title: string;
  imageUrl?: string | null;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-provided URLs, not a static/local asset
      <img
        src={imageUrl}
        alt=""
        className={cn("size-8 shrink-0 rounded-lg object-cover", className)}
      />
    );
  }

  const { icon: Icon, gradient } = getCoverTheme(title);
  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white",
        gradient,
        className
      )}
    >
      <Icon className="size-4" strokeWidth={2} />
    </div>
  );
}
