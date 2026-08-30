import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Une clases de Tailwind resolviendo los conflictos.
 *
 * @param inputs Clases sueltas, condicionales o listas, en cualquier mezcla.
 * @returns Una cadena de clases. Cuando dos afectan a lo mismo —`p-2` y
 *   `p-4`— gana la última, que es lo que permite que un componente reciba una
 *   clase por props y sobrescriba la suya sin pelearse con la especificidad.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Iniciales para el avatar de una persona.
 *
 * @param firstName Nombre.
 * @param lastName Apellido, si se sabe.
 * @returns Una o dos letras en mayúscula.
 */
export function initials(firstName: string, lastName?: string | null) {
  return `${firstName.charAt(0)}${lastName?.charAt(0) ?? ""}`.toUpperCase();
}

/**
 * Nombre completo para pintar.
 *
 * @param person Nombre y, opcionalmente, apellido.
 * @returns Los dos separados por un espacio, o solo el nombre. Sin espacio
 *   suelto al final cuando no hay apellido.
 */
export function fullName(person: { firstName: string; lastName?: string | null }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ");
}

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Fecha en formato español, para leer.
 *
 * @param value La fecha, o nada.
 * @returns `31/12/2026`, o `—` si no hay fecha. Devuelve la raya y no una
 *   cadena vacía a propósito: una celda vacía parece un fallo de carga.
 */
export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

/**
 * Fecha y hora en formato español.
 *
 * @param value La fecha, o nada.
 * @returns `31 dic 2026, 18:00`, o `—` si no hay.
 */
export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return dateTimeFormatter.format(new Date(value));
}

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

/** Los importes se guardan en céntimos para no perder precisión. */
/**
 * Fecha para un `<input type="date">`.
 *
 * NO se usa `toISOString()`. En España, un `Date` del 5 de septiembre a las
 * 00:00 es el 4 de septiembre a las 22:00 en UTC: el formulario mostraría el
 * día anterior y, al guardar, la fecha retrocedería un día en cada edición. Es
 * un fallo que se acumula sin que nadie lo note hasta que la fecha del examen
 * está una semana antes de lo que debería.
 *
 * @param value La fecha, o nada.
 * @returns `AAAA-MM-DD` en hora **local**, o cadena vacía si no hay fecha o no
 *   es válida. Vacía y no `—` porque esto va dentro de un campo de formulario.
 */
export function fechaParaInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const fecha = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(fecha.getTime())) return "";

  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/**
 * Importe en euros a partir de céntimos.
 *
 * Los importes se guardan en céntimos, como enteros, porque un `float` no
 * puede representar 0,10 € exactamente y los errores se acumulan al sumar una
 * remesa de doscientos recibos.
 *
 * @param cents El importe en céntimos.
 * @returns `69,00 €`, o `—` si no hay importe.
 */
export function formatCents(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "—";
  return currencyFormatter.format(cents / 100);
}

/**
 * Convierte un texto en un identificador apto para una dirección.
 *
 * @param input El texto, con acentos, eñes y lo que traiga.
 * @returns Minúsculas, sin acentos, con guiones en lugar de todo lo demás y un
 *   máximo de 60 caracteres. Sin guiones sueltos al principio ni al final.
 */
export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
