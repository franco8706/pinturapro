#!/usr/bin/env node
/**
 * Harness para PROBAR la calidad de Bria AI en el recoloreo de paredes (1000 acciones gratis).
 *
 * Uso:
 *   BRIA_API_TOKEN=xxx node scripts/test-bria-wall.mjs <imagen> <mascara> "<prompt de color>"
 *
 *   <imagen>  : URL http(s) o ruta local (la foto de la pared/fachada)
 *   <mascara> : URL http(s) o ruta local — PNG donde BLANCO = pared a repintar, NEGRO = preservar
 *   <prompt>  : ej "deep navy blue matte wall paint"
 *
 * Saca el token en https://bria.ai (sección API/Platform). NO lo commitees.
 * Doc del endpoint: https://docs.bria.ai/image-editing/v2-endpoints/gen-fill
 *
 * Nota: los nombres exactos de campos pueden ajustarse según la doc viva de Bria; este script
 * usa los documentados (image_url/mask_url o base64) y deja todo listo para iterar.
 */
import { readFile, writeFile } from "node:fs/promises";

const BASE = "https://engine.prod.bria-api.com";
const TOKEN = process.env.BRIA_API_TOKEN;
const [, , imageArg, maskArg, prompt = "smooth matte wall paint, photorealistic"] = process.argv;

if (!TOKEN) fail("Falta BRIA_API_TOKEN en el entorno.");
if (!imageArg || !maskArg) fail('Uso: node scripts/test-bria-wall.mjs <imagen> <mascara> "<prompt>"');

function fail(msg) {
  console.error("✖", msg);
  process.exit(1);
}

// Convierte un arg en el par de campos que entiende Bria (URL directa o base64 local).
async function toFields(arg, kind) {
  if (/^https?:\/\//.test(arg)) return { [`${kind}_url`]: arg };
  const buf = await readFile(arg);
  return { [`${kind}_file`]: buf.toString("base64") };
}

async function main() {
  const body = {
    ...(await toFields(imageArg, "image")),
    ...(await toFields(maskArg, "mask")),
    prompt,
    sync: true, // pedimos resultado directo; si la cuenta fuerza async, manejamos el polling abajo
  };

  console.log("→ POST /v2/image/edit/gen_fill  (prompt:", JSON.stringify(prompt) + ")");
  let res = await fetch(`${BASE}/v2/image/edit/gen_fill`, {
    method: "POST",
    headers: { "Content-Type": "application/json", api_token: TOKEN },
    body: JSON.stringify(body),
  });
  let data = await res.json().catch(() => ({}));
  if (!res.ok) fail(`Bria respondió ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);

  // Async: viene { request_id, status_url } → pollear hasta tener result_url.
  if (data.status_url && !resultUrlOf(data)) {
    process.stdout.write("… procesando");
    for (let i = 0; i < 40 && !resultUrlOf(data); i++) {
      await sleep(2000);
      process.stdout.write(".");
      data = await (await fetch(data.status_url, { headers: { api_token: TOKEN } })).json();
    }
    console.log("");
  }

  const url = resultUrlOf(data);
  if (!url) fail("No encontré la imagen de resultado en la respuesta: " + JSON.stringify(data).slice(0, 400));

  const out = "bria-result.png";
  const img = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(out, img);
  console.log("✓ Guardado", out, `(${img.length} bytes). Abrilo y comparalo con el método gratis.`);
}

// Busca la URL del resultado en las distintas formas que puede tener la respuesta de Bria.
function resultUrlOf(d) {
  return d?.result_url || d?.result?.[0]?.url || d?.result?.image_url || d?.urls?.[0] || null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

main().catch((e) => fail(e.message));
