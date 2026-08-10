# Geminis IA

> Estado: **diseñada y modelada, no implementada**. Corresponde a la fase 5. Este
> documento fija las reglas antes de escribir el primer prompt, porque son
> decisiones que después cuesta mucho revertir.

---

## 1. Qué es y qué no es

Geminis IA no es «ChatGPT dentro del programa». Es una IA vertical que responde
**usando el material de una academia concreta** y que cita de dónde sale cada
cosa.

Un preparador lleva años construyendo su temario y su criterio. Una IA genérica
que le contradiga con información de internet no le ayuda: le resta autoridad
delante de sus alumnos. La regla es que Geminis IA hace al preparador más
potente, no que lo sustituye.

---

## 2. Aislamiento absoluto

Academia A y academia B pueden preparar la misma oposición. Sus contenidos son
independientes y no se tocan **nunca**:

- ni en la base de datos,
- ni en los archivos,
- ni en los índices vectoriales,
- ni en las cachés,
- ni en las conversaciones,
- ni en la generación de preguntas.

El contenido de una academia no se usa para responder a otra ni para entrenar
nada. Por defecto: **no** (§135). Si algún día existiera un acuerdo distinto,
sería explícito, por escrito y opcional.

---

## 3. El Gateway

Ningún módulo llama a un proveedor de IA directamente. Todo pasa por
`src/lib/ai/gateway.ts` (por construir), que es responsable de:

- elegir proveedor y modelo (Anthropic, OpenAI u otros) según la funcionalidad,
- construir el contexto **ya filtrado** por academia y permisos,
- aplicar límites por academia y por plan,
- registrar consumo en `AIUsage` (tokens, coste estimado, latencia, errores),
- guardar el registro sin datos personales innecesarios.

Motivo: si las llamadas se dispersan por la aplicación, cambiar de proveedor
—o negociar precios, o cumplir un requisito de privacidad— pasa de ser una
decisión a ser una refactorización.

---

## 4. Recuperación (RAG) con permisos

El orden importa. Este es el correcto:

```
Pregunta del usuario
      ↓
Autenticación
      ↓
Academia activa (de la sesión, nunca del cliente)
      ↓
Permisos del rol
      ↓
Matrículas activas
      ↓
Derechos de acceso activos          ← aquí se decide qué puede citar
      ↓
Fuentes autorizadas (aiEnabled)
      ↓
Búsqueda semántica  ── solo sobre lo anterior
      ↓
Contexto
      ↓
Modelo
      ↓
Respuesta + fuentes
```

Y este es el incorrecto, el que hay que evitar:

```
Pregunta → índice vectorial global → modelo
```

**El filtro va antes de la búsqueda, no después.** Filtrar los resultados
después es cómodo y está mal: significa que el sistema ya ha leído material que
esa persona no puede ver, y basta un descuido para que acabe en la respuesta.

Consecuencia concreta: un alumno con el pack «solo tests» no puede obtener el
temario preguntándole a la IA. El motor que decide es el mismo que usa el
Campus: `src/lib/access/content-access.ts`.

---

## 5. Respuestas con fuentes

Toda respuesta apoyada en material de la academia debe decir en qué se apoya:

```
Respuesta…

Fuentes:
· Tema 8 · página 32
· Ley 39/2015 · artículo 16
· Apuntes del profesor · revisión 04/05/2026
```

Las citas se guardan en `AIMessage.citations` con el identificador del fragmento,
para poder comprobarlas después. **Una referencia no se inventa jamás**: si no
hay fragmento, no hay cita.

Cuando no encuentre apoyo suficiente, la respuesta correcta es decirlo:

> «No encuentro información suficiente en los documentos de tu academia sobre
> esto. Consúltalo con tu preparador.»

Eso es mejor que una respuesta plausible y equivocada. En una oposición, una
respuesta inventada sobre un plazo administrativo puede costar la plaza.

---

## 6. Fuentes autorizadas

Solo entra en la base de conocimiento lo que la academia autoriza. Cada rama del
contenido tiene su bandera `aiEnabled`, heredable, que la academia controla desde
la interfaz. Se puede almacenar material sin que la IA lo use.

`KnowledgeSource` lleva la versión de lo indexado, de modo que al cambiar un
documento se reindexa y las citas antiguas siguen siendo interpretables.

`DocumentChunk` guarda, junto al fragmento, los metadatos que permiten filtrar
por permisos en la misma consulta: `academyId`, `nodeId`, `nodePath`,
`editionId`, y su localizador para citar (página, apartado, marca de tiempo).

---

## 7. Nada se publica sin una persona

```
IA genera → BORRADOR → el profesor revisa → aprueba → publicado
```

No existe ni existirá una ruta de código que publique contenido académico sin
decisión humana. Aplica a preguntas generadas, explicaciones, resúmenes y
propuestas de cambio por normativa.

Cada pregunta generada guarda su procedencia en `Question.aiProvenance`: modelo,
fecha, quién la pidió y qué fragmentos se usaron. Dentro de un año se podrá
saber por qué existe esa pregunta.

---

## 8. Funciones previstas

**Para el alumno** — sobre el contenido que tenga contratado:
explicar un concepto, resumir, poner ejemplos, generar preguntas de un tema,
explicar por qué ha fallado una respuesta, comparar dos normas.

**Copiloto del profesor** — sobre el contenido de su academia:
generar preguntas por tema, dificultad o artículo; detectar preguntas duplicadas
o ambiguas; señalar contenido posiblemente desactualizado; resumir documentos;
comparar versiones de una ley; proponer redacciones para un cambio normativo.

**Contexto automático**: si el alumno está en el tema 12, página 47, y abre la
IA, esta ya sabe dónde está. No hay que explicárselo (`AIConversation.contextData`).

---

## 9. Privacidad

Al proveedor se le envía lo mínimo: los fragmentos necesarios y la pregunta.
Nunca la ficha del alumno, ni sus datos de contacto, ni su historial de pagos.
El perfil de aprendizaje (fortalezas, debilidades, errores recurrentes) se
calcula en Geminis y, si se usa, se resume en unas líneas sin datos
identificativos.

---

## 10. Coste

`AIUsage` registra consumo por academia, persona, funcionalidad, proveedor,
modelo y tokens, con coste estimado en milésimas de céntimo para no arrastrar
errores de coma flotante. Es lo que permitirá poner precios con criterio en vez
de a ojo, y avisar a una academia antes de que se le dispare el gasto.

---

## 11. Decisiones ya tomadas

- **ADR-0010** — Los fragmentos llevan siempre `academyId` y los identificadores
  necesarios para filtrar por permisos. El filtro va antes de la búsqueda.
- **ADR-0011** — La columna vectorial se añade con `pgvector` en la fase de IA.
  Hasta entonces el esquema no declara una columna que no podría crear en todos
  los entornos.
- **ADR-0009** — Toda pregunta generada nace como borrador y guarda su
  procedencia.
