export function diagramDimensions(svg: SVGSVGElement) {
  const box = svg.viewBox.baseVal;
  const width = box.width || Number.parseFloat(svg.getAttribute('width') || '') || 800;
  const height = box.height || Number.parseFloat(svg.getAttribute('height') || '') || 500;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('El diagrama no tiene dimensiones válidas.');
  return { width, height };
}
export function diagramBlob(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement, { width, height } = diagramDimensions(svg);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width)); clone.setAttribute('height', String(height));
  clone.style.maxWidth = 'none'; clone.style.background = '#08151a';
  return new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportDiagram(svg: SVGSVGElement, format: 'svg' | 'png') {
  const blob = diagramBlob(svg);
  if (format === 'svg') { download(blob, 'ares-diagrama.svg'); return; }
  const { width, height } = diagramDimensions(svg), scale = Math.min(2, 4096 / width, 4096 / height);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('No se pudo preparar el PNG. Puedes exportar el SVG.')); image.src = url; });
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d'); if (!context) throw new Error('Este navegador no ofrece exportación PNG.');
    context.fillStyle = '#08151a'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No se pudo exportar el PNG.')), 'image/png'));
    download(png, 'ares-diagrama.png');
  } finally { URL.revokeObjectURL(url); }
}
