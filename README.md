# 🧾 CHANGELOG - SalemTV PWA

## v1.3 - Correcciones críticas y reestructuración de multimedia
📅 Fecha: 2025-10-19

### Archivos modificados
- `styles.css v1.3`
- `app.js v1.3`

### Cambios principales
**Swipe bug**
- Se solucionó el problema donde un swipe agresivo duplicaba la página o dejaba pantalla en blanco introduciendo un bloqueo (debounce) y evitando disparos repetidos.

**Notificaciones**
- Badge ahora cuenta todas las notificaciones no eliminadas (historial), aunque ya hayan sido mostradas como toast.
- Se añadió `LS_SHOWN` para registrar toasts ya mostrados y evitar re-reproducción sin afectar el contador.
- Al pulsar `Abrir` desde el panel, éste se cierra automáticamente.
- `Eliminar` borra permanentemente la notificación (marcada en `LS_REMOVED`) para que no vuelva a importarse ni mostrarse.

**Videos & EnVi**
- `videos.json` ahora soporta entradas con `sources[]` por video; la UI de Videos fue rehecha: playlist + player que cambia fuentes sin recarga.
- `envi.json` ahora contiene `base_url`, `default` y `canales[]`. `renderEnVi` utiliza estos datos dinámicamente.
- Se añadió loader por sección (images/videos/EnVi) y caching local (localStorage TTL) para acelerar cargas.

**Carga & UX**
- Loading overlays por sección mientras se cargan imágenes/videos.
- Cache JSON en `localStorage` con TTL (por defecto 5 minutos) para mejorar percepciones de velocidad.

---

## v1.2 - Corrección de bugs y mejoras visuales
📅 Fecha: 2025-10-19

### Archivos modificados
- `styles.css v1.2`
- `app.js v1.2`

### Cambios principales
**Funcionales**
- Eliminado completamente el botón **“Descartar”** del panel de notificaciones.
- Las notificaciones eliminadas desaparecen definitivamente del `localStorage`.
- El toast marca automáticamente una notificación como vista al mostrarse (no se repite).
- El toast se oculta tras 3 s y no queda fijo en pantalla.
- Corregido bug donde reaparecían notificaciones eliminadas.

**Visuales**
- Icono de notificaciones agrandado (28 px) y alineado con el logotipo.
- Barra de pestañas ajustada dentro del flujo del diseño con padding y overflow correctos.
- Scroll horizontal suave para múltiples pestañas.

---

## v1.1 - Mejora de pestañas y sistema de notificaciones
📅 Fecha: 2025-10-18

### Archivos modificados
- `styles.css v1.1`
- `app.js v1.1`

### Cambios principales
**Pestañas**
- Las pestañas ahora ocupan el 100% del ancho del contenedor y se centran dentro del `max-width` del `main`.
- Cada tab tiene `min-width` para evitar colapso; si hay muchas pestañas, aparece scroll horizontal.
- Mantiene comportamiento y estilos previos para compatibilidad.

**Notificaciones**
- Se eliminó el bucle infinito.
- Comportamiento de aparición:
  - Retraso inicial de **5 segundos** al entrar a la web.
  - **3 segundos** de intervalo entre cada notificación automática.
  - Cada notificación tiene un **botón de cierre individual** en el toast.
  - Persistencia mediante `localStorage`: una vez descartada (cerrada) no vuelve a aparecer.
- Panel de historial:
  - Mantiene historial en el panel (puedes "Descartar" o "Eliminar" la notificación en tiempo real).
  - Al eliminar desde el panel la notificación desaparece de inmediato y no se volverá a mostrar.
- Detección en tiempo real:
  - Vigila `data/notifications.json` cada **15s**. Si se publica una notificación nueva, aparece en pantalla en tiempo real (y se guarda en localStorage).

### Notas
- Se mantuvo íntegro el resto del código no relacionado con estas dos mejoras para evitar romper funcionalidades existentes.
- Si querés, en la v1.2 puedo:
  - Añadir tipos de notificación (info/alert/success) con colores y accesibilidad,
  - Añadir indicador visual si la notificación tiene acción (canal/image),
  - O permitir reactivar notificaciones descartadas desde el panel.

---

## v1.0 - Estructura base separada
📅 Fecha: 2025-10-18

### Archivos creados
- `index.html v1.0` — Separado del código monolítico. Estructura HTML limpia y modular.
- `styles.css v1.0` — Estilos extraídos a archivo independiente, con variables, temas y media queries.
- `app.js v1.0` — Lógica completa del PWA (tabs, notificaciones, EnVi, etc.).
- `manifest.json v1.0` — Configuración de la PWA (nombre, tema, ícono).
- `sw.js v1.0` — Service Worker básico.
- `data/*.json v1.0` — Datos estáticos de prueba (imágenes, videos, notificaciones, EnVi).
- `CHANGELOG.md` — Archivo de control de versiones (este documento).

### Notas
- Proyecto reorganizado desde `codigo.html` monolítico.
- Listo para futuras mejoras por módulo (HTML, CSS, JS o datos).
- Estructura de archivos establecida para control de versiones incremental (v1.x, v2.x, etc.).

---

🧩 **Próximos pasos sugeridos**
- [ ] Añadir favicon local y assets optimizados.
- [ ] Implementar minificación (build simple).
- [ ] Mejorar precarga y caché en `sw.js`.
- [ ] Añadir modo oscuro/tema dinámico.

---
