export class Order {
  #lines;
  #status;
  constructor(id, lines = [], status = "draft") {
    if (!id || !["draft", "confirmed"].includes(status))
      throw new Error("Pedido inválido");
    Object.defineProperty(this, "id", { value: id, enumerable: true });
    this.#status = status;
    this.#lines = lines.map((line) => ({ ...line }));
    if (status === "confirmed") this.assertConfirmable();
  }
  addLine(productId, quantity) {
    if (this.#status !== "draft")
      throw new Error("El pedido confirmado no admite cambios");
    if (!productId || !Number.isInteger(quantity) || quantity <= 0)
      throw new Error("Cantidad inválida");
    const line = this.#lines.find((line) => line.productId === productId);
    if (line) line.quantity += quantity;
    else this.#lines.push({ productId, quantity });
  }
  assertConfirmable() {
    if (!this.#lines.length)
      throw new Error("No se puede confirmar un pedido vacío");
    if (
      this.#lines.some(
        (line) =>
          !line.productId ||
          !Number.isInteger(line.quantity) ||
          line.quantity <= 0,
      )
    )
      throw new Error("Línea inválida");
  }
  confirm() {
    this.assertConfirmable();
    this.#status = "confirmed";
  }
  get status() {
    return this.#status;
  }
  get lines() {
    return this.#lines.map((line) => ({ ...line }));
  }
  snapshot() {
    return { id: this.id, lines: this.lines, status: this.#status };
  }
  static restore(snapshot) {
    return new Order(snapshot.id, snapshot.lines, snapshot.status);
  }
}
