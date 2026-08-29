# Plan por fases

Criterio para priorizar (§73): cada funcionalidad debe responder al menos a una
de estas preguntas. Si no responde a ninguna, no entra.

**A.** ¿Ahorra tiempo a la academia? · **B.** ¿Ayuda al alumno a aprobar? ·
**C.** ¿Reduce abandonos? · **D.** ¿Reduce trabajo administrativo? ·
**E.** ¿Mejora la actualización del contenido? · **F.** ¿Facilita venir de otro
programa?

---

## ✅ Fase 0 — Cimientos · **terminada**

- Arquitectura, repositorio y entorno local sin Docker
- 52 tablas con migraciones versionadas
- Guardia multi-tenant con pruebas de aislamiento reales
- Autenticación con sesiones revocables
- Recuperación de contraseña y verificación de correo ✅
- RBAC centralizado con catálogo de permisos
- Auditoría
- Design system con modo claro y oscuro
- Academia Geminis Demo con datos realistas

## ✅ Fase 1 — Geminis Manager · **terminada**

- Panel con métricas reales
- Alumnos: listado con búsqueda y filtros, alta, ficha, edición, baja
- Profesores: listado y alta con especialidades
- Oposiciones y convocatorias
- Cursos y grupos
- Matrículas, que conceden el derecho de acceso correspondiente
- Ficha del alumno con **qué contenido tiene contratado**
- Configuración: academia, plan, roles y permisos

## ✅ Fase 1b — Geminis Campus · **terminada**

- Inicio: continuar donde lo dejó, progreso, próxima clase
- Estudiar: solo las secciones que tenga contratadas
- Navegación por el árbol con progreso por tema
- Calendario de clases
- Perfil con matrículas y qué incluye su acceso
- Barra inferior pensada para el pulgar

---

## ✅ Fase 2 — Geminis Import *(A · D · F)* · **terminada**

La barrera número uno para que una academia cambie de programa es tener a sus
alumnos en otro sitio. Esta fase es comercial, no técnica.

- Subida de CSV / XLS / XLSX
- Detección y mapeo de columnas
- Validación y detección de duplicados
- **Simulación antes de importar** e informe de errores
- Importación con registro fila a fila
- **Reversión completa de una importación**
- **Importación de bancos de preguntas** con detección de repetidas ✅
- Exportación de los datos de la academia (§89)

Modelo ya listo: `ImportJob`, `ImportRow`.

## ✅ Fase 3 — Contenido y clases *(A · B · E)* · **terminada**

- Subida de archivos con almacén S3 y URLs firmadas temporales
- Editor del árbol de contenido: crear, renombrar, ordenar, publicar
- Configuración por rama: visible, descargable, marca de agua, IA
- Visor de PDF con «continuar donde lo dejé» y marcadores
- Clases con enlace externo, materiales y grabación posterior
- Asistencia
- Comunicaciones internas y por correo
- Pagos y recibos

## ✅ Fase 4 — Tests *(B)* · **terminada**

- Banco de preguntas con estados y revisión ✅
- Tests por tema, aleatorios y de errores ✅
- Corrección con explicación del preparador ✅
- Histórico de errores y **test de mis errores** ✅
- Estadísticas por alumno, tema y pregunta ✅
- Simulacros con plantilla de examen, temporizador y percentil ✅
- Repetición espaciada SM-2 con repaso diario en el Campus ✅

## ✅ Fase 5 — Geminis IA *(A · B · E)* · **terminada**

- Gateway con varios proveedores y registro de consumo ✅
- Indexación del contenido autorizado ✅
- Recuperación con permisos: filtrar **antes** de buscar ✅
- Chat del alumno con citas ✅
- Copiloto: generar preguntas desde el material ✅
- Flujo generar → revisar → publicar ✅
- **Motor propio: funciona sin contratar ninguna API** ✅ (ADR-0028)
- Explicación de por qué has fallado cada pregunta ✅
- Propuestas diarias con su motivo, sin que nadie pregunte ✅ (ADR-0030)
- Búsqueda vectorial con `pgvector` — pendiente (ADR-0011); hoy es léxica
- Detección de duplicados y ambigüedades — pendiente
- Asistente guiado de importación de temario — pendiente

## ✅ Fase 6 — Normativa *(E)* · **terminada**

- Alta manual de normas, versiones y artículos
- Relación normativa ↔ temas y preguntas
- Alerta de cambio con cálculo de impacto
- Flujo aceptar / editar / ignorar
- Marcado de preguntas posiblemente desactualizadas ✅
- Detección automática de referencias en las preguntas ✅
- Conexión con el BOE para convocatorias ✅ (radar)
- Rastreo de modificaciones legislativas en boletines — pendiente

## ✅ Fase 7 — Analítica y retención *(C · D)* · **terminada**

- Panel de la academia con métricas útiles
- Analítica académica: temas flojos, preguntas problemáticas
- **Riesgo de abandono** con reglas sencillas y explicables
- Lista de «alumnos que requieren atención»
- Alertas al preparador

---

## Construido además del plan

Radar de convocatorias del BOE · ritmo del temario por profesor y grupo · muro
de clase y red interna · mensajes internos · tareas con entrega y evaluación ·
salas online · PWA instalable · consola de plataforma con alta de academias,
impersonación auditada, white-label y exportación RGPD.

## Construido después de la auditoría

- **Segunda barrera de aislamiento**: Row Level Security en las 50 tablas de
  academia, con un rol de aplicación sin privilegios de superusuario (ADR-0040)
- **Cobros recurrentes**: forma de pago por alumno, cuotas mensuales y fichero
  SEPA de adeudos para el banco (ADR-0042)
- **Facturación**: series, numeración correlativa, desglose de IVA, exenciones
  y rectificativas (ADR-0043)
- **Agenda**: calendario de clases por mes y semana, con series de repetición
  (ADR-0044)
- **Editar y eliminar** oposiciones y convocatorias, con protección si hay
  alumnos matriculados
- **Los tres niveles** documentados y verificados (ADR-0045)

## Lo siguiente, por orden de urgencia

1. Asistente guiado de importación de temario
6. Pasarela de pago
7. Boletines autonómicos en el radar
9. Notificaciones push
10. Dominio propio por academia

---

## Fuera del MVP a propósito (§72)

Streaming propio, aplicaciones nativas, aprendizaje automático avanzado,
contabilidad completa, WhatsApp y SMS, videoconferencia propia, rastreador
masivo de boletines, marketplace, gamificación y white-label completo.

Están modelados donde toca. No se construyen todavía.

---

## Cómo se cierra una fase

Una fase no está terminada porque las pantallas se vean. Está terminada cuando:

- funciona con datos reales de la base de datos, sin arrays de mentira,
- tiene estados vacíos, de carga y de error,
- valida en servidor, no solo en el formulario,
- comprueba permisos en servidor,
- funciona en móvil y en escritorio,
- deja rastro en la auditoría si la operación es relevante,
- tiene pruebas si toca permisos, aislamiento, dinero o resultados académicos,
- está documentada, y la decisión importante anotada en `DECISIONS.md`.
