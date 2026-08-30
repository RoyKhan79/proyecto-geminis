# Seguir con el proyecto en otro ordenador

Esta carpeta viene comprimida desde un Mac y está lista para seguir en Windows,
en Linux o en otro Mac. Lo que **no** viene es lo que se regenera solo:
`node_modules`, `.next`, la base de datos local y el cliente de Prisma. Son 4 GB
que no aportan nada y que además no son portables entre sistemas.

---

## ⚠️ Antes de subirlo a ningún sitio

**Este ZIP contiene secretos.** En concreto:

- `.env` · la clave de cifrado de datos bancarios y las cadenas de conexión.
- `conversacion/` · la conversación entera, y ahí aparecen contraseñas que se
  han escrito durante el trabajo, incluida la del superadministrador.

Súbelo a **tu** Drive privado y no lo compartas por enlace. Si en algún momento
va a verlo alguien más, borra antes esas dos cosas: el proyecto arranca igual
copiando `.env.example` a `.env`.

---

## 1 · Poner en marcha el proyecto

Hace falta **Node 22** o superior. En Windows, desde <https://nodejs.org>.

```bash
npm install
npm run setup     # arranca PostgreSQL embebido, migra, genera y siembra
npm run demo:todo # temario, preguntas y normativa de la demostración
npm run indexar   # para que Geminis IA tenga de dónde citar
npm run dev
```

`npm run setup` levanta un PostgreSQL propio en `.dev/`, sin Docker y sin
permisos de administrador. No hace falta instalar nada más.

Con eso, <http://localhost:3000> y a entrar:

| Quién | Correo | Contraseña |
| --- | --- | --- |
| Administración | `admin@academiademo.test` | `Geminis2026!` |
| Profesora | `laura@academiademo.test` | `Geminis2026!` |
| Alumna (curso completo) | `alumno1@academiademo.test` | `Geminis2026!` |
| Alumno (solo tests) | `alumno2@academiademo.test` | `Geminis2026!` |
| Alumna de Magisterio | `alumno15@academiademo.test` | `Geminis2026!` |

El superadministrador es el correo real que se configuró; su contraseña está en
la conversación. Se puede cambiar en cualquier momento:

```bash
npm run superadmin -- tu@correo.com "una contraseña larga"
```

### Si algo falla en Windows

- **`scripts/dev-db.sh` no se ejecuta** · es un script de shell. En Windows usa
  Git Bash o WSL, o levanta un PostgreSQL propio y apunta `DATABASE_URL` a él.
- **Las capturas del manual** (`npm run manual:capturas`) necesitan Chrome
  instalado o `npx playwright install chromium`.

---

## 2 · Comprobar que todo sigue bien

Antes de tocar nada, conviene ver el proyecto en verde en la máquina nueva:

```bash
npm run verificar   # tipos, estilo, 182 pruebas y compilación
npm run auditoria   # 33 comprobaciones del código + 46 contra el servidor
npm run pentest     # 43 ataques reales, con el servidor levantado
```

Los dos últimos necesitan la aplicación en marcha y la demostración sembrada.
Si `pentest` dice que algún ataque **no ha podido lanzarse**, no es un fallo del
sistema: es que a la demostración le falta con qué atacar. Vuelve a sembrarla.

---

## 3 · Seguir la conversación con Claude

En `conversacion/` está la transcripción completa del trabajo hecho hasta aquí.

**Lo primero que conviene saber:** Claude Code guarda sus conversaciones en una
carpeta ligada a la ruta del proyecto, y en Windows esa ruta es distinta. Así
que el archivo **no se recupera solo** copiándolo; hay que dárselo.

La forma que funciona:

1. Abre Claude Code en la carpeta del proyecto ya descomprimida.
2. Pídele que lea el resumen y, si necesita detalle, la transcripción:

   > Lee `docs/CONTINUAR_EN_OTRO_PC.md` y `docs/ESTADO_DEL_PROYECTO.md`. La
   > conversación anterior está en `conversacion/`. Vamos a seguir desde ahí.

3. A partir de ahí, contexto suficiente para continuar. Los documentos de
   `docs/` —sobre todo `DECISIONS.md`— explican **por qué** está hecho cada
   cosa así, que es lo que no se deduce leyendo el código.

---

## 4 · Por dónde iba el trabajo

Está en `docs/ESTADO_DEL_PROYECTO.md`, escrito para leerse en dos minutos.

Y el mapa completo, por si hace falta:

| Documento | Qué cuenta |
| --- | --- |
| `docs/ARCHITECTURE.md` | Cómo está montado |
| `docs/DECISIONS.md` | **57 decisiones y por qué**. El más útil de todos |
| `docs/SECURITY_MODEL.md` | Las dos barreras de aislamiento |
| `docs/AUDITORIA_FINAL.md` | Qué se comprueba y qué queda abierto |
| `docs/DESPLIEGUE.md` | Lo que hay que configurar antes de datos reales |
| `docs/GUIA_APP_MOVIL.md` | Probar academia ↔ alumno de extremo a extremo |
| `docs/REQUISITOS_CUMPLIDOS.md` | Los 136 puntos del encargo, uno a uno |
| `/manual` (en la aplicación) | El manual de uso, con capturas |
