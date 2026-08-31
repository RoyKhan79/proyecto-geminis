import { sendEmail } from "@/lib/email";
import { prismaBase } from "@/lib/db/client";
import { formatDate } from "@/lib/utils";
import { env } from "@/lib/env";

/**
 * LA FACTURA QUE LE LLEGA AL ALUMNO
 *
 * Lo que se manda no es «adjunto factura»: es el importe, el concepto y —sobre
 * todo— qué tiene que hacer para pagarla. Una factura domiciliada y una que hay
 * que transferir piden cosas distintas de quien la recibe, y mandar el mismo
 * texto a las dos genera la llamada que este correo venía a evitar: la de
 * quien va a transferir un recibo que ya le van a cobrar del banco.
 *
 * El detalle completo va en el cuerpo y no en un adjunto. Generar un PDF en el
 * servidor es otra pieza —y otra dependencia— y sin ella el correo ya cumple:
 * la factura formal se imprime desde la ficha, que es lo que se hace cuando
 * alguien la pide en papel.
 */

/** El enlace público donde el alumno paga su recibo con tarjeta. */
export function enlaceDePago(paymentId: string): string {
  return `${(env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/pagar/${paymentId}`;
}

const euros = (centimos: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    centimos / 100,
  );

/** Enmascara el IBAN: en un correo no se escriben veinticuatro dígitos enteros. */
function ibanCorto(iban: string | null | undefined) {
  if (!iban) return null;
  const limpio = iban.replace(/\s+/g, "");
  if (limpio.length < 8) return null;
  return `${limpio.slice(0, 4)} **** **** ${limpio.slice(-4)}`;
}

/**
 * Qué hay que hacer para pagar esta factura, en una o dos frases.
 *
 * Es la parte del correo que evita trabajo: si está domiciliada, que no haga
 * nada; si es transferencia, el número de cuenta y el concepto; si es efectivo
 * o tarjeta, que pase por la academia.
 */
export function instruccionesDePago(datos: {
  metodo: string | null | undefined;
  diaDeCobro?: number | null;
  ibanDelAlumno?: string | null;
  ibanDeLaAcademia?: string | null;
  referencia: string | null;
  nombreAcademia: string;
  /// Enlace para pagar con tarjeta, si la academia tiene el cobro montado. Sin
  /// él, se le dice que pase por la academia.
  enlaceDePago?: string | null;
}): { titulo: string; cuerpo: string } {
  const cuenta = ibanCorto(datos.ibanDelAlumno);

  switch (datos.metodo) {
    case "SEPA_DIRECT_DEBIT":
      return {
        titulo: "Domiciliado · no tienes que hacer nada",
        cuerpo: [
          cuenta
            ? `Se cargará en tu cuenta ${cuenta}`
            : "Se cargará en la cuenta que nos diste",
          datos.diaDeCobro ? ` alrededor del día ${datos.diaDeCobro}.` : ".",
          " Si en ese momento no hubiera fondos, el banco lo devuelve y te avisamos.",
        ].join(""),
      };

    case "TRANSFER": {
      const iban = datos.ibanDeLaAcademia?.replace(/\s+/g, "");
      return {
        titulo: "Por transferencia",
        cuerpo: iban
          ? `Transfiere el importe a ${iban} (${datos.nombreAcademia})${
              datos.referencia ? `, indicando «${datos.referencia}» como concepto` : ""
            }. Así lo identificamos sin tener que preguntarte.`
          : `Escríbenos y te pasamos el número de cuenta${
              datos.referencia ? `. El concepto es «${datos.referencia}»` : ""
            }.`,
      };
    }

    case "CASH":
      return {
        titulo: "En efectivo",
        cuerpo: `Puedes pagarlo en ${datos.nombreAcademia} en horario de secretaría.`,
      };

    case "CARD":
      return {
        titulo: "Con tarjeta",
        cuerpo: datos.enlaceDePago
          ? `Puedes pagarlo ahora mismo desde aquí: ${datos.enlaceDePago}`
          : `Puedes pagarlo con tarjeta en ${datos.nombreAcademia}, o llamarnos y lo hacemos por teléfono.`,
      };

    default:
      return {
        titulo: "Forma de pago",
        cuerpo:
          "Si tienes cualquier duda sobre cómo pagarla, contesta a este correo y te decimos.",
      };
  }
}

/** Escapa lo que va dentro del HTML: los nombres llevan comillas y ampersands. */
function escapar(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type FacturaParaCorreo = {
  reference: string | null;
  issuedOn: Date | null;
  customerName: string;
  customerEmail: string | null;
  totalCents: number;
  taxCents: number;
  taxableCents: number;
  exemptionNote: string | null;
  issuerName: string;
  issuerEmail: string | null;
  lines: { description: string; totalCents: number }[];
};

/** Compone el correo. Separado del envío para poder probarlo sin mandar nada. */
export function componerCorreoDeFactura(
  factura: FacturaParaCorreo,
  pago: { titulo: string; cuerpo: string },
) {
  const referencia = factura.reference ?? "sin número";
  const fecha = factura.issuedOn ? formatDate(factura.issuedOn) : "";
  const total = euros(factura.totalCents);

  const conceptos = factura.lines
    .map((l) => `  · ${l.description} — ${euros(l.totalCents)}`)
    .join("\n");

  const text = [
    `Hola ${factura.customerName.split(" ")[0] ?? ""},`.trim(),
    "",
    `Te adjuntamos los datos de la factura ${referencia}${fecha ? ` del ${fecha}` : ""}.`,
    "",
    conceptos,
    "",
    `TOTAL: ${total}`,
    factura.taxCents === 0 && factura.exemptionNote ? factura.exemptionNote : "",
    "",
    `${pago.titulo.toUpperCase()}`,
    pago.cuerpo,
    "",
    `Si algún dato de la factura no es correcto —el NIF, por ejemplo— dínoslo y te emitimos una rectificativa.`,
    "",
    factura.issuerName,
  ]
    .filter((linea) => linea !== null)
    .join("\n");

  const filas = factura.lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 0;color:#333">${escapar(l.description)}</td>` +
        `<td style="padding:6px 0;text-align:right;color:#333;white-space:nowrap">${euros(l.totalCents)}</td></tr>`,
    )
    .join("");

  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px">
  <p>Hola ${escapar(factura.customerName.split(" ")[0] ?? "")},</p>
  <p>Estos son los datos de la factura <strong>${escapar(referencia)}</strong>${fecha ? ` del ${fecha}` : ""}.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    ${filas}
    <tr><td style="padding:10px 0 0;border-top:1px solid #ddd;font-weight:600">Total</td>
        <td style="padding:10px 0 0;border-top:1px solid #ddd;text-align:right;font-weight:600;white-space:nowrap">${total}</td></tr>
  </table>
  ${
    factura.taxCents === 0 && factura.exemptionNote
      ? `<p style="font-size:13px;color:#666">${escapar(factura.exemptionNote)}</p>`
      : ""
  }
  <div style="background:#f4f6fb;border-radius:10px;padding:14px 16px;margin:20px 0">
    <p style="margin:0 0 4px;font-weight:600">${escapar(pago.titulo)}</p>
    <p style="margin:0;color:#333">${escapar(pago.cuerpo)}</p>
  </div>
  <p style="font-size:13px;color:#666">Si algún dato de la factura no es correcto —el NIF, por ejemplo— dínoslo y te emitimos una rectificativa.</p>
  <p style="margin-top:24px">${escapar(factura.issuerName)}</p>
</div>`;

  return {
    subject: `Factura ${referencia} · ${factura.issuerName}`,
    text,
    html,
  };
}

/**
 * Manda una factura a su cliente y deja constancia de que salió.
 *
 * @returns Si se envió, y si no, por qué. **No lanza**: se usa dentro de un
 *   bucle que factura a media academia, y que un alumno no tenga correo no
 *   puede tumbar el envío de los demás ni deshacer lo ya facturado.
 */
export async function enviarFacturaAlCliente(
  academyId: string,
  invoiceId: string,
): Promise<{ enviada: boolean; motivo?: string; destino?: string }> {
  const factura = await prismaBase.invoice.findFirst({
    where: { id: invoiceId, academyId },
    select: {
      id: true,
      reference: true,
      issuedOn: true,
      status: true,
      customerName: true,
      customerEmail: true,
      totalCents: true,
      taxCents: true,
      taxableCents: true,
      exemptionNote: true,
      issuerName: true,
      issuerEmail: true,
      studentId: true,
      paymentId: true,
      lines: {
        orderBy: { position: "asc" },
        select: { description: true, totalCents: true },
      },
      student: {
        select: {
          user: { select: { email: true } },
          billingProfile: {
            select: { method: true, chargeDay: true, iban: true },
          },
        },
      },
      academy: { select: { name: true, legalName: true, billingIban: true } },
    },
  });

  if (!factura) return { enviada: false, motivo: "La factura no existe." };
  if (factura.status === "DRAFT") {
    return { enviada: false, motivo: "Un borrador no se manda: primero se emite." };
  }

  const destino = factura.customerEmail ?? factura.student.user.email;
  if (!destino) {
    return { enviada: false, motivo: `${factura.customerName} no tiene correo.` };
  }

  const pago = instruccionesDePago({
    metodo: factura.student.billingProfile?.method,
    diaDeCobro: factura.student.billingProfile?.chargeDay,
    ibanDelAlumno: factura.student.billingProfile?.iban,
    ibanDeLaAcademia: factura.academy.billingIban,
    referencia: factura.reference,
    nombreAcademia: factura.academy.legalName ?? factura.academy.name,
    enlaceDePago: factura.paymentId ? enlaceDePago(factura.paymentId) : null,
  });

  const correo = componerCorreoDeFactura(factura, pago);
  const salio = await sendEmail({
    to: destino,
    replyTo: factura.issuerEmail ?? undefined,
    ...correo,
  });

  if (!salio) {
    return { enviada: false, motivo: "El servidor de correo no lo aceptó.", destino };
  }

  await prismaBase.invoice.update({
    where: { id: factura.id },
    data: { sentAt: new Date(), sentTo: destino },
  });

  return { enviada: true, destino };
}
