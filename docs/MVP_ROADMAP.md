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

## ✅ Fase 4 — Tests y simulacros *(B)* · **terminada**

- Banco de preguntas con estados y revisión
- Tests por tema, bloque, aleatorios y personalizados
- Corrección con penalización configurable
- Histórico de errores y **test de mis errores**
- Simulacros con plantilla de examen (`ExamBlueprint`)
- Repetición espaciada
- Estadísticas por alumno, tema y pregunta

## ✅ Fase 5 — Geminis IA *(A · B · E)* · **terminada**

- Gateway de IA con varios proveedores y registro de consumo
- `pgvector` e indexación del contenido autorizado
- Recuperación con permisos: filtrar **antes** de buscar
- Chat del alumno con citas
- Copiloto del profesor: generar preguntas, detectar duplicados y ambigüedades
- Flujo generar → revisar → aprobar → publicar
- Asistente de importación de temario

## ✅ Fase 6 — Normativa *(E)* · **terminada**

- Alta manual de normas, versiones y artículos
- Relación normativa ↔ temas y preguntas
- Alerta de cambio con cálculo de impacto
- Flujo aceptar / editar / ignorar
- Marcado de preguntas posiblemente desactualizadas
- Más adelante: conexión con fuentes oficiales

## ✅ Fase 7 — Analítica y retención *(C · D)* · **terminada**

- Panel de la academia con métricas útiles
- Analítica académica: temas flojos, preguntas problemáticas
- **Riesgo de abandono** con reglas sencillas y explicables
- Lista de «alumnos que requieren atención»
- Alertas al preparador

---

## Después del MVP

Plataforma y planes SaaS con límites · impersonación de soporte auditada ·
roles personalizados · Row Level Security como segunda barrera · PWA instalable
con notificaciones · white-label con dominio propio · integración con Zoom,
Meet y Teams · pasarelas de pago · API pública · aplicaciones nativas.

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
