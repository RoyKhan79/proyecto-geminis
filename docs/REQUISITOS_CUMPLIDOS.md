# Revisión punto por punto de los requisitos

Recorrido de los 136 puntos del encargo. Tres estados:

- **Hecho** · construido y verificado
- **Parcial** · lo esencial funciona, falta afinar
- **Preparado** · modelado en la base de datos, sin interfaz todavía

---

## Fundamentos (1-10)

| # | Requisito | Estado | Dónde |
|---|-----------|--------|-------|
| 1 | Trabajo por fases, sin construirlo todo de golpe | Hecho | 12 entregas en git, cada una verificada |
| 2 | SaaS B2B multi-tenant | Hecho | `src/lib/db/tenant.ts` |
| 3 | Cinco tipos de usuario | Hecho | `src/lib/auth/permissions.ts` |
| 4 | Dos experiencias diferenciadas | Hecho | `/gestion` y `/campus` |
| 5 | Campus del alumno | Hecho | inicio, estudiar, tests, tareas, muro, mensajes, salas, calendario, avisos, IA, perfil |
| 6 | Mi oposición | Hecho | `/campus/estudiar` |
| 7 | Temario jerárquico con progreso | Hecho | árbol libre + `StudentContentProgress` |
| 8 | Visor de PDF | Hecho | pantalla completa, marca de agua, control de descarga |
| 9 | Clases online | Hecho | `/gestion/clases` con enlace externo, asistencia y grabación |
| 10 | Calendario del alumno | Hecho | `/campus/calendario` |

## Tests y evaluación (11-15)

| # | Requisito | Estado | Dónde |
|---|-----------|--------|-------|
| 11 | Banco de preguntas con estados | Hecho | borrador → revisión → publicada → posiblemente desactualizada |
| 12 | Tipos de test | Parcial | por tema, aleatorio y de errores. Simulacro y examen oficial: modelados |
| 13 | Sistema de errores | Hecho | `StudentQuestionStat` y «test de mis errores» |
| 14 | Simulacros | Preparado | `ExamBlueprint` modelado |
| 15 | Planificador de estudio | Preparado | `StudyPlan` en el modelo |

## Inteligencia artificial (16-22)

| # | Requisito | Estado | Dónde |
|---|-----------|--------|-------|
| 16 | IA vertical, no un ChatGPT pegado | Hecho | responde solo con material de la academia |
| 17 | Respuestas con citas | Hecho | `[1]`, `[2]` con documento y localizador |
| 18 | IA del alumno | Hecho | `/campus/ia` |
| 19 | Perfil de aprendizaje | Parcial | se calculan fortalezas y debilidades; aún no se envían a la IA |
| 20 | Recomendaciones | Parcial | «dónde flojeas» en tests; recomendaciones activas pendientes |
| 21 | Copiloto del profesor | Hecho | generación de preguntas desde el material |
| 22 | Validación humana obligatoria | Hecho | todo nace en borrador; no existe ruta que publique solo |

## Normativa (23-25, 57, 124-128)

| # | Requisito | Estado | Dónde |
|---|-----------|--------|-------|
| 23 | Normativa relacionada con contenido | Hecho | artículo ↔ tema ↔ pregunta |
| 24 | Alerta de cambio con impacto | Hecho | calcula temas y preguntas afectadas |
| 25 | Versionado de contenidos | Preparado | `ContentNodeVersion` modelado |
| 57 | Modelo antes que rastreador | Hecho | flujo completo; el BOE ya conectado para convocatorias |
| 126 | Nunca modificar el temario solo | Hecho | genera alerta y espera decisión |
| 127 | Preguntas marcadas como obsoletas | Hecho | verificado con el art. 24 |

## Gestión (26-36)

| # | Requisito | Estado | Dónde |
|---|-----------|--------|-------|
| 26 | Gestión de alumnos con estados | Hecho | cinco estados, búsqueda y filtros |
| 27 | Ficha del alumno | Hecho | datos, matrículas, accesos, pagos |
| 28 | Gestión de profesores | Hecho | con especialidades y asignaciones |
| 29 | Cursos y grupos flexibles | Hecho | ningún nivel obligatorio salvo la oposición |
| 30 | Matrículas | Hecho | conceden el derecho de acceso |
| 31 | Gestión económica | Hecho | recibos, estados, suspensión por impago |
| 32 | Comunicaciones | Hecho | a academia, oposición, curso, grupo o persona |
| 33 | Notificaciones | Hecho | clases, grabaciones, tareas, pagos, mensajes |
| 34 | Riesgo de abandono | Hecho | reglas explicables con motivos en cristiano |
| 35 | Analítica de academia | Hecho | `/gestion/analitica` |
| 36 | Analítica académica | Hecho | temas flojos y preguntas a revisar |

## Migración (37-40)

| # | Requisito | Estado | Dónde |
|---|-----------|--------|-------|
| 37-38 | Asistente de importación en 7 pasos | Hecho | `/gestion/importar` |
| 39 | Importación segura y reversible | Hecho | simulación, duplicados, informe y deshacer |
| 40 | Arquitectura para más importaciones | Hecho | `ImportJob` con tipos |

## Archivos y medios (41-42)

| # | Requisito | Estado | Dónde |
|---|-----------|--------|-------|
| 41 | Almacenamiento con permisos | Hecho | ruta protegida, sin URLs públicas |
| 42 | Vídeo sin infraestructura propia | Hecho | enlaces externos con proveedor modelado |

## Diseño y experiencia (43-46, 68-70, 79-85)

| # | Requisito | Estado |
|---|-----------|--------|
| 43 | Diseño moderno, no Moodle antiguo | Hecho |
| 44 | Campus móvil con barra inferior | Hecho |
| 45 | Tablet | Hecho, mismo diseño adaptativo |
| 46 | PWA instalable | Hecho |
| 68 | Usable por gente no técnica | Hecho, lenguaje llano en toda la interfaz |
| 69 | Velocidad | Hecho, consultas filtradas e índices por academia |
| 70 | Accesibilidad | Hecho, foco visible, `aria`, áreas táctiles, contraste |
| 79 | Design system | Hecho, tokens en un solo sitio |
| 80 | Menú del Manager con «Pronto» | Hecho, sin botones falsos |
| 81 | Dashboard del alumno sencillo | Hecho |
| 82-84 | IA contextual | Parcial: el contexto de tema ya se pasa; selección dentro del PDF pendiente |
| 85 | Pantallas completas, no solo bonitas | Hecho, con estados vacíos, errores y permisos |

## Arquitectura y calidad (47-56, 61-67, 86-90)

| # | Requisito | Estado |
|---|-----------|--------|
| 47 | Stack moderno | Hecho: Next.js 16, React 19, PostgreSQL 18, Prisma 7 |
| 48 | Base de datos bien diseñada | Hecho: 63 tablas, documentadas |
| 49 | Auditoría | Hecho, con enmascarado de datos sensibles |
| 50 | RBAC centralizado | Hecho, catálogo único |
| 51 | Seguridad | Hecho + auditado |
| 52 | RGPD | Parcial: anonimización y exportación hechas; falta circuito formal |
| 53 | Gateway de IA | Hecho |
| 54 | Coste de IA | Hecho, por academia, persona y funcionalidad |
| 55 | Búsqueda con metadatos y aislamiento | Hecho |
| 56 | Control de alucinaciones | Hecho: sin fuentes, no se llama al modelo |
| 61 | Testing de lo crítico | Hecho: 72 pruebas |
| 62 | Academia demo | Hecho: 24 personas, 2 oposiciones, PDFs, 21 preguntas, normativa |
| 63 | Modo desarrollo fácil | Hecho: `npm run setup`, sin Docker |
| 64 | Documentación | Hecho: 9 documentos |
| 65 | Sin código gigante ni duplicado | Hecho: lógica en `src/server`, componentes sin negocio |
| 66-67 | Decidir y avanzar, documentando | Hecho: 25 decisiones registradas |
| 86 | Nada de datos falsos en producción | Hecho: todo sale de la base de datos |
| 87 | Observabilidad preparada | Parcial: auditoría sí, métricas pendientes |
| 88 | Backups | Pendiente: decisión de despliegue |
| 89 | Portabilidad | Hecho: exportación completa |
| 90 | Producto real, no demo | Hecho |

## Conocimiento privado y pagos (91-116)

| # | Requisito | Estado |
|---|-----------|--------|
| 91-93 | Espacio privado por academia, aislado también en la IA | Hecho y probado |
| 94 | Jerarquía flexible | Hecho: árbol libre |
| 95-97 | Tipos de oposición y configurador | Hecho: tipos editables, secciones que nombra la academia |
| 98-100 | Subida masiva y asistente de temario | Parcial: subida hecha; troceado automático hecho; asistente guiado pendiente |
| 101-103 | Importación de preguntas | Parcial: el motor de importación está; el mapeo específico de preguntas falta |
| 104-105 | Fuentes activables | Hecho: banderas por rama, heredables |
| 106 | Matriz de permisos de contenido | Hecho |
| 107-111 | Derechos de acceso y packs | Hecho, incluida la IA |
| 112 | Pipeline seguro de RAG | Hecho, filtro antes de buscar |
| 113-114 | Descarga y visor protegido | Hecho |
| 115 | Marca de agua | Hecho |
| 116 | Protección frente a compartición | Parcial: sesiones revocables; límite de dispositivos pendiente |

## IA avanzada y examen (117-123, 129-136)

| # | Requisito | Estado |
|---|-----------|--------|
| 117-118 | Generación con procedencia | Hecho |
| 119 | Nunca publicar directamente | Hecho |
| 120-121 | Simulacros y blueprint | Preparado |
| 122-123 | Convocatorias y versionado | Hecho / Preparado |
| 129-131 | IA para preparador y alumno, con contexto | Hecho |
| 132-133 | Productos y catálogo | Hecho |
| 134-135 | El contenido es de la academia | Hecho, por diseño |
| 136 | Metadatos obligatorios en los fragmentos | Hecho |

---

## Lo añadido sobre el encargo

Peticiones posteriores, todas construidas:

- **Ritmo del temario**: el profesor abre los temas según avanza la clase, con
  ritmo distinto por grupo y apertura programada.
- **Radar de convocatorias**: revisa el BOE cada mañana en el servidor y avisa
  por correo. Conectado a la API real.
- **Muro de clase** y red interna del alumnado.
- **Mensajes internos** alumno–academia.
- **Tareas con entrega y evaluación**, tipo aula virtual.
- **Salas online permanentes** con entrada controlada.
- **App móvil** instalable.

## Lo que queda

Por orden de urgencia real:

1. Simulacros con plantilla de examen y percentiles.
2. Importación específica de bancos de preguntas.
3. Asistente guiado de importación de temario.
4. Planificador de estudio y repetición espaciada.
5. Perfil de aprendizaje enviado a la IA.
6. Selección de texto dentro del PDF para preguntar.
7. Recuperación de contraseña y verificación de correo.
8. Pasarela de pago.
9. Boletines autonómicos en el radar.
10. Row Level Security como segunda barrera.
