import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth/context";
import { createStudentAction } from "@/server/students/actions";
import { loadCourseOptions } from "@/server/students/queries";
import { PageHeader } from "@/components/ui/primitives";
import { StudentForm } from "../student-form";

export const metadata: Metadata = { title: "Nuevo alumno" };

export default async function NuevoAlumnoPage() {
  const ctx = await requirePermission("students.write");
  const courses = await loadCourseOptions(ctx.db);

  return (
    <>
      <PageHeader
        title="Nuevo alumno"
        description="Se creará su acceso al Campus. Podrás darle contenido al matricularlo."
        breadcrumb={
          <Link
            href="/gestion/alumnos"
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Alumnos
          </Link>
        }
      />

      <StudentForm
        mode="create"
        action={createStudentAction}
        courses={courses}
        submitLabel="Crear alumno"
      />
    </>
  );
}
