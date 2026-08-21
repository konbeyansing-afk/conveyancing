import { prisma } from "./src/lib/prisma";
async function main() {
  const p = await prisma.program.count({ where: { title: { contains: "ZZ-AUDIT" } } });
  const u = await prisma.user.count({ where: { email: { contains: "@example.test" } } });
  const s = await prisma.stage.count({ where: { title: { contains: "ZZ-AUDIT" } } });
  const c = await prisma.course.count({ where: { title: { contains: "ZZ-AUDIT" } } });
  const l = await prisma.lesson.count({ where: { title: { contains: "ZZ-AUDIT" } } });
  const q = await prisma.quiz.count({ where: { title: { contains: "ZZ-AUDIT" } } });
  console.log("LEFTOVER audit rows:", { programs: p, users: u, stages: s, courses: c, lessons: l, quizzes: q });
  console.log("REAL totals:", {
    users: await prisma.user.count(), programs: await prisma.program.count(),
    stages: await prisma.stage.count(), courses: await prisma.course.count(),
    modules: await prisma.module.count(), lessons: await prisma.lesson.count(),
    quizzes: await prisma.quiz.count(), enrollments: await prisma.enrollment.count(),
    progress: await prisma.lessonProgress.count(), attempts: await prisma.quizAttempt.count(),
  });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
