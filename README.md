# Geminis

Plataforma SaaS para academias de oposiciones: gestión, campus del alumno e
inteligencia artificial sobre el material propio de cada academia.

Geminis no aspira a ser un LMS con un chatbot encima. Aspira a ser el sistema
operativo de una academia de oposiciones: que la academia gestione su negocio,
que el alumno estudie de verdad desde el móvil, y que el preparador tenga más
capacidad sin perder el control de su contenido.

---

## Estado actual

| Fase | Contenido | Estado |
|------|-----------|--------|
| 0 | Arquitectura, base de datos, multi-tenancy, autenticación, permisos, auditoría, academia demo | **Terminada** |
| 1 | Manager: alumnos, profesores, oposiciones, convocatorias, cursos, grupos, matrículas, derechos de acceso | **Terminada** |
| 1b | Campus del alumno: inicio, estudiar, calendario, perfil, progreso | **Terminada** |
| 2 | Geminis Import (Excel/CSV con previsualización y reversión) | Pendiente |
| 3 | Contenido: subida de material, visor de PDF, clases, comunicaciones, pagos | Pendiente |
| 4 | Tests, simulacros e histórico de errores | Pendiente |
| 5 | Geminis IA (RAG con citas, copiloto del profesor) | Pendiente |
| 6 | Normativa y alertas de cambio legislativo | Pendiente |
| 7 | Analítica y riesgo de abandono | Pendiente |

El detalle vive en [docs/MVP_ROADMAP.md](docs/MVP_ROADMAP.md).

---

## Poner en marcha el proyecto

Requisitos: **Node 22 o superior**. No hace falta Docker ni instalar PostgreSQL:
el proyecto trae binarios de PostgreSQL 18 y levanta una base de datos local en
`.dev/pgdata` sin permisos de administrador.

```bash
npm install          # dependencias + binarios de PostgreSQL
npm run db:start     # levanta PostgreSQL en 127.0.0.1:55432
cp .env.example .env
npm run db:deploy    # aplica las migraciones
npm run db:seed      # crea la Academia Geminis Demo
npm run dev          # http://localhost:3000
```

O todo de una vez:

```bash
npm run setup && npm run dev
```

### Cuentas de la academia demo

Todas usan la contraseña `Geminis2026!`.

| Perfil | Correo | Dónde entra |
|--------|--------|-------------|
| Administración | `admin@academiademo.test` | Geminis Manager |
| Profesora | `laura@academiademo.test` | Manager (solo lo asignado) |
| Personal administrativo | `secretaria@academiademo.test` | Manager (sin datos académicos sensibles) |
| Alumna · curso completo | `alumno1@academiademo.test` | Campus, con todo |
| Alumno · pack solo tests | `alumno2@academiademo.test` | Campus, sin temario |
| Alumno · pack solo clases | `alumno3@academiademo.test` | Campus, sin temario ni tests |
| Alumna · solo temario | `alumno4@academiademo.test` | Campus, sin clases ni tests |
| Superadmin de plataforma | `superadmin@geminis.test` | Consola de plataforma |

Entrar con `alumno1` y con `alumno2` seguidos es la mejor forma de ver de un
vistazo cómo el contenido depende de lo contratado.

---

## Comandos

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción (incluye comprobación de tipos) |
| `npm run typecheck` | Solo tipos |
| `npm test` | Pruebas (aislamiento, permisos, acceso a contenido) |
| `npm run db:start` / `db:stop` | Arranca o para PostgreSQL local |
| `npm run db:migrate` | Crea y aplica una migración nueva |
| `npm run db:seed` | Recrea la academia demo |
| `npm run db:studio` | Explorador visual de la base de datos |
| `npm run db:sql "SELECT …"` | Consulta rápida contra la base local |
| `npm run db:reset` | Borra los datos locales y empieza de cero |

---

## Cómo está organizado

```
prisma/schema/        Esquema dividido por dominios
src/
  app/                Rutas (Next.js App Router)
    entrar/           Acceso
    gestion/          GEMINIS MANAGER  · academia
    campus/           GEMINIS CAMPUS   · alumno
    plataforma/       Consola de superadmin
  components/
    ui/               Design system (sin lógica de negocio)
    manager/ campus/  Piezas de cada aplicación
  lib/
    auth/             Sesiones, contraseñas, permisos, contexto
    db/               Cliente Prisma y GUARDIA MULTI-TENANT
    access/           Motor de derechos de acceso al contenido
  server/             Casos de uso y consultas por dominio
tests/                Pruebas de lo que no puede fallar
docs/                 Arquitectura y decisiones
scripts/              PostgreSQL local y utilidades
```

Regla de oro: **las páginas no consultan la base de datos directamente ni deciden
permisos**. Piden a `src/server/**` y comprueban con `requirePermission()`.

---

## Las tres ideas que sostienen el producto

**1. Ninguna academia toca los datos de otra.**
`tenantDb(academyId)` devuelve un cliente de base de datos que no puede salirse
de su academia: filtra las lecturas, rellena las escrituras y rechaza cualquier
operación cruzada. No es una convención, es una barrera. Ver
[docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md).

**2. El contenido lo organiza y lo nombra cada academia.**
No hay ninguna jerarquía fija en el código. En Magisterio hoy se habla de
«Programación de aula» y «Situaciones de aprendizaje» donde antes se decía otra
cosa; mañana volverá a cambiar. Por eso la estructura es un árbol libre que la
academia crea, nombra y ordena a su gusto (ADR-0006).

**3. El acceso se concede, no se deduce.**
Un alumno ve una rama del contenido si tiene un *derecho de acceso* que la
cubra. Eso permite vender el curso completo, solo el temario, solo las clases,
temario + tests o lo que la academia invente, y que el profesor ajuste el acceso
de un alumno concreto. La misma comprobación la usará Geminis IA: preguntarle a
la IA nunca podrá ser una puerta trasera para leer material no contratado.

---

## Documentación

- [docs/PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md) — qué es Geminis y para quién
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — stack, capas y cómo encaja todo
- [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) — modelo de datos
- [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) — aislamiento, permisos, RGPD
- [docs/PERMISSIONS.md](docs/PERMISSIONS.md) — RBAC y alcances
- [docs/AI_ARCHITECTURE.md](docs/AI_ARCHITECTURE.md) — Geminis IA y su gateway
- [docs/MVP_ROADMAP.md](docs/MVP_ROADMAP.md) — plan por fases
- [docs/DECISIONS.md](docs/DECISIONS.md) — decisiones tomadas y por qué
