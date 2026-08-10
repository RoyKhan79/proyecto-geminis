import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import { requirePlatformAdmin } from "@/lib/auth/context";
import { prismaBase } from "@/lib/db/client";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { BRAND } from "@/lib/brand";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Plataforma" };

/**
 * Consola de plataforma (superadmin).
 *
 * Muestra academias y uso agregado. No da acceso al contenido de ninguna
 * academia: para soporte real habrá impersonación explícita y auditada (§3),
 * que se implementa junto con el resto del módulo de plataforma.
 */
export default async function PlataformaPage() {
  const ctx = await requirePlatformAdmin();

  const academias = await prismaBase.academy.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      createdAt: true,
      plan: { select: { name: true } },
      _count: { select: { memberships: true, oppositions: true } },
    },
  });

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <PageHeader
        title={`Plataforma · ${BRAND.name}`}
        description={`Conectado como ${ctx.user.email}.`}
        actions={
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="icon" aria-label="Cerrar sesión">
              <LogOut aria-hidden />
            </Button>
          </form>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <thead>
            <tr>
              <Th>Academia</Th>
              <Th>Plan</Th>
              <Th>Personas</Th>
              <Th>Oposiciones</Th>
              <Th>Alta</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {academias.map((academia) => (
              <tr key={academia.id}>
                <Td>
                  <span className="block font-medium text-ink">{academia.name}</span>
                  <span className="text-xs text-ink-muted">/{academia.slug}</span>
                </Td>
                <Td className="text-ink-soft">{academia.plan?.name ?? "—"}</Td>
                <Td className="tabular-nums text-ink-soft">
                  {academia._count.memberships}
                </Td>
                <Td className="tabular-nums text-ink-soft">
                  {academia._count.oppositions}
                </Td>
                <Td className="text-ink-soft">{formatDate(academia.createdAt)}</Td>
                <Td>
                  <Badge tone={academia.status === "ACTIVE" ? "positive" : "caution"}>
                    {academia.status}
                  </Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardContent className="p-5 pt-5 text-sm text-ink-muted">
          El alta de academias, los límites por plan, el consumo de IA y la
          impersonación de soporte se construyen en el módulo de plataforma. Hasta
          entonces, las academias se crean con{" "}
          <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">
            createAcademyWithRoles()
          </code>
          .{" "}
          <Link href="/inicio" className="text-accent hover:underline">
            Volver
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
