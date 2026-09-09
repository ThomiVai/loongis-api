# Validación y publicación

## Nuevas rutas

Todas requieren autenticación. Importación y edición requieren rol dueño.

- POST /api/inventory/ingredients/import: `{rows:[...]}`. Entre 1 y 200 insumos nuevos; validación y transacción. Stock inicial genera movimiento y lote.
- PATCH /api/inventory/ingredients/batch: `{rows:[{id,updatedAt,minimumStock,targetStock,unitCost,purchaseUnitFactor,purchaseUnitLabel,category,storageLocation}]}`. Todo o nada, con control de concurrencia por updatedAt. No modifica stock ni unidad.
- GET/POST /api/inventory/purchase-templates: consulta/creación compartida de habituales.
- DELETE /api/inventory/purchase-templates/:id: solo dueño. No borra compras.
- POST /api/orders: requestKey UUID v4 opcional. El servidor conserva un hash del contenido para devolver el mismo pedido ante reintentos idénticos. Si el contenido difiere devuelve 409. La clave y el hash se excluyen de respuestas públicas.

## Verificación

`npm run build`, `npm test`, `npm run test:integration`.

La integración crea un replica set MongoDB 7 temporal y una API en loopback; nunca importa dotenv ni la conexión de producción. Verifica permisos, importación con lotes/movimientos, rollback, concurrencia, habituales, conversión/costo promedio, pedido concurrente y confirmación/cancelación repetidas. Requiere poder descargar/iniciar mongod; CI configura Ubuntu 22.04 y Node 20.

No ejecutar las pruebas apuntando a la base real. No se requiere MONGODB_URI. No introducir secretos reales en el test.

## Publicación

1. Esperar validaciones de la API y frontend.
2. Verificar respaldos de Atlas según el plan contratado y efectuar una prueba de restauración en una base aparte. No declarar respaldos disponibles sin verificar la cuenta.
3. Publicar API y comprobar que existe el índice único disperso `requestKey_1` en orders. Mongoose lo declara para creación automática; si se deshabilita autoIndex, crearlo explícitamente antes de aceptar los nuevos intentos. No usar syncIndexes contra producción sin revisión.
4. Publicar frontend. La importación requiere transacciones (Atlas/replica set).
5. Probar con el dueño el circuito real completo y conciliar cualquier movimiento de prueba. No activar seguimiento ni modificar números por el despliegue.

La tabla rechaza filas si cualquier operación cambió updatedAt; actualizar y revisar antes de reintentar. Si se perdió la respuesta de una importación, actualizar inventario primero; los slugs únicos impiden duplicar insumos.
