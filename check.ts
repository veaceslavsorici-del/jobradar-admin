// Проверка страницы перед публикацией (CI). Правила — docs/ADMIN_PANEL_PLAN.md в хранилище бота (правки по критику).
const OURS = ["index.html", "app.v1.js"];
const ALL = [...OURS, "admin.v1.css"];
const FORBIDDEN = ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval(", "new Function", "localStorage",
  "sessionStorage", "indexedDB", "serviceWorker", 'setAttribute("style"', "setAttribute('style'"];
// Разрешённые источники: Telegram (скрипт Mini App), функция бота, пространство имён SVG (не запрос, а имя).
const ALLOWED_ORIGINS = ["https://telegram.org", "https://grgsfcutzcyflnqogkbj.supabase.co", "http://www.w3.org"];
const CSP = `default-src 'none'; script-src 'self' https://telegram.org; style-src 'self'; img-src 'self' data:; connect-src https://grgsfcutzcyflnqogkbj.supabase.co; base-uri 'none'; form-action 'none'`;
const errors: string[] = [];

for (const file of OURS) {
  const text = await Deno.readTextFile(file);
  for (const word of FORBIDDEN) if (text.includes(word)) errors.push(`${file}: запрещено «${word}»`);
}
for (const file of ALL) {
  const text = (await Deno.readTextFile(file)).replace(/\/\*![\s\S]*?\*\//g, ""); // лицензионный комментарий сборщика стилей
  for (const raw of text.match(/https?:\/\/[^\s"'`)<>;]+/g) ?? []) {
    let origin = "";
    try {
      origin = new URL(raw).origin;
    } catch {
      origin = raw;
    }
    if (!ALLOWED_ORIGINS.includes(origin)) errors.push(`${file}: чужой адрес ${raw}`);
  }
}
const html = await Deno.readTextFile("index.html");
if (!html.includes(`<meta http-equiv="Content-Security-Policy" content="${CSP}">`)) errors.push("index.html: CSP не совпадает с эталоном");
if (!html.includes(`<meta name="referrer" content="no-referrer">`)) errors.push("index.html: нет referrer no-referrer");
if (/<script(?![^>]*\bsrc=)/.test(html)) errors.push("index.html: встроенный <script> без src");
if (/\sstyle=/.test(html)) errors.push("index.html: атрибут style");

if (errors.length) {
  console.error(errors.join("\n"));
  Deno.exit(1);
}
console.log("OK: проверка страницы пройдена");
