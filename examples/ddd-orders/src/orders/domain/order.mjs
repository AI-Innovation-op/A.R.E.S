// Ejemplo didáctico: falta proteger addLine después de confirmar.
export class Order {
  #lines = [];
  #confirmed = false;
  addLine(product, quantity) {
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
