# Acceso por `_id` de cuentas existentes y vistas de artículos

Fecha: 2026-09-13

## Alcance y decisiones

- El contenido publicado, el feed y los enlaces compartidos siguen siendo públicos.
- No se crean usuarios nuevos. Sólo los documentos que ya existen en `users` pueden iniciar sesión.
- La única entrada visible al login es `GET /login/<_id>` con el `ObjectId` real de esa cuenta. No se reemplaza por un token aleatorio, por decisión explícita del propietario.
- El `_id` **no es un secreto**: una persona autenticada puede conocer el suyo y compartirlo. La posesión del enlace no autentica; el correo de la cuenta aún debe verificarse mediante magic link.
- Google OAuth queda deshabilitado, no sólo oculto. El bypass QA también queda deshabilitado para que no pueda crear cuentas ni saltarse la restricción, incluso si las variables antiguas siguen configuradas.
- Los likes desaparecen de interfaz, API, tipos y documentos históricos. No existe un sistema de comentarios en este repositorio.
- Cada apertura de un artículo publicado y la primera aparición de cada tarjeta montada en el viewport del feed suman una vista. Son impresiones, no visitantes únicos: recargas, nuevos montajes y bots pueden contar de nuevo.

## Flujo de acceso

1. `GET /login`, `GET /auth/login` y `GET /login/<_id>` con formato inválido o sin usuario correspondiente devuelven HTTP 404 mediante la página `+error.svelte` habitual. No hay página ni mensaje diferenciador para el ID incorrecto. Los problemas de base de datos son errores operativos, no falsos 404.
2. `GET /login/<_id>` válido muestra el formulario de correo sin publicar la dirección asociada al ID. El campo se envía junto con el ID y el destino interno validado.
3. `POST /api/auth/magic-link` conserva sus límites por IP y correo. Sólo emite correo si el ID y el correo normalizado pertenecen al **mismo usuario existente**. Si no coinciden, responde de forma genérica, sin emitir correo ni revelar qué dato falló.
4. El token de magic link queda vinculado al ID y al correo. Al canjearlo, se vuelve a consultar esa cuenta y se verifica la coincidencia; no se llama a ningún `findOrCreate`. Tokens antiguos sin esta vinculación dejan de ser canjeables. La verificación por correo puede marcar `emailVerified` para esa cuenta existente.
5. Se retiran botones y redirecciones públicas que apuntan al login abierto. Al cerrar sesión se vuelve al feed público. Los accesos directos a `/auth/google`, `/auth/google/callback` y `/auth/qa-login` no autentican; devuelven 404. Las sesiones QA existentes dejan de ser válidas; las sesiones ordinarias existentes siguen siendo válidas.
6. Los endpoints de redacción, administración, perfil y guardados continúan comprobando `locals.user` y rol en el servidor. Conocer un ID no concede permisos ni permite seleccionar otra cuenta durante el login.

## Likes y datos históricos

- Se elimina `/api/articles/[id]/like` y `toggleLike`, además de `isLiked` y `likesCount` en los DTO de feed, guardados y detalle, y todos los botones de like. Compartir y guardar siguen funcionando.
- `ArticleDoc` ya no declara `likes`; las publicaciones nuevas no lo insertan.
- Una migración idempotente al conectar MongoDB ejecuta `$unset` de `likes` exclusivamente en documentos de `articles` que aún tengan ese campo. La eliminación es permanente, como pidió el propietario. No toca `savedBy` ni otros datos.

## Conteo de vistas

- `articles.views` es un entero no negativo; los documentos nuevos empiezan en `0` y una migración idempotente asigna `0` a documentos anteriores sin el campo.
- El `GET /post/[id]` de un artículo publicado hace un `$inc: { views: 1 }` atómico por carga de detalle, tanto con sesión como sin ella. Artículos inexistentes o no publicados no suman. No se escribe durante la mera consulta de un feed.
- En el feed, un `IntersectionObserver` observa cada tarjeta —también las incorporadas con «Cargar más»— y, cuando entra suficientemente en pantalla, envía una única impresión por montaje de esa tarjeta a un endpoint público. El servidor valida ID y estado `published` y aplica el mismo incremento atómico. Navegar de nuevo o recargar puede generar otra impresión. El envío es best-effort: desconexiones o cierres bruscos pueden perder alguna vista.
- El endpoint de impresión tiene limitación por IP para reducir abuso; un cliente que supere el límite no incrementa. Esto no convierte el contador en una métrica de usuarios únicos ni impide toda manipulación.
- No se agrega una cifra visible en la interfaz en esta entrega: el pedido concreto fue persistir `views` en MongoDB.

## Verificación

- Pruebas de 404 para rutas de login inválidas y OAuth/QA deshabilitados; prueba de coincidencia ID/correo y de que no se crean cuentas.
- Pruebas de token de correo ligado al usuario, canje único y rechazo de tokens anteriores sin ID.
- Pruebas del incremento atómico sólo para artículos publicados, migración de `likes` y `views`, y ausencia de likes en respuestas públicas.
- Suite completa, `check`, `lint`, build y una revisión manual de feed público, post compartido, login válido/inválido y vistas tras scroll.

## Despliegue

- La migración se ejecuta al inicializar la conexión de la aplicación a MongoDB; no requiere pegar credenciales ni ejecutar borrados manuales contra producción.
- Al desplegar, los enlaces de login anteriores dejan de funcionar y los magic links emitidos antes del cambio dejan de ser canjeables. Los enlaces de publicaciones siguen funcionando.
