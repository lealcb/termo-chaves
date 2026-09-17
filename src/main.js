import "./style.css";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { omitUncheckedDocuments } from "./optional-documents.js";

const form = document.querySelector("#termo-form");
const button = document.querySelector("#generate-button");
const errorBox = document.querySelector("#form-error");
const toast = document.querySelector("#toast");
const preview = document.querySelector("#document-preview");
const paperStage = document.querySelector("#paper-stage");

const MONTHS = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

function dateForDocument(value) {
  if (!value) return "DATA";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

function onlyNumbers(value) {
  return value.replace(/\D/g, "");
}

function formatCpf(value) {
  return onlyNumbers(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function getValues() {
  const values = Object.fromEntries(new FormData(form).entries());
  for (const field of ["rg", "cpf"]) {
    values[`incluir_${field}`] = document.querySelector(`#incluir-${field}`).checked;
    if (!values[`incluir_${field}`]) values[field] = "";
  }
  values.data = dateForDocument(values.data);
  values.inquilino = values.inquilino.trim().toUpperCase();
  values.chaves = values.chaves.trim().toUpperCase();
  for (const [key, value] of Object.entries(values)) {
    values[key] = typeof value === "string" ? value.trim() : value;
  }
  return values;
}

function textOr(value, fallback) {
  return value?.trim() || fallback;
}

function updatePreview() {
  const d = getValues();
  document.querySelectorAll('[data-preview="data"]').forEach((node) => {
    node.textContent = d.data;
  });
  document.querySelectorAll('[data-preview="inquilino"]').forEach((node) => {
    node.textContent = textOr(d.inquilino, "NOME DO INQUILINO");
  });

  const body = document.querySelector("#preview-body");
  body.replaceChildren();
  const pieces = [
    ["No dia ", false], [d.data, false], [" ", false],
    [textOr(d.inquilino, "NOME DO INQUILINO"), true],
    ...(d.incluir_rg ? [[" RG ", false], [textOr(d.rg, "RG"), false]] : []),
    ...(d.incluir_cpf ? [[" CPF ", false], [textOr(d.cpf, "CPF"), true]] : []),
    [" retirou as chaves conjunto com ", false],
    [textOr(d.chaves, "CHAVES ENTREGUES"), true],
    [", do imóvel situado em ", false],
    [textOr(d.endereco_imovel, "ENDEREÇO DO IMÓVEL"), false],
    [", em locação firmada entre PROPRIETÁRIOS ", false],
    [textOr(d.proprietario, "PROPRIETÁRIO"), false],
    [", inscrita no ", false],
    [textOr(d.cpf_cnpj, "CPF OU CNPJ"), false],
    [", ", false],
    [textOr(d.endereco_proprietario, "ENDEREÇO DO PROPRIETÁRIO"), false],
    [d.socios ? ` ${d.socios}` : "", false],
    [".", false],
  ];
  for (const [text, bold] of pieces) {
    const node = document.createElement(bold ? "strong" : "span");
    node.textContent = text;
    body.append(node);
  }

  let extra = document.querySelector("#preview-extra");
  if (d.mais_info) {
    if (!extra) {
      extra = document.createElement("p");
      extra.id = "preview-extra";
      extra.className = "document-extra";
      body.after(extra);
    }
    extra.textContent = d.mais_info;
  } else if (extra) {
    extra.remove();
  }
}

function resizePreview() {
  const available = paperStage.clientWidth - 32;
  const scale = Math.min(1, available / 794);
  preview.style.setProperty("--paper-scale", scale);
  paperStage.style.height = `${1123 * scale + 32}px`;
}

function safeFilename(value) {
  return value.replace(/[\\/*?:"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 180);
}

async function createDocx(data) {
  const response = await fetch(`${import.meta.env.BASE_URL}TEMPLATE.docx`);
  if (!response.ok) throw new Error("O modelo DOCX não foi encontrado.");
  const template = await response.arrayBuffer();
  const zip = new PizZip(template);
  zip.file("word/document.xml", omitUncheckedDocuments(zip.file("word/document.xml").asText(), data));
  const document = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    parser(tag) {
      const key = tag.trim();
      return { get: (scope) => scope[key] ?? "" };
    },
  });
  document.render(data);
  return document.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

async function createPdf() {
  const currentScale = preview.style.getPropertyValue("--paper-scale");
  const logo = preview.querySelector("img");
  if (logo?.decode) await logo.decode();
  preview.style.setProperty("--paper-scale", "1");
  await new Promise((resolve) => requestAnimationFrame(resolve));
  let canvas;
  try {
    canvas = await html2canvas(preview, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: 794,
      height: 1123,
    });
  } finally {
    preview.style.setProperty("--paper-scale", currentScale || "1");
  }
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297, undefined, "FAST");
  return pdf.output("blob");
}

async function createBundle(docxBlob, pdfBlob, baseName) {
  const zip = new PizZip();
  zip.file(`${baseName}.docx`, await docxBlob.arrayBuffer());
  zip.file(`${baseName}.pdf`, await pdfBlob.arrayBuffer());
  return zip.generate({ type: "blob", compression: "DEFLATE" });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 3600);
}

function syncDocumentFields() {
  for (const field of ["rg", "cpf"]) {
    const checked = document.querySelector(`#incluir-${field}`).checked;
    const input = document.querySelector(`#${field}`);
    input.required = checked;
    input.disabled = !checked;
    document.querySelector(`#${field}-required`).hidden = !checked;
  }
}

form.addEventListener("input", () => {
  syncDocumentFields();
  updatePreview();
});
document.querySelector("#cpf").addEventListener("input", (event) => {
  event.target.value = formatCpf(event.target.value);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  if (!form.checkValidity()) {
    form.reportValidity();
    errorBox.textContent = "Preencha todos os campos obrigatórios antes de gerar o documento.";
    errorBox.hidden = false;
    return;
  }

  const data = getValues();
  const baseName = safeFilename(`TERMO ENTREGA DE CHAVES ${data.data} ${data.inquilino}`);
  button.disabled = true;
  button.querySelector(".button-text").textContent = "Preparando documentos...";

  try {
    updatePreview();
    await document.fonts.ready;
    const [docx, pdf] = await Promise.all([createDocx(data), createPdf()]);
    const bundle = await createBundle(docx, pdf, baseName);
    saveAs(bundle, `${baseName}.zip`);
    showToast("DOCX e PDF gerados com sucesso.");
  } catch (error) {
    console.error(error);
    errorBox.textContent = `Não foi possível gerar os documentos: ${error.message}`;
    errorBox.hidden = false;
  } finally {
    button.disabled = false;
    button.querySelector(".button-text").textContent = "Baixar DOCX e PDF";
  }
});

document.querySelector("#data").value = new Date().toISOString().slice(0, 10);
new ResizeObserver(resizePreview).observe(paperStage);
syncDocumentFields();
updatePreview();
resizePreview();
