"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import type { QuestionType } from "@prisma/client";

function lessonPath(programId: string, courseId: string, lessonId: string) {
  return `/admin/programs/${programId}/courses/${courseId}/lessons/${lessonId}`;
}

export async function createQuiz(
  programId: string,
  courseId: string,
  lessonId: string,
  formData: FormData
) {
  await requireRole("ADMIN");

  const title = (formData.get("title") as string)?.trim() || "Knowledge Check";
  const passingScore = Number(formData.get("passingScore")) || 80;

  await prisma.quiz.create({
    data: { courseId, lessonId, title, passingScore },
  });

  revalidatePath(lessonPath(programId, courseId, lessonId));
}

export async function updateQuiz(
  programId: string,
  courseId: string,
  lessonId: string,
  quizId: string,
  formData: FormData
) {
  await requireRole("ADMIN");

  const title = (formData.get("title") as string)?.trim();
  if (!title) return;
  const passingScore = Number(formData.get("passingScore")) || 80;

  await prisma.quiz.update({ where: { id: quizId }, data: { title, passingScore } });
  revalidatePath(lessonPath(programId, courseId, lessonId));
}

export async function deleteQuiz(
  programId: string,
  courseId: string,
  lessonId: string,
  quizId: string,
  _formData: FormData
) {
  await requireRole("ADMIN");
  await prisma.quiz.delete({ where: { id: quizId } });
  revalidatePath(lessonPath(programId, courseId, lessonId));
}

export async function createQuestion(
  programId: string,
  courseId: string,
  lessonId: string,
  quizId: string,
  formData: FormData
) {
  await requireRole("ADMIN");

  const prompt = (formData.get("prompt") as string)?.trim();
  if (!prompt) return;

  const type = formData.get("type") as QuestionType;
  const explanation = (formData.get("explanation") as string)?.trim() || null;
  const order = await prisma.question.count({ where: { quizId } });

  if (type === "SHORT_ANSWER") {
    await prisma.question.create({
      data: { quizId, prompt, type, explanation, order },
    });
    revalidatePath(lessonPath(programId, courseId, lessonId));
    return;
  }

  if (type === "TRUE_FALSE") {
    const correct = formData.get("correctBool") as string;
    await prisma.question.create({
      data: {
        quizId,
        prompt,
        type,
        explanation,
        order,
        choices: {
          create: [
            { text: "True", isCorrect: correct === "true", order: 0 },
            { text: "False", isCorrect: correct === "false", order: 1 },
          ],
        },
      },
    });
    revalidatePath(lessonPath(programId, courseId, lessonId));
    return;
  }

  // MULTIPLE_CHOICE
  const correctIndex = Number(formData.get("correctIndex"));
  const choiceTexts = [0, 1, 2, 3]
    .map((i) => (formData.get(`choice${i}`) as string)?.trim())
    .filter((text): text is string => !!text);

  if (choiceTexts.length < 2) return;

  await prisma.question.create({
    data: {
      quizId,
      prompt,
      type,
      explanation,
      order,
      choices: {
        create: choiceTexts.map((text, i) => ({
          text,
          isCorrect: i === correctIndex,
          order: i,
        })),
      },
    },
  });

  revalidatePath(lessonPath(programId, courseId, lessonId));
}

export async function deleteQuestion(
  programId: string,
  courseId: string,
  lessonId: string,
  questionId: string,
  _formData: FormData
) {
  await requireRole("ADMIN");
  await prisma.question.delete({ where: { id: questionId } });
  revalidatePath(lessonPath(programId, courseId, lessonId));
}
