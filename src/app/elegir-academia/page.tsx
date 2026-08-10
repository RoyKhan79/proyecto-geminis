import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { switchAcademyAction } from "@/lib/auth/actions";
import { requireAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Elegir academia" };

export default async function ElegirAcademiaPage() {
  const ctx = await requireAuth();

  if (ctx.memberships.length === 1 && ctx.academy) redirect("/inicio");

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          Elige academia
        </h1>
        <p className="text-sm text-ink-muted">
          Perteneces a varias academias. Cada una es un espacio independiente.
        </p>
      </div>

      {ctx.memberships.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 className="size-5" />}
            title="Todavía no perteneces a ninguna academia"
            description="Cuando una academia te dé de alta, aparecerá aquí."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-[var(--border-subtle)]">
          {ctx.memberships.map((membership) => (
            <form
              key={membership.academyId}
              action={switchAcademyAction}
              className="flex items-center justify-between gap-4 p-4"
            >
              <input type="hidden" name="academyId" value={membership.academyId} />
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">
                  {membership.academyName}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  /{membership.academySlug}
                </p>
              </div>
              <Button type="submit" variant="secondary" size="sm">
                Entrar
              </Button>
            </form>
          ))}
        </Card>
      )}
    </main>
  );
}
