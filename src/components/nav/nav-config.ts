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
  /** Section heading this item sits under in the sidebar. */
  group: string;
};

export const adminNav: NavItem[] = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, group: "Overview" },
  { title: "Programs", url: "/admin/programs", icon: GraduationCap, group: "Academy" },
  { title: "Trainees", url: "/admin/trainees", icon: Users, group: "People" },
  { title: "Assessments", url: "/admin/assessments", icon: ClipboardCheck, group: "Academy" },
  { title: "Certificates", url: "/admin/certificates", icon: Award, group: "Academy" },
  { title: "Resources", url: "/admin/resources", icon: FolderOpen, group: "Academy" },
  { title: "Reports", url: "/admin/reports", icon: BarChart3, group: "Insights" },
  { title: "Work Status", url: "/admin/work-status", icon: ClipboardList, group: "Insights" },
  { title: "Users", url: "/admin/users", icon: Users, group: "People" },
];

export const trainerNav: NavItem[] = [
  { title: "Dashboard", url: "/trainer", icon: LayoutDashboard, group: "Overview" },
  { title: "Trainees", url: "/trainer/trainees", icon: Users, group: "People" },
  { title: "Certificates", url: "/trainer/certificates", icon: Award, group: "Academy" },
  { title: "Work Status", url: "/admin/work-status", icon: ClipboardList, group: "Insights" },
];

export const traineeNav: NavItem[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard, group: "Overview" },
  { title: "Training Journey", url: "/app/journey", icon: Route, group: "Training" },
  { title: "My Courses", url: "/app/courses", icon: BookOpen, group: "Training" },
  { title: "Certificates", url: "/app/certificates", icon: Award, group: "Training" },
  { title: "Resource Library", url: "/app/resources", icon: Library, group: "Library" },
  { title: "Settlement Calculator", url: "/app/tools/settlement-calculator", icon: Calculator, group: "Tools" },
  { title: "Practice System", url: "/app/tools/practice-system", icon: MonitorSmartphone, group: "Tools" },
  { title: "PEXA Simulator", url: "/app/tools/pexa", icon: Landmark, group: "Tools" },
  { title: "Actionstep Simulator", url: "/app/tools/actionstep", icon: Workflow, group: "Tools" },
];

export const vaNav: NavItem[] = [
  { title: "Work Status", url: "/va", icon: ClipboardList, group: "Work" },
  { title: "Settlement Calculator", url: "/va/settlement-calculator", icon: Calculator, group: "Tools" },
];

export type NavKey = "admin" | "trainer" | "trainee" | "va";

export const navByKey: Record<NavKey, NavItem[]> = {
  admin: adminNav,
  trainer: trainerNav,
  trainee: traineeNav,
  va: vaNav,
};
