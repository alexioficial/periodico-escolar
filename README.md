# Periódico Escolar

Plataforma SvelteKit para crear, moderar y publicar artículos de una comunidad escolar.

## Funcionalidades

- Feed público con categorías, paginación, likes y guardados.
- Login con Google o enlace mágico de un solo uso.
- Perfil con avatar recortable.
- Redacción con imágenes, videos y adjuntos almacenados en S3 privado.
- Moderación para administradores.
- Gestión de categorías y roles para superadministradores.

## Requisitos

- Node.js 22
- pnpm 11.6.0
- MongoDB
- Bucket S3 o servicio compatible
- Servidor SMTP para enlaces mágicos
- Credenciales OAuth de Google

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

El workflow de GitHub Actions ejecuta estas comprobaciones en cada push y pull request.

## Roles

- `user`: envía artículos a revisión.
- `admin`: modera artículos y puede publicar directamente.
- `superadmin`: además administra categorías, usuarios y roles.

Para ascender la primera cuenta, después de que el usuario haya iniciado sesión al menos una vez, ejecuta:

```bash
pnpm create:superadmin -- usuario@ejemplo.com
```

## Seguridad y rate limits

- Las sesiones y magic links se almacenan mediante hashes.
- Los archivos permanecen privados y se sirven mediante URLs firmadas.
- Las lecturas anónimas de contenido y las páginas públicas de autenticación se limitan por IP.
- La creación de artículos se limita por usuario: 10 por hora para usuarios y 60 por hora para staff.
- La solicitud y consumo de magic links tienen límites independientes.
- El bypass temporal de QA requiere `QA_AUTH_BYPASS_ENABLED=true` y un
  `QA_AUTH_BYPASS_SECRET` de al menos 32 caracteres. Solo se muestra al abrir
  `/auth/login?qa=EL_SECRETO_URL_ENCODED`; el servidor limpia inmediatamente la URL.
  Desactivarlo o rotar el secreto invalida las sesiones QA existentes.

Los rate limits se guardan en MongoDB, por lo que se comparten entre instancias y sobreviven reinicios.

## Producción

La imagen Docker compila la aplicación con `adapter-node` y se ejecuta como usuario no privilegiado:

```bash
docker build -t periodico-escolar .
docker run --env-file .env -p 3000:3000 periodico-escolar
```

El endpoint usado por el healthcheck es `/feed`; requiere que MongoDB esté disponible.
