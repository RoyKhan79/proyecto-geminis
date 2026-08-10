# Auditoría interna y de seguridad

Fecha de la revisión: agosto de 2026 · Versión auditada: rama principal.

Esta auditoría es interna: la ha hecho quien escribió el código. Eso tiene un
valor —conoce cada decisión— y un límite honesto: **no sustituye a una revisión
externa ni a un test de intrusión profesional**, que es lo que hay que
contratar antes de meter datos reales de alumnos.

---

## 1. Resumen

| Área | Estado |
|------|--------|
| Aislamiento entre academias | **Sólido**, con barrera de código y 72 pruebas |
| Autenticación | **Sólido** para el alcance actual |
| Autorización (roles y permisos) | **Sólido**, catalogado y probado |
| Acceso a contenido de pago | **Sólido**, misma barrera para interfaz, archivos e IA |
| Protección frente a XSS | **Corregido** durante esta auditoría |
| Cabeceras de seguridad | **Corregido** durante esta auditoría |
| Trazabilidad | **Sólido** |
| RGPD | **Suficiente** para empezar; falta el circuito formal de solicitudes |
| Resistencia a fuerza bruta | **Provisional**, limitador en memoria |
| Cifrado en reposo | **Pendiente**, decisión de despliegue |

**Hallazgos abiertos: 0.** Los tres encontrados se corrigieron y quedaron con
prueba de regresión.

---

## 2. Hallazgos y correcciones

### H-01 · El alumnado podía abrir material no contratado · **GRAVE** · corregido

El rol de alumno incluía el permiso `content.read`. La ruta que sirve los
archivos usaba ese permiso para distinguir al personal de la academia del
alumnado, así que **todos los alumnos entraban por la rama de "personal" y se
saltaban la comprobación de derechos de acceso**. Cualquiera con una sesión
válida podía abrir el temario completo sin haberlo pagado.

*Corrección*: se retira `content.read` del rol de alumno y la ruta exige además
`manager.access`. Dos condiciones en lugar de una, para que reintroducir el
permiso por descuido no vuelva a abrir el agujero.
*Regresión*: `tests/auth.test.ts` falla si alguien devuelve ese permiso al rol.
*Verificado*: el alumno con pack de tests recibe 404 sobre un PDF del temario.

### H-02 · XSS latente en el contenido enriquecido · **ALTO** · corregido

El contenido enriquecido se pintaba con `dangerouslySetInnerHTML` y un
comentario afirmaba que estaba saneado en servidor. **Ese saneador no existía.**
Aún no hay editor en la interfaz, así que no era explotable hoy, pero el camino
estaba abierto y en un producto multi-tenant el impacto es serio: el script se
ejecutaría con la sesión de cada alumno que abriera el tema.

*Corrección*: saneador por lista blanca (`src/lib/sanitize.ts`) aplicado **al
guardar y al pintar**. Se eliminan scripts, iframes, formularios, atributos de
evento y URLs `javascript:` y `data:`.
*Regresión*: seis pruebas específicas.

### H-03 · Fuga de información en cabeceras · **BAJO** · corregido

La aplicación anunciaba con qué está construida (`X-Powered-By`), que es
información gratuita para quien busca vulnerabilidades de una versión concreta.

*Corrección*: desactivado, y añadidas cabeceras de seguridad en todas las
respuestas: CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y
HSTS en producción.

### Dos fallos funcionales encontrados de camino

- **Claves únicas compuestas.** La guardia multi-tenant convertía `findUnique`
  en `findFirst` para añadir `academyId`, y `findFirst` no admite claves como
  `studentId_questionId`. Consecuencia: el histórico de errores del alumnado
  nunca se guardaba. Corregido comprobando la propiedad con `findUnique`.
- **Cierre del ritmo del temario.** Cerrar un tema borrando su regla lo dejaba
  cayendo en «sin reglas → manda el estado global», es decir, visible otra vez.
  Ahora los cierres se guardan de forma explícita.

---

## 3. Qué se ha comprobado

### Automático · 72 pruebas

```
tests/tenancy.test.ts        aislamiento entre academias
tests/auth.test.ts           contraseñas, sesiones, catálogo de permisos
tests/content-access.test.ts derechos de acceso y herencia de banderas
tests/security.test.ts       escenarios completos con dos academias reales
```

Lo que verifican, en lenguaje llano:

- Una academia no puede leer, contar, modificar ni borrar nada de otra. Probado
  con dos academias reales y todas las operaciones de Prisma.
- La lista de modelos protegidos se compara **contra las columnas reales de
  PostgreSQL**: añadir un modelo con `academyId` y olvidar registrarlo rompe la
  suite.
- El alumno con «solo tests» no accede al temario ni por la interfaz, ni por el
  archivo, ni preguntándole a la IA.
- Ver y descargar son permisos distintos.
- Un tema cerrado por el profesor desaparece, aunque esté publicado.
- Una apertura programada para mañana no se ve hoy.
- El muro, los mensajes y las entregas de una academia no existen para otra.
- El radar distingue una convocatoria real de un trámite del BOE.
- El saneador de HTML aguanta los vectores habituales.

### Penetración por HTTP · 24 comprobaciones

`node scripts/auditoria.mjs` ataca la aplicación en marcha con sesiones reales
de seis perfiles distintos. Resultado actual: **24 superadas, 0 fallidas**.

| Bloque | Qué comprueba |
|--------|---------------|
| Sin sesión | 33 rutas privadas, todas redirigen al acceso |
| Autenticación | contraseña incorrecta, correo inexistente, cookie inventada |
| Separación | el alumnado no entra en ninguna pantalla de gestión |
| Permisos | secretaría, profesorado, administración y superadmin en su sitio |
| Contenido | el pack de tests no alcanza el temario |
| Archivos | sin sesión, sin derecho, descarga denegada, id inventado |
| Identificadores | ficha de otro alumno, test de otro alumno |
| Superficie | cabeceras, rutas inexistentes |

### Estático

- Sin claves ni contraseñas incrustadas en el código.
- Sin SQL construido por concatenación: todo pasa por Prisma.
- Un único `dangerouslySetInnerHTML`, ahora saneado.
- Dos usos de `prismaBase` en páginas, ambos justificados y acotados.
- Sin `any` explícitos fuera del código generado.
- Todas las acciones de servidor tienen guarda, salvo las de acceso —login,
  logout y cambio de academia—, que por definición no pueden exigir sesión
  previa y validan por otra vía.

---

## 4. Riesgos conocidos y aceptados

Se documentan porque callarlos sería el verdadero problema.

| Riesgo | Situación | Cuándo abordarlo |
|--------|-----------|------------------|
| **Limitador de intentos en memoria** | Con varias instancias, cada una lleva su cuenta | Antes de escalar a más de un proceso: sustituir por Redis (misma interfaz) |
| **Sin Row Level Security en PostgreSQL** | La barrera es de aplicación. Alguien con acceso directo a la base la esquiva | Antes de dar acceso a la base a terceros o a herramientas de BI |
| **Sin cifrado en reposo** | Depende del proveedor de base de datos | Al elegir hosting: exigir cifrado de disco |
| **Sin verificación de correo ni 2FA** | Modelado pero no implementado | Antes de abrir registro por autoservicio |
| **Sin antivirus en las subidas** | Se valida el tipo por lista blanca, no el contenido | Antes de permitir que el alumnado suba archivos a gran escala |
| **Búsqueda de la IA sin vectores** | Léxica; funciona pero es menos fina | Cuando el entorno tenga pgvector |
| **Recuperación de contraseña** | Modelada, sin flujo | Antes del primer cliente real |
| **Protección de documentos** | URLs temporales, visor y marca de agua | No hay solución completa: ninguna protección web impide una captura de pantalla. **No prometerlo** |

---

## 5. Antes de tener el primer cliente real

Lista corta y concreta:

1. `AUTH_SECRET` propio y largo en producción.
2. HTTPS obligatorio y HSTS activo (ya preparado).
3. PostgreSQL gestionado con copias de seguridad automáticas y cifrado en disco.
4. Almacenamiento S3 privado, sin acceso público al bucket.
5. Redis para el limitador de intentos.
6. Recuperación de contraseña y verificación de correo.
7. Registro de errores y monitorización.
8. Prueba de intrusión externa.
9. Registro de actividades de tratamiento y contratos de encargado (RGPD).
10. Revisión legal de condiciones y política de privacidad.

---

## 6. Cómo repetir esta auditoría

```bash
npm test                      # 72 pruebas automáticas
npm run dev                   # en otra terminal
node scripts/auditoria.mjs    # 24 comprobaciones por HTTP
npm run build                 # incluye comprobación de tipos
npx eslint src prisma tests scripts --max-warnings=0
```

Conviene ejecutarlo antes de cada despliegue. Las cuatro cosas juntas tardan
menos de dos minutos.
