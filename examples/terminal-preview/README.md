# Prototipo sintético para la terminal

Con backend iniciado, abre `npm run terminal` desde la raíz:

```text
preview examples/terminal-preview/sources.json
zip ID-DEVUELTO .local-setup/terminal-preview.zip
```

El primer comando compila estos tres archivos; no abre ni ejecuta la vista. Puedes abrir el enlace temporal por decisión propia. El segundo escribe un ZIP nuevo con las mismas fuentes, salida, manifiesto y licencias. El archivo de destino debe no existir.

Para comprobar la fidelidad, cambia 17 por 999 en main.ts dentro de sources.json, compila de nuevo y compara. Es una demostración explícita, sin pagos, persistencia ni autenticación: no representa archivos privados del usuario ni una implementación completa de pedidos DDD.
