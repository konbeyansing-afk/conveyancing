import { Info } from "lucide-react";
import { createQuiz, updateQuiz, deleteQuiz, createQuestion, deleteQuestion } from "@/lib/actions/quiz";
import { AddQuestionForm } from "@/components/admin/add-question-form";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const QUESTION_TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: "Multiple choice",
  TRUE_FALSE: "True / False",
  SHORT_ANSWER: "Short answer",
};

type QuizData = {
  id: string;
  title: string;
  passingScore: number;
  questions: {
    id: string;
    prompt: string;
    type: string;
    explanation: string | null;
    choices: { id: string; text: string; isCorrect: boolean }[];
  }[];
} | null;

export function LessonSettingsPanel({
  programId,
  courseId,
  lessonId,
  quiz,
}: {
  programId: string;
  courseId: string;
  lessonId: string;
  quiz: QuizData;
}) {
  const createQuizForLesson = createQuiz.bind(null, programId, courseId, lessonId);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="size-4 text-muted-foreground" />
            How completion works
          </CardTitle>
          <CardDescription>
            Set in the Lesson Settings panel on the Content step, or the Details step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            By default, a trainee marks this lesson complete by working through every content
            step and sealing it at the end. If &ldquo;Must pass quiz&rdquo; is selected instead,
            they also need a passing attempt on the knowledge check below before the lesson is
            recorded as complete. There&apos;s no separate &ldquo;require previous lesson&rdquo;
            or certificate gating yet — that&apos;s a future roadmap item.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Knowledge check</CardTitle>
          <CardDescription>
            Trainees answer these after finishing the lesson. Correct answers and explanations
            are never shown until after they submit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!quiz ? (
            <form action={createQuizForLesson} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <div className="grid gap-1.5">
                <Label htmlFor="quiz-title">Title</Label>
                <Input id="quiz-title" name="title" defaultValue="Knowledge Check" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="quiz-passing">Passing score (%)</Label>
                <Input id="quiz-passing" name="passingScore" type="number" defaultValue={80} className="w-28" />
              </div>
              <Button type="submit" className="self-end">
                Create knowledge check
              </Button>
            </form>
          ) : (
            <div className="grid gap-4">
              {(() => {
                const updateQuizWithId = updateQuiz.bind(null, programId, courseId, lessonId, quiz.id);
                const deleteQuizWithId = deleteQuiz.bind(null, programId, courseId, lessonId, quiz.id);
                const createQuestionForQuiz = createQuestion.bind(null, programId, courseId, lessonId, quiz.id);

                return (
                  <>
                    <form action={updateQuizWithId} className="flex flex-wrap items-end gap-3">
                      <div className="grid gap-1.5">
                        <Label htmlFor="quiz-title-edit">Title</Label>
                        <Input id="quiz-title-edit" name="title" defaultValue={quiz.title} required />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="quiz-passing-edit">Passing score (%)</Label>
                        <Input
                          id="quiz-passing-edit"
                          name="passingScore"
                          type="number"
                          defaultValue={quiz.passingScore}
                          className="w-28"
                        />
                      </div>
                      <Button type="submit" variant="outline" size="sm">
                        Save
                      </Button>
                      <DeleteConfirmDialog
                        trigger="Delete knowledge check"
                        triggerVariant="ghost"
                        triggerSize="sm"
                        title={`Delete "${quiz.title}"?`}
                        description="This also deletes every question in this knowledge check. This cannot be undone."
                        action={deleteQuizWithId}
                      />
                    </form>

                    <div className="grid gap-2">
                      {quiz.questions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No questions yet.</p>
                      ) : (
                        quiz.questions.map((question, i) => {
                          const deleteQuestionWithId = deleteQuestion.bind(
                            null,
                            programId,
                            courseId,
                            lessonId,
                            question.id
                          );
                          return (
                            <div key={question.id} className="rounded-md border border-border/60 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium">
                                    {i + 1}. {question.prompt}
                                  </p>
                                  <Badge variant="outline" className="mt-1">
                                    {QUESTION_TYPE_LABEL[question.type]}
                                  </Badge>
                                </div>
                                <DeleteConfirmDialog
                                  trigger="Delete"
                                  triggerVariant="ghost"
                                  triggerSize="sm"
                                  title="Delete this question?"
                                  description="This cannot be undone."
                                  action={deleteQuestionWithId}
                                />
                              </div>
                              {question.choices.length > 0 && (
                                <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
                                  {question.choices.map((choice) => (
                                    <li key={choice.id}>
                                      {choice.isCorrect ? "✓" : "○"} {choice.text}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {question.explanation && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Explanation: {question.explanation}
                                </p>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <AddQuestionForm action={createQuestionForQuiz} />
                  </>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
