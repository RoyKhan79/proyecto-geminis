import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/context";
import { BRAND } from "@/lib/brand";
import { Captura } from "./captura";
import { Indice } from "./indice";
import {
  Apartado,
  Comando,
  Ficha,
  Fichas,
  Lista,
  Nota,
  P,
  Parte,
  Paso,
  Pasos,
  Punto,
  Regla,
  Ruta,
  Sub,
  Tabla,
} from "./piezas";

export const metadata: Metadata = {
  title: "Manual",
  description: "Cómo se usa Geminis, por los dos lados.",
};

/**
 * EL MANUAL, DENTRO DEL PROPIO SISTEMA
 *
 * Vive aquí y no en un PDF suelto por dos razones. La primera es práctica: un
 * manual en un archivo adjunto se queda desactualizado el día que cambia una
 * pantalla, y este está en el mismo repositorio que el código, así que se
 * corrige en el mismo cambio. La segunda es que así el enlace es de la
 * academia: su dominio, su sesión, sin depender de nadie.
 *
 * Pide sesión. No porque el contenido sea secreto, sino porque describe las
 * pantallas de dentro y no tiene sentido enseñárselo a quien no puede entrar.
 * La parte de operación —comandos, tareas programadas— solo la ve el personal
 * de la academia: al alumnado no le sirve y solo hace más largo lo que busca.
 */
export default async function ManualPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/entrar");

  const esPersonal =
    ctx.permissions.has("manager.access") || ctx.user.isPlatformAdmin;

  const volver = ctx.permissions.has("manager.access")
    ? { href: "/gestion", texto: "Volver a Manager" }
    : { href: "/campus", texto: "Volver al Campus" };

  return (
    <div className="shell-wash min-h-dvh bg-surface-sunken">
      <div className="mx-auto grid max-w-[74rem] grid-cols-1 gap-x-14 px-5 pb-24 lg:grid-cols-[14rem_minmax(0,1fr)]">
        {/* ── Cabecera ────────────────────────────────────────────────── */}
        <header className="col-span-full border-b border-line pb-9 pt-14">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2.5 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-ink-muted">
              <span className="grid size-7 place-items-center rounded-lg bg-linear-to-br from-accent to-accent-hover font-display text-sm font-bold text-accent-contrast">
                {BRAND.initial}
              </span>
              {BRAND.name}
            </p>
            <Link
              href={volver.href}
              className="text-sm text-accent underline-offset-4 hover:underline"
            >
              {volver.texto}
            </Link>
          </div>

          <h1 className="mt-5 font-display text-[clamp(2.2rem,6vw,3.2rem)] font-semibold leading-[1.05] tracking-tight text-ink text-balance">
            Manual de {BRAND.name}
          </h1>
          <p className="mt-4 max-w-[60ch] text-[1.05rem] leading-relaxed text-ink-soft">
            Cómo se usa el sistema por los dos lados: el ERP con el que la
            academia lleva su negocio y la aplicación con la que el alumnado
            estudia. Escrito para tenerlo abierto al lado mientras se trabaja,
            no para leerlo de un tirón.
          </p>
        </header>

        <Indice conOperacion={esPersonal} />

        <main className="min-w-0">
          {/* ═══ Antes de nada ═══════════════════════════════════════════ */}
          <Parte
            id="quien-es-quien"
            etiqueta="Antes de nada"
            titulo="Quién es quién"
            entradilla="Todo lo demás se entiende mejor con esto delante. Hay tres niveles, y la frontera que importa es la de arriba."
          />

          <div className="max-w-[68ch] space-y-4 pt-6">
            <Tabla
              cabeceras={["Nivel", "Qué es", "Qué ve"]}
              filas={[
                [
                  <strong key="a">Superadministrador</strong>,
                  "El dueño del servicio. Da de alta academias y da soporte.",
                  <>
                    El estado del servicio y la lista de academias.{" "}
                    <strong>No ve el contenido ni los alumnos de ninguna.</strong>
                  </>,
                ],
                [
                  <strong key="b">Administrador de academia</strong>,
                  "Manda sobre todo lo suyo.",
                  "Toda su academia. Nada de las demás.",
                ],
                [
                  <strong key="c">Profesor</strong>,
                  "Prepara y corrige.",
                  "Su gente y su contenido.",
                ],
                [
                  <strong key="d">Personal administrativo</strong>,
                  "Secretaría.",
                  "Matrículas, cobros y comunicaciones. No los datos académicos sensibles.",
                ],
                [
                  <strong key="e">Alumno</strong>,
                  "Estudia.",
                  "Solo el Campus, y dentro de él solo lo que tenga contratado.",
                ],
              ]}
            />

            <Regla>
              <p>
                <strong>Una academia no puede ver a otra.</strong> No es una
                promesa: hay dos barreras independientes, la de la aplicación y
                la de la propia base de datos, y cada una funciona aunque la otra
                falle. Los archivos del temario tienen sus dos barreras propias.
                Si algún día una consulta se equivocara y trajera el documento de
                otra academia, no se serviría.
              </p>
            </Regla>
          </div>

          <Apartado id="entrar" titulo="Entrar">
            <P>
              Todo el mundo entra por la misma puerta, <Ruta>/entrar</Ruta>, y el
              sistema lleva a cada uno a su sitio: la academia a{" "}
              <Ruta>/gestion</Ruta>, el alumnado a <Ruta>/campus</Ruta>, el
              superadministrador a <Ruta>/plataforma</Ruta>. Quien tenga los dos
              papeles —un profesor que además estudia— verá un botón para saltar
              de uno a otro.
            </P>
            <P>
              Si alguien olvida su contraseña, <Ruta>/recuperar</Ruta> le manda un
              enlace por correo. El enlace caduca y solo sirve una vez.
            </P>
            <Nota>
              <p>
                <strong>
                  Sin correo configurado, nadie recupera su contraseña.
                </strong>{" "}
                Es lo primero que hay que dejar puesto en una instalación nueva,
                antes de dar de alta a nadie.
              </p>
            </Nota>
          </Apartado>

          {/* ═══ El ERP ══════════════════════════════════════════════════ */}
          <Parte
            id="montar"
            etiqueta="El ERP · para la academia"
            titulo="Montar la academia"
            entradilla="El orden importa: cada paso necesita el anterior. Hacerlo así la primera vez ahorra rehacer cosas."
          />

          <div className="max-w-[68ch] space-y-3 pt-6">
            <Pasos>
              <Paso>
                <strong>Configuración</strong> · <Ruta>/gestion/configuracion</Ruta>
                <br />
                Nombre, razón social, correo, zona horaria y plan. Aquí también
                está la tabla de roles y permisos: qué puede hacer exactamente
                cada uno.
              </Paso>
              <Paso>
                <strong>Profesorado y personal</strong> ·{" "}
                <Ruta>/gestion/profesores</Ruta>
                <br />
                Se les da de alta con su rol. Cada persona con su acceso; nadie
                comparte cuenta.
              </Paso>
              <Paso>
                <strong>Oposiciones</strong> · <Ruta>/gestion/oposiciones</Ruta>
                <br />
                La oposición que se prepara. Se pueden editar y eliminar después.
              </Paso>
              <Paso>
                <strong>Convocatorias</strong> · <Ruta>/gestion/convocatorias</Ruta>
                <br />
                La edición concreta de esa oposición. El temario y las preguntas
                cuelgan de aquí, y por eso una convocatoria nueva no obliga a
                rehacer nada.
              </Paso>
              <Paso>
                <strong>Cursos y grupos</strong> · <Ruta>/gestion/cursos</Ruta>
                <br />
                El curso es lo que se vende; el grupo es la clase concreta, con su
                horario y su profesor. El grupo manda sobre el <em>ritmo</em> al
                que se abre el temario, así que conviene tenerlos antes de subir
                nada.
              </Paso>
            </Pasos>

            <Captura
              nombre="gestion-inicio"
              pie="La pantalla de inicio de Manager. A la izquierda, todo lo que la academia puede hacer, agrupado por Personas, Académico y Academia; lo que no te aparezca es que tu rol no lo tiene."
            />
          </div>

          <Apartado
            id="temario"
            titulo="El temario"
            roles={["Administrador", "Profesor"]}
          >
            <P>
              En <Ruta>/gestion/contenido</Ruta> se elige la convocatoria y se
              entra en su árbol. Los apartados los nombra la academia: si en tu
              casa se llama «Supuestos» y no «Casos prácticos», se llama
              «Supuestos».
            </P>

            <Sub>Subir el temario entero de una vez</Sub>
            <P>
              El botón <strong>Subir temario entero</strong> abre el asistente. Es
              el camino corto cuando el temario está en una carpeta con sesenta
              PDF.
            </P>
            <Pasos>
              <Paso>Eliges el apartado de destino.</Paso>
              <Paso>Sueltas todos los archivos de golpe.</Paso>
              <Paso>
                <strong>Revisas.</strong> Aquí está el valor: se lee el número y
                el título del nombre de cada archivo —
                <Ruta>Tema 01 - El acto administrativo.pdf</Ruta>,{" "}
                <Ruta>T12_Fuentes.PDF</Ruta>— y se enseña la lista completa,
                ordenada y <em>editable</em>. Además avisa de lo que huele mal:
                números repetidos, huecos en la numeración, temas que se quedarían
                sin título.
              </Paso>
              <Paso>
                Decides cómo entran —descargable o no, con IA o sin ella— y
                confirmas.
              </Paso>
            </Pasos>

            <Regla>
              <p>
                <strong>El asistente propone; tú nombras.</strong> Lo que se crea
                son las etiquetas que has aprobado en pantalla, no las que dedujo
                el sistema.
              </p>
              <p>
                <strong>
                  Entra todo en borrador salvo que marques lo contrario
                </strong>
                , y la tanda entera se deshace en un clic. Publicar sesenta temas
                de golpe sin mirarlos no debería pasar por descuido.
              </p>
            </Regla>

            <Captura
              nombre="gestion-contenido"
              pie="El árbol del temario. Los apartados los nombra la academia; aquí se ve cuántos elementos hay y cuántos están publicados."
            />

            <Sub>Las banderas de cada rama</Sub>
            <P>
              Se heredan hacia abajo: lo que pongas en «Temario» vale para todos
              sus temas salvo que un tema diga otra cosa.
            </P>
            <Fichas>
              <Ficha titulo="Descargable">
                Si no, el alumno lo consulta en línea pero no se lo lleva. Por
                defecto está cerrado.
              </Ficha>
              <Ficha titulo="Marca de agua">
                Pinta encima quién está leyendo. No impide una foto a la pantalla;
                deja claro de quién es la copia.
              </Ficha>
              <Ficha titulo="Geminis IA">
                Si lo apagas, la IA no indexa ni cita ese material.
              </Ficha>
              <Ficha titulo="Sirve para preguntas">
                Si el copiloto puede generar test a partir de ese material.
              </Ficha>
            </Fichas>

            <Sub>El ritmo del temario</Sub>
            <P>
              En <Ruta>/gestion/contenido/…/ritmo</Ruta> se decide, por grupo,
              hasta dónde tiene abierto cada clase. Es lo que permite subir el
              temario completo el primer día y que cada grupo vea solo por dónde
              va. Lo que aún no has abierto no existe para ese alumno: ni lo ve,
              ni lo descarga, ni se lo cita la IA.
            </P>
          </Apartado>

          <Apartado
            id="alumnado"
            titulo="Alumnado y matrículas"
            roles={["Administrador", "Personal", "Profesor"]}
          >
            <P>
              <Ruta>/gestion/alumnos</Ruta> lista a todo el mundo; entrando en una
              ficha están sus datos, sus matrículas, sus pagos y su rendimiento.
              Para dar de alta a muchos de golpe,{" "}
              <Ruta>/gestion/importar</Ruta> tiene un asistente que simula la
              importación antes de hacerla y permite revertirla.
            </P>

            <Regla>
              <p>
                <strong>Matricular es lo que abre el contenido.</strong> Al
                matricular a alguien en un curso se le crea automáticamente su
                derecho de acceso al temario que ese curso incluye. No hay que
                hacer las dos cosas: es una.
              </p>
              <p>
                Por eso un curso de «solo tests» y uno de «curso completo» dan
                acceso a cosas distintas sobre el mismo temario, y el de solo
                tests no llega al temario ni por la pantalla ni preguntándole a la
                IA.
              </p>
            </Regla>

            <Captura
              nombre="gestion-alumnos"
              pie="El listado de alumnado. Desde aquí se entra a la ficha de cada uno, con sus matrículas, sus pagos y su rendimiento."
            />

            <Sub>Forma de pago</Sub>
            <P>
              En la ficha de cada alumno se elige cómo paga: efectivo, tarjeta,
              transferencia o <strong>cargo mensual en cuenta</strong>. Para el
              último hace falta su IBAN y su mandato firmado; el número de cuenta
              se guarda cifrado y en pantalla solo se ven los últimos dígitos.
            </P>
          </Apartado>

          <Apartado
            id="dinero"
            titulo="Cobros y facturas"
            roles={["Administrador", "Personal"]}
          >
            <Sub>Recibos</Sub>
            <P>
              <Ruta>/gestion/pagos</Ruta> es el estado de cuentas: quién ha
              pagado, quién debe, qué se ha devuelto. Marcar un recibo como
              devuelto suspende el acceso del alumno, que es lo que hace que la
              lista sirva para algo y no sea solo un registro.
            </P>

            <Captura
              nombre="gestion-pagos"
              pie="El estado de cuentas: quién ha pagado, quién debe y qué se ha devuelto."
            />

            <Sub>Remesas de cobro</Sub>
            <P>
              <Ruta>/gestion/pagos/remesas</Ruta> genera el archivo SEPA con todos
              los cargos mensuales del mes y se lo lleva al banco.
            </P>
            <Pasos>
              <Paso>Eliges el mes y la fecha de cargo.</Paso>
              <Paso>
                Ves el detalle: cuántos alumnos, cuánto suma, quién se queda fuera
                y por qué.
              </Paso>
              <Paso>Emites la remesa y descargas el archivo XML.</Paso>
              <Paso>Lo subes al banco.</Paso>
            </Pasos>
            <Nota>
              <p>
                <strong>Los primeros cargos y los siguientes van separados.</strong>{" "}
                El banco los trata distinto —el primero exige más plazo—, así que
                el sistema los emite en dos remesas cuando toca. No es un fallo:
                es lo correcto.
              </p>
            </Nota>

            <Captura
              nombre="gestion-remesas"
              pie="Las remesas emitidas. De cada una sale el archivo XML que se sube al banco."
            />

            <Sub>Facturas</Sub>
            <P>
              <Ruta>/gestion/facturas</Ruta> emite facturas con su base imponible,
              su descripción, su IVA y su numeración correlativa. Una factura
              emitida <strong>no se puede modificar ni borrar</strong>: si hay que
              corregirla se emite una rectificativa, que es lo que exige la ley.
            </P>
            <Captura
              nombre="gestion-facturas"
              pie="Las facturas emitidas, con su numeración correlativa. Una vez emitida no se toca: si hay que corregirla, se emite una rectificativa."
            />

            <Nota>
              <p>
                Si la enseñanza que impartes está exenta de IVA por el artículo
                20.Uno.9º, se marca en la serie y las facturas salen exentas con
                su mención legal.
              </p>
            </Nota>
          </Apartado>

          <Apartado
            id="docencia"
            titulo="Agenda y clases"
            roles={["Administrador", "Profesor"]}
          >
            <P>
              <Ruta>/gestion/agenda</Ruta> es el calendario, con vista de mes y de
              semana: se colocan las clases por día, con su tema, su profesor y su
              aula o su enlace. Lo que pongas aquí lo ve el alumnado en su propio
              calendario.
            </P>
            <Captura
              nombre="gestion-agenda"
              pie="La agenda, con las clases colocadas por día. Lo que se ponga aquí lo ve el alumnado en su propio calendario."
            />

            <P>
              <Ruta>/gestion/clases</Ruta> es la lista, y entrando en una clase se
              pasa lista. La asistencia admite presente, ausente, justificado, en
              línea y «ha visto la grabación», porque en una academia esas cinco
              cosas no son lo mismo.
            </P>
            <P>
              <Ruta>/gestion/salas</Ruta> son las salas permanentes: el aula
              virtual de un grupo, la de tutorías. Se diferencian de una clase en
              que no tienen fecha: están ahí. El enlace real nunca se pinta en la
              pantalla del alumno; se entra por una ruta que comprueba que la sala
              es suya y deja registro.
            </P>
          </Apartado>

          <Apartado
            id="evaluacion"
            titulo="Tests y exámenes"
            roles={["Administrador", "Profesor"]}
          >
            <P>Hay cuatro cosas distintas y conviene no mezclarlas.</P>
            <Tabla
              cabeceras={["Qué", "Dónde", "Para qué"]}
              filas={[
                [
                  <strong key="a">Banco de preguntas</strong>,
                  <Ruta key="a2">/gestion/tests</Ruta>,
                  "Las preguntas tipo test, por tema. De aquí se sirve todo lo demás.",
                ],
                [
                  <strong key="b">Simulacros</strong>,
                  <Ruta key="b2">/gestion/simulacros</Ruta>,
                  "Un examen tipo test convocado, con su reloj, su penalización y sus intentos.",
                ],
                [
                  <strong key="c">Exámenes de desarrollo</strong>,
                  <Ruta key="c2">/gestion/examenes</Ruta>,
                  "Se escriben en la plataforma y los corriges tú. Con hora y reloj.",
                ],
                [
                  <strong key="d">Tareas</strong>,
                  <Ruta key="d2">/gestion/tareas</Ruta>,
                  "Un supuesto o un trabajo para casa, con plazo de días.",
                ],
              ]}
            />

            <Captura
              nombre="gestion-examenes"
              pie="Un examen de desarrollo convocado. De un vistazo: quién está escribiendo ahora mismo, quién ha entregado y cuántos quedan por corregir."
            />

            <Sub>Cargar preguntas</Sub>
            <P>
              <Ruta>/gestion/tests/importar</Ruta> admite un archivo con las
              preguntas, detecta las repetidas, simula la importación antes de
              hacerla y permite revertirla entera. También puedes generarlas con
              el copiloto a partir de tu propio material: entran siempre en
              borrador y no se publican sin que alguien las revise.
            </P>

            <Sub>Convocar un examen de desarrollo</Sub>
            <Pasos>
              <Paso>
                Título y enunciado. El enunciado lo ve el alumno antes de empezar
                y mientras escribe.
              </Paso>
              <Paso>A quién: el curso entero o un grupo.</Paso>
              <Paso>
                <strong>Se abre</strong> (antes de esa hora nadie puede empezarlo)
                y <strong>se cierra</strong> (después ya no se escribe, aunque a
                alguien le queden minutos).
              </Paso>
              <Paso>
                <strong>Minutos por alumno.</strong> Cuentan desde que cada uno lo
                abre, no desde la convocatoria: quien entra cinco minutos tarde
                pierde cinco minutos, no el examen.
              </Paso>
              <Paso>Convocar. Al alumnado le llega el aviso.</Paso>
            </Pasos>
            <P>
              Mientras dura, la pantalla te dice quién está escribiendo en ese
              momento, quién ha entregado y cuáles se cerraron solos. Cuando
              entregan, abres, lees, pones nota y comentario. También puedes
              devolver un trabajo para que lo rehagan sin perder lo anterior.
            </P>

            <Regla>
              <p>
                <strong>El reloj lo lleva el servidor.</strong> Cambiar la hora
                del móvil, recargar la página o abrir el examen en otro
                dispositivo no da ni un segundo de más.
              </p>
              <p>
                <strong>Y no se pierde lo escrito.</strong> El borrador se guarda
                solo cada pocos segundos. Si se agota el tiempo, lo último
                guardado <em>es</em> la entrega. Y si alguien se queda sin batería
                y no vuelve, el mantenimiento nocturno cierra su examen para que
                te aparezca en la lista de corregir en lugar de quedarse
                invisible.
              </p>
            </Regla>
          </Apartado>

          <Apartado
            id="copiloto"
            titulo="Geminis IA, del lado del preparador"
            roles={["Administrador", "Profesor"]}
          >
            <P>
              <Ruta>/gestion/ia</Ruta>. Lo primero que hay que hacer una vez es{" "}
              <strong>Indexar material</strong>: hasta entonces la IA no tiene de
              dónde sacar nada y dirá, con razón, que no encuentra información.
            </P>
            <P>
              Con el material indexado, el copiloto genera borradores a partir de
              tu propio temario: preguntas tipo test, resúmenes, esquemas.
            </P>
            <Regla>
              <p>
                <strong>Todo lo que genera es un borrador.</strong> No existe
                ningún camino por el que algo llegue al alumno sin que una persona
                lo revise y lo publique.
              </p>
              <p>
                <strong>Y no inventa.</strong> Responde solo con el material de tu
                academia y cita de dónde lo saca. Si no lo tiene, lo dice. En una
                oposición, una respuesta plausible y falsa sobre un plazo puede
                costar la plaza.
              </p>
            </Regla>
            <Captura
              nombre="gestion-ia"
              pie="El copiloto. El botón de indexar es lo primero que hay que pulsar: sin material indexado, la IA no tiene de dónde sacar nada."
            />

            <P>
              Funciona sin contratar ninguna API externa. Si conectas una, mejora
              la redacción; si no, sigue respondiendo con su propio motor.
            </P>
          </Apartado>

          <Apartado
            id="comunicar"
            titulo="Comunicación"
            roles={["Administrador", "Profesor", "Personal"]}
          >
            <Lista>
              <Punto>
                <Ruta>/gestion/muro</Ruta> — el tablón de una clase: avisos,
                cambios de aula, ánimos antes de un examen.
              </Punto>
              <Punto>
                <Ruta>/gestion/mensajes</Ruta> — conversaciones uno a uno con un
                alumno.
              </Punto>
              <Punto>
                <Ruta>/gestion/comunicaciones</Ruta> — envíos a muchos: a un
                grupo, a un curso, a quien deba dinero.
              </Punto>
            </Lista>
          </Apartado>

          <Apartado
            id="analitica"
            titulo="Analítica y alumnos en riesgo"
            roles={["Administrador", "Profesor"]}
          >
            <P>
              <Ruta>/gestion/analitica</Ruta> es la pantalla que conviene mirar
              una vez por semana. Lo importante no son los totales: es la lista de{" "}
              <strong>quién necesita atención</strong>.
            </P>
            <Captura
              nombre="gestion-analitica"
              pie="Analítica. Lo que importa no son los totales de arriba, sino la lista de quién necesita atención y por qué."
            />

            <P>
              El riesgo se calcula con reglas explicables y te dice el motivo, no
              un número mágico: días sin entrar, ningún test este mes, material sin
              abrir, faltas a clase, resultados que bajan. Con eso se puede llamar
              a alguien antes de que se dé de baja, que es de lo que va todo esto.
            </P>
          </Apartado>

          <Apartado
            id="normativa"
            titulo="Normativa y radar"
            roles={["Administrador", "Profesor"]}
          >
            <P>
              <Ruta>/gestion/normativa</Ruta> guarda las leyes que importan y las
              enlaza con los temas que las explican. Cuando una cambia, los temas y
              las preguntas afectadas se marcan como{" "}
              <span className="font-semibold text-caution">
                posiblemente desactualizadas
              </span>{" "}
              para que las revises. No se cambia nada solo.
            </P>
            <P>
              El radar del BOE mira cada mañana si ha salido la convocatoria de las
              oposiciones que estás vigilando y avisa.
            </P>
          </Apartado>

          {/* ═══ La app ══════════════════════════════════════════════════ */}
          <Parte
            id="instalar"
            etiqueta="La app · para el alumnado"
            titulo="Instalarla en el móvil"
            entradilla="No está en ninguna tienda de aplicaciones y no hace falta: se instala desde el navegador y queda con su icono en la pantalla de inicio, igual que cualquier otra."
          />

          <div className="max-w-[68ch] space-y-3 pt-6">
            <Fichas>
              <Ficha titulo="iPhone y iPad">
                Abre la dirección en <strong>Safari</strong> (no vale Chrome),
                pulsa Compartir y luego{" "}
                <strong>Añadir a pantalla de inicio</strong>.
              </Ficha>
              <Ficha titulo="Android">
                Abre la dirección en Chrome. Sale un aviso de{" "}
                <strong>Instalar</strong>; si no, está en el menú de tres puntos.
              </Ficha>
            </Fichas>
            <Captura
              nombre="campus-inicio"
              movil
              pie="La pantalla de inicio del alumno. Abajo, la barra con los cinco destinos principales; arriba, los accesos al resto."
            />

            <Nota>
              <p>
                <strong>
                  En Android el aviso de instalar solo aparece con HTTPS.
                </strong>{" "}
                Si estás probando en una red local por HTTP, funciona todo menos
                ese aviso. No es un fallo de la aplicación.
              </p>
            </Nota>
          </div>

          <Apartado id="estudiar" titulo="Estudiar" roles={["Alumno"]}>
            <P>
              La pestaña <strong>Estudiar</strong> es el temario tal y como lo ha
              organizado la academia. Solo aparece lo contratado y lo que el
              profesor ya haya abierto para esa clase: lo demás, sencillamente, no
              está.
            </P>
            <Captura
              nombre="campus-estudiar"
              movil
              pie="El temario del alumno. Solo aparece lo contratado y lo que el profesor ya haya abierto."
            />

            <P>
              Al entrar en un tema se abre el documento en el visor, sin salir de
              la aplicación. Si la academia lo permite, hay botón para
              descargarlo; si no, se consulta en línea y se dice claramente por
              qué.
            </P>
          </Apartado>

          <Apartado
            id="descargas"
            titulo="Descargas · estudiar sin cobertura"
            roles={["Alumno"]}
          >
            <P>
              En <strong>Descargas</strong> están todos los temas que se pueden
              guardar en el dispositivo. <strong>Guardar los que faltan</strong>{" "}
              se los lleva todos de una vez; también se puede guardar un tema
              suelto desde su propia pantalla, mientras se lee.
            </P>
            <P>
              Después, sin red —en el metro, en el pueblo—, esos temas se abren
              igual desde Estudiar.
            </P>
            <Captura
              nombre="campus-descargas"
              movil
              pie="Descargas. Cada tema con lo que ocupa, y arriba cuánto llevas guardado en el dispositivo."
            />

            <Regla>
              <p>
                <strong>Guardar no abre ninguna puerta.</strong> Solo aparece lo
                que ya se podía descargar a mano. Un tema con marca de agua no se
                guarda nunca, porque sin conexión se serviría sin ella.
              </p>
              <p>
                <strong>Y se revoca.</strong> Cada vez que hay red se comprueba
                contra el servidor: una baja, un derecho que caduca o una descarga
                que la academia retira vacían la mochila y lo dicen en pantalla.
                Si entra otra persona en ese mismo móvil, se borra todo antes de
                enseñarle nada.
              </p>
            </Regla>
          </Apartado>

          <Apartado
            id="tests-alumno"
            titulo="Tests y simulacros"
            roles={["Alumno"]}
          >
            <P>
              En la pestaña <strong>Tests</strong> hay dos cosas distintas.
            </P>
            <Lista>
              <Punto>
                <strong>Practicar por tu cuenta</strong> — por tema, aleatorio,
                solo tus fallos, o el repaso que el sistema te programa.
              </Punto>
              <Punto>
                <strong>Simulacros de la academia</strong> — convocados, con su
                reloj y su penalización por fallo. Solo salen los de tu oposición.
              </Punto>
            </Lista>
            <Captura
              nombre="campus-tests"
              movil
              pie="Tests. Arriba lo que el alumno puede practicar por su cuenta; más abajo, los simulacros que convoca la academia."
            />

            <P>
              El <strong>repaso programado</strong> es el que más rinde: te
              devuelve cada pregunta justo cuando estabas a punto de olvidarla, y
              lo que fallas vuelve antes que lo que aciertas. Al terminar puedes
              pedirle a Geminis que te explique por qué fallaste, con la cita del
              material.
            </P>
          </Apartado>

          <Apartado
            id="examenes-alumno"
            titulo="Exámenes de desarrollo"
            roles={["Alumno"]}
          >
            <P>
              En <strong>Exámenes</strong> aparecen los convocados, con su estado:
              convocado,{" "}
              <span className="font-semibold text-positive">puedes empezarlo</span>,{" "}
              <span className="font-semibold text-caution">en curso</span>,
              entregado o corregido.
            </P>
            <Pasos>
              <Paso>
                Lees el enunciado y pulsas <strong>Empezar</strong>. Ahí arranca
                tu reloj.
              </Paso>
              <Paso>
                Escribes. Cada pocos segundos aparece <strong>Guardado</strong>{" "}
                arriba.
              </Paso>
              <Paso>Si quieres, adjuntas un esquema o una foto de tu hoja.</Paso>
              <Paso>
                Pulsas <strong>Entregar</strong>. A partir de ahí ya no se puede
                seguir escribiendo.
              </Paso>
            </Pasos>
            <Captura
              nombre="campus-examenes"
              movil
              pie="Los exámenes convocados, cada uno con su estado. El que ya está corregido enseña la nota y el comentario del profesor."
            />

            <Regla>
              <p>
                <strong>Puedes cerrar la aplicación sin miedo.</strong> Lo escrito
                está guardado en el servidor y el reloj sigue corriendo aunque
                cierres. Al volver a entrar sigue todo donde lo dejaste.
              </p>
              <p>
                <strong>Si se acaba el tiempo, se entrega solo</strong> con lo
                último que hubieras escrito. Quedarse sin tiempo no significa
                perder el examen.
              </p>
            </Regla>
          </Apartado>

          <Apartado
            id="ia-alumno"
            titulo="Preguntarle a Geminis"
            roles={["Alumno"]}
          >
            <P>
              Responde <strong>solo con el material de tu academia</strong>, y te
              dice de qué documento y de qué página lo ha sacado. Si estás dentro
              de un tema, la pregunta se entiende en el contexto de ese tema.
            </P>
            <Captura
              nombre="campus-ia"
              movil
              pie="Geminis IA en el Campus. Cada respuesta llega con la cita de dónde ha salido."
            />

            <P>
              Cuando algo no está en tu material, lo dice: «No encuentro esa
              información en el material de tu academia. Consúltalo con tu
              preparador». Eso es lo correcto, no un fallo. Prefiere callarse a
              inventarse un plazo.
            </P>
          </Apartado>

          <Apartado id="dia-a-dia" titulo="El resto del día" roles={["Alumno"]}>
            <Fichas>
              <Ficha titulo="Tareas">
                Los supuestos y trabajos que manda el profesor, con su plazo, y
                las notas y comentarios cuando los corrige.
              </Ficha>
              <Ficha titulo="Calendario">
                Las clases de tu grupo, con el tema de cada una.
              </Ficha>
              <Ficha titulo="Muro">Los avisos de tu clase.</Ficha>
              <Ficha titulo="Mensajes">Hablar con tu preparador.</Ficha>
              <Ficha titulo="Salas">
                Entrar al aula virtual o a la sala de tutorías.
              </Ficha>
              <Ficha titulo="Perfil">
                Tus datos, tu progreso y <strong>tus dispositivos activos</strong>
                : desde dónde has entrado y cerrar sesión a distancia.
              </Ficha>
            </Fichas>
            <Captura
              nombre="campus-perfil"
              movil
              pie="El perfil, con las sesiones abiertas: desde qué dispositivo se ha entrado y cuándo. Se pueden cerrar a distancia."
            />

            <Nota>
              <p>
                <strong>Hay un límite de dispositivos por alumno.</strong> Lo pone
                la academia. Al pasarlo, se cierra la sesión más antigua, no la
                nueva: si cambias de móvil, entras y ya está.
              </p>
            </Nota>
          </Apartado>

          {/* ═══ Operación ═══════════════════════════════════════════════ */}
          {esPersonal ? (
            <>
              <Parte
                id="superadmin"
                etiqueta="Operación"
                titulo="Superadministrador"
                entradilla="El nivel del dueño del servicio, que da de alta academias y da soporte."
              />

              <div className="max-w-[68ch] space-y-3 pt-6">
                <Lista>
                  <Punto>
                    <strong>Alta de academias</strong> — nombre, identificador,
                    plan y el primer usuario administrador, que ya entra con todo
                    lo suyo montado.
                  </Punto>
                  <Punto>
                    <strong>Salud</strong> · <Ruta>/plataforma/salud</Ruta> — no
                    es un panel de números de uso: comprueba en caliente que las
                    protecciones están puestas. Que la conexión no se salta el
                    aislamiento, que las políticas están activas, que la clave de
                    cifrado existe y que no queda ningún número de cuenta sin
                    cifrar.
                  </Punto>
                  <Punto>
                    <strong>Soporte</strong> — se puede entrar en una academia
                    para ayudar. Mientras dura, en pantalla se ve un aviso y todo
                    lo que se hace queda registrado con quién estaba detrás.
                  </Punto>
                </Lista>
                <Regla>
                  <p>
                    <strong>
                      El superadministrador no ve el contenido ni los alumnos de
                      ninguna academia
                    </strong>{" "}
                    a menos que entre expresamente a dar soporte, y eso deja
                    rastro. Es la frontera que hace que una academia pueda confiar
                    sus datos al servicio.
                  </p>
                </Regla>
              </div>

              <Apartado id="rutina" titulo="Rutina y comandos">
                <Sub>Lo que va en el cron</Sub>
                <pre className="overflow-x-auto rounded-[var(--radius-control)] border border-line bg-surface-muted px-4 py-3 font-mono text-[0.8rem] leading-relaxed text-ink">
{`30 8 * * *   npm run radar          # el BOE, cada mañana
0  4 * * *   npm run mantenimiento  # limpieza + cierre de exámenes vencidos
30 3 * * *   npm run copia          # copia completa y por academia`}
                </pre>
                <P>
                  El mantenimiento no es higiene estética: borra sesiones caducadas
                  y enlaces de recuperación vencidos, y cierra los exámenes a los
                  que se les agotó el tiempo y nadie llegó a cerrar.
                </P>

                <Sub>Comprobar que todo está bien</Sub>
                <Tabla
                  cabeceras={["Comando", "Qué hace"]}
                  filas={[
                    [
                      <Comando key="a">npm run desplegar:comprobar</Comando>,
                      "Falla si falta algo obligatorio para producción.",
                    ],
                    [
                      <Comando key="b">npm run auditoria</Comando>,
                      "Comprobaciones del código y contra el servidor en marcha.",
                    ],
                    [
                      <Comando key="c">npm run pentest</Comando>,
                      "Batería de ataques reales contra el servicio.",
                    ],
                    [
                      <Comando key="d">npm run rls:probar</Comando>,
                      "Que el aislamiento protege aunque la primera barrera falle.",
                    ],
                    [
                      <Comando key="e">npm run ia:fuga</Comando>,
                      "Que la IA no deja escapar temario no contratado.",
                    ],
                    [
                      <Comando key="f">npm run copia:restaurar</Comando>,
                      <>
                        Restaurar una copia. <strong>Hazlo cada pocos meses</strong>
                        : es lo único que convierte un archivo en una copia de
                        seguridad.
                      </>,
                    ],
                  ]}
                />
                <Nota>
                  <p>
                    <strong>Antes de meter datos reales</strong>,{" "}
                    <Comando>npm run desplegar:comprobar</Comando> tiene que
                    terminar en verde, y hay que borrar la academia de
                    demostración: sus contraseñas están escritas en el README.
                  </p>
                </Nota>
              </Apartado>

              <Apartado id="si-algo-falla" titulo="Si algo falla">
                <Sub>«La IA dice que no encuentra información»</Sub>
                <P>
                  Casi siempre falta indexar: <Ruta>/gestion/ia</Ruta> →{" "}
                  <strong>Indexar material</strong>. Si ya está indexado,
                  comprueba que ese tema tenga la IA activada, esté abierto para
                  ese grupo y lo tenga contratado ese alumno.
                </P>

                <Sub>«Un alumno no ve un tema»</Sub>
                <P>
                  Tres cosas, en este orden: ¿está publicado?, ¿lo has abierto
                  para su grupo en el ritmo?, ¿su matrícula cubre esa rama?
                </P>

                <Sub>«No puede descargar»</Sub>
                <P>
                  Ver y descargar son permisos distintos a propósito. Hace falta
                  que la rama esté marcada como descargable <em>y</em> que su
                  curso incluya el derecho de descarga.
                </P>

                <Sub>«Se ha ido la luz en mitad de un examen»</Sub>
                <P>
                  No se pierde nada. Lo escrito está guardado en el servidor y el
                  examen se cierra solo con lo último guardado. Te aparecerá en la
                  lista de corregir.
                </P>

                <Sub>«Un alumno no puede entrar desde su móvil nuevo»</Sub>
                <P>
                  Puede haber llegado al límite de dispositivos. Al entrar, se
                  cierra la sesión más antigua automáticamente; también puede
                  cerrarlas él desde su Perfil.
                </P>
              </Apartado>
            </>
          ) : null}

          <footer className="mt-20 border-t border-line pt-6 text-sm text-ink-muted">
            <p className="max-w-[68ch] leading-relaxed">
              Las direcciones entre <Ruta>/barras</Ruta> son pantallas de este
              mismo sistema: puedes escribirlas detrás de la dirección de tu
              academia.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
