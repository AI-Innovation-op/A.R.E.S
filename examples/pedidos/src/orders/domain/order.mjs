// Agregado del ejemplo sintético: una orden confirmada no admite modificaciones.
export class Order {
  #lines = [];
  #confirmed = false;
  addLine(product, quantity) {
    if (this.#confirmed) throw new Error('Pedido confirmado');
    if (!product || !Number.isInteger(quantity) || quantity <= 0) throw new Error('Línea inválida');
    this.#lines.push({ product, quantity });
  }
  confirm() {
    if (!this.#lines.length) throw new Error('Pedido vacío');
    this.#confirmed = true;
  }
  get confirmed() { return this.#confirmed; }
  get lines() { return this.#lines.map(line => ({ ...line })); }
}
