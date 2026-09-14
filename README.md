# Santo Domingo Savio — Periódico Escolar Salesiano

Plataforma SvelteKit para crear, moderar y publicar artículos de una comunidad escolar.

## Funcionalidades

- Feed público con categorías, paginación, guardados y conteo de vistas.
- Acceso directo de cuentas existentes mediante `/login/<_id>`; no se crean usuarios nuevos.
- Perfil con avatar recortable.
- Redacción con imágenes, videos y adjuntos almacenados en S3 privado.
- Moderación para administradores.
- Gestión de categorías y roles para superadministradores.

## Requisitos

- Node.js 22
- pnpm 11.6.0
- MongoDB
- Bucket S3 o servicio compatible

## Desarrollo

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev
```

Completa `.env` antes de probar autenticación, uploads o páginas que consulten MongoDB. Si se despliega detrás de un proxy, configura `ADDRESS_HEADER` y, cuando corresponda, `XFF_DEPTH`; solo confíes en headers que el proxy reemplace y no permita falsificar al cliente.

## Validación

```bash
pnpm test
pnpm check
pnpm lint
pnpm build
pnpm audit --prod
```

## Roles

- `user`: envía artículos a revisión.
- `admin`: modera artículos y puede publicar directamente.
- `superadmin`: además administra categorías, usuarios y roles.

Para ascender una cuenta que ya exista en MongoDB, ejecuta:

```bash
pnpm create:superadmin -- usuario@ejemplo.com
```

## Seguridad y rate limits

- Las sesiones se almacenan mediante hashes.
- Los archivos permanecen privados y se sirven mediante URLs firmadas.
- Las lecturas anónimas, los accesos directos y las impresiones de artículos se limitan por IP.
- La creación de artículos se limita por usuario: 10 por hora para usuarios y 60 por hora para staff.
- Abrir `/login/<_id>` inicia sesión inmediatamente como esa cuenta, incluso si es superadmin. El ID funciona como una credencial reutilizable: no compartas esos enlaces fuera del grupo autorizado. Cerrar sesión no invalida el enlace.
- `/login`, IDs incorrectos y los antiguos flujos de Google, magic link y QA responden 404. Las sesiones QA anteriores se invalidan.
- Los artículos publicados suman una vista al abrir su página y otra cuando su tarjeta entra en pantalla en el feed. La migración borra permanentemente los likes históricos e inicializa `views: 0` en artículos antiguos.

Los rate limits se guardan en MongoDB, por lo que se comparten entre instancias y sobreviven reinicios.

## Producción

La imagen Docker compila la aplicación con `adapter-node` y se ejecuta como usuario no privilegiado:

```bash
docker build -t periodico-escolar .
docker run --env-file .env -p 3000:3000 periodico-escolar
```

El endpoint usado por el healthcheck es `/feed`; requiere que MongoDB esté disponible.
