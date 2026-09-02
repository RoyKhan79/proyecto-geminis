import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import {
  Apartado,
  AvisoPlantilla,
  Hueco,
  LegalPage,
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Condiciones de uso",
  description:
    "Qué se puede y qué no se puede hacer en Proyecto Geminis, y de quién es cada cosa.",
};

/**
 * Condiciones de uso.
 *
 * Dos cosas hay que dejar claras aquí porque son las que generan conflictos
 * reales en este negocio: que el temario es de la academia y compartirlo tiene
 * consecuencias, y que el software no promete que nadie apruebe.
 */
export default function CondicionesPage() {
  return (
    <LegalPage titulo="Condiciones de uso" actualizado="agosto de 2026">
      <AvisoPlantilla />

      <p>
        Estas condiciones regulan el uso de {BRAND.name}. Al entrar con tus
        credenciales las aceptas. Si no estás de acuerdo con algo, no uses el
        servicio y díselo a tu academia.
      </p>

      <Apartado numero="1" titulo="Qué es esto y quién es quién">
        <p>
          {BRAND.name} es una plataforma de gestión académica y campus virtual
          para academias de oposiciones. Tiene dos aplicaciones: {BRAND.manager},
          para el equipo de la academia, y {BRAND.campus}, para el alumnado.
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong className="text-ink">El titular del software</strong> es{" "}
            <Hueco>razón social</Hueco>, NIF <Hueco>NIF</Hueco>, con domicilio en{" "}
            <Hueco>domicilio</Hueco> y correo{" "}
            <Hueco>correo de contacto</Hueco>. Proporciona la herramienta.
          </li>
          <li>
            <strong className="text-ink">Tu academia</strong> es quien presta el
            servicio de formación, quien sube el temario, quien decide qué ves y
            quien te cobra. La relación formativa es con ella.
          </li>
        </ul>
        <p>
          Dicho de otro modo: si tienes una duda sobre el temario, sobre tu
          matrícula o sobre un pago, es cosa de tu academia. Si algo del software
          no funciona, tu academia lo traslada al titular.
        </p>
      </Apartado>

      <Apartado numero="2" titulo="Tu cuenta">
        <ul className="ml-5 list-disc space-y-2">
          <li>
            Tu cuenta es <strong className="text-ink">personal e
            intransferible</strong>. Eres responsable de lo que se haga con ella.
          </li>
          <li>
            No compartas tu contraseña.{" "}
            <strong className="text-ink">
              El sistema registra desde qué dispositivos entras
            </strong>
            , y el uso simultáneo desde varios sitios es motivo suficiente para
            que tu academia suspenda el acceso.
          </li>
          <li>
            Si crees que alguien ha entrado en tu cuenta, avisa cuanto antes. Tu
            academia puede cerrar todas las sesiones al instante.
          </li>
        </ul>
      </Apartado>

      <Apartado numero="3" titulo="El material es de tu academia">
        <p>
          Este es el apartado importante y por eso está escrito sin rodeos.
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            El temario, los esquemas, las preguntas, las clases grabadas y
            cualquier otro material son{" "}
            <strong className="text-ink">
              propiedad de tu academia o de sus autores
            </strong>
            . Tener acceso no es tener licencia para redistribuirlo.
          </li>
          <li>
            Se te concede un derecho de uso{" "}
            <strong className="text-ink">
              personal, limitado a tu preparación y mientras dure tu matrícula
            </strong>
            .
          </li>
          <li>
            No puedes copiarlo, revenderlo, subirlo a grupos de mensajería, a
            redes, a repositorios ni compartirlo con quien no esté matriculado.
            Tampoco grabar las clases en directo.
          </li>
          <li>
            Los documentos pueden llevar{" "}
            <strong className="text-ink">
              marca de agua con tus datos identificativos
            </strong>
            , precisamente para poder rastrear una filtración. Es una medida
            disuasoria y funciona.
          </li>
          <li>
            La difusión no autorizada puede suponer la baja inmediata sin
            devolución del importe, además de las responsabilidades civiles y
            penales que correspondan.
          </li>
        </ul>
        <p>
          El software y su código son propiedad de su titular. Estas condiciones
          no te ceden ningún derecho sobre ellos.
        </p>
      </Apartado>

      <Apartado numero="4" titulo="Qué ves y qué no">
        <p>
          Lo que puedes ver depende de dos cosas, y las dos las decide tu
          academia:
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong className="text-ink">Lo que tengas contratado.</strong> Hay
            distintos planes: solo temario, solo clases, temario y tests, curso
            completo. Tu profesor puede además ajustar tu acceso de forma
            individual.
          </li>
          <li>
            <strong className="text-ink">El ritmo que marque el profesor.</strong>{" "}
            Aunque el temario esté subido entero, solo verás los temas que se
            hayan abierto para tu grupo. No es un fallo: es la forma de trabajo
            que ha elegido tu academia.
          </li>
        </ul>
        <p>
          Si crees que deberías ver algo que no ves, es una conversación con tu
          academia.
        </p>
      </Apartado>

      <Apartado numero="5" titulo="Cómo comportarse con los demás">
        <p>
          El muro, el espacio de clase y los mensajes son herramientas de
          estudio. En ellos:
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            No se insulta, no se acosa ni se discrimina. Ni en broma ni en
            privado.
          </li>
          <li>No se publica publicidad ni contenido ajeno al curso.</li>
          <li>
            No se comparte material de la academia con quien no esté matriculado,
            ni material de otras academias sin permiso de su autor.
          </li>
          <li>
            No se sube contenido ilegal, ni datos personales de terceros sin su
            consentimiento.
          </li>
        </ul>
        <p>
          Tu academia modera estos espacios y puede retirar publicaciones y
          suspender el acceso. Lo que publicas queda registrado con tu nombre y
          la fecha.
        </p>
      </Apartado>

      <Apartado numero="6" titulo="Qué hace el asistente y qué no">
        <ul className="ml-5 list-disc space-y-2">
          <li>
            Responde únicamente con el material de tu academia y cita de dónde
            saca cada cosa, para que puedas comprobarlo.
          </li>
          <li>
            <strong className="text-ink">Puede equivocarse.</strong> Si su
            respuesta no coincide con lo que ha dicho tu preparador, hazle caso a
            tu preparador. En una oposición, una respuesta plausible y falsa
            cuesta una plaza.
          </li>
          <li>
            No es un servicio de asesoramiento jurídico ni sustituye a la
            normativa oficial. Comprueba siempre en el boletín oficial lo que sea
            determinante.
          </li>
          <li>
            No lo uses para generar contenido ajeno a tu preparación ni para
            intentar extraer material que no tengas contratado.
          </li>
        </ul>
      </Apartado>

      <Apartado numero="7" titulo="Disponibilidad del servicio">
        <p>
          Se procura que el servicio esté disponible de forma continuada, pero no
          se garantiza que no vaya a interrumpirse nunca. Habrá paradas
          programadas para mantenimiento, que se avisan con antelación cuando es
          posible, y puede haber caídas por causas ajenas —proveedor de
          alojamiento, red, fuerza mayor—.
        </p>
        <p>
          Compromiso de disponibilidad acordado con la academia:{" "}
          <Hueco>SLA, si lo hay</Hueco>.
        </p>
        <p>
          Guarda copia de lo que sea importante para ti. El servicio hace copias
          de seguridad, pero no es un archivo personal.
        </p>
      </Apartado>

      <Apartado numero="8" titulo="Lo que no se promete">
        <p>
          Ningún software aprueba una oposición.{" "}
          {BRAND.name} organiza el estudio, mide el progreso y avisa de lo que
          cambia; el resultado del examen depende de muchas cosas que no están
          aquí dentro. No se ofrece ninguna garantía de aprobado, de plaza ni de
          nota.
        </p>
        <p>
          Tampoco se garantiza que el contenido del temario esté actualizado: eso
          es responsabilidad de tu academia. El radar de boletines y las alertas
          de cambio normativo son{" "}
          <strong className="text-ink">ayudas para que lo detecte antes</strong>,
          no una certificación de que todo esté al día.
        </p>
      </Apartado>

      <Apartado numero="9" titulo="Pagos y bajas">
        <p>
          Los precios, las formas de pago, las renovaciones y las devoluciones
          los fija tu academia en el contrato que tengas con ella. El impago
          puede suspender tu acceso.
        </p>
        <p>
          Al causar baja, tu cuenta se desactiva y dejas de tener acceso al
          material. Puedes pedir tus datos personales antes o después, en los
          términos de la{" "}
          <a href="/privacidad" className="text-accent underline-offset-2 hover:underline">
            política de privacidad
          </a>
          .
        </p>
      </Apartado>

      <Apartado numero="10" titulo="Suspensión del acceso">
        <p>
          Tu academia puede suspender o cancelar tu acceso si incumples estas
          condiciones, especialmente en caso de difusión del material o de uso
          compartido de la cuenta. Cuando sea posible, se avisa antes; cuando el
          incumplimiento sea grave, la suspensión puede ser inmediata.
        </p>
      </Apartado>

      <Apartado numero="11" titulo="Cambios y ley aplicable">
        <p>
          Estas condiciones pueden cambiar. Si el cambio es relevante, se avisa
          dentro de la aplicación con antelación suficiente para que puedas
          decidir si sigues usando el servicio.
        </p>
        <p>
          Se aplica la legislación española. Para cualquier controversia, las
          partes se someten a los juzgados y tribunales de{" "}
          <Hueco>localidad</Hueco>, salvo que la normativa de consumo determine
          otro fuero, en cuyo caso prevalece esta.
        </p>
        <p>
          Si eres consumidor, puedes acudir a la plataforma europea de resolución
          de litigios en línea.
        </p>
      </Apartado>
    </LegalPage>
  );
}

/**
 * Se renderiza en cada petición aunque su contenido no cambie.
 *
 * No es un capricho: la cabecera de seguridad del contenido lleva un testigo
 * distinto por petición (`src/proxy.ts`), y Next solo puede ponérselo a los
 * scripts de una página que se genere al pedirla. Una página prerenderizada se
 * escribió durante la compilación, cuando ese testigo todavía no existía, así
 * que sus scripts llegarían sin él y el navegador los bloquearía.
 *
 * El coste de generar una página de texto en cada visita es despreciable; el de
 * dejar `unsafe-inline` puesto para que estas cuatro siguieran siendo
 * estáticas, no.
 */
export const dynamic = "force-dynamic";
