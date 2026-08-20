import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "@prisma/client";

function roleHome(role?: Role) {
  if (role === "ADMIN") return "/admin";
  if (role === "TRAINER") return "/trainer";
  return "/app";
}

export default async function Home() {
  const session = await auth();
  redirect(roleHome(session?.user?.role));
}
