import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Calculator,
  ClipboardCheck,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Library,
  MonitorSmartphone,
  Route,
  Users,
} from "lucide-react";

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
};

export const adminNav: NavItem[] = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Programs", url: "/admin/programs", icon: GraduationCap },
  { title: "Trainees", url: "/admin/trainees", icon: Users },
  { title: "Assessments", url: "/admin/assessments", icon: ClipboardCheck },
  { title: "Resources", url: "/admin/resources", icon: FolderOpen },
  { title: "Reports", url: "/admin/reports", icon: BarChart3 },
  { title: "Users", url: "/admin/users", icon: Users },
];

export const trainerNav: NavItem[] = [
  { title: "Dashboard", url: "/trainer", icon: LayoutDashboard },
  { title: "Trainees", url: "/trainer/trainees", icon: Users },
];

export const traineeNav: NavItem[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Training Journey", url: "/app/journey", icon: Route },
  { title: "My Courses", url: "/app/courses", icon: BookOpen },
  { title: "Resource Library", url: "/app/resources", icon: Library },
  { title: "Settlement Calculator", url: "/app/tools/settlement-calculator", icon: Calculator },
  { title: "Practice System", url: "/app/tools/practice-system", icon: MonitorSmartphone },
];

export type NavKey = "admin" | "trainer" | "trainee";

export const navByKey: Record<NavKey, NavItem[]> = {
  admin: adminNav,
  trainer: trainerNav,
  trainee: traineeNav,
};
