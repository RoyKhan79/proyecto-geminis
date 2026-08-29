# Geminis

Plataforma SaaS para academias de oposiciones: gestión, campus del alumno e
inteligencia artificial sobre el material propio de cada academia.

Geminis no aspira a ser un LMS con un chatbot encima. Aspira a ser el sistema
operativo de una academia de oposiciones: que la academia gestione su negocio,
que el alumno estudie de verdad desde el móvil, y que el preparador tenga más
capacidad sin perder el control de su contenido.

---

## Estado actual

Las siete fases del plan están construidas y verificadas.

| Fase | Contenido | Estado |
|------|-----------|--------|
| 0 | Arquitectura, base de datos, multi-tenancy, autenticación, permisos, auditoría | ✅ |
| 1 | Manager: alumnos, profesores, oposiciones, cursos, grupos, matrículas, accesos | ✅ |
| 2 | Import: Excel y CSV con simulación, validación y reversión | ✅ |
| 3 | Contenido, visor de documentos, clases, comunicaciones y pagos | ✅ |
| 4 | Tests, corrección e histórico de errores | ✅ |
| 5 | Geminis IA con recuperación por permisos y citas | ✅ |
| 6 | Normativa y alertas de cambio legislativo | ✅ |
| 7 | Analítica y riesgo de abandono | ✅ |

Y además, sobre el plan inicial:

| Añadido | Qué hace |
|---------|----------|
| **Ritmo del temario** | El profesor abre los temas según avanza la clase, con ritmo distinto por grupo |
| **Radar de convocatorias** | Revisa el BOE cada mañana en el servidor y avisa por correo |
| **Muro de clase** | El profesor escribe a su gente y el alumnado se ayuda entre sí |
| **Mensajes internos** | Conversación privada alumno–academia |
| **Tareas con evaluación** | Supuestos y simulacros escritos, con entrega y corrección |
| **Salas online** | Aulas virtuales permanentes con entrada controlada |
| **App móvil** | PWA instalable en el teléfono |
| **Plataforma** | Alta de academias, soporte auditado, white-label, exportación y RGPD |
| **Simulacros** | Plantilla de examen, temporizador, penalización por fallo y percentil |
| **IA con motor propio** | Responde con el material de la academia **sin contratar ninguna API** |
| **«¿Por qué he fallado?»** | La explicación del preparador, reforzada con el temario y citada |
| **Repetición espaciada** | Cada pregunta vuelve justo antes de que se olvide |
| **Propuestas diarias** | Qué toca hoy, siempre con el dato que lo justifica |
| **Importar preguntas** | Bancos enteros desde Excel, con detección de repetidas |
| **Recuperar contraseña** | Y verificación de correo, con testigos de un solo uso |
| **Textos legales** | Política de privacidad y condiciones de uso |

En cifras: **63 tablas · 55 pantallas · 36.000 líneas · 109 pruebas automáticas ·
66 comprobaciones de auditoría** (33 sobre el código y 33 contra el servidor).

El detalle está en [docs/MVP_ROADMAP.md](docs/MVP_ROADMAP.md), la revisión punto
por punto del encargo en
[docs/REQUISITOS_CUMPLIDOS.md](docs/REQUISITOS_CUMPLIDOS.md) y la auditoría final
en [docs/AUDITORIA_FINAL.md](docs/AUDITORIA_FINAL.md).

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

Para llenar la demo con material realista (PDFs, banco de preguntas y
normativa):

```bash
npm run demo:todo
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
| `npm run demo:todo` | Recrea la demo con PDFs, preguntas y normativa |
| `npm run radar` | Revisa el BOE (pensado para cron cada mañana) |
| `npm run mantenimiento` | Limpia sesiones y enlaces caducados (cron diario) |
| `npm run verificar` | Tipos, estilo, pruebas y compilación, todo seguido |
| `npm run auditoria` | Las dos auditorías: la del código y la del servidor |
| `npm run ia:probar` | Comprueba desde la terminal que Geminis IA responde |
| `npm run iconos` | Regenera los iconos de la app con los colores de marca |

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

## El radar del BOE

Cada mañana, sin que nadie abra el programa, el servidor revisa el Boletín
Oficial del Estado y avisa por correo a la academia cuando sale una convocatoria
de las oposiciones que prepara. Si la acepta, se le crea la oposición lista para
subir temario.

```bash
# En el crontab del servidor, a las 8:30
30 8 * * *  cd /ruta/proyecto && npm run radar >> /var/log/geminis-radar.log 2>&1
```

Nunca crea una oposición por su cuenta: avisa y decide una persona.

---

## Geminis IA funciona sin contratar nada

El asistente tiene un **motor propio** dentro del servidor: lee el material de la
academia, entiende qué se le pregunta, localiza lo que responde y lo cita. No
hace falta configurar ningún proveedor, y con esa configuración por defecto el
temario **no sale del servidor**.

Si la academia configura `AI_PROVIDER`, las respuestas pasan a redactarse además
con un modelo, con el mismo material y la misma barrera de permisos. La interfaz
distingue los dos modos: vender uno como el otro sería mentir a la academia.

Lo que el motor propio hace y lo que no está escrito sin adornos en
[`src/lib/ai/local-engine.ts`](src/lib/ai/local-engine.ts) y en el ADR-0028.

```bash
npm run ia:probar    # le hace preguntas reales al material de la demo
```

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
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — color, tipografía, componentes e iconos
- [docs/AUDITORIA_FINAL.md](docs/AUDITORIA_FINAL.md) — auditoría completa, hallazgos y riesgos aceptados
- [docs/AUDITORIA.md](docs/AUDITORIA.md) — la auditoría anterior, con los tres hallazgos que se cerraron
- [docs/REQUISITOS_CUMPLIDOS.md](docs/REQUISITOS_CUMPLIDOS.md) — los 136 puntos del encargo, uno a uno
- [docs/GUIA_APP_MOVIL.md](docs/GUIA_APP_MOVIL.md) — instalar la app en el móvil y probar academia ↔ alumno
- [docs/PRESENTACION.md](docs/PRESENTACION.md) — guión para enseñárselo a una academia

Y para el alumnado: [política de privacidad](src/app/privacidad/page.tsx) y
[condiciones de uso](src/app/condiciones/page.tsx), accesibles sin entrar en
`/privacidad` y `/condiciones`.
