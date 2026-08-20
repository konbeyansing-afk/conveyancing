import Link from "next/link";
import { BookOpen, Library, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function NoCoursesEmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="relative flex size-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <BookOpen className="size-7" />
          <span className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-card ring-1 ring-foreground/10">
            <Sparkles className="size-3.5 text-amber-500" />
          </span>
        </div>
        <div className="grid max-w-sm gap-1.5">
          <h3 className="text-base font-semibold">You haven&apos;t been enrolled in any courses yet</h3>
          <p className="text-sm text-muted-foreground">
            Your assigned training courses will appear here once your trainer or administrator
            enrolls you.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Button nativeButton={false} render={<Link href="/app/resources" />}>
            <Library />
            Explore Resource Library
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="#how-training-works" />}
          >
            How training works
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
