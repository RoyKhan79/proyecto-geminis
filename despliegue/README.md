# Poner Catedria en marcha en un servidor

Lo que falta cuando el código ya está bien: las cosas que no se pueden resolver
desde el repositorio. `npm run desplegar:comprobar` las va tachando.

---

## 1 · Las tareas programadas

```bash
crontab despliegue/catedria.cron   # cambia antes /srv/catedria por tu ruta
crontab -l                        # comprueba que ha entrado
mkdir -p /var/log/catedria
```

Son cuatro: el radar del BOE cada mañana, la copia de seguridad de madrugada, el
mantenimiento, y **la prueba semanal de la copia**.

Esa última es la que la gente se salta y es la que más importa. Una copia que
no se ha restaurado nunca no es una copia. `npm run copia:probar` crea una base
desechable, mete la copia dentro, comprueba que las claves foráneas vuelven a
crearse —que es lo que demuestra que los datos son coherentes— y la borra.

Después: `BACKUP_CRON_CONFIRMED=1` y, tras probarla una vez a mano,
`RESTORE_TESTED_CONFIRMED=1`.

## 2 · El correo saliente

Sin SMTP **nadie puede recuperar su contraseña** y no salen los avisos del BOE.
Es el requisito que más bloquea y no tiene alternativa.

```bash
SMTP_HOST="smtp.tuproveedor.com"
SMTP_PORT=587
SMTP_USER="..."
SMTP_PASSWORD="..."
SMTP_FROM="Catedria <avisos@tudominio.com>"
```

Y en el DNS del dominio, **SPF, DKIM y DMARC**. Sin eso el correo llega a la
carpeta de no deseado, que a efectos prácticos es no llegar.

Para comprobarlo: pide una recuperación de contraseña con una cuenta real y mira
si llega a la bandeja de entrada, no solo si el servidor acepta el envío.

## 3 · El cifrado del disco

La base de datos guarda IBAN cifrados y contraseñas irreversibles, pero el resto
—nombres, direcciones, notas— está en claro dentro del disco. Si alguien se
lleva el volumen, se lo lleva todo.

- **Servicio gestionado** (RDS, Cloud SQL, Supabase, Neon): viene activado.
  Confírmalo en el panel.
- **Servidor propio**: LUKS en Linux, BitLocker en Windows.

Después: `DISK_ENCRYPTION_CONFIRMED=1`.

## 4 · El cifrado del almacén de archivos

Ahí está el temario, que es el activo de la academia.

En S3 o compatible, activa **SSE-S3** o **SSE-KMS** en el bucket. Y comprueba
que el bucket **no es público**: un temario indexado por Google es una fuga
silenciosa que no aparece en ningún registro.

Después: `STORAGE_ENCRYPTION_CONFIRMED=1`.

## 5 · Antes de meter datos reales

```bash
npm run desplegar:comprobar
```

No debe quedar ningún ✗. Y además:

- **Borra la academia de demostración.** Trae 24 cuentas con contraseña
  conocida y publicada en el repositorio.
- **`APP_URL` con https**, no http.
- **`sslmode=require`** en la conexión a la base de datos.
- **`DB_RLS=on`** y que la aplicación se conecte con `geminis_app`, nunca con el
  dueño. Es la mitad del aislamiento entre academias.

---

## Lo que NO hay aquí

No hay un `docker-compose.yml` ni un `Dockerfile` de producción, ni plantillas
de Terraform. No están porque dependen de dónde se despliegue y poner una al
azar invitaría a usarla sin leerla.

Lo que sí es fijo, y está arriba, es **qué tiene que quedar resuelto**.
