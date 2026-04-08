# TODO — CleanCare

Última actualización: 2026-04-08

## Crítico (para que funcione end-to-end)
- [ ] **App Expo** — resolver incompatibilidad SDK 55 vs Expo Go 54 (bajar SDK o actualizar Expo Go)
- [ ] **Vercel SPA rewrites** — agregar vercel.json al panel con rewrite a index.html para que /dashboard y /maquinas no den 404 al refrescar

## Importante (para producción)
- [ ] **Recuperar contraseña** — flujo de reset password (email o código)
- [ ] **Exportar reportes** — CSV/PDF desde Dashboard para facturación del consorcio
- [ ] **Múltiples edificios** — permitir al admin gestionar varios edificios
- [ ] **Validaciones** — IP format en formulario máquinas, email format, password mínimo

## Nice to have
- [ ] **Notificaciones push** — avisar al residente cuando la máquina termina
- [ ] **Dominio custom** — cleancare.uy apuntando al panel
- [ ] **Tests** — al menos para endpoints del backend
- [ ] **CI/CD** — GitHub Actions para auto-deploy en push
- [ ] **Borrar CLAUDE_1.md** — quedó el viejo, ya existe CLAUDE.md
- [ ] **Estado en tiempo real en panel** — ver qué máquinas están en uso ahora
