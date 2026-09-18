import { describe, expect, it } from "vitest";
import { findNextLesson, type SiblingModule } from "@/lib/next-lesson";

const modules: SiblingModule[] = [
  {
    id: "mod-1",
    order: 0,
    lessons: [
      { id: "lesson-1a", order: 0, isPublished: true },
      { id: "lesson-1b", order: 1, isPublished: true },
    ],
  },
  {
    id: "mod-2",
    order: 1,
    lessons: [
      { id: "lesson-2a-draft", order: 0, isPublished: false },
      { id: "lesson-2b", order: 1, isPublished: true },
    ],
  },
  { id: "mod-3", order: 2, lessons: [] },
];

describe("Finding the next lesson from real module/lesson order", () => {
  it("moves to the next lesson within the same module", () => {
    expect(findNextLesson(modules, "mod-1", "lesson-1a")).toEqual({
      moduleId: "mod-1",
      lessonId: "lesson-1b",
    });
  });

  it("skips unpublished lessons when crossing into the next module", () => {
    expect(findNextLesson(modules, "mod-1", "lesson-1b")).toEqual({
      moduleId: "mod-2",
      lessonId: "lesson-2b",
    });
  });

  it("skips empty modules and returns null past the course's last lesson", () => {
    expect(findNextLesson(modules, "mod-2", "lesson-2b")).toBeNull();
  });

  it("returns null for an unknown module", () => {
    expect(findNextLesson(modules, "does-not-exist", "lesson-1a")).toBeNull();
  });
});
