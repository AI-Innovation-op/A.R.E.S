# Ejemplo DDD: Pedidos

Ejemplo sintético sin servicios externos ni dependencias. Contexto: Pedidos. Agregado: Order. El caso de uso depende del puerto repository.

Invariantes: cantidades enteras positivas, un pedido vacío no se confirma y un pedido confirmado no admite nuevas líneas.

Desde esta carpeta ejecuta `npm test` con Node.js 22 o posterior. Las tres pruebas comprueban las invariantes y el caso de uso.

Este ejemplo no implementa la aplicación A.R.E.S., pagos, concurrencia ni persistencia de producción.
