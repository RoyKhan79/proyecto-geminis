# Auditoría final · interna y de seguridad

Fecha: agosto de 2026 · Alcance: todo el producto, no una fase.

Esta auditoría la ha hecho quien escribió el código. Eso tiene un valor —conoce
cada decisión y por qué se tomó— y un límite que hay que decir en la primera
línea y no en la última: **no sustituye a una revisión externa ni a un test de
intrusión profesional.** Eso hay que contratarlo antes de meter datos reales de
alumnos. Lo que sí garantiza esta auditoría es que no hay nada que el propio
equipo sepa que está mal y haya dejado pasar.

---

## 1. Cómo se comprueba

Tres capas, todas automáticas y todas ejecutables con un comando:

| Comando | Qué mira | Resultado |
| --- | --- | --- |
| `npm run auditoria:interna` | El **código**: pantallas sin comprobación de acceso, acciones sin permiso, consultas que se saltan el aislamiento, HTML sin sanear, modelos sin clasificar, secretos escritos a mano | **33 / 33** |
| `npm run auditoria:http` | La **aplicación levantada**: qué responde de verdad a un atacante con y sin sesión | **44 / 44** |
| `npm run verificar` | Tipos, estilo, pruebas y compilación | **137 pruebas, 0 fallos** |
| `npm run rls:probar` | Que la **segunda barrera** protege aunque la primera falle | **5 / 5** |
| `npm run rls:concurrencia` | Que dos academias a la vez no se cruzan | **200 consultas, 0 cruces** |
| `npm run remesa:probar` | El fichero de adeudos que se manda al banco | **6 / 6** |
| `npm run facturas:probar` | Numeración correlativa, totales y rectificativas | **6 / 6** |

La diferencia entre las dos primeras importa. La interna encuentra el descuido
el día que se comete —una pantalla nueva a la que se le olvidó pedir permiso—.
La HTTP encuentra lo que el código *parece* hacer pero no hace.

---

## 2. Resultado por área

| Área | Estado | Comentario |
| --- | --- | --- |
| Aislamiento entre academias | **Sólido** | **Dos barreras independientes**: la guardia de la aplicación y Row Level Security en PostgreSQL con un rol sin privilegios. Probado con consultas crudas y bajo concurrencia |
| Autenticación | **Sólido** | scrypt con coste de memoria, sesiones revocables, comparación en tiempo constante |
| Recuperación de contraseña | **Sólido** | Testigos resumidos, de un solo uso, con caducidad y separados por propósito |
| Autorización | **Sólido** | Catálogo único de permisos, comprobado en servidor en las 46 pantallas privadas |
| Acceso a contenido de pago | **Sólido** | La misma barrera para la interfaz, para la descarga de archivos y para la IA |
| Geminis IA | **Sólido** | Filtra permisos antes de buscar; nada se publica sin aprobación humana |
| XSS | **Sólido** | Saneado por lista blanca al guardar y al pintar |
| Cabeceras HTTP | **Sólido** | CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy |
| Trazabilidad | **Sólido** | Auditoría por academia con enmascarado de datos sensibles |
| RGPD | **Suficiente** | Anonimización, exportación, política de privacidad y condiciones |
| Fuerza bruta | **Provisional** | Limitador en memoria del proceso (ADR-0016) |
| Cobros y datos bancarios | **Sólido** | IBAN validado con dígito de control, fichero SEPA comprobado, el IBAN nunca entra en la auditoría |
| Facturación | **Sólido** | Numeración correlativa con bloqueo de fila, inmutable una vez emitida, rectificativas |
| Cifrado en reposo | **Pendiente** | Decisión de despliegue, no de código |
| Copias de seguridad | **Pendiente** | Decisión de despliegue |

**Hallazgos abiertos: 0.**

---

## 3. Los tres hallazgos anteriores, cerrados

Se mantienen aquí porque una auditoría que solo enseña lo que salió bien no
sirve de nada.

### H-01 · El alumnado podía abrir material no contratado · GRAVE · cerrado

El rol de alumno incluía `content.read`, y la ruta que sirve los archivos usaba
ese permiso para distinguir al personal del alumnado. Resultado: **todos los
alumnos entraban por la rama de «personal» y se saltaban la comprobación de
derechos**. Cualquiera con sesión podía abrir el temario completo sin pagarlo.

Corregido quitando el permiso del rol y dejando escrito en el catálogo por qué
no debe volver. Con prueba de regresión: un alumno con pack de solo tests recibe
404 al pedir el PDF del temario.

### H-02 · HTML sin sanear · ALTO · cerrado

Había un `dangerouslySetInnerHTML` con un comentario que afirmaba que el
contenido venía saneado. No lo estaba: el saneador no existía. En multi-tenant
eso significa que un script inyectado corre con la sesión de cada alumno que
abre el tema.

Corregido escribiendo el saneador por lista blanca y aplicándolo dos veces, al
guardar y al pintar (ADR-0026). La auditoría interna comprueba ahora que ningún
`dangerouslySetInnerHTML` conviva sin un saneador en el mismo archivo.

### H-03 · Se anunciaba la versión del servidor · BAJO · cerrado

`X-Powered-By` desactivado y añadido el juego completo de cabeceras.

### H-04 · Row Level Security activada y sin efecto · GRAVE · cerrado

Se activó RLS en las 50 tablas de academia y **no protegía nada**. La aplicación
se conectaba con el rol dueño de las tablas, que además era superusuario, y un
superusuario se salta las políticas incluso con `FORCE ROW LEVEL SECURITY`.

Es el hallazgo más instructivo de toda la auditoría: la medida estaba puesta, se
podía enseñar en el esquema, y su efecto real era cero. Se descubrió al escribir
la prueba que intentaba leer datos de otra academia con una consulta cruda: los
leyó todos.

Corregido creando el rol `geminis_app` —sin superusuario, sin `BYPASSRLS` y sin
ser dueño de las tablas— y separando dos conexiones: la de la aplicación y la
del dueño, que solo usan las migraciones. Con prueba permanente:
`npm run rls:probar` falla si alguien vuelve a conectar con un rol privilegiado.

### H-05 · Bloqueo mutuo dentro de las transacciones · ALTO · cerrado

La primera versión de la segunda barrera envolvía cada operación en su propia
transacción. Dentro de una transacción interactiva eso abría una transacción
anidada en otra conexión: con un `SELECT … FOR UPDATE` de por medio, la de
dentro esperaba un bloqueo que solo soltaría la de fuera. Bloqueo mutuo y
timeout a los cinco segundos.

Afectaba a reservar el número de una factura y a borrar una oposición en
cascada. Se detectó al probar la facturación de extremo a extremo, no en
producción. Corregido con `transaccionDeAcademia` (ADR-0041).

### H-06 · La fecha de cobro se enviaba con un día menos · ALTO · cerrado

El fichero de adeudos usaba `toISOString()` para la fecha de cargo. En España,
un `Date` del 5 de septiembre a las 00:00 es el 4 de septiembre en UTC: al banco
le llegaba el día anterior. Un adeudo con fecha equivocada se rechaza por
antelación insuficiente, o se cobra un día antes de lo pactado con el alumno.

El mismo error estaba en los formularios de fecha, donde era peor porque se
acumula: cada edición restaba un día. Corregido con `fechaParaInput()` en
`lib/utils`, su equivalente en el generador SEPA, y pruebas que lo fijan.

---

## 4. Lo que se revisó en esta ronda

### 4.1 Aislamiento entre academias

Es lo que más se ha mirado, porque es lo único que no admite un fallo.

- Los **63 modelos** del esquema están clasificados como de academia, globales o
  derivados. Un modelo sin clasificar **hace saltar la guardia** en lugar de
  pasar sin filtro: el descuido falla ruidosamente.
- Los **modelos derivados** —los que cuelgan de un padre ya protegido, como
  `ContentResource` o `StudentProfile`— **no se pueden consultar** desde un
  cliente de academia: la guardia lanza. Se accede por el padre.
- Las **22 consultas** que usan el cliente base y tocan datos de academia se
  revisaron una a una. Todas acotan por `academyId`.
- Las **dos** que cruzan academias a propósito —«¿esta persona pertenece a
  alguna otra?»— llevan un comentario `tenant-ok` con el motivo al lado. La
  auditoría lo exige: el motivo vive junto a la consulta, no en una lista
  aparte, para que se revise cuando alguien la toque.

### 4.2 Superficie de acceso

- **46 pantallas privadas**, todas con comprobación en servidor. Las 9 públicas
  están enumeradas: si una deja de estar en la lista, la auditoría falla.
- **21 módulos de acciones de servidor**, todos con comprobación de sesión o de
  permiso. Las dos excepciones —entrar y recuperar la contraseña— son
  precisamente las que crean la sesión, y están enumeradas.
- Sin sesión, **todas** las rutas privadas redirigen al acceso. Una cookie
  inventada no sirve.

### 4.3 Recuperación de contraseña

Área nueva, revisada con el mismo criterio que el inicio de sesión:

- El testigo es de 32 bytes aleatorios; en la base solo vive su SHA-256.
- Un testigo nuevo invalida los anteriores; el usado no vale dos veces.
- Un enlace de **verificación de correo** no puede usarse para cambiar una
  contraseña. Los dos comparten tabla, y la separación está en un prefijo que va
  **dentro** del texto resumido: no se puede quitar sin invalidar el testigo
  (ADR-0037). Es el fallo clásico de compartir tabla y está cerrado.
- Cambiar la contraseña **cierra todas las sesiones** (ADR-0038). Si la cuenta
  estaba comprometida, cambiarla sin echar al intruso no sirve de nada.
- El mensaje es **idéntico** exista el correo o no, comprobado por HTTP
  comparando las dos respuestas. Si cambiara, el formulario sería una lista de
  quién está dado de alta.
- El enlace se valida al abrir pero se consume al guardar (ADR-0039): muchos
  antivirus de correo abren los enlaces antes que la persona.

### 4.4 Geminis IA

- La recuperación **filtra por permisos antes de buscar**, no después. Se
  comprueba estáticamente que `loadStudentGrants` aparece antes de la consulta
  de fragmentos: filtrar después significa que el sistema ya leyó material que
  esa persona no puede ver.
- Comprobado en caliente: dos alumnos de la misma academia con packs distintos
  reciben conjuntos de temas distintos en el asistente.
- Lo generado por IA nace en **borrador** y guarda su procedencia.
- Con el motor propio, **nada sale del servidor**. Es la configuración por
  defecto.

### 4.5 Contenido y dinero

- La descarga de un archivo se comprueba en cada petición: sesión → academia →
  personal o alumno → derecho de acceso → tema abierto → permiso de descarga.
- Los documentos no se cachean en intermediarios y llevan
  `X-Content-Type-Options`.
- Un identificador inventado devuelve 404, no 403: no se confirma que exista.

---

## 5. Lo que sigue sin estar resuelto

Se dice aquí y no en una nota al pie.

| Asunto | Estado | Qué hace falta |
| --- | --- | --- |
| **Limitador de fuerza bruta** | En memoria del proceso | Con varias instancias, cada una lleva su cuenta. La interfaz ya es la que tendrá la versión con Redis (ADR-0016) |
| **Cifrado en reposo** | No implementado | Es configuración del gestor de base de datos y del almacén de archivos, no código |
| **Copias de seguridad** | No implementado | Decisión de despliegue. Deben ser por academia, para poder restaurar una sin tocar las demás |
| **Límite de dispositivos** | No implementado | Las sesiones son revocables y se ve desde dónde se entra, pero nada impide tres sesiones a la vez |
| **Revisión externa** | No hecha | Lo más importante de esta lista |
| **Métricas** | No implementado | La auditoría registra qué pasó; falta saber cómo va el sistema |

---

## 6. Cobertura del encargo

Los 136 puntos del encargo original están revisados uno a uno en
[REQUISITOS_CUMPLIDOS.md](REQUISITOS_CUMPLIDOS.md). El recuento, sin redondear:

| Estado | Puntos | Cuáles |
| --- | --- | --- |
| **Hecho** | 122 | construido y verificado |
| **Parcial** | 9 | 82-84 (selección de texto dentro del PDF), 87 (métricas), 98-100 (asistente guiado de temario), 116 (límite de dispositivos), 128 (simulacro y clase aún fuera del grafo) |
| **Preparado** | 4 | 25 y 122-123 (versionado, modelado sin interfaz), 58 (API: la lógica ya está aislada para exponerla) |
| **Pendiente** | 1 | 88 (copias de seguridad: decisión de despliegue, no de código) |

Cada parcial dice en la tabla qué falta exactamente y por qué se dejó así.

Además se construyó lo que se pidió después: ritmo del temario, radar del BOE,
muro, red interna, mensajes, tareas con evaluación, salas online, app móvil,
simulacros, motor propio de IA, repetición espaciada, importación de bancos de
preguntas, recuperación de contraseña, rediseño completo y textos legales.

---

## 7. Antes de meter datos reales

Por orden, y esto no es una recomendación:

1. **Contratar una revisión de seguridad externa.** Ningún equipo audita bien su
   propio código, por mucho cuidado que ponga.
2. **Cifrado en reposo** en base de datos y almacén de archivos.
3. **Copias de seguridad por academia**, probando la restauración. Una copia que
   no se ha restaurado nunca no es una copia.
4. **Limitador distribuido** si se despliega en más de una instancia.
5. **Rellenar los textos legales** y hacerlos revisar por un profesional.
6. **Registro de actividad centralizado** con alertas.

---

## 8. Cómo repetir esta auditoría

```bash
npm run verificar            # tipos, estilo, 109 pruebas y compilación
npm run auditoria:interna    # revisión del código
npm run dev                  # en otra terminal
npm run auditoria:http       # revisión de la aplicación levantada
```

Las tres deben terminar sin incidencias. Si alguna falla, hay algo que arreglar
antes de seguir: están escritas para no dar falsos positivos, y cada una de las
dos veces que los dio durante esta ronda se corrigió la comprobación, no el
producto, y quedó anotado por qué.
