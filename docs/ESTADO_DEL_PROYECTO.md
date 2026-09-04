# Por dónde va Catedria

Actualizado el **30 de agosto de 2026**. Para leer en dos minutos antes de
seguir trabajando.

---

## Qué es

Un SaaS para academias de oposiciones españolas, con dos caras:

- **Manager** (`/gestion`) · el ERP de la academia: alumnado, matrículas,
  temario, cobros y facturas, agenda, evaluación, comunicación y analítica.
- **Campus** (`/campus`) · la aplicación del alumnado, pensada para el móvil:
  estudiar, descargar temas para ir sin cobertura, tests, simulacros, exámenes
  de desarrollo y Catedria IA.

Por encima, un **superadministrador** (`/plataforma`) que da de alta academias
y da soporte, y que **no ve el contenido ni el alumnado de ninguna**.

---

## En qué estado está

Funciona de punta a punta y está comprobado con la aplicación levantada:

| Comprobación | Resultado |
| --- | --- |
| `npm run verificar` | 182 pruebas, tipos y compilación en verde |
| `npm run auditoria` | 33/33 código · 46/46 contra el servidor |
| `npm run pentest` | 43/43 ataques repelidos, 0 sin lanzar |
| RLS, concurrencia, facturas, remesas, dispositivos, fuga de IA | en verde |

Lo que **no** está resuelto y hay que hacer antes de meter datos reales de
alumnos está en `docs/DESPLIEGUE.md`, y `npm run desplegar:comprobar` falla
mientras falte. Son cinco cosas y las cinco son configuración del servidor, no
código: cifrado del disco, cifrado del almacén de archivos, copias
programadas, restauración probada y correo saliente.

---

## Lo último que se hizo

1. **La app del alumnado**: descargar temas para estudiar sin cobertura (con
   revocación al perder el derecho) y exámenes de desarrollo con reloj de
   servidor y guardado automático.
2. **Asistente de temario**: subir una carpeta con sesenta PDF, revisar la
   propuesta y crear el temario entero, con opción de deshacerlo.
3. **El manual** (`/manual`), con diecisiete capturas que se regeneran con
   `npm run manual:capturas`.
4. **Auditoría completa** con la aplicación en marcha. Lo más importante que
   salió: tres pruebas que pasaban **sin haber probado nada** (ver ADR-0056).

---

## Lo siguiente, por orden

1. **Búsqueda vectorial con `pgvector`** para la IA. Hoy es léxica y funciona,
   pero la recuperación mejora mucho. El filtro de permisos ya está hecho y no
   habría que tocarlo: solo se sustituye la función de búsqueda (ADR-0011).
2. **Detección de duplicados y ambigüedades** en el banco de preguntas.
3. **Pasarela de pago** para cobrar con tarjeta desde la propia plataforma.
4. **Notificaciones push**. El receptor ya está en el service worker; falta la
   suscripción y el envío.
5. **Boletines autonómicos** en el radar, además del BOE.
6. **Dominio propio por academia**.

Y una que no es de producto pero pesa: **un test de intrusión profesional**
antes de abrir con datos reales. La batería propia son 43 ataques conocidos; un
profesional busca los que no están en esa lista.

---

## Lo que conviene leer antes de tocar código

`docs/DECISIONS.md`. Son 57 decisiones con su porqué, y casi todas nacieron de
un problema real. Las que más ahorran tiempo:

- **ADR-0049** · nunca dos condiciones sobre la misma clave en un `where`. Fue
  el fallo más grave del proyecto (H-07) y volvió a aparecer dos veces más.
- **ADR-0056** · una prueba que no puede probar nada lo dice. Tres
  comprobaciones daban verde sin haber comprobado nada.
- **ADR-0053** · el reloj de un examen lo lleva el servidor, y lo escrito no se
  pierde nunca.
- **ADR-0052** · guardar temario en un móvil no abre ninguna puerta nueva, y se
  revoca en la siguiente conexión.
