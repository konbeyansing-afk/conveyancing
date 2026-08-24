"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canPreviewUnpublished } from "@/lib/can-preview-unpublished";
import { isEnrolledInCourse } from "@/lib/is-enrolled-in-course";
import { isStageUnlockedForUser, isCoursePublished, isStageComplete } from "@/lib/stage-access";
import { syncCompletionForStage } from "@/lib/completion";

export type QuestionResult = {
  questionId: string;
  type: string;
  correct: boolean | null; // null for short-answer (not auto-graded)
  explanation: string | null;
  correctAnswer: string | null; // the correct choice's text, for MC/TF questions only
};

export type QuizAttemptState = {
  score: number;
  passed: boolean;
  passingScore: number;
  results: QuestionResult[];
  stageJustCompleted?: { id: string; title: string };
} | null;

export async function submitQuizAttempt(
  quizId: string,
  _prevState: QuizAttemptState,
  formData: FormData
): Promise<QuizAttemptState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: { include: { choices: true }, orderBy: { order: "asc" } },
      course: {
        select: {
          id: true,
          isPublished: true,
          program: { select: { isPublished: true } },
          stage: {
            select: { id: true, title: true, isPublished: true, program: { select: { isPublished: true } } },
          },
        },
      },
      lesson: { select: { isPublished: true } },
    },
  });
  if (!quiz) return null;

  // A quiz can be lesson-scoped or course-level; only lesson-scoped quizzes carry their own publish gate.
  const isPublished = (quiz.lesson?.isPublished ?? true) && isCoursePublished(quiz.course);
  const staffPreview = await canPreviewUnpublished();

  if (!staffPreview) {
    if (!isPublished || !(await isEnrolledInCourse(quiz.course.id))) return null;
    // Critical mutation-level gate: stops a locked-stage quiz submission even if the
    // page was somehow reached directly by URL.
    if (quiz.course.stage && !(await isStageUnlockedForUser(quiz.course.stage.id, userId))) {
      return null;
    }
  }

  let correctCount = 0;
  let gradableCount = 0;
  const results: QuestionResult[] = [];
  const answers: Record<string, { choiceId?: string; text?: string; correct?: boolean }> = {};

  for (const question of quiz.questions) {
    if (question.type === "SHORT_ANSWER") {
      const text = ((formData.get(`q_${question.id}`) as string) ?? "").trim();
      answers[question.id] = { text };
      results.push({
        questionId: question.id,
        type: question.type,
        correct: null,
        explanation: question.explanation,
        correctAnswer: null,
      });
      continue;
    }

    gradableCount++;
    const choiceId = formData.get(`q_${question.id}`) as string | null;
    const chosen = question.choices.find((c) => c.id === choiceId);
    const isCorrect = !!chosen?.isCorrect;
    if (isCorrect) correctCount++;
    answers[question.id] = { choiceId: choiceId ?? undefined, correct: isCorrect };
    results.push({
      questionId: question.id,
      type: question.type,
      correct: isCorrect,
      explanation: question.explanation,
      correctAnswer: isCorrect ? null : (question.choices.find((c) => c.isCorrect)?.text ?? null),
    });
  }

  const score = gradableCount > 0 ? Math.round((correctCount / gradableCount) * 100) : 0;
  const passed = score >= quiz.passingScore;

  const wasStageComplete = quiz.course.stage ? await isStageComplete(quiz.course.stage.id, userId) : false;

  await prisma.quizAttempt.create({
    data: { quizId, userId, score, passed, answers, submittedAt: new Date() },
  });

  // A passing attempt can satisfy a stage's gating quiz, which can in turn
  // complete the stage and the program.
  if (quiz.course.stage) await syncCompletionForStage(quiz.course.stage.id, userId);

  if (
    quiz.course.stage &&
    !wasStageComplete &&
    (await isStageComplete(quiz.course.stage.id, userId))
  ) {
    return {
      score,
      passed,
      passingScore: quiz.passingScore,
      results,
      stageJustCompleted: { id: quiz.course.stage.id, title: quiz.course.stage.title },
    };
  }

  return { score, passed, passingScore: quiz.passingScore, results };
}
