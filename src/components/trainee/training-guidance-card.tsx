import { CheckCircle2, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  "Access your lessons",
  "Complete quizzes and assessments",
  "Track your progress",
  "Earn certificates",
];

export function TrainingGuidanceCard() {
  return (
    <Card id="how-training-works" className="scroll-mt-20">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <HelpCircle className="size-5" />
        </div>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <h3 className="text-base font-semibold">How does your training work?</h3>
            <p className="text-sm text-muted-foreground">
              Your trainer or administrator enrolls you in the training program that matches your
              role. Once enrolled, you can:
            </p>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {steps.map((step) => (
              <li key={step} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {step}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
