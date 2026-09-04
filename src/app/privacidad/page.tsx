import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import {
  Apartado,
  AvisoPlantilla,
  Hueco,
  LegalPage,
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Qué datos trata Catedria, para qué, durante cuánto tiempo y qué derechos tienes.",
};

/**
 * Política de privacidad.
 *
 * Escrita a partir de lo que el software hace de verdad, no copiada de otra:
 * cada categoría de datos que se menciona aquí existe en el esquema, y cada
 * medida de seguridad que se afirma está implementada. Si algo se deja de
 * hacer, este texto hay que cambiarlo el mismo día.
 */
export default function PrivacidadPage() {
  return (
    <LegalPage titulo="Política de privacidad" actualizado="agosto de 2026">
      <AvisoPlantilla />

      <p>
        Este documento explica qué datos personales se tratan al usar{" "}
        {BRAND.name}, con qué finalidad, durante cuánto tiempo y qué puedes hacer
        al respecto. Está escrito para entenderse, no para cubrirse las espaldas.
      </p>

      <Apartado numero="1" titulo="Quién trata tus datos">
        <p>
          Hay dos figuras distintas y conviene no confundirlas, porque de eso
          depende a quién tienes que dirigirte:
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong className="text-ink">Tu academia es la responsable.</strong>{" "}
            Es quien decide qué datos recoge de ti, para qué y durante cuánto
            tiempo. Es a quien tienes que dirigirte para ejercer tus derechos.
            Sus datos de contacto están en tu contrato con ella y en su propia
            política de privacidad.
          </li>
          <li>
            <strong className="text-ink">
              El proveedor del software es encargado del tratamiento.
            </strong>{" "}
            Trata los datos únicamente por cuenta de tu academia y siguiendo sus
            instrucciones, conforme al artículo 28 del RGPD. Identificación:{" "}
            <Hueco>razón social</Hueco>, NIF <Hueco>NIF</Hueco>, domicilio{" "}
            <Hueco>domicilio</Hueco>, correo <Hueco>correo de contacto</Hueco>.
          </li>
        </ul>
        <p>
          Delegado de protección de datos, si lo hubiera:{" "}
          <Hueco>contacto del DPD</Hueco>.
        </p>
      </Apartado>

      <Apartado numero="2" titulo="Qué datos se tratan">
        <p>Estos y no otros:</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong className="text-ink">Identificación y contacto.</strong>{" "}
            Nombre, apellidos, correo electrónico y, si tu academia lo pide,
            teléfono y documento de identidad.
          </li>
          <li>
            <strong className="text-ink">Datos académicos.</strong> Matrículas,
            oposición y convocatoria, grupo, asistencia a clase, progreso por
            tema, respuestas a los tests, resultados y notas, entregas de tareas
            y las correcciones de tu preparador.
          </li>
          <li>
            <strong className="text-ink">Comunicaciones.</strong> Mensajes
            internos con tu academia, publicaciones en el muro y en los espacios
            de tu clase, y avisos enviados.
          </li>
          <li>
            <strong className="text-ink">Datos de pago.</strong> Importes,
            conceptos, fechas y estado de los recibos.{" "}
            <strong className="text-ink">
              No se almacenan números de tarjeta
            </strong>
            : cuando se cobre por pasarela, los datos de la tarjeta los trata
            directamente la entidad de pago.
          </li>
          <li>
            <strong className="text-ink">Datos técnicos de la sesión.</strong>{" "}
            Fecha y hora de acceso, dirección IP y tipo de dispositivo desde el
            que entras. Sirven para que tu academia pueda cerrar una sesión y
            para detectar cuentas compartidas.
          </li>
          <li>
            <strong className="text-ink">Registro de actividad.</strong> Quién
            hizo qué y cuándo sobre datos relevantes (altas, bajas, cambios de
            acceso, cobros). Es una garantía para ti tanto como para la academia.
          </li>
        </ul>
        <p>
          No se piden ni se tratan categorías especiales de datos —salud,
          ideología, religión, afiliación sindical—. Si tu academia necesitara
          alguna, por ejemplo para una adaptación por discapacidad, tendría que
          informarte por separado y recabar tu consentimiento.
        </p>
      </Apartado>

      <Apartado numero="3" titulo="Para qué y con qué base legal">
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong className="text-ink">
              Prestarte el servicio de formación
            </strong>{" "}
            —darte acceso al material contratado, a las clases, a los tests y al
            seguimiento—. Base legal: la ejecución del contrato entre tú y tu
            academia (art. 6.1.b RGPD).
          </li>
          <li>
            <strong className="text-ink">Gestionar cobros y facturación.</strong>{" "}
            Base legal: la ejecución del contrato y el cumplimiento de
            obligaciones legales, fiscales y contables (art. 6.1.b y 6.1.c).
          </li>
          <li>
            <strong className="text-ink">
              Avisarte de lo que afecta a tu preparación
            </strong>{" "}
            —convocatorias, cambios normativos que afectan a tus temas, clases,
            plazos de entrega—. Base legal: la ejecución del contrato.
          </li>
          <li>
            <strong className="text-ink">
              Detectar riesgo de abandono y ofrecerte ayuda.
            </strong>{" "}
            Base legal: el interés legítimo de tu academia en que apruebes (art.
            6.1.f). Se calcula con reglas explicables sobre tu actividad, no con
            un modelo automático, y{" "}
            <strong className="text-ink">
              no produce ninguna decisión automatizada con efectos jurídicos
            </strong>
            : es una señal para que una persona hable contigo.
          </li>
          <li>
            <strong className="text-ink">Seguridad y trazabilidad.</strong> Base
            legal: interés legítimo en proteger las cuentas y el material.
          </li>
          <li>
            <strong className="text-ink">Comunicaciones comerciales</strong> de
            otros cursos, solo si las has aceptado. Base legal: tu consentimiento
            (art. 6.1.a), revocable en cualquier momento.
          </li>
        </ul>
      </Apartado>

      <Apartado numero="4" titulo="La inteligencia artificial">
        <p>
          {BRAND.name} incluye un asistente. Conviene ser muy claro con esto:
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            El asistente responde{" "}
            <strong className="text-ink">
              únicamente con el material de tu academia
            </strong>{" "}
            y solo con la parte que tú tienes contratada y que tu profesor ha
            abierto. La comprobación de permisos se hace{" "}
            <strong className="text-ink">antes</strong> de buscar, no después.
          </li>
          <li>
            El material de una academia{" "}
            <strong className="text-ink">
              nunca se usa para responder a otra
            </strong>{" "}
            ni para entrenar ningún modelo.
          </li>
          <li>
            En su configuración por defecto, el asistente funciona con un motor
            propio dentro del servidor y{" "}
            <strong className="text-ink">no envía nada a terceros</strong>.
          </li>
          <li>
            Si tu academia activa un proveedor externo de inteligencia
            artificial, se le envían los fragmentos de material necesarios para
            responder a cada pregunta y el texto de la pregunta. Proveedor
            configurado: <Hueco>proveedor, si lo hay</Hueco>. Tu academia debe
            informarte de ello y tener firmado el correspondiente contrato de
            encargo.
          </li>
          <li>
            Las conversaciones con el asistente se guardan con sus fuentes, para
            que puedan comprobarse.
          </li>
          <li>
            Lo que genera la inteligencia artificial{" "}
            <strong className="text-ink">nunca se publica solo</strong>: siempre
            lo aprueba antes una persona de tu academia.
          </li>
        </ul>
      </Apartado>

      <Apartado numero="5" titulo="Quién más ve tus datos">
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong className="text-ink">El personal de tu academia</strong>,
            según su función. Un profesor ve el progreso de sus grupos; la
            secretaría ve los cobros; la dirección ve el conjunto.
          </li>
          <li>
            <strong className="text-ink">
              El resto de alumnado de tu clase
            </strong>{" "}
            ve tu nombre y lo que tú publiques en el muro o en el espacio de la
            clase. Tus notas, tus tests y tus mensajes al profesor{" "}
            <strong className="text-ink">no los ve nadie más</strong>.
          </li>
          <li>
            <strong className="text-ink">Proveedores técnicos</strong> —alojamiento,
            correo, copias de seguridad y, si está activada, inteligencia
            artificial—, todos con contrato de encargo del tratamiento. Listado:{" "}
            <Hueco>proveedores</Hueco>.
          </li>
          <li>
            <strong className="text-ink">Administraciones y juzgados</strong>,
            cuando exista obligación legal.
          </li>
        </ul>
        <p>
          <strong className="text-ink">
            Ninguna academia puede ver los datos de otra.
          </strong>{" "}
          El aislamiento entre academias está implementado en la propia capa de
          acceso a los datos y se comprueba con pruebas automáticas en cada
          cambio del software.
        </p>
        <p>
          Transferencias internacionales: <Hueco>indicar si las hay</Hueco>. Si
          existen, se realizan con las garantías del capítulo V del RGPD.
        </p>
      </Apartado>

      <Apartado numero="6" titulo="Cuánto tiempo se conservan">
        <ul className="ml-5 list-disc space-y-2">
          <li>
            Mientras dure tu relación con la academia, y después bloqueados
            durante los plazos de prescripción de las acciones derivadas del
            contrato.
          </li>
          <li>
            Los datos de facturación, el tiempo que exija la normativa fiscal y
            contable —con carácter general, seis años—.
          </li>
          <li>
            Las sesiones caducan solas; el registro de actividad se conserva{" "}
            <Hueco>plazo</Hueco>.
          </li>
          <li>
            Si te das de baja, tu cuenta se desactiva y deja de ser accesible.
            Tus datos se eliminan o anonimizan cuando vencen los plazos
            anteriores.
          </li>
        </ul>
      </Apartado>

      <Apartado numero="7" titulo="Cookies">
        <p>
          {BRAND.name} usa{" "}
          <strong className="text-ink">
            una única cookie, estrictamente necesaria
          </strong>
          : la que mantiene tu sesión iniciada. No lleva datos personales, solo
          un identificador aleatorio; es <code>HttpOnly</code> y{" "}
          <code>SameSite</code>, y se envía cifrada.{" "}
          <strong className="text-ink">
            No hay cookies de publicidad, de seguimiento ni de terceros
          </strong>
          , por lo que no hace falta pedirte consentimiento para ellas: no
          existen. Si tu academia añadiera alguna herramienta de análisis,
          tendría que informarte y pedírtelo.
        </p>
      </Apartado>

      <Apartado numero="8" titulo="Cómo se protegen">
        <p>Estas son las medidas implementadas, no una lista de buenos deseos:</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            Las contraseñas se guardan cifradas con una función de derivación
            con coste de memoria. Nadie, tampoco el personal de tu academia,
            puede leer tu contraseña.
          </li>
          <li>
            Las sesiones se guardan en servidor y pueden revocarse al instante.
            En la base de datos solo hay un resumen criptográfico del testigo, no
            el testigo.
          </li>
          <li>
            El acceso al material está separado por permisos y por lo que tienes
            contratado. Cada descarga de un documento se comprueba en el momento.
          </li>
          <li>
            Las academias están aisladas entre sí en la capa de datos, con
            pruebas automáticas que lo verifican.
          </li>
          <li>
            Copias de seguridad periódicas, separadas por academia:{" "}
            <Hueco>periodicidad y retención</Hueco>.
          </li>
        </ul>
        <p>
          Ninguna medida elimina el riesgo por completo. Si se produjera una
          brecha de seguridad que suponga un riesgo para tus derechos, tu
          academia debe notificarlo a la Agencia Española de Protección de Datos
          en 72 horas y, si el riesgo es alto, comunicártelo a ti.
        </p>
      </Apartado>

      <Apartado numero="9" titulo="Tus derechos">
        <p>
          Puedes pedir <strong className="text-ink">acceso</strong> a tus datos,{" "}
          <strong className="text-ink">rectificación</strong> de los que sean
          inexactos, <strong className="text-ink">supresión</strong>,{" "}
          <strong className="text-ink">limitación</strong> del tratamiento,{" "}
          <strong className="text-ink">portabilidad</strong> en un formato
          legible por máquina y{" "}
          <strong className="text-ink">oposición</strong> a los tratamientos
          basados en interés legítimo. Si diste tu consentimiento para algo,
          puedes retirarlo cuando quieras sin que eso afecte a lo anterior.
        </p>
        <p>
          Escribe a tu academia. Debe responderte en el plazo de un mes. El
          software incluye la exportación completa de tus datos, de modo que
          atender una solicitud de acceso o de portabilidad no debería llevarle
          más de unos minutos.
        </p>
        <p>
          Si no te atienden o no estás conforme con la respuesta, puedes
          reclamar ante la{" "}
          <a
            href="https://www.aepd.es"
            className="text-accent underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer noopener"
          >
            Agencia Española de Protección de Datos
          </a>
          .
        </p>
      </Apartado>

      <Apartado numero="10" titulo="Menores de edad">
        <p>
          Si tienes menos de 14 años, hace falta el consentimiento de quien
          ostente tu patria potestad o tutela. Cada academia es responsable de
          recabarlo antes de darte de alta.
        </p>
      </Apartado>

      <Apartado numero="11" titulo="Cambios en esta política">
        <p>
          Si cambia algo relevante —una nueva finalidad, un nuevo proveedor, un
          cambio de plazos—, se actualiza este documento y se avisa dentro de la
          aplicación. La fecha de arriba es siempre la de la última versión.
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
