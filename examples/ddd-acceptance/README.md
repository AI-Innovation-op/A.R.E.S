# Caso de aceptación DDD: Pedidos e Inventario

Ejemplo sintético ejecutable, separado del ejemplo con defecto deliberado `../ddd-orders`. No utiliza IA, datos del usuario ni servicios externos.

Ejecutar desde esta carpeta: `npm test` (Node 22 o superior). Las seis pruebas comprueban pedido vacío, confirmación válida, inmutabilidad, stock insuficiente, reintento y concurrencia sobre un adaptador transaccional en memoria. Ver [ADR-001](docs/ADR-001.md) para lenguaje de negocio, límites y secuencia.

Para verificar la regla principal cambia temporalmente assertConfirmable para permitir cero líneas y repite las pruebas: debe fallar el caso de pedido vacío. Restaurar esa modificación devuelve el comportamiento esperado. Una compilación o un diagrama por sí solos no acreditan esta regla.
