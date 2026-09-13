# Acceso por `_id` de cuentas existentes y vistas de artículos

Fecha: 2026-09-13

## Alcance y decisiones

- El contenido publicado, el feed y los enlaces compartidos siguen siendo públicos.
- No se crean usuarios nuevos. Sólo los documentos que ya existen en `users` pueden iniciar sesión.
- La única entrada al login es `GET /login/<_id>` con el `ObjectId` real de esa cuenta. No se reemplaza por un token aleatorio, por decisión explícita del propietario. La visita crea una sesión inmediatamente y redirige a `/feed`, sin formulario, correo ni verificación adicional.
- El `_id` **no es un secreto**: una persona autenticada puede conocer el suyo y compartirlo. La posesión del enlace **sí autentica como esa cuenta**, incluido su rol de administrador o superadministrador. Si el enlace se filtra, cualquiera puede reutilizarlo mientras exista la cuenta y esta ruta siga activa. El propietario aceptó expresamente este riesgo como solución temporal.
- Google OAuth, magic link y el bypass QA quedan deshabilitados, no sólo ocultos, incluso si las variables antiguas siguen configuradas.
- Los likes desaparecen de interfaz, API, tipos y documentos históricos. No existe un sistema de comentarios en este repositorio.
- Cada apertura de un artículo publicado y la primera aparición de cada tarjeta montada en el viewport del feed suman una vista. Son impresiones, no visitantes únicos: recargas, nuevos montajes y bots pueden contar de nuevo.

## Flujo de acceso

1. `GET /login`, `GET /auth/login` y `GET /login/<_id>` con formato inválido o sin usuario correspondiente devuelven HTTP 404 mediante la página `+error.svelte` habitual. No hay página ni mensaje diferenciador para el ID incorrecto. Los problemas de base de datos son errores operativos, no falsos 404.
2. `GET /login/<_id>` válido comprueba que el usuario ya existe, invalida una sesión previa del navegador si la hay, crea una nueva sesión para ese ID con cookie `HttpOnly`, `SameSite=Lax` y `Secure` en producción, y redirige a `/feed`. La respuesta no se cachea ni expone el ID en `Referer` a terceros.
3. Se retiran botones y redirecciones públicas que apuntan al login abierto. Al cerrar sesión se vuelve al feed público. Los accesos directos a `/auth/google`, `/auth/google/callback`, `/auth/qa-login`, `/api/auth/magic-link` y `/auth/m/<token>` no autentican; devuelven 404. Las sesiones QA existentes dejan de ser válidas; las sesiones ordinarias existentes siguen siendo válidas.
4. Los endpoints de redacción, administración, perfil y guardados continúan comprobando `locals.user` y rol en el servidor. Quien abre un enlace válido obtiene exactamente el rol de la cuenta identificada.

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

- Pruebas de 404 para rutas de login inválidas y OAuth/QA/magic link deshabilitados; prueba de que un ID existente crea sesión sin correo y respeta el rol de esa cuenta.
- Pruebas de cookie segura, redirección al feed, reemplazo de sesión anterior y rechazo de sesiones QA anteriores.
- Pruebas del incremento atómico sólo para artículos publicados, migración de `likes` y `views`, y ausencia de likes en respuestas públicas.
- Suite completa, `check`, `lint`, build y una revisión manual de feed público, post compartido, login válido/inválido y vistas tras scroll.

## Despliegue

- La migración se ejecuta al inicializar la conexión de la aplicación a MongoDB; no requiere pegar credenciales ni ejecutar borrados manuales contra producción.
- Al desplegar, el login anterior y los magic links emitidos antes del cambio dejan de funcionar. Los enlaces de publicaciones siguen funcionando. Para revocar la capacidad de entrar mediante un `_id` concreto hará falta desactivar este mecanismo o retirar esa cuenta; cerrar sus sesiones no revoca el enlace.
