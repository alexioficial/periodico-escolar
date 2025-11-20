# 📰 Periódico Escolar

Plataforma web moderna para la gestión y publicación de artículos periodísticos escolares. Permite a estudiantes crear contenido, a administradores revisar y aprobar artículos, y a toda la comunidad escolar leer y interactuar con las publicaciones.

![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

## ✨ Características

### Para Estudiantes
- ✍️ **Editor de artículos** con soporte para título, extracto, contenido y categorías
- 📸 **Multimedia enriquecida**: Carga múltiples imágenes y videos (carrusel automático)
- 📎 **Archivos adjuntos**: Soporta PDF, Word, Excel y más
- 💾 **Guardar artículos favoritos** para leer después
- ❤️ **Sistema de likes** para interactuar con contenido
- 📊 **Panel personal** para ver estado de tus artículos (pendiente/publicado/rechazado)

### Para Administradores
- ✅ **Revisión de artículos**: Aprobar o rechazar publicaciones pendientes
- 👥 **Gestión de usuarios**: Asignar roles (usuario, admin, superadmin)
- 🏷️ **Gestión de categorías**: Crear, editar y eliminar categorías
- 📈 **Control de acceso** basado en roles

### Funcionalidades Generales
- 🔐 **Autenticación dual**: Email/contraseña + Google OAuth
- 📧 **Verificación de email** con códigos de un solo uso
- 🎨 **UI moderna y responsive** con Tailwind CSS
- 🔍 **Filtrado por categorías** en el feed principal
- 📄 **Paginación automática** para mejor rendimiento
- 🌐 **Server-Side Rendering (SSR)** para SEO optimizado

## 🛠️ Tech Stack

- **Frontend**: SvelteKit 2.47 + Svelte 5
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS 4.1
- **Base de datos**: MongoDB 7.0
- **Autenticación**: Auth.js (Google OAuth)
- **Email**: Nodemailer
- **Build tool**: Vite 7.1

## 📋 Requisitos Previos

- Node.js 18+ (recomendado: 20+)
- MongoDB (local o MongoDB Atlas)
- Cuenta de Google Cloud (para OAuth, opcional)
- Servidor SMTP (para emails de verificación)

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone <tu-repositorio>
cd periodico-escolar
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copia el archivo de ejemplo y configura tus credenciales:

```bash
cp .env.example .env
```

Edita `.env` con tus valores:

```bash
# MongoDB
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/periodico_escolar
MONGODB_DB=periodico_escolar

# SMTP (Gmail, SendGrid, etc.)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_password_o_app_password
SMTP_FROM="Periódico Escolar <no-reply@tuescuela.com>"

# Auth.js
AUTH_SECRET=any_random_32_character_string_here_xxxxx
AUTH_TRUST_HOST=true

# Google OAuth (opcional)
GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_client_secret

# Vercel Blob Storage (para subida de archivos)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxx
```

### 4. Iniciar en modo desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## 🗂️ Estructura del Proyecto

```
periodico-escolar/
├── src/
│   ├── lib/
│   │   ├── components/       # Componentes reutilizables
│   │   │   ├── ConfirmDialog.svelte
│   │   │   ├── ToastHost.svelte
│   │   │   └── ValidatedInput.svelte
│   │   ├── server/          # Lógica del servidor
│   │   │   ├── articles.ts  # CRUD de artículos
│   │   │   ├── auth.ts      # Autenticación
│   │   │   ├── categories.ts
│   │   │   ├── db.ts        # Conexión MongoDB
│   │   │   ├── mailer.ts    # Envío de emails
│   │   │   ├── session.ts   # Gestión de sesiones
│   │   │   └── verification.ts
│   │   ├── confirmDialog.ts # Store de diálogos
│   │   └── toast.ts         # Sistema de notificaciones
│   ├── routes/
│   │   ├── admin/           # Panel administrativo
│   │   │   ├── categories/  # Gestión de categorías
│   │   │   └── users/       # Gestión de usuarios
│   │   ├── auth/            # Rutas de autenticación
│   │   ├── feed/            # Feed público de artículos
│   │   ├── perfil/          # Perfil y guardados
│   │   └── redaccion/       # Crear y verificar artículos
│   ├── app.css
│   ├── app.d.ts
│   └── app.html
├── static/                  # Archivos estáticos
├── .env.example
├── package.json
├── svelte.config.js
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## 📝 Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Inicia servidor de desarrollo

# Build
npm run build        # Compila para producción

# Preview
npm run preview      # Previsualiza build de producción

# Formato y Linting
npm run format       # Formatea código con Prettier
npm run lint         # Ejecuta ESLint y Prettier check

# Type Checking
npm run check        # Verifica tipos de TypeScript/Svelte
npm run check:watch  # Modo watch para type checking
```

## 🎭 Roles y Permisos

| Rol | Permisos |
|-----|----------|
| **user** | Crear artículos, dar likes, guardar artículos |
| **admin** | Todo lo anterior + aprobar/rechazar artículos |
| **superadmin** | Todo lo anterior + gestionar usuarios y categorías |

> **Nota**: El primer usuario debe ser promovido a superadmin manualmente en la base de datos.

## 🗄️ Modelos de Base de Datos

### Usuarios
- Email, username, password (hash PBKDF2)
- Provider (credentials/google)
- Role (user/admin/superadmin)
- Email verification

### Artículos
- Título, contenido, extracto
- Categoría (referencia a Categories)
- Estado: draft/pending/published/rejected
- Media (imágenes/videos en carrusel)
- Attachments (archivos descargables)
- Likes y guardados (arrays de user IDs)

### Categorías
- Nombre y slug (auto-generado)
- Categorías por defecto: Noticias, Deportes, Cultura, Opinión, Entrevistas

## 🌐 Despliegue

### Configuración de Vercel Blob Storage

Esta aplicación usa Vercel Blob para almacenar archivos (imágenes, videos, adjuntos). Sigue estos pasos:

#### 1. Habilitar Vercel Blob en tu proyecto

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto (o créalo conectando tu repositorio)
3. Ve a la pestaña **Storage**
4. Haz clic en **Create Database** → **Blob**
5. Dale un nombre (ej: "periodico-blob")
6. Haz clic en **Create**

#### 2. Obtener el token

Después de crear el Blob storage:

1. En la sección Storage, haz clic en tu Blob database
2. Ve a la pestaña **.env.local**
3. Copia el valor de `BLOB_READ_WRITE_TOKEN`

#### 3. Configurar para desarrollo local

Pega el token en tu archivo `.env` local:

```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxxxxxxx
```

> **Nota**: Los archivos se subirán directamente a Vercel Blob, incluso en desarrollo local.

#### 4. Configurar para producción

Vercel automáticamente inyectará `BLOB_READ_WRITE_TOKEN` en producción, **no necesitas configurarlo manualmente**.

### Vercel (Recomendado)

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno
3. Vercel detectará automáticamente SvelteKit
4. Deploy automático en cada push

### Otras Opciones
- **Netlify**: Soporta SvelteKit de forma nativa
- **Cloudflare Pages**: Excelente rendimiento global
- **Node.js Server**: Usa `adapter-node` en `svelte.config.js`

### Configuración de Producción

Asegúrate de:
- [ ] Configurar MongoDB Atlas (cloud)
- [ ] Establecer `AUTH_SECRET` seguro (32+ caracteres)
- [ ] Configurar dominio para Google OAuth
- [ ] Configurar SMTP para emails
- [x] Vercel Blob Storage (ya implementado)

## 🔧 Configuración de Google OAuth

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita "Google+ API"
4. Ve a "Credenciales" → "Crear credenciales" → "ID de cliente OAuth 2.0"
5. Configura orígenes autorizados:
   - Desarrollo: `http://localhost:5173`
   - Producción: `https://tu-dominio.com`
6. Configura URIs de redirección:
   - Desarrollo: `http://localhost:5173/auth/callback/google`
   - Producción: `https://tu-dominio.com/auth/callback/google`
7. Copia Client ID y Client Secret a tu `.env`

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add: AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 🐛 Reporte de Bugs

Si encuentras un bug, por favor abre un issue con:
- Descripción clara del problema
- Pasos para reproducirlo
- Comportamiento esperado vs. actual
- Screenshots (si aplica)

## 📞 Soporte

Para preguntas o ayuda, puedes:
- Abrir un issue en GitHub
- Contactar al equipo de desarrollo

---

**Desarrollado con ❤️ para la comunidad escolar**
