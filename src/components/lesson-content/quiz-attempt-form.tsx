"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, HelpCircle, LayoutDashboard, ArrowLeft } from "lucide-react";
import { submitQuizAttempt, type QuizAttemptState } from "@/lib/actions/quiz-attempt";

type ClientChoice = { id: string; text: string };
type ClientQuestion = {
  id: string;
  prompt: string;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
  choices: ClientChoice[];
};

export function QuizAttemptForm({
  quizId,
  quizTitle,
  passingScore,
  questions,
  courseId,
}: {
  quizId: string;
  quizTitle: string;
  passingScore: number;
  questions: ClientQuestion[];
  courseId: string;
}) {
  const action = submitQuizAttempt.bind(null, quizId) as (
    prevState: QuizAttemptState,
    formData: FormData
  ) => Promise<QuizAttemptState>;
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.stageJustCompleted) {
      toast.success("Stage complete!", {
        description: `You've completed "${state.stageJustCompleted.title}" — your next stage is now unlocked.`,
      });
    }
  }, [state]);

  if (state) {
    const resultByQuestion = new Map(state.results.map((r) => [r.questionId, r]));
    return (
      <div className="matter-file-theme -m-4 min-h-[calc(100vh-3.5rem)] px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <div
            className="rounded-xl border p-6 text-center"
            style={{ borderColor: "var(--mf-line)", backgroundColor: "var(--mf-paper-raised)" }}
          >
            <p className="mf-mono text-xs uppercase tracking-wide" style={{ color: "var(--mf-brass-dark)" }}>
              {quizTitle}
            </p>
            <p className="mf-display mt-2 text-4xl font-medium">{state.score}%</p>
            <p
              className="mt-1 text-sm font-medium"
              style={{ color: state.passed ? "var(--mf-eucalyptus)" : "var(--mf-clay)" }}
            >
              {state.passed ? `Passed (needed ${state.passingScore}%)` : `Not yet — needed ${state.passingScore}%`}
            </p>
          </div>

          <div className="mt-6 grid gap-3">
            {questions.map((q, i) => {
              const result = resultByQuestion.get(q.id);
              return (
                <Card key={q.id}>
                  <CardHeader className="flex-row items-start gap-2">
                    {result?.correct === true && <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" style={{ color: "var(--mf-eucalyptus)" }} />}
                    {result?.correct === false && <XCircle className="mt-0.5 size-5 shrink-0" style={{ color: "var(--mf-clay)" }} />}
                    {result?.correct === null && <HelpCircle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}
                    <div>
                      <CardTitle className="text-sm font-normal">
                        {i + 1}. {q.prompt}
                      </CardTitle>
                      {result?.correct === null && (
                        <p className="mt-1 text-xs text-muted-foreground">Recorded for trainer review.</p>
                      )}
                      {result?.correct === false && result.correctAnswer && (
                        <p className="mt-1 text-xs font-medium" style={{ color: "var(--mf-eucalyptus)" }}>
                          Correct answer: {result.correctAnswer}
                        </p>
                      )}
                      {result?.explanation && (
                        <p className="mt-1 text-xs text-muted-foreground">{result.explanation}</p>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button variant="outline" nativeButton={false} render={<Link href={`/app/courses/${courseId}`} />}>
              <ArrowLeft /> Back to course
            </Button>
            <Button
              nativeButton={false}
              style={{ backgroundColor: "var(--mf-brass)", color: "var(--mf-paper)" }}
              render={<Link href="/app" />}
            >
              <LayoutDashboard /> Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="matter-file-theme -m-4 min-h-[calc(100vh-3.5rem)] px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <p className="mf-mono text-xs uppercase tracking-wide" style={{ color: "var(--mf-brass-dark)" }}>
          Knowledge check
        </p>
        <h1 className="mf-display text-3xl font-medium">{quizTitle}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--mf-ink-soft)" }}>
          Answer every question, then submit — you&apos;ll see your score and feedback right away.
          You need {passingScore}% to pass.
        </p>

        <form action={formAction} className="mt-6 grid gap-4">
          {questions.map((q, i) => (
            <div
              key={q.id}
              className="rounded-xl border p-5"
              style={{ borderColor: "var(--mf-line)", backgroundColor: "var(--mf-paper-raised)" }}
            >
              <p className="text-sm font-medium">
                {i + 1}. {q.prompt}
              </p>
              {q.type === "SHORT_ANSWER" ? (
                <Textarea name={`q_${q.id}`} className="mt-3" rows={3} />
              ) : (
                <div className="mt-3 grid gap-2">
                  {q.choices.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input type="radio" name={`q_${q.id}`} value={c.id} required className="size-4" />
                      {c.text}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          <Button type="submit" disabled={pending} style={{ backgroundColor: "var(--mf-brass)", color: "var(--mf-paper)" }}>
            {pending ? "Submitting…" : "Submit answers"}
          </Button>
        </form>
      </div>
    </div>
  );
}
