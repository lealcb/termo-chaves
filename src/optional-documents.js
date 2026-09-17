// Word can split a placeholder across multiple runs. Remove only the matching
// text ranges, retaining the surrounding runs and their original formatting.
export function omitUncheckedDocuments(xml, data) {
  const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  for (const field of ["rg", "cpf"]) {
    if (data[`incluir_${field}`]) continue;
    const pattern = new RegExp(`\\s+${field.toUpperCase()}\\s*\\{\\{\\s*${field}\\s*\\}\\}`, "g");
    for (const paragraph of Array.from(doc.getElementsByTagNameNS(ns, "p"))) {
      const nodes = Array.from(paragraph.getElementsByTagNameNS(ns, "t"));
      const text = nodes.map((node) => node.textContent).join("");
      const ranges = Array.from(text.matchAll(pattern), (match) => [match.index, match.index + match[0].length]);
      let offset = 0;
      for (const node of nodes) {
        const original = node.textContent;
        node.textContent = original.split("").filter((_, index) =>
          !ranges.some(([start, end]) => offset + index >= start && offset + index < end)
        ).join("");
        offset += original.length;
      }
    }
  }
  return new XMLSerializer().serializeToString(doc);
}
