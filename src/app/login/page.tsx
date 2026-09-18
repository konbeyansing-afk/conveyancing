import { GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { matterDisplay } from "@/lib/fonts";

/** `--mf-font-display` is Newsreader, already loaded for the lesson-viewer's
 *  "premium" theme — reused here rather than adding a second serif font. */
const displayFont = { fontFamily: "var(--mf-font-display)" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: params.callbackUrl || "/",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect(`/login?error=CredentialsSignin`);
      }
      throw error;
    }
  }

  return (
    <div className={`flex min-h-screen ${matterDisplay.variable}`}>
      {/* Brand panel — hidden on small screens, where the form alone is the priority. */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-[var(--brand-slate)] via-[#111e3a] to-[#0b1530] px-12 py-10 text-sidebar-foreground lg:flex">
        {/* Faint dot-grid texture — depth without noise. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="login-rise relative flex items-center gap-2.5" style={{ "--login-delay": "0ms" } as React.CSSProperties}>
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <GraduationCap className="size-4.5" />
          </span>
          <span style={displayFont} className="text-lg font-medium">
            Conveyancing Academy
          </span>
        </div>

        <div className="relative max-w-md">
          <div
            className="login-rise mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-sidebar-foreground/80 backdrop-blur-sm"
            style={{ "--login-delay": "80ms" } as React.CSSProperties}
          >
            <Sparkles className="size-3 shrink-0 text-success" />
            Built for real conveyancing practice
          </div>
          <h1 style={displayFont} className="text-4xl leading-[1.15] font-medium text-white italic">
            <span
              className="login-rise inline-block not-italic"
              style={{ "--login-delay": "140ms" } as React.CSSProperties}
            >
              Practical training
            </span>{" "}
            <span className="login-rise inline-block" style={{ "--login-delay": "200ms" } as React.CSSProperties}>
              for real conveyancing work.
            </span>
          </h1>
          <p
            className="login-rise mt-5 text-sm leading-relaxed text-sidebar-foreground/70"
            style={{ "--login-delay": "260ms" } as React.CSSProperties}
          >
            Queensland and New South Wales workflows, guided practice tools, and the same
            checklists your matters run on — all in one place.
          </p>
          <div
            className="login-rise mt-8 flex items-center gap-2 text-sm text-success"
            style={{ "--login-delay": "320ms" } as React.CSSProperties}
          >
            <ShieldCheck className="size-4 shrink-0" />
            Trusted by trainees and VAs across the firm
          </div>
        </div>

        <p className="login-rise relative text-xs text-sidebar-foreground/50" style={{ "--login-delay": "380ms" } as React.CSSProperties}>
          &copy; {new Date().getFullYear()} Conveyancing Academy
        </p>

        {/* Decorative accent — purely visual, not interactive, slowly drifting. */}
        <div
          aria-hidden
          className="login-drift pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-primary/25 blur-3xl"
        />
        <div
          aria-hidden
          className="login-drift-slow pointer-events-none absolute -top-16 -left-16 size-64 rounded-full bg-success/15 blur-3xl"
        />
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-1 items-center justify-center bg-background px-6 lg:w-1/2">
        <div className="login-rise w-full max-w-sm" style={{ "--login-delay": "120ms" } as React.CSSProperties}>
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-4.5" />
            </span>
            <span style={displayFont} className="text-lg font-medium">
              Conveyancing Academy
            </span>
          </div>

          <h2 style={displayFont} className="text-3xl font-medium">
            Sign in
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in with your work account to continue.
          </p>

          <form action={login} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="h-11 transition-shadow focus-visible:shadow-md"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="h-11 transition-shadow focus-visible:shadow-md"
              />
            </div>
            {params.error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                Incorrect email or password.
              </p>
            )}
            <Button
              type="submit"
              className="h-11 w-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 active:translate-y-0"
            >
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
