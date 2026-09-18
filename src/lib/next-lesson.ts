export type SiblingLesson = { id: string; order: number; isPublished: boolean };
export type SiblingModule = { id: string; order: number; lessons: SiblingLesson[] };

/**
 * The next lesson to suggest from a course's own module/lesson order — never
 * loads or needs lesson content, just ids/order/publish state already on
 * hand. Returns null when the current lesson is the course's last one.
 */
export function findNextLesson(
  modules: SiblingModule[],
  currentModuleId: string,
  currentLessonId: string,
): { moduleId: string; lessonId: string } | null {
  const sorted = [...modules].sort((a, b) => a.order - b.order);
  const currentModuleIndex = sorted.findIndex((m) => m.id === currentModuleId);
  if (currentModuleIndex === -1) return null;

  const currentModule = sorted[currentModuleIndex];
  const lessonsInModule = [...currentModule.lessons]
    .filter((l) => l.isPublished)
    .sort((a, b) => a.order - b.order);
  const currentLessonIndex = lessonsInModule.findIndex((l) => l.id === currentLessonId);

  if (currentLessonIndex !== -1 && currentLessonIndex < lessonsInModule.length - 1) {
    const next = lessonsInModule[currentLessonIndex + 1];
    return { moduleId: currentModule.id, lessonId: next.id };
  }

  for (let i = currentModuleIndex + 1; i < sorted.length; i++) {
    const candidateLessons = [...sorted[i].lessons]
      .filter((l) => l.isPublished)
      .sort((a, b) => a.order - b.order);
    if (candidateLessons.length > 0) {
      return { moduleId: sorted[i].id, lessonId: candidateLessons[0].id };
    }
  }

  return null;
}
