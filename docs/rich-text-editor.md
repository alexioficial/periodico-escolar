# Editor visual de publicaciones

El contenido nuevo se almacena como `contentRich: { version: 1, doc }`. El servidor valida y normaliza el documento, deriva `content` como texto plano y genera `contentHtml` con una lista cerrada de etiquetas y atributos. No se persiste HTML enviado por el navegador. Las publicaciones antiguas siguen funcionando sin migración.

Límites: 50.000 caracteres visibles, 250.000 bytes UTF-8 de JSON (antes y después de parsear), 10.000 nodos, profundidad 20 y URLs de 2.048 caracteres. Solo se permiten párrafos, H2/H3, negrita, cursiva, tachado, citas, listas, saltos y enlaces HTTP(S) o relativos a la raíz.

Los enlaces del contenido abren otra pestaña. Los sitios externos no confiables requieren confirmación. Una cuenta autenticada puede guardar hasta 100 nombres de host exactos y eliminar preferencias desde su perfil. Los visitantes no guardan preferencias. La política no intercepta enlaces de navegación ni compartir por correo.

## Verificación local

- Suite completa, incluido editar/eliminar: 104 pruebas aprobadas, sin fallos.
- Svelte: cero errores y advertencias. Prettier y ESLint aprobados.
- Build de producción completado. La comprobación sin configuración de despliegue avisa que falta `MONGODB_URI`; Rollup también muestra avisos de dependencias circulares de Svelte. Los flujos principales se comprobaron usando el build local con Mongo temporal, sin errores de ejecución observados.
- Revisión independiente del backend, preferencias y UI; hallazgos corregidos y revisados nuevamente.
- Navegador con una base Mongo temporal: administrador, usuario normal y visitante anónimo.
- Redacción, envío a revisión, aprobación y formato en feed, detalle, guardados y moderación.
- Pegado HTML: conserva formatos permitidos y elimina scripts, imágenes y estilos.
- Error de contenido vacío conserva formulario; publicación correcta limpia el editor.
- Enter en el diálogo aplica el enlace sin enviar el artículo; cambios de editabilidad no causan bucles reactivos.
- Enlaces internos abren directamente. Externos anónimos advierten nuevamente después de cancelar.
- Confianza autenticada persistente, eliminación en perfil y aislamiento entre usuarios comprobados.
- Un fallo de red simulado al guardar confianza abre igualmente el enlace y muestra el aviso.
- Compatibilidad legacy: saltos de línea conservados y etiquetas de script mostradas como texto escapado.
- Vista móvil de 390 × 844 comprobada. Los contrastes de botones de archivos y etiquetas de estado se corrigieron al ampliar redacción.

## Editar y eliminar publicaciones propias

En «Mis artículos» cada autor puede editar título, categoría, extracto y contenido, o eliminar definitivamente su publicación tras confirmar su nombre. La multimedia y los adjuntos se conservan sin cambios al editar. Los administradores y superadministradores tampoco pueden editar ni eliminar artículos ajenos.

Los cambios de usuarios normales vuelven a revisión y ocultan el artículo público hasta una nueva aprobación. Los administradores publican directamente los cambios en sus propios artículos. Se conservan la autoría, fecha de creación, likes, guardados y vistas. Cada edición incrementa una revisión; una decisión de moderación sobre una versión anterior se rechaza con 409.

Editar y eliminar comparten un límite de 30 modificaciones por usuario cada 10 minutos. La propiedad se comprueba de nuevo en la escritura atómica. Al eliminar se limpian únicamente los archivos del registro eliminado por el servidor; si falla esa limpieza, se informa que el artículo ya fue eliminado pero quedaron archivos pendientes de limpiar.

Sin JavaScript se pueden editar los metadatos sin perder el formato existente. Cambiar el contenido de una publicación enriquecida requiere el editor visual; se rechaza una degradación silenciosa a texto plano. Los errores conservan el borrador y las respuestas solo contienen texto y HTML generado de forma segura, nunca el JSON almacenado.

Pruebas locales adicionales: edición y borrado por cada rol, solicitudes ajenas manipuladas, sesión anónima, envío de cambios a revisión, aprobación obsoleta, contenido antiguo escapado, retención del borrador, cancelación y confirmación de borrado. La confirmación móvil se comprobó a 390 × 844 y su auditoría automática no encontró infracciones.

## Entorno de prueba reutilizable

`pnpm smoke:rich-text` levanta Mongo temporal y la app en `http://127.0.0.1:4175`. Imprime sesiones y publicaciones de prueba, no añade un bypass de autenticación. Escribe `stop` y Enter para cerrar y eliminar la base temporal. La primera ejecución descarga un binario de Mongo en `.svelte-kit/smoke-mongo`. Nunca usa la base configurada para producción.

No se han validado estos cambios en producción ni se han enviado al remoto.
