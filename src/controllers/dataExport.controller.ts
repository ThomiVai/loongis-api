import type {
  Request,
  Response,
} from "express";

import { InventoryMovement } from "../models/inventoryMovement.model";
import { InventoryPurchase } from "../models/inventoryPurchase.model";
import { Order } from "../models/order.model";

type CsvValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined;

const MAX_EXPORT_ROWS =
  50_000;

function csvCell(
  value: CsvValue,
): string {
  let text =
    value instanceof Date
      ? value.toISOString()
      : value === null ||
          value === undefined
        ? ""
        : String(value);

  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function createCsv(
  headers: string[],
  rows: CsvValue[][],
): string {
  return (
    "\uFEFF" +
    [
      headers,
      ...rows,
    ]
      .map((row) =>
        row.map(csvCell).join(","),
      )
      .join("\r\n")
  );
}

function sendCsv(
  response: Response,
  name: string,
  headers: string[],
  rows: CsvValue[][],
): void {
  const date =
    new Date()
      .toISOString()
      .slice(0, 10);

  response.set({
    "Content-Type":
      "text/csv; charset=utf-8",
    "Content-Disposition":
      `attachment; filename="loongis-${name}-${date}.csv"`,
    "Cache-Control":
      "no-store",
  });

  response.status(200).send(
    createCsv(headers, rows),
  );
}

function orderItemsText(
  items: Array<{
    name: string;
    quantity: number;
  }>,
): string {
  return items
    .map(
      (item) =>
        `${item.quantity} x ${item.name}`,
    )
    .join(" | ");
}

export async function exportOrders(
  _request: Request,
  response: Response,
): Promise<void> {
  const orders =
    await Order.find()
      .sort({ createdAt: -1 })
      .limit(MAX_EXPORT_ROWS)
      .lean();

  sendCsv(
    response,
    "pedidos",
    [
      "numero",
      "fecha",
      "estado",
      "cliente",
      "telefono",
      "direccion",
      "pago",
      "productos",
      "total_productos",
      "costo_envio",
      "total",
      "estado_inventario",
      "motivo_cancelacion",
    ],
    orders.map((order) => [
      order.orderNumber,
      order.createdAt,
      order.status,
      order.customer.name,
      order.customer.phone,
      order.customer.address,
      order.paymentMethod,
      orderItemsText(order.items),
      order.productsTotal,
      order.deliveryCost,
      order.total,
      order.inventoryTrackingStatus,
      order.cancellationReason,
    ]),
  );
}

export async function exportSales(
  _request: Request,
  response: Response,
): Promise<void> {
  const orders =
    await Order.find({
      status: "confirmed",
    })
      .sort({ createdAt: -1 })
      .limit(MAX_EXPORT_ROWS)
      .lean();

  sendCsv(
    response,
    "ventas",
    [
      "numero_pedido",
      "fecha",
      "medio_pago",
      "unidades",
      "productos",
      "venta_productos",
      "costo_envio",
      "total",
    ],
    orders.map((order) => [
      order.orderNumber,
      order.createdAt,
      order.paymentMethod,
      order.items.reduce(
        (total, item) =>
          total + item.quantity,
        0,
      ),
      orderItemsText(order.items),
      order.productsTotal,
      order.deliveryCost,
      order.total,
    ]),
  );
}

export async function exportPurchases(
  _request: Request,
  response: Response,
): Promise<void> {
  const purchases =
    await InventoryPurchase.find()
      .sort({ purchasedAt: -1 })
      .limit(MAX_EXPORT_ROWS)
      .lean();

  const rows =
    purchases.flatMap((purchase) =>
      purchase.lines.map((line) => [
        purchase.purchasedAt,
        purchase.supplierName,
        purchase.invoiceNumber,
        line.ingredientName,
        line.presentationQuantity,
        line.presentationLabel,
        line.conversionFactor,
        line.baseQuantity,
        line.totalCost,
        line.unitCost,
        line.batchNumber,
        line.expirationDate,
        purchase.notes,
        purchase.createdByEmail,
      ]),
    );

  sendCsv(
    response,
    "compras",
    [
      "fecha",
      "proveedor",
      "comprobante",
      "insumo",
      "cantidad_presentaciones",
      "presentacion",
      "conversion",
      "cantidad_base",
      "costo_total",
      "costo_unitario",
      "lote",
      "vencimiento",
      "notas",
      "registrado_por",
    ],
    rows,
  );
}

export async function exportMovements(
  _request: Request,
  response: Response,
): Promise<void> {
  const movements =
    await InventoryMovement.find()
      .populate("ingredient", "name")
      .sort({ createdAt: -1 })
      .limit(MAX_EXPORT_ROWS)
      .lean();

  sendCsv(
    response,
    "movimientos",
    [
      "fecha",
      "insumo",
      "tipo",
      "cambio",
      "stock_anterior",
      "stock_nuevo",
      "costo_unitario",
      "costo_estimado",
      "pedido",
      "nota",
      "registrado_por",
    ],
    movements.map((movement) => {
      const ingredient =
        movement.ingredient as unknown as {
          name?: string;
        };

      return [
        movement.createdAt,
        ingredient?.name ?? "",
        movement.type,
        movement.change,
        movement.previousStock,
        movement.newStock,
        movement.unitCost,
        movement.estimatedCost,
        movement.orderNumber,
        movement.note,
        movement.performedByEmail,
      ];
    }),
  );
}
