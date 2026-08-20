import { Badge } from "@/components/ui/badge";

export function StatusBadge({ isPublished }: { isPublished: boolean }) {
  return isPublished ? (
    <Badge className="bg-primary/10 text-primary">Published</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Draft
    </Badge>
  );
}
