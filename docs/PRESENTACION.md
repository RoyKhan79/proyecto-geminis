# Guión para enseñar Proyecto Geminis a una academia

Pensado para una demostración en directo de **20 minutos**, con dos pantallas
abiertas (o dos navegadores): una haciendo de academia y otra de alumno.

Antes de empezar:

```bash
npm run demo:todo   # deja la demo con material realista
npm run dev
```

Ten preparadas dos ventanas:

| Ventana | Sesión |
|---------|--------|
| Izquierda · **la academia** | `admin@academiademo.test` / `Geminis2026!` |
| Derecha · **el alumno** | `alumno1@academiademo.test` / `Geminis2026!` |

---

## 0 · Cómo abrir (30 segundos)

> «Voy a enseñaros dos cosas a la vez: lo que veis vosotros y lo que ve vuestro
> alumno. Todo lo que toque en esta pantalla aparece en la otra.»

Es el gesto que más convence. Nadie se cree una promesa; todo el mundo se cree
una pantalla que cambia delante.

---

## 1 · El problema de cambiar de programa (3 minutos)

**Manager → Importar.**

> «La primera pregunta que me hacéis siempre es: *tengo a mis 400 alumnos en
> otro sitio*. Vamos a traerlos.»

1. Arrastra un Excel cualquiera.
2. Enseña que **detecta las columnas solo**.
3. Señala la previsualización: *"se crearán 4, se actualizará 1, hay 2 con
   errores"*. Recalca: **todavía no se ha tocado nada**.
4. Importa.
5. **Pulsa «Deshacer importación».** Todo vuelve atrás.

> «Podéis probar sin miedo. Si el archivo venía mal, se deshace y la academia
> queda como estaba.»

---

## 2 · Vuestro contenido, con vuestros nombres (4 minutos)

**Manager → Contenido → Maestros · Educación Primaria.**

> «Fijaos en cómo se llaman los apartados.»

Muestra **«Programación de aula»** y **«Situaciones de aprendizaje»**.

> «Esto no lo hemos puesto nosotros. Lo escribe cada academia. Hasta hace poco
> se llamaba de otra forma, y volverá a cambiar. Si el nombre estuviera en el
> programa, tendríais que esperar a que lo actualizáramos. Aquí lo cambiáis
> vosotros en dos segundos.»

Crea un apartado nuevo delante de ellos y ponle el nombre que ellos usen.

---

## 3 · El profesor marca el ritmo (4 minutos) ⭐

**Manager → Contenido → Administrativo → Ritmo del temario.**

> «Subís el temario entero el primer día. Pero vuestro alumno solo ve por dónde
> vais.»

1. Enseña los 11 temas y el contador *"X de 11 abiertos"*.
2. Pulsa **«Hasta aquí»** en el Tema 3.
3. **Cambia a la ventana del alumno** → Estudiar. Solo ve tres temas.
4. Ve a **Tests**: solo puede examinarse de esos tres.
5. Vuelve a la academia y abre hasta el Tema 6.
6. Refresca al alumno: ahora ve seis.

> «Y si tenéis grupo de mañana y grupo de tarde a distinto ritmo, cada uno ve el
> suyo. Con el mismo material y sin duplicar cursos.»

Remata:

> «Aunque el alumno se sepa la dirección de un tema cerrado y la escriba a mano,
> no existe para él. No está escondido: no está.»

---

## 4 · Cada alumno paga lo suyo (3 minutos) ⭐

Abre una tercera pestaña con `alumno2@academiademo.test` (pack solo tests).

> «Este alumno ha pagado solo el pack de tests.»

Enseña que **no le aparece el temario**. Ni la sección, ni los PDFs.

Vuelve a la academia → **Alumnos → ficha → «Acceso al contenido»**.

> «Aquí veis de un vistazo qué tiene contratado cada alumno. Y podéis darle o
> quitarle acceso a una parte concreta sin tocar su matrícula.»

Enseña el catálogo: curso completo, solo temario, solo clases, temario + tests.

> «Los packs los inventáis vosotros. El sistema no os obliga a vender de una
> forma concreta.»

---

## 5 · Estudiar de verdad (2 minutos)

En la ventana del alumno:

1. Abre un tema con PDF. Enseña el **visor a pantalla completa**.
2. Señala el aviso de que no se puede descargar.

> «Vosotros decidís, rama por rama, qué se descarga y qué solo se lee. Y podéis
> poner marca de agua con el nombre del alumno.»

3. Ve a **Tests** → test aleatorio de 20 preguntas → responde unas cuantas mal a
   propósito → **entrega**.
4. Enseña la corrección: respuesta correcta, la que marcó, y **la explicación
   del preparador**.
5. Vuelve a Tests: aparece **«Dónde flojeas»** y el **test de mis errores**.

> «El sistema se acuerda de lo que falla y se lo devuelve.»

---

## 6 · Quién se está desenganchando (2 minutos) ⭐

**Manager → Analítica.**

Baja a **«Alumnos que requieren atención»**.

> «Esto es lo que os va a ahorrar dinero de verdad.»

Lee en voz alta un par de líneas reales: *"🟠 Sergio Blanco · 33 días sin
actividad"*, *"🟡 Álvaro Rincón · 14 días sin actividad"*.

> «No es magia ni un algoritmo que no podéis discutir. Os dice exactamente por
> qué sale cada uno: días sin entrar, tests sin hacer, material sin abrir,
> faltas a clase, resultados que bajan. Vosotros decidís a quién llamáis.»

---

## 7 · El BOE, cada mañana (2 minutos) ⭐

**Manager → Convocatorias.**

> «Decidnos qué oposiciones preparáis.»

Enseña las vigilancias y una convocatoria detectada de verdad en el BOE.

> «Cada mañana, a las ocho y media, el servidor mira el Boletín. Vosotros no
> tenéis que abrir nada. Si sale algo de lo vuestro, os llega un correo.»

Pulsa **«Aceptar y crear»**.

> «Y con un clic tenéis la oposición creada, con sus apartados, lista para subir
> temario. Podéis convocar a vuestros alumnos el mismo día que sale.»

---

## 8 · La IA que no os contradice (2 minutos)

En la ventana del alumno: **Geminis IA**.

Pregunta algo del temario. Enseña las **fuentes citadas**: documento y fragmento.

> «Responde con vuestro material. No con internet. Y os dice de dónde lo saca.»

Ahora, en la ventana del alumno de "solo tests", haz la misma pregunta:

> «No encuentro esa información en el material de tu academia.»

> «Preguntarle a la IA no es una puerta trasera para leer lo que no se ha
> pagado. Es la misma barrera.»

Y el remate importante:

> «Cuando la IA genera preguntas para vosotros, entran siempre como borrador.
> Nunca publica nada. La última palabra es del preparador, siempre.»

Una frase más, que es la que sorprende:

> «Y esto no os cuesta nada. Geminis lleva su propio motor dentro: no hay que
> contratar ninguna API, y con esa configuración vuestro temario **no sale del
> servidor**. Si algún día queréis respuestas más redactadas, se conecta un
> modelo y la barrera de permisos es exactamente la misma.»

---

## 8b · La IA que os conoce (2 minutos) ⭐

Esto es lo que separa a Geminis de un buscador.

En la ventana del alumno, entra en el inicio del Campus. Arriba, **«Geminis te
propone»**:

> «Fíjate en que no dice "estudia el tema 4". Dice *por qué*: llevas doce fallos
> de veinte en ese tema. Una recomendación sin el dato delante no la sigue
> nadie.»

Ahora ve a **Tests**. Si hay repaso pendiente, sale arriba:

> «Geminis lleva la cuenta de cuándo está a punto de olvidar cada pregunta y se
> la devuelve justo a tiempo. Es lo que hace que lo del tema 1 siga en pie el día
> del examen. El alumno no organiza nada: le llega hecho.»

Y en la corrección de un test, en una pregunta fallada, pulsa **«¿Por qué he
fallado?»**:

> «El momento en que más se aprende es justo después de equivocarse, y es
> justo cuando no tenéis a nadie delante. Aquí le da vuestra explicación y la
> refuerza con lo que dice vuestro temario, citando la página.»

---

## 9 · El móvil (1 minuto)

Abre el Campus en el móvil (o reduce la ventana).

> «Esto se instala en el teléfono. Se añade a la pantalla de inicio y se abre
> como una aplicación.»

Enseña la barra inferior y el muro de clase.

---

## Cierre (1 minuto)

Tres frases, sin florituras:

> «Uno: traer vuestros alumnos es cuestión de minutos, y se puede deshacer.
>
> Dos: vuestro contenido es vuestro, se organiza como vosotros trabajáis, y
> ninguna otra academia lo ve nunca.
>
> Tres: el programa os avisa de lo que no podéis vigilar a mano: quién se está
> desenganchando, qué normativa ha cambiado y cuándo sale vuestra convocatoria.»

Y una que conviene decir en voz alta:

> «Y si algún día queréis iros, os lleváis todos vuestros datos en un clic. Un
> programa del que no se puede salir no merece confianza.»

---

## Preguntas que os van a hacer

**«¿Y si otra academia ve mi temario?»**
No puede. No es que esté oculto: la base de datos no se lo devuelve. Hay 109
pruebas automáticas y 66 comprobaciones de auditoría que lo verifican en cada
cambio, y el informe completo está en `docs/AUDITORIA_FINAL.md`, con lo que
funciona y con lo que todavía no.

**«¿Puedo evitar que se descarguen mis PDFs?»**
Sí, se lee online y no se descarga, con marca de agua opcional con el nombre del
alumno. Con honestidad: ninguna web del mundo impide una captura de pantalla.
Lo que se consigue es que compartirlo cueste y deje rastro.

**«¿La IA se va a inventar cosas?»**
Si no encuentra la respuesta en vuestro material, lo dice. Y no puede publicar
nada por su cuenta.

**«¿Cuánto cuesta la IA?»**
En su configuración por defecto, nada: lleva su propio motor dentro del
servidor. Si queréis conectar un modelo externo, el consumo se mide por
academia, por persona y por funcionalidad, y lo veis en euros.

**«¿Y si tengo veinte años de preguntas en un Excel?»**
Se importan. Se os propone qué columna es cada cosa, se avisa de las repetidas
—que en un banco viejo son muchas—, se simula antes de tocar nada y entran en
borrador para que las reviséis.

**«¿Y si un alumno olvida su contraseña?»**
Se la cambia él solo con un enlace que le llega al correo y que caduca en una
hora. No tenéis que hacer nada, y vosotros nunca podéis ver su contraseña.

**«¿Cuánto tardo en tenerlo funcionando?»**
Importar los alumnos: minutos. Subir el temario: lo que tardéis en arrastrarlo.
Podéis empezar con una oposición y crecer.

**«¿Qué pasa si cambia una ley?»**
Registráis el cambio y el sistema os dice qué temas y qué preguntas dependen de
ese artículo, y marca las preguntas para que las reviséis. No toca vuestro
contenido: la decisión es vuestra.
