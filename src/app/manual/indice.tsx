import Link from "next/link";

/**
 * Índice lateral.
 *
 * Fijo en pantalla grande y escondido en móvil, donde el pulgar hace mejor
 * trabajo desplazando que buscando en un menú. Es un manual de consulta: lo
 * normal es llegar buscando una cosa concreta, no leyéndolo de arriba abajo.
 */
export function Indice({ conOperacion }: { conOperacion: boolean }) {
  const bloques: { titulo: string; enlaces: [string, string][] }[] = [
    {
      titulo: "Antes de nada",
      enlaces: [
        ["#quien-es-quien", "Quién es quién"],
        ["#entrar", "Entrar"],
      ],
    },
    {
      titulo: "El ERP",
      enlaces: [
        ["#montar", "Montar la academia"],
        ["#temario", "El temario"],
        ["#alumnado", "Alumnado y matrículas"],
        ["#dinero", "Cobros y facturas"],
        ["#docencia", "Agenda y clases"],
        ["#evaluacion", "Tests y exámenes"],
        ["#copiloto", "Geminis IA"],
        ["#comunicar", "Comunicación"],
        ["#analitica", "Analítica y riesgo"],
        ["#normativa", "Normativa y radar"],
      ],
    },
    {
      titulo: "La app",
      enlaces: [
        ["#instalar", "Instalarla"],
        ["#estudiar", "Estudiar"],
        ["#descargas", "Descargas"],
        ["#tests-alumno", "Tests y simulacros"],
        ["#examenes-alumno", "Exámenes de desarrollo"],
        ["#ia-alumno", "Preguntarle a Geminis"],
        ["#dia-a-dia", "El resto del día"],
      ],
    },
  ];

  if (conOperacion) {
    bloques.push({
      titulo: "Operación",
      enlaces: [
        ["#superadmin", "Superadministrador"],
        ["#rutina", "Rutina y comandos"],
        ["#si-algo-falla", "Si algo falla"],
      ],
    });
  }

  return (
    <nav
      aria-label="Índice del manual"
      className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] overflow-y-auto pr-2 text-[0.85rem] lg:block"
    >
      {bloques.map((bloque) => (
        <div key={bloque.titulo} className="mb-6">
          <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.13em] text-ink-muted">
            {bloque.titulo}
          </p>
          <ul className="space-y-0.5">
            {bloque.enlaces.map(([href, texto]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block rounded-md px-2.5 py-1 text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
                >
                  {texto}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
