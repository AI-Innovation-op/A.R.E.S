export function reserveStock(stock, reservations, reservationId, items) {
  if (reservations.includes(reservationId)) return;
  // Validar todo antes de cambiar existencias, también ante una reserva de varios SKU.
  for (const item of items) {
    if (
      !Number.isInteger(item.units) ||
      item.units <= 0 ||
      (stock[item.sku] ?? 0) < item.units
    )
      throw new Error(`Stock insuficiente: ${item.sku}`);
  }
  for (const item of items) stock[item.sku] -= item.units;
  reservations.push(reservationId);
}
