"use client";

import { useMemo, useState } from "react";
import { ExternalLink, FileText, Library, Search, X } from "lucide-react";
import type { TrainingJurisdiction } from "@prisma/client";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type LibraryResource = {
  id: string;
  title: string;
  url: string;
  fileType: string;
  description: string | null;
  programTitle: string | null;
  jurisdiction: TrainingJurisdiction | null;
};

const JURISDICTION_LABEL: Record<TrainingJurisdiction, string> = {
  QLD: "Queensland",
  NSW: "New South Wales",
  VIC: "Victoria",
  UK: "United Kingdom",
};

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Filters only what the trainee is already entitled to see — the list comes from the server page. */
export function ResourceLibrary({ resources }: { resources: LibraryResource[] }) {
  const [query, setQuery] = useState("");
  const [jurisdiction, setJurisdiction] = useState<TrainingJurisdiction | "GENERAL" | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);

  const jurisdictions = useMemo(
    () => [...new Set(resources.map((r) => r.jurisdiction ?? "GENERAL"))] as (TrainingJurisdiction | "GENERAL")[],
    [resources],
  );
  const fileTypes = useMemo(() => [...new Set(resources.map((r) => r.fileType))].sort(), [resources]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter((r) => {
      if (jurisdiction && (r.jurisdiction ?? "GENERAL") !== jurisdiction) return false;
      if (fileType && r.fileType !== fileType) return false;
      if (!q) return true;
      return [r.title, r.description ?? "", r.programTitle ?? ""].some((t) => t.toLowerCase().includes(q));
    });
  }, [resources, query, jurisdiction, fileType]);

  const filtering = query !== "" || jurisdiction !== null || fileType !== null;

  if (resources.length === 0) {
    return (
      <EmptyState
        icon={Library}
        title="Your library is empty for now"
        description="Guides, templates and reference material for your programs will appear here as they're added."
      />
    );
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search the library"
            placeholder="Search guides, templates and references"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {jurisdictions.length > 1 &&
            jurisdictions.map((j) => (
              <Chip key={j} active={jurisdiction === j} onClick={() => setJurisdiction(jurisdiction === j ? null : j)}>
                {j === "GENERAL" ? "General" : JURISDICTION_LABEL[j]}
              </Chip>
            ))}
          {fileTypes.length > 1 &&
            fileTypes.map((t) => (
              <Chip key={t} active={fileType === t} onClick={() => setFileType(fileType === t ? null : t)}>
                {t}
              </Chip>
            ))}
          {filtering && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setJurisdiction(null);
                setFileType(null);
              }}
              className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" /> Clear filters
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Showing {filtered.length} of {resources.length} {resources.length === 1 ? "resource" : "resources"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nothing matches those filters"
          description="Try a different search term, or clear the filters to see everything available to you."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((r) => (
            <li key={r.id}>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="group block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-(--shadow-raised)">
                  <CardContent className="flex h-full gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-balance">{r.title}</p>
                        <ExternalLink aria-hidden className="mt-1 size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                      </div>
                      {r.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{r.fileType}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {r.jurisdiction ? JURISDICTION_LABEL[r.jurisdiction] : "General"}
                          {r.programTitle ? ` · ${r.programTitle}` : ""}
                        </span>
                        <span className="sr-only">Opens in a new tab</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
