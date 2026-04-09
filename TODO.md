# TODO — CleanCare

Última actualización: 2026-04-08

## Crítico (para que funcione end-to-end)
- [x] **App Expo** — actualizado a SDK 55 con todas las dependencias alineadas
- [x] **Vercel SPA rewrites** — agregado vercel.json al panel con rewrite a index.html

## Importante (para producción)
- [ ] **Recuperar contraseña** — flujo de reset password (email o código)
- [x] **Exportar reportes** — CSV desde Dashboard con botón "Exportar CSV"
- [ ] **Múltiples edificios** — permitir al admin gestionar varios edificios
- [x] **Validaciones** — IP format en backend+panel, email format y password mínimo 6 chars en backend+app

## Nice to have
- [ ] **Notificaciones push** — avisar al residente cuando la máquina termina
- [ ] **Dominio custom** — cleancare.uy apuntando al panel
- [ ] **Tests** — al menos para endpoints del backend
- [ ] **CI/CD** — GitHub Actions para auto-deploy en push
- [x] **Borrar CLAUDE_1.md** — ya no existe
- [ ] **Estado en tiempo real en panel** — ver qué máquinas están en uso ahora
