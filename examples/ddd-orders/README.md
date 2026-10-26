# Pedidos: recorrido DDD de A.R.E.S.

Ejemplo sintético, sin datos privados ni servicios externos. Incluye un defecto deliberado: un pedido confirmado admite nuevas líneas. La prueba debe fallar hasta corregirlo.

Lenguaje ubicuo: pedido, línea, confirmar. Contexto delimitado: Pedidos. Agregado: Order. Invariantes: cantidades positivas, al menos una línea para confirmar y ninguna modificación posterior. El caso de uso confirmOrder depende del puerto repository; una implementación de persistencia se aportaría desde infraestructura.

1. Conecta una copia de esta carpeta en Repositorio.
2. Ejecuta test: la invariante de inmutabilidad debe fallar.
3. En Arquitectura genera un borrador DDD con estas reglas.
4. Lee src/orders/domain/order.mjs y solicita proteger addLine cuando el pedido ya está confirmado.
5. Revisa Antes/Después. La propuesta aún no cambia el archivo.
6. Aplica el cambio revisado y ejecuta test: las tres pruebas deben pasar.
7. Restaura el original: vuelve el defecto didáctico y la prueba vuelve a fallar.

No es una plantilla de producción ni implementa pagos, concurrencia o persistencia real. El recorrido automatizado usa un proveedor de prueba determinista para la propuesta y PostgreSQL/Docker reales para guardar, aplicar, comprobar y restaurar.
