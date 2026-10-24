const clock = document.getElementById("clock");
const status = document.getElementById("status");
const note = document.getElementById("note");

function tick() {
  clock.textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

tick();
setInterval(tick, 1000);

status.textContent = "已连通";

if (location.protocol === "file:") {
  note.textContent = "本地文件模式 · 通过 file:// 打开";
} else {
  note.textContent = `已部署 · ${location.host || "静态托管"}`;
}

console.log("[ARG-for-novel] boot ok", { href: location.href, at: new Date().toISOString() });
