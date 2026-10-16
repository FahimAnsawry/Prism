// A minimal PDF writer for the Export menu's PDF (tools.md §8: no libraries). Each page shows one
// JPEG edge to edge, so the file is a header, a few dictionaries per page, the JPEG bytes as they
// are (DCTDecode) and the cross-reference table that points at each object.

export interface PdfPage {
  /** A baseline RGB JPEG, as canvas.toBlob("image/jpeg") writes. */
  jpeg: Uint8Array<ArrayBuffer>;
  pixelWidth: number;
  pixelHeight: number;
  /** Page size in board px (shown at 96 per inch, like the browser prints them). */
  width: number;
  height: number;
}

/** PDF points per CSS px: 72 per inch over 96 per inch. */
const PT_PER_PX = 0.75;

const num = (value: number) => String(Number(value.toFixed(2)));

/** A PDF text string in UTF-16BE, so any title shows correctly. */
function pdfText(text: string) {
  let hex = "FEFF";
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, "0");
  return `<${hex}>`;
}

export function pdfFile(pages: PdfPage[], title: string) {
  const encoder = new TextEncoder();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const offsets: number[] = [];
  let length = 0;
  const write = (chunk: string | Uint8Array<ArrayBuffer>) => {
    const bytes = typeof chunk === "string" ? encoder.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, ...body: (string | Uint8Array<ArrayBuffer>)[]) => {
    offsets[id] = length;
    write(`${id} 0 obj\n`);
    for (const chunk of body) write(chunk);
    write("\nendobj\n");
  };

  // The binary comment tells tools the file holds binary data.
  write("%PDF-1.4\n");
  write(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  // Objects: 1 catalog, 2 page tree, 3 info, then per page its page, contents and image.
  const pageId = (index: number) => 4 + 3 * index;
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(
    2,
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );
  object(3, `<< /Title ${pdfText(title)} /Producer (Prism) >>`);
  pages.forEach((page, i) => {
    const id = pageId(i);
    const width = num(page.width * PT_PER_PX);
    const height = num(page.height * PT_PER_PX);
    object(
      id,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
        `/Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`,
    );
    // Stretches the image (1 × 1 in its own space) over the page.
    const content = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`;
    object(id + 1, `<< /Length ${content.length} >>\nstream\n`, content, "\nendstream");
    object(
      id + 2,
      `<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      page.jpeg,
      "\nendstream",
    );
  });

  const xref = length;
  const size = pageId(pages.length);
  // Every entry is exactly 20 bytes.
  let table = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let id = 1; id < size; id++) table += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  write(table);
  write(`trailer\n<< /Size ${size} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: "application/pdf" });
}
