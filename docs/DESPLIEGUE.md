# Poner Catedria en producción

Esta guía cubre lo que **no se puede resolver desde el código**: el cifrado del
disco, las copias programadas y el resto de la configuración del servidor. Es
justo lo que quedaba abierto en la auditoría.

No hay que fiarse de haberla leído. Al final hay un comando que comprueba lo que
se puede comprobar y **falla si falta algo**:

```bash
npm run desplegar:comprobar
```

Mientras diga que faltan requisitos obligatorios, no pongas datos reales de
alumnos. No es una recomendación: son datos personales de menores en algunos
casos, y bancarios en otros.

---

## 1 · La base de datos

Catedria necesita PostgreSQL 15 o superior. Sirve cualquiera; lo que cambia es
quién se encarga del cifrado del disco.

### Con un servicio gestionado (lo recomendable)

RDS, Cloud SQL, Supabase, Neon y similares **cifran el disco por defecto**. No
hay que hacer nada más que comprobarlo en su panel y anotarlo:

```bash
DISK_ENCRYPTION_CONFIRMED=1
```

### En una máquina propia

El cifrado hay que ponerlo tú, y va en el **volumen**, no en PostgreSQL:

- **Linux** · LUKS sobre la partición donde vive `PGDATA`:
  ```bash
  cryptsetup luksFormat /dev/sdX
  cryptsetup open /dev/sdX datos
  mkfs.ext4 /dev/mapper/datos
  mount /dev/mapper/datos /var/lib/postgresql
  ```
- **macOS** · FileVault. **Windows** · BitLocker.

PostgreSQL no cifra el disco por su cuenta: eso es una confusión frecuente.
`pgcrypto` cifra *columnas*, que es lo que Catedria ya hace por su cuenta con los
números de cuenta.

### Los dos roles

La aplicación **no** se conecta con el dueño de las tablas. Esto no es un
detalle: fue el hallazgo H-04, una protección activada que no protegía nada
porque el rol se la saltaba.

```bash
# La aplicación: sin superusuario, sin BYPASSRLS, no es dueña de nada
DATABASE_URL="postgresql://geminis_app:CONTRASEÑA@servidor:5432/geminis?sslmode=require"

# El dueño: SOLO para migraciones y semillas
DATABASE_URL_OWNER="postgresql://geminis:CONTRASEÑA@servidor:5432/geminis?sslmode=require"
```

El rol `geminis_app` lo crea la migración `20260811003000`. Ponle contraseña:

```sql
ALTER ROLE geminis_app WITH PASSWORD 'una contraseña larga y aleatoria';
```

`sslmode=require` no es opcional en producción: sin él, las consultas viajan en
claro entre la aplicación y la base.

---

## 2 · Los archivos

Los PDF del temario viven en el almacén, no en la base. Ahí el cifrado también
es del proveedor:

- **S3** · activa `SSE-S3` (basta) o `SSE-KMS` (si necesitas rotar claves y
  trazabilidad de accesos a la clave).
- **Disco propio** · el mismo volumen cifrado del punto anterior.

```bash
STORAGE_ENCRYPTION_CONFIRMED=1
```

**Los archivos también tienen dos barreras.** El control de acceso vive en
`/api/archivos/[fileId]`, y por debajo hay una comprobación independiente: la
clave de todo objeto empieza por `academies/<id de la academia>/`, y antes de
devolver un solo byte se comprueba que esa academia es la de quien pide. Si un
fallo en la consulta trajera un archivo de otra academia, ahí se para.

Lo que **no** cubre esa segunda barrera es el almacén en sí: quien tenga las
credenciales del bucket ve todo lo que hay dentro. Por eso el bucket **no debe
ser público bajo ningún concepto**. Compruébalo:

```bash
aws s3api get-public-access-block --bucket TU-BUCKET
# BlockPublicAcls, IgnorePublicAcls, BlockPublicPolicy y RestrictPublicBuckets: true
```

---

## 3 · Las claves

```bash
# Cifra los números de cuenta en la base. Si se pierde, esos datos no se
# recuperan; si se filtra, el cifrado deja de servir.
FIELD_ENCRYPTION_KEY="$(openssl rand -base64 48)"
```

Guárdala donde guardes el resto de secretos (el gestor de tu proveedor, Vault,
lo que uses), **no en el repositorio**. Y haz una copia aparte: sin ella, los
IBAN guardados son ilegibles para siempre.

Si algún día la rotas, hay que descifrar con la vieja y volver a cifrar con la
nueva antes de retirar la anterior.

---

## 4 · Copias de seguridad

Dos tipos, porque resuelven dos miedos distintos:

```bash
# Completa (desastre) + por academia (error humano acotado)
30 3 * * *  cd /ruta/geminis && npm run copia >> /var/log/geminis-copia.log 2>&1
```

Las copias por academia son las que de verdad se acaban usando: cuando alguien
borra una convocatoria con todo dentro, restaurar la copia completa se llevaría
por delante el trabajo de las demás academias desde esa copia.

**Sácalas de la máquina.** Una copia en el mismo disco que la base no sirve para
el caso que importa. Con S3, por ejemplo:

```bash
0 4 * * *  aws s3 sync /ruta/geminis/.dev/copias s3://copias-geminis/ --sse AES256
```

Y lo que casi nadie hace y es lo único que convierte un archivo en una copia:

```bash
npm run copia:restaurar -- .dev/copias/mi-academia-2026-08-29-2208.json
```

Comprueba que está completa, que no se ha colado ninguna fila de otra academia y
que los datos bancarios se pueden descifrar con la clave actual. **Hazlo cada
pocos meses.** Después:

```bash
BACKUP_CRON_CONFIRMED=1
RESTORE_TESTED_CONFIRMED=1
```

---

## 5 · Tareas programadas

No se copian a mano. Están versionadas en `scripts/cron/catedria.crontab` y se
instalan con:

```bash
./scripts/cron/instalar.sh --ver    # enseña lo que pondría, sin tocar nada
./scripts/cron/instalar.sh          # lo instala en tu crontab
./scripts/cron/instalar.sh --quitar # lo retira sin tocar tus otras tareas
```

El instalador sustituye la ruta del proyecto y la de `npm` por las de este
servidor. Eso es justo lo que se hacía mal al copiar y pegar: cron no hereda tu
PATH, así que un `npm` a secas funciona al probarlo en la terminal y falla en
silencio a las ocho y media de la mañana.

Qué queda programado:

| Cuándo | Qué |
|---|---|
| Cada día a las 8:30 | **Radar del BOE.** Busca convocatorias nuevas de las ramas que vigila cada academia. Solo actúa sobre las que tienen contratado el módulo «Normativa». |
| Domingos a las 9:15 | **Recuperación de una semana.** Por si el servidor estuvo caído: sin esto, un corte de un día se convierte en una convocatoria que nadie vio. |
| Cada día a las 9:00 | **Avisos de impago.** Reclama los recibos vencidos y, pasado el plazo de cada academia, le pausa el acceso al alumno. Solo actúa sobre academias con el módulo «Cobros». |
| Cada día a las 4:40 | **Mantenimiento.** Sesiones caducadas, enlaces de recuperación vencidos y contadores del limitador. |

El radar es idempotente: repetir un día no duplica nada.

```bash
MAINTENANCE_CRON_CONFIRMED=1
```

Si el radar deja de correr, el panel de salud lo dice. Míralo de vez en cuando:
`/plataforma/salud`.

---

## 6 · La aplicación

```bash
NODE_ENV=production
APP_URL="https://academia.example.com"     # con HTTPS: sin él la sesión viaja en claro
DB_RLS=on                                   # segunda barrera de aislamiento

SMTP_HOST="..."                             # sin correo, nadie recupera su contraseña
SMTP_USER="..."
SMTP_PASSWORD="..."
SMTP_FROM="Academia <no-responder@academia.example.com>"
```

Delante conviene un proxy inverso que corte HTTPS y limite peticiones por IP.
El limitador de Catedria cuenta intentos de acceso; el del proxy protege del
resto.

### Antes de abrir al público

```bash
npm run db:deploy              # migraciones, incluidas las políticas de aislamiento
npm run superadmin -- tu@correo.com "una contraseña larga"
npm run cifrar:migrar          # por si vienes de una instalación anterior
npm run desplegar:comprobar    # tiene que terminar en verde
```

Y borra la academia de demostración: sus contraseñas están escritas en el
`README`.

---

## 7 · Comprobarlo de verdad

Con el sistema en marcha:

```bash
npm run auditoria      # 33 comprobaciones del código + 46 contra el servidor
npm run pentest        # 35 ataques reales contra el servicio
npm run rls:probar     # que la segunda barrera protege aunque la primera falle
npm run ia:fuga        # que la IA no deja escapar temario no contratado
```

Los cuatro contra la instalación real, no contra tu portátil.

---

## 8 · Lo que esto NO cubre

Y conviene decirlo antes de que alguien lo dé por hecho:

- **Un test de intrusión profesional.** `npm run pentest` ejecuta 35 ataques
  conocidos. Un profesional busca los que no están en esa lista. Sigue haciendo
  falta antes de abrir con datos reales.
- **Alta disponibilidad.** No hay réplicas ni conmutación por error.
- **Registro centralizado.** Los avisos van a la salida estándar; recógelos con
  lo que uses.
- **Cumplimiento formal del RGPD.** El software trae lo suyo —anonimización,
  exportación, política de privacidad—, pero el registro de actividades de
  tratamiento y los contratos de encargo los firma la academia.
