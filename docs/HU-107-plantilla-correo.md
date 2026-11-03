# HU-107: plantilla del correo de recuperación (Firebase Auth)

El correo lo envía Firebase Auth (sin costo, sin funciones de servidor). Su texto NO está en el código: se configura en
la consola del proyecto real. Los emuladores no usan esta plantilla; ahí el enlace aparece en la terminal del
emulador y en `http://127.0.0.1:9099/emulator/v1/projects/<proyecto>/oobCodes`.

## 1. Datos de cada cuenta

`%DISPLAY_NAME%` es el nombre visible de la cuenta en Firebase Auth. Para que el correo diga "Hola, admin:" cada cuenta
de administrador debe tener **displayName = su usuario**. El seed ya lo hace, y la carga de cuentas (E5-050.1)
también tiene que hacerlo.

## 2. Consola → Authentication → Plantillas → Restablecimiento de contraseña

- **Idioma de la plantilla:** Español.
- **Nombre del remitente:** `CANI Café`.
- **Asunto:** `CANI Café – Recuperación de contraseña` (con raya –, igual que el criterio).
- **Mensaje** (HTML):

```html
<p>Hola, %DISPLAY_NAME%:</p>
<p>Recibimos una solicitud para crear una nueva contraseña para su cuenta del sistema de CANI Café.</p>
<p>
  <a href="%LINK%"
     style="display:inline-block;padding:10px 18px;background:#6b3e26;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">
    Crear nueva contraseña
  </a>
</p>
<p>Este enlace vence 30 minutos después de enviado y solo se puede usar una vez. Si usted no hizo esta solicitud, ignore este correo.</p>
```

- **URL de acción personalizada** (lápiz → "Personalizar URL de acción"): `https://<dirección del sitio del administrador>/nueva-contrasena`.
  Sin esto el botón abre la página genérica de Firebase y no se aplican las reglas de validez de HU-107 ni la
  pantalla de HU-108.

## 3. Dominios autorizados

En *Authentication → Configuración → Dominios autorizados* tiene que estar el dominio del sitio del administrador.
La dirección de vuelta del enlace (`continueUrl`) usa ese dominio; si no está autorizado, el envío falla.

## 4. Diferencia con el criterio (requiere solicitud de cambio)

El criterio pide: "Este enlace vence a las **[hora]** del **[fecha]** y solo se puede usar una vez…".
La plantilla de Firebase Auth solo tiene `%DISPLAY_NAME%`, `%APP_NAME%`, `%LINK%` y `%EMAIL%`: no hay forma de poner
la hora exacta sin un servidor de pago (choca con CC-01). Por eso el correo dice "vence 30 minutos después de
enviado". La regla del vencimiento sí se cumple exacta: la valida la pantalla "Nueva contraseña"
(`src/auth/passwordResetLinks.ts`).

## 5. Cómo se cumple el resto de HU-107

| Criterio | Dónde |
|---|---|
| Remitente "CANI Café" y asunto | Plantilla (punto 2) |
| "Hola, [usuario]: …" y botón "Crear nueva contraseña" | Plantilla + displayName = usuario (punto 1) |
| Vence a los 30 minutos | `passwordResets/{usuario}.requestedAt` + `isResetRequestCurrent` |
| Deja de servir si ya se usó | `used: true` al crear la contraseña (HU-108) y el código de Firebase es de un solo uso |
| Deja de servir si se pidió otro | Cada solicitud cambia `passwordResets/{usuario}.rid` |
| "El enlace ya no es válido. Solicite uno nuevo." | `src/auth/ResetPasswordPage.tsx` |
| El correo llega en producción (RT-01) | Prueba manual después de publicar (E5-040.1 y E5-060.1) |
