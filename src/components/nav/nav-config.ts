import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Library,
  Award,
  Landmark,
  Workflow,
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
  { title: "Certificates", url: "/admin/certificates", icon: Award },
  { title: "Resources", url: "/admin/resources", icon: FolderOpen },
  { title: "Reports", url: "/admin/reports", icon: BarChart3 },
  { title: "Work Status", url: "/admin/work-status", icon: ClipboardList },
  { title: "Users", url: "/admin/users", icon: Users },
];

export const trainerNav: NavItem[] = [
  { title: "Dashboard", url: "/trainer", icon: LayoutDashboard },
  { title: "Trainees", url: "/trainer/trainees", icon: Users },
  { title: "Certificates", url: "/trainer/certificates", icon: Award },
  { title: "Work Status", url: "/admin/work-status", icon: ClipboardList },
];

export const traineeNav: NavItem[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Training Journey", url: "/app/journey", icon: Route },
  { title: "My Courses", url: "/app/courses", icon: BookOpen },
  { title: "Certificates", url: "/app/certificates", icon: Award },
  { title: "Resource Library", url: "/app/resources", icon: Library },
  { title: "Settlement Calculator", url: "/app/tools/settlement-calculator", icon: Calculator },
  { title: "Practice System", url: "/app/tools/practice-system", icon: MonitorSmartphone },
  { title: "PEXA Simulator", url: "/app/tools/pexa", icon: Landmark },
  { title: "Actionstep Simulator", url: "/app/tools/actionstep", icon: Workflow },
];

export const vaNav: NavItem[] = [
  { title: "Work Status", url: "/va", icon: ClipboardList },
];

export type NavKey = "admin" | "trainer" | "trainee" | "va";

export const navByKey: Record<NavKey, NavItem[]> = {
  admin: adminNav,
  trainer: trainerNav,
  trainee: traineeNav,
  va: vaNav,
};
