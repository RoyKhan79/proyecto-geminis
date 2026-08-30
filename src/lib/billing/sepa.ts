import { limpiarParaSepa, normalizarIban } from "./iban";

/**
 * FICHERO DE ADEUDOS SEPA · pain.008.001.02
 *
 * Esto es lo que la academia descarga y sube a la banca electrónica de su
 * banco para que se pasen los recibos del mes. Es el formato que usan todos los
 * bancos españoles para las domiciliaciones (Cuaderno 19-14 de la AEB en su
 * versión XML).
 *
 * Conviene ser exacto con lo que hace Geminis aquí:
 *
 *   · **Geminis no cobra.** Genera el fichero. El cargo lo hace el banco.
 *     Mover dinero exigiría ser entidad de pago y estar autorizado por el Banco
 *     de España, y no lo somos.
 *   · La academia necesita tener firmado un **contrato de adeudos** con su
 *     banco y un **identificador de acreedor** (en España empieza por ES).
 *   · Cada alumno domiciliado tiene que haber firmado su **mandato**. Sin él,
 *     el recibo se puede devolver hasta trece meses después.
 *
 * Detalles de la norma que cuestan un rechazo si se olvidan:
 *
 *   · Los primeros cobros de un mandato van como `FRST` y los siguientes como
 *     `RCUR`. Mezclarlos en el mismo lote no está permitido: se generan dos
 *     lotes cuando hace falta.
 *   · Los importes van en euros con dos decimales, no en céntimos.
 *   · Nada de acentos ni de eñes en ningún texto.
 *   · La fecha de cobro tiene que dar margen al banco. Se avisa en la interfaz.
 */

export type AdeudoSepa = {
  /// Identificador único del adeudo dentro del fichero.
  id: string;
  /// Nombre del titular de la cuenta, que no siempre es el alumno.
  deudor: string;
  iban: string;
  importeCents: number;
  concepto: string;
  mandatoRef: string;
  mandatoFecha: Date;
  /// true si es el primer cobro de ese mandato.
  primerCobro: boolean;
};

/**
 * Quién cobra: la academia, tal como la conoce el banco.
 *
 * El `identificadorAcreedor` no es el CIF: es el identificador SEPA que asigna
 * el banco, y sin él la remesa se rechaza entera.
 */
export type DatosAcreedor = {
  nombre: string;
  iban: string;
  /// Identificador de acreedor SEPA. En España empieza por ES.
  identificador: string;
};

/** El fichero de adeudos listo para subir al banco, con su resumen. */
export type FicheroSepa = {
  xml: string;
  nombreArchivo: string;
  totalCents: number;
  adeudos: number;
  lotes: number;
};

/** Escapa lo que no puede ir suelto dentro de un XML. */
function xml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Importe en euros con dos decimales, como exige la norma. */
function euros(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Fecha en formato aaaa-mm-dd, tomada del calendario local.
 *
 * NO se usa `toISOString()`, y esto no es una manía: en España, un `Date` del
 * 5 de septiembre a las 00:00 es el 4 de septiembre a las 22:00 en UTC, así que
 * `toISOString()` manda al banco el día anterior. Con una fecha de cobro eso
 * significa un adeudo rechazado por antelación insuficiente, o cobrado un día
 * antes de lo pactado con el alumno.
 */
function fecha(d: Date): string {
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/** Texto ya saneado y recortado a la longitud que admite el campo. */
function campo(texto: string, maximo: number): string {
  return xml(limpiarParaSepa(texto).slice(0, maximo));
}

/**
 * Genera el fichero.
 *
 * `ahora` se pasa como parámetro en lugar de leerlo dentro: así el fichero es
 * reproducible y se puede probar sin depender del reloj.
 */
export function generarFicheroAdeudos(params: {
  acreedor: DatosAcreedor;
  adeudos: AdeudoSepa[];
  /// Día en que se pide el cargo.
  fechaCobro: Date;
  /// Referencia del mensaje. Se usa el identificador de la remesa.
  referencia: string;
  ahora: Date;
}): FicheroSepa {
  const { acreedor, adeudos, fechaCobro, referencia, ahora } = params;

  if (adeudos.length === 0) {
    throw new Error("No hay adeudos que incluir en el fichero.");
  }

  // Primeros cobros y recurrentes van en lotes separados: el banco rechaza un
  // lote que mezcle los dos tipos.
  const primeros = adeudos.filter((a) => a.primerCobro);
  const recurrentes = adeudos.filter((a) => !a.primerCobro);
  const grupos = [
    { tipo: "FRST", items: primeros },
    { tipo: "RCUR", items: recurrentes },
  ].filter((g) => g.items.length > 0);

  const totalCents = adeudos.reduce((s, a) => s + a.importeCents, 0);
  const idMensaje = campo(`GEM${referencia}`, 35);

  const lotes = grupos
    .map((grupo, indice) => {
      const totalLote = grupo.items.reduce((s, a) => s + a.importeCents, 0);

      const transacciones = grupo.items
        .map(
          (adeudo) => `
      <DrctDbtTxInf>
        <PmtId><EndToEndId>${campo(adeudo.id, 35)}</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">${euros(adeudo.importeCents)}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${campo(adeudo.mandatoRef, 35)}</MndtId>
            <DtOfSgntr>${fecha(adeudo.mandatoFecha)}</DtOfSgntr>
            <AmdmntInd>false</AmdmntInd>
          </MndtRltdInf>
        </DrctDbtTx>
        <Dbtr><Nm>${campo(adeudo.deudor, 70)}</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>${xml(normalizarIban(adeudo.iban))}</IBAN></Id></DbtrAcct>
        <RmtInf><Ustrd>${campo(adeudo.concepto, 140)}</Ustrd></RmtInf>
      </DrctDbtTxInf>`,
        )
        .join("");

      return `
    <PmtInf>
      <PmtInfId>${campo(`${referencia}-${indice + 1}`, 35)}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>${grupo.items.length}</NbOfTxs>
      <CtrlSum>${euros(totalLote)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
        <LclInstrm><Cd>CORE</Cd></LclInstrm>
        <SeqTp>${grupo.tipo}</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${fecha(fechaCobro)}</ReqdColltnDt>
      <Cdtr><Nm>${campo(acreedor.nombre, 70)}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${xml(normalizarIban(acreedor.iban))}</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></CdtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <CdtrSchmeId>
        <Id>
          <PrvtId>
            <Othr>
              <Id>${campo(acreedor.identificador, 35)}</Id>
              <SchmeNm><Prtry>SEPA</Prtry></SchmeNm>
            </Othr>
          </PrvtId>
        </Id>
      </CdtrSchmeId>${transacciones}
    </PmtInf>`;
    })
    .join("");

  const documento = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${idMensaje}</MsgId>
      <CreDtTm>${ahora.toISOString().slice(0, 19)}</CreDtTm>
      <NbOfTxs>${adeudos.length}</NbOfTxs>
      <CtrlSum>${euros(totalCents)}</CtrlSum>
      <InitgPty><Nm>${campo(acreedor.nombre, 70)}</Nm></InitgPty>
    </GrpHdr>${lotes}
  </CstmrDrctDbtInitn>
</Document>
`;

  return {
    xml: documento,
    nombreArchivo: `remesa-${fecha(fechaCobro)}-${referencia}.xml`,
    totalCents,
    adeudos: adeudos.length,
    lotes: grupos.length,
  };
}

/**
 * Comprobaciones previas al envío.
 *
 * Se hacen aquí y se enseñan antes de generar nada, porque un fichero rechazado
 * por el banco no dice qué línea falla: dice que el fichero está mal.
 */
export function revisarAntesDeEnviar(params: {
  acreedor: Partial<DatosAcreedor>;
  fechaCobro: Date;
  hoy: Date;
}): string[] {
  const avisos: string[] = [];

  if (!params.acreedor.nombre?.trim()) {
    avisos.push("Falta el nombre fiscal de la academia.");
  }
  if (!params.acreedor.iban?.trim()) {
    avisos.push("Falta la cuenta de la academia donde ingresar los recibos.");
  }
  if (!params.acreedor.identificador?.trim()) {
    avisos.push(
      "Falta el identificador de acreedor SEPA. Te lo da tu banco al firmar el contrato de adeudos; en España empieza por ES.",
    );
  }

  const dias = Math.round(
    (params.fechaCobro.getTime() - params.hoy.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (dias < 2) {
    avisos.push(
      "La fecha de cobro está muy cerca. Los bancos suelen pedir dos días hábiles de margen para los adeudos CORE.",
    );
  }

  return avisos;
}
