const FORMATS = {
  story: [1080, 1920],
  post: [1080, 1350],
  square: [1080, 1080],
  wall: [2560, 1440],
};
const EXAMPLES = [
  ["ONE MORE", "focused hour"],
  ["DEEP WORK", "is the reward"],
  ["SHOW UP", "every single day"],
  ["QUIET FOCUS", "is a kind of power"],
  ["NO SHORTCUTS", "only the work"],
];
const COLORS = { bg: "#0c0a09", text: "#f8f4f0" };
const GITHUB_REPO = "";
const LOGO_RATIO = 15 / 104;

const state = {
  fmt: "story",
  pos: "bottom",
  dim: 0.7,
  zoom: 1,
  ox: 0,         // image offset, -1 to 1 of the available slack
  oy: 0,
  logo: false,
  credit: "",
  tainted: false, // the image blocks canvas export (cross-origin without CORS)
  output: "png",  // what the main button does: png, jpeg, webp or copy
  img: null,
};

const $ = (id) => document.getElementById(id);
const canvas = $("cv");
const ctx = canvas.getContext("2d");
const frame = $("frame");
const logoImg = new Image();
logoImg.onload = () => draw();
logoImg.src = LOGO;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const setStatus = (message) => { $("status").textContent = message; };

const setEmpty = (message) => { $("emptyText").textContent = message; };

let toastTimer;
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function loadImagePreviewOnly(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function coverGeometry(img, W, H) {
  const imageRatio = img.width / img.height;
  let w, h;
  if (imageRatio > W / H) { h = H; w = H * imageRatio; } else { w = W; h = W / imageRatio; }
  w *= state.zoom;
  h *= state.zoom;
  return { w, h, slackX: Math.max(0, (w - W) / 2), slackY: Math.max(0, (h - H) / 2) };
}

function fitFontSize(text, fontFor, maxWidth, size) {
  while (size > 12) {
    ctx.font = fontFor(size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function drawBackground(W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#241d17");
  g.addColorStop(1, COLORS.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawImage(img, W, H) {
  const g = coverGeometry(img, W, H);
  ctx.drawImage(img, (W - g.w) / 2 + state.ox * g.slackX, (H - g.h) / 2 + state.oy * g.slackY, g.w, g.h);
}

function drawShade(W, H) {
  const atBottom = state.pos === "bottom";
  const shade = ctx.createLinearGradient(0, atBottom ? H : 0, 0, atBottom ? H * 0.38 : H * 0.62);
  shade.addColorStop(0, `rgba(12,10,9,${state.dim})`);
  shade.addColorStop(1, "rgba(12,10,9,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
}

/** Draws the two text lines and returns the base font size, which the footer reuses. */
function drawText(W, H) {
  const atBottom = state.pos === "bottom";
  const maxWidth = W * 0.84;
  const base = Math.sqrt(W * H) * 0.047; // follows the poster's area, so every format gets text of similar weight
  const sans = (s) => `300 ${s}px "DM Sans", sans-serif`;
  const serif = (s) => `italic 400 ${s}px "Instrument Serif", Georgia, serif`;
  const line1 = $("l1").value.toUpperCase().trim();
  const line2 = $("l2").value.trim();

  let size = base;
  if (line1) size = Math.min(size, fitFontSize(line1, sans, maxWidth, base));
  if (line2) size = Math.min(size, fitFontSize(line2, serif, maxWidth, base * 1.12) / 1.12);

  const bottomLine = H * 0.875;
  const topLine = H * 0.115;
  const y2 = atBottom ? bottomLine : topLine + size * 1.05;
  const y1 = atBottom ? y2 - size * 1.02 : topLine;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.text;
  if (line1) { ctx.font = sans(size); ctx.fillText(line1, W / 2, y1); }
  if (line2) { ctx.font = serif(size * 1.12); ctx.fillText(line2, W / 2, atBottom ? y2 : y1 + size * 1.02); }
  return size;
}

function drawLogo(W, H, size) {
  const w = size * 2.6;
  const h = w * LOGO_RATIO;
  const centerY = state.credit.trim() ? H * 0.93 : H * 0.945;
  ctx.drawImage(logoImg, W / 2 - w / 2, centerY - h / 2, w, h);
}

function drawCredit(W, H, size) {
  const credit = state.credit.trim();
  if (!credit) return;
  ctx.font = `400 ${size * 0.3}px "DM Sans", sans-serif`;
  ctx.fillStyle = "rgba(248,244,240,.5)";
  let text = credit;
  while (ctx.measureText(text).width > W * 0.9 && text.length > 8) text = text.slice(0, -2);
  ctx.fillText(text === credit ? text : text + "…", W / 2, H * 0.972);
}

function draw(dims = FORMATS[state.fmt]) {
  const [W, H] = dims;
  canvas.width = W;
  canvas.height = H;

  if (state.img) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    drawImage(state.img, W, H);
  } else {
    drawBackground(W, H);
  }
  drawShade(W, H);
  const size = drawText(W, H);
  if (state.logo && logoImg.complete) drawLogo(W, H, size);
  drawCredit(W, H, size);
  $("empty").hidden = !!state.img;
}

const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;
const FORMAT_ANIMATION_MS = 320;
let formatAnimation = 0;

function changeFormat(next) {
  const from = FORMATS[state.fmt];
  const to = FORMATS[next];
  state.fmt = next;
  cancelAnimationFrame(formatAnimation);
  if (prefersReducedMotion.matches || from === to) { draw(); return; }

  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / FORMAT_ANIMATION_MS);
    if (t < 1) {
      const k = easeOutCubic(t);
      draw([Math.round(lerp(from[0], to[0], k)), Math.round(lerp(from[1], to[1], k))]);
      formatAnimation = requestAnimationFrame(step);
    } else {
      draw();
    }
  };
  formatAnimation = requestAnimationFrame(step);
}

/** Puts an image on the poster. `selected` is the index of the default image it came from, or -1. */
function useImage(img, { tainted = false, credit = "", message = "", selected = -1 } = {}) {
  Object.assign(state, { img, ox: 0, oy: 0, tainted, credit });
  $("credit").value = credit;
  markSelectedThumb(selected);
  draw();
  setStatus(message);
}

function markSelectedThumb(index) {
  document.querySelectorAll(".thumb[data-i]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.i === index)));
}

function renderDefaults() {
  $("defaultsEmpty").hidden = DEFAULT_IMAGES.length > 0;
  $("thumbs").innerHTML = DEFAULT_IMAGES.map((item, i) => `
    <button class="thumb" type="button" data-i="${i}" aria-pressed="false" title="${escapeHtml(item.title)}">
      <img src="${escapeHtml(item.thumb || item.src)}" alt="${escapeHtml(item.title)}" loading="lazy">
    </button>`).join("");
}

async function selectDefault(index) {
  const item = DEFAULT_IMAGES[index];
  if (!item) return;
  const options = { credit: item.credit || "", message: item.title, selected: index };
  try {
    useImage(await loadImage(item.src), options);
  } catch {
    try {
      // Typically the page was opened as a file: the image shows, but the browser blocks the export.
      useImage(await loadImagePreviewOnly(item.src), {
        ...options, tainted: true, message: "Preview only: open this page through a web server to export default images.",
      });
    } catch {
      setStatus("This image could not be loaded.");
    }
  }
}

function useFile(file) {
  if (!file || !file.type.startsWith("image/")) { setStatus("This file is not an image."); return; }
  loadImage(URL.createObjectURL(file))
    .then((img) => useImage(img, { message: "Image uploaded: " + file.name }))
    .catch(() => setStatus("This image is unreadable."));
}

async function useLink(link) {
  try { new URL(link); } catch { setStatus("This link is not valid."); return; }
  setStatus("Loading link…");
  try {
    useImage(await loadImage(link), { message: "Image loaded from the link." });
    return;
  } catch { /* the site refuses canvas copies: fall back to a preview-only image */ }
  try {
    useImage(await loadImagePreviewOnly(link), {
      tainted: true,
      message: "Preview only: this site blocks export. Download the image, then upload it.",
    });
  } catch {
    setStatus("Could not load this link. Make sure it's a direct link to an image.");
  }
}

const TAINTED_MESSAGE = "This image's site blocks export. Download it, then upload it.";

const OUTPUTS = {
  png: { type: "image/png", ext: "png", label: "PNG" },
  jpeg: { type: "image/jpeg", ext: "jpg", label: "JPG", quality: 0.92 },
  webp: { type: "image/webp", ext: "webp", label: "WebP", quality: 0.9 },
};

async function renderBlob(output) {
  try {
    draw();
    return await new Promise((resolve) => canvas.toBlob(resolve, output.type, output.quality));
  } finally {
    draw();
  }
}

const renderPng = () => renderBlob(OUTPUTS.png);

function posterFilename(ext = "png") {
  const slug = ($("l2").value || "promethee").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `poster-${slug}.${ext}`;
}

function saveBlob(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
}

async function copyPoster() {
  if (!(navigator.clipboard && window.ClipboardItem)) {
    toast("This browser can't copy images. Download it instead.");
    return;
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": renderPng() })]);
    toast("Poster copied to the clipboard");
  } catch {
    toast("Could not copy the poster. Download it instead.");
  }
}

async function exportImage() {
  if (state.tainted) { toast(TAINTED_MESSAGE); return; }
  if (state.output === "copy") { copyPoster(); return; } // no await before the clipboard call: it needs the click

  const output = OUTPUTS[state.output];
  const button = $("dl");
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = "Preparing…";
  try {
    const blob = await renderBlob(output);
    const filename = posterFilename(output.ext);
    saveBlob(blob, filename);
    toast(`Downloaded ${filename}`);
  } catch {
    toast("Export failed: this image can't be copied to the canvas. Try another one.");
  }
  button.disabled = false;
  button.innerHTML = original;
}

function setOutput(value) {
  if (!(value in OUTPUTS) && value !== "copy") value = "png";
  state.output = value;
  $("output").value = value;
  $("dl").dataset.mode = value === "copy" ? "copy" : "download";
  $("dlLabel").textContent = value === "copy" ? "Copy" : `Download ${OUTPUTS[value].label}`;
  try { localStorage.setItem("poster-output", value); } catch { /* storage unavailable: the choice just isn't remembered */ }
}

function restoreOutput() {
  let saved = "png";
  try { saved = localStorage.getItem("poster-output") || "png"; } catch { /* same */ }
  setOutput(saved);
}

/* X's web intent cannot attach an image, so the poster is copied to the clipboard and the
   composer opens with the text ready: the user pastes the image with Ctrl+V. If the browser
   refuses the clipboard, the PNG is downloaded instead so it can be attached by hand. */
async function shareOnX() {
  if (state.tainted) { toast(TAINTED_MESSAGE); return; }

  const words = [$("l1").value.trim(), $("l2").value.trim()].filter(Boolean).join(" ");
  const params = new URLSearchParams({ text: `${words ? words + "\n\n" : ""}Made with Promethee lab` });
  if (GITHUB_REPO) params.set("url", `https://github.com/${GITHUB_REPO}`);

  // Both calls stay synchronous in the click handler, so the browser keeps the user gesture.
  const copied = navigator.clipboard && window.ClipboardItem
    ? navigator.clipboard.write([new ClipboardItem({ "image/png": renderPng() })]).then(() => true, () => false)
    : Promise.resolve(false);
  window.open(`https://x.com/intent/post?${params}`, "_blank", "noopener");

  if (await copied) {
    toast("Poster copied. Paste it into your post (Ctrl+V).");
    return;
  }
  try {
    saveBlob(await renderPng(), posterFilename());
    toast("Poster downloaded. Attach it to your post.");
  } catch {
    toast("Could not prepare the poster for sharing.");
  }
}

function bindSegmented(id, key) {
  $(id).addEventListener("click", (e) => {
    const button = e.target.closest("button[data-v]");
    if (!button) return;
    $(id).querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    if (key === "fmt") {
      document.querySelector(".app").dataset.fmt = button.dataset.v; // the layout gives wide formats a wider preview
      changeFormat(button.dataset.v);
    } else {
      state[key] = button.dataset.v;
      draw();
    }
  });
}
bindSegmented("fmt", "fmt");
bindSegmented("pos", "pos");

["l1", "l2"].forEach((id) => $(id).addEventListener("input", () => draw()));
let exampleIndex = 0;
$("example").addEventListener("click", () => {
  exampleIndex = (exampleIndex + 1) % EXAMPLES.length;
  [$("l1").value, $("l2").value] = EXAMPLES[exampleIndex];
  draw();
});

$("dim").addEventListener("input", (e) => {
  state.dim = e.target.value / 100;
  $("dimOut").textContent = e.target.value + "%";
  draw();
});
$("zoom").addEventListener("input", (e) => {
  state.zoom = e.target.value / 100;
  $("zoomOut").textContent = e.target.value + "%";
  draw();
});
$("reset").addEventListener("click", () => {
  state.ox = state.oy = 0;
  state.zoom = 1;
  $("zoom").value = 100;
  $("zoomOut").textContent = "100%";
  draw();
});
$("credit").addEventListener("input", (e) => { state.credit = e.target.value; draw(); });
$("logo").addEventListener("change", (e) => { state.logo = e.target.checked; draw(); });
$("dl").addEventListener("click", exportImage);
$("output").addEventListener("change", (e) => setOutput(e.target.value));
$("share").addEventListener("click", shareOnX);

function showSource(name) {
  document.querySelectorAll("#sources [role=tab]").forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  ["images", "upload", "link"].forEach((id) => { $("tab-" + id).hidden = id !== name; });
}
$("sources").addEventListener("click", (e) => {
  const tab = e.target.closest("[role=tab]");
  if (tab) showSource(tab.dataset.tab);
});
$("sources").addEventListener("keydown", (e) => {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const tabs = [...document.querySelectorAll("#sources [role=tab]")];
  const current = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
  const next = tabs[(current + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
  showSource(next.dataset.tab);
  next.focus();
});

$("thumbs").addEventListener("click", (e) => {
  const thumb = e.target.closest(".thumb[data-i]");
  if (thumb) selectDefault(+thumb.dataset.i);
});

const drop = $("drop");
const openFilePicker = () => $("file").click();
drop.addEventListener("click", openFilePicker);
drop.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFilePicker(); }
});
$("file").addEventListener("change", (e) => { useFile(e.target.files[0]); e.target.value = ""; });
[frame, drop].forEach((zone) => {
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("dragging"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragging"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragging");
    useFile(e.dataTransfer.files[0]);
  });
});
document.addEventListener("paste", (e) => {
  const file = [...(e.clipboardData ? e.clipboardData.files : [])].find((f) => f.type.startsWith("image/"));
  if (file) { e.preventDefault(); useFile(file); }
});

$("urlForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const link = $("url").value.trim();
  if (link) useLink(link);
});

let drag = null;
canvas.addEventListener("pointerdown", (e) => {
  if (!state.img) return;
  drag = { x: e.clientX, y: e.clientY, ox: state.ox, oy: state.oy };
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add("drag");
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const [W, H] = FORMATS[state.fmt];
  const g = coverGeometry(state.img, W, H);
  const scale = W / canvas.clientWidth; // screen pixels to canvas pixels
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  if (g.slackX) state.ox = clamp(drag.ox + ((e.clientX - drag.x) * scale) / g.slackX);
  if (g.slackY) state.oy = clamp(drag.oy + ((e.clientY - drag.y) * scale) / g.slackY);
  draw();
});
["pointerup", "pointercancel"].forEach((type) =>
  canvas.addEventListener(type, () => { drag = null; canvas.classList.remove("drag"); })
);

const formatCount = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n));

async function showStarCount() {
  if (!GITHUB_REPO) return;
  const link = $("stars");
  link.href = `https://github.com/${GITHUB_REPO}`;
  link.hidden = false;
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`);
    if (!res.ok) return; // repo not found or rate-limited: show the star without a number
    const { stargazers_count } = await res.json();
    $("starCount").textContent = formatCount(stargazers_count);
  } catch { /* offline: same fallback */ }
}

const hasDefaults = DEFAULT_IMAGES.length > 0;
showStarCount();
restoreOutput();
renderDefaults();
showSource(hasDefaults ? "images" : "upload"); // with no default images, open on the tab that works
setEmpty(hasDefaults ? "Pick an image to start." : "Upload an image or paste a link to start.");
draw();
Promise.all([
  document.fonts.load('300 40px "DM Sans"'),
  document.fonts.load('italic 40px "Instrument Serif"'),
]).catch(() => {}).then(() => {
  draw();
  if (hasDefaults) selectDefault(0);
});
