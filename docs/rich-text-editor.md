# Editor visual de publicaciones

El contenido nuevo se almacena como `contentRich: { version: 1, doc }`. El servidor valida y normaliza el documento, deriva `content` como texto plano y genera `contentHtml` con una lista cerrada de etiquetas y atributos. No se persiste HTML enviado por el navegador. Las publicaciones antiguas siguen funcionando sin migración.

Límites: 50.000 caracteres visibles, 250.000 bytes UTF-8 de JSON (antes y después de parsear), 10.000 nodos, profundidad 20 y URLs de 2.048 caracteres. Solo se permiten párrafos, H2/H3, negrita, cursiva, tachado, citas, listas, saltos y enlaces HTTP(S) o relativos a la raíz.

Los enlaces del contenido abren otra pestaña. Los sitios externos no confiables requieren confirmación. Una cuenta autenticada puede guardar hasta 100 nombres de host exactos y eliminar preferencias desde su perfil. Los visitantes no guardan preferencias. La política no intercepta enlaces de navegación ni compartir por correo.

## Verificación local

- Suite completa: 82 pruebas aprobadas, sin fallos.
- Svelte: cero errores y advertencias. Prettier y ESLint aprobados.
- Build de producción completado. La comprobación sin configuración de despliegue avisa que falta `MONGODB_URI`.
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
- Vista móvil de 390 × 844 comprobada. La auditoría encontró contrastes preexistentes en botones de archivos y etiquetas de estado; se atenderán al ampliar redacción.

## Entorno de prueba reutilizable

`pnpm smoke:rich-text` levanta Mongo temporal y la app en `http://127.0.0.1:4175`. Imprime sesiones y publicaciones de prueba, no añade un bypass de autenticación. Escribe `stop` y Enter para cerrar y eliminar la base temporal. La primera ejecución descarga un binario de Mongo en `.svelte-kit/smoke-mongo`. Nunca usa la base configurada para producción.

No se han validado estos cambios en producción ni se han enviado al remoto.
