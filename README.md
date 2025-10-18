# 🧾 CHANGELOG - SalemTV PWA

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
