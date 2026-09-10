import type { Request, Response } from 'express';
import { Order } from '../models/order.model';
import { salesRange, SALES_TIMEZONE } from '../services/salesReport';
export async function getSalesReport(request: Request, response: Response): Promise<void> {
  let range: ReturnType<typeof salesRange>;
  try { range = salesRange(request.query.from, request.query.to); }
  catch (error) { response.status(400).json({ success: false, message: (error as Error).message }); return; }
  try {
    const rows = await Order.aggregate<{ _id: string; sales: number; orders: number }>([
      { $match: { status: 'confirmed', createdAt: { $gte: range.start, $lt: range.end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: SALES_TIMEZONE } }, sales: { $sum: '$productsTotal' }, orders: { $sum: 1 } } },
    ]);
    const byDay = new Map(rows.map(row => [row._id, row]));
    const days = range.days.map(date => ({ date, sales: byDay.get(date)?.sales ?? 0, orders: byDay.get(date)?.orders ?? 0 }));
    const sales = days.reduce((sum, day) => sum + day.sales, 0);
    const orders = days.reduce((sum, day) => sum + day.orders, 0);
    response.json({ success: true, data: { from: range.from, to: range.to, timezone: SALES_TIMEZONE, sales, orders, averageTicket: orders ? sales / orders : 0, days } });
  } catch (error) {
    console.error('Error al consultar ventas:', error);
    response.status(500).json({ success: false, message: 'No se pudo generar el reporte de ventas.' });
  }
}
