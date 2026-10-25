// Веб-админка JobRadar (этап 1, только просмотр). Контракт ответа — docs/ADMIN_WEB_SPEC.md в хранилище бота.
// Правила страницы: вывод только через createElement/textContent; ничего не хранится на устройстве; один внешний скрипт — telegram.org.
"use strict";

const API = "https://grgsfcutzcyflnqogkbj.supabase.co/functions/v1/bright-worker?admin";

// 25.10 (владелец: «укоротить, самые главные функции»): 3 вкладки, в итогах — шесть главных чисел; остальное — /stats в боте.
const TOTALS = {
  new_users: "Новых людей", seekers_radar_on: "Радар включён", vacancies_active: "Активных вакансий",
  applications: "Откликов", invited: "Приглашено", hires_total: "Наймов всего",
};
const DELIVERY = { sent: "Доставлено", waiting: "Ждут отправки", retrying: "Повторяются", failed: "Не доставлено" };
const PENDING = { vacancies: "Вакансии ждут проверки", edits: "Правки ждут", reports: "Жалобы", expired: "Истекли без проверки" };
const WHO = {
  totals: "Как в /stats — без исключений.",
  funnels: "Те же числа, что строки «🚪 Вход» и «Кафе» в сводке.",
  sources: "Те же числа, что «📣 Откуда люди» в сводке.",
  delivery: "Все сообщения за 7 дней.",
  pending: "Как в /pending.",
  bot: "Состояние бота сейчас.",
};
const TABS = {
  summary: ["pending", "totals", "funnels", "sources"],
  vacancies: ["vacancies", "deadlines"],
  bot: ["bot", "delivery"],
};

WHO.vacancies = "Одобренные и не удалённые вакансии; ваши помечены 🛠. Числа по людям — без вас, тестовых и заблокированных.";
WHO.deadlines = "Открытые вакансии, срок которых истекает за 3 дня; ожидающие решения — как в /pending.";

const STATE = { open: "открыта", closed: "закрыта", ended: "закрыта без причины или истекла" };
const CLOSE = { found_here: "нашли в JobRadar", found_elsewhere: "нашли в другом месте", not_needed: "больше не нужно" };

function num(value) {
  return value === null || value === undefined ? "—" : value;
}


function vacancyName(v) {
  return `${v.by_jobradar ? "🛠 " : ""}${v.title || "—"} · ${v.company || "—"} · ${v.city || "—"}`;
}


const tg = window.Telegram && window.Telegram.WebApp;
const state = { days: 7, tab: "summary", data: null, loading: false };

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function card(title, who) {
  const box = el("section", "mb-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3");
  box.append(el("h2", "text-theme-xl font-semibold", title));
  if (who) box.append(el("p", "mt-1 text-theme-xs text-gray-500 dark:text-gray-400", who));
  return box;
}

function metric(label, value) {
  const box = el("div", "rounded-xl border border-gray-200 p-3 dark:border-gray-800");
  box.append(el("span", "text-theme-xs text-gray-500 dark:text-gray-400", label));
  box.append(el("p", "mt-1 text-title-xs font-bold", value === null || value === undefined ? "—" : value));
  return box;
}

function grid() {
  return el("div", "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3");
}

function table(head, rows) {
  const wrap = el("div", "mt-3 overflow-x-auto");
  const t = el("table", "w-full text-theme-sm");
  const tr = el("tr", "border-b border-gray-200 text-left text-gray-500 dark:border-gray-800 dark:text-gray-400");
  head.forEach((h) => tr.append(el("th", "py-2 pr-3 font-medium", h)));
  const thead = el("thead");
  thead.append(tr);
  const tbody = el("tbody");
  rows.forEach((row) => {
    const r = el("tr", "border-b border-gray-100 dark:border-gray-800");
    row.forEach((cell) => r.append(el("td", "py-2 pr-3", cell)));
    tbody.append(r);
  });
  t.append(thead, tbody);
  wrap.append(t);
  return wrap;
}


// Время — по Кишинёву, как в сводке бота.
function when(value) {
  if (value === null || value === undefined || value === "") return "—";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return isNaN(date.getTime()) ? String(value) : date.toLocaleString("ru-RU", { timeZone: "Europe/Chisinau", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function failed(box, block) {
  box.append(el("p", "mt-2 text-theme-sm text-error-500", block && block.error ? block.error : "не удалось собрать"));
  return box;
}

const RENDER = {
  pending(block) {
    const box = card("⏳ Ждут решения", WHO.pending);
    if (!block.ok) return failed(box, block);
    const g = grid();
    Object.keys(PENDING).forEach((k) => g.append(metric(PENDING[k], block.data[k])));
    box.append(g);
    return box;
  },
  totals(block) {
    const box = card(`📊 Итоги за ${state.days} дн.`, WHO.totals);
    if (!block.ok) return failed(box, block);
    const g = grid();
    // Сначала известные поля в порядке TOTALS (люди → вакансии → отклики → доставка), затем новые, если база их добавит.
    const keys = Object.keys(TOTALS).filter((k) => k in block.data);
    keys.forEach((k) => {
      if (typeof block.data[k] === "number") g.append(metric(TOTALS[k] || k, block.data[k]));
    });
    box.append(g);
    return box;
  },
  funnels(block) {
    const box = card("🚪 Воронки", WHO.funnels);
    if (!block.ok) return failed(box, block);
    const entry = block.data.entry;
    if (entry) {
      box.append(el("p", "mt-3 font-medium", `Вход (${entry.days} дн.): пришли ${entry.came}`));
      box.append(table(["Этап", "Дошли"], (entry.steps || []).map((s) => [s.label, s.n])));
      if (entry.stuck && entry.stuck.length) {
        box.append(el("p", "mt-3 font-medium", "Застряли"));
        box.append(table(["Этап", "Людей"], entry.stuck.map((s) => [s[0], s[1]])));
      }
    }
    const emp = block.data.employer;
    if (emp) {
      box.append(el("p", "mt-3 font-medium", `Работодатели (${emp.days} дн.)`));
      box.append(table(["Пришли", "Анкета", "Подали", "Одобрено", "Отклики"], [[emp.came, emp.profile, emp.submitted, emp.approved, emp.responded]]));
    }
    return box;
  },
  sources(block) {
    const box = card("📣 Откуда люди", WHO.sources);
    if (!block.ok) return failed(box, block);
    const groups = block.data.groups || [];
    box.append(table(["Метка", "Пришли", "Соискатели", "Откликнулись", "Компании"],
      groups.map((g) => [g.label, g.came, g.seekers, g.responded, g.cafes])));
    return box;
  },
  delivery(block) {
    const box = card("✉️ Доставка за 7 дней", WHO.delivery);
    if (!block.ok) return failed(box, block);
    const g = grid();
    const sum = (list) => (Array.isArray(list) ? list.reduce((a, b) => a + (Number(b) || 0), 0) : null);
    Object.keys(DELIVERY).forEach((k) => g.append(metric(DELIVERY[k], sum(block.data[k]))));
    box.append(g);
    const errors = block.data.errors || [];
    if (errors.length) {
      box.append(el("p", "mt-4 font-medium", "Причины отказов"));
      box.append(table(["Причина", "Раз"], errors.map((e) => [e[0], e[1]])));
    }
    return box;
  },
  bot(block) {
    const box = card("🤖 Бот", WHO.bot);
    if (!block.ok) return failed(box, block);
    const d = block.data;
    const rows = [];
    if (d.community) rows.push(["Группа", `${d.community.title || ""}${d.community.members !== null && d.community.members !== undefined ? ` · ${d.community.members} участников` : ""}`]);
    if (d.counter) rows.push(["Счётчик «ищут работу»", `${d.counter.count} (${when(d.counter.updated_at)})`]);
    if (d.automod) rows.push(["Автопубликация", `${d.automod.on ? "вкл" : "выкл"} · сегодня ${d.automod.used_today} из ${d.automod.cap}`]);
    if (d.webhook) rows.push(["Telegram: ждут обработки", `${d.webhook.pending}${d.webhook.last_error_at ? ` · ошибка ${when(d.webhook.last_error_at)}` : ""}`]);
    if (d.hourly) rows.push(["Ежечасный проход", `${when(d.hourly.at)}${d.hourly.failed && d.hourly.failed.length ? ` · сбои: ${d.hourly.failed.join(", ")}` : " · без сбоев"}`]);
    box.append(table(["", ""], rows));
    const alerts = d.alerts || [];
    box.append(el("p", "mt-4 font-medium", alerts.length ? "Последние тревоги" : "Тревог нет"));
    if (alerts.length) box.append(table(["Где", "Когда"], alerts.map((a) => [a.place, when(a.at)])));
    return box;
  },
  vacancies(block) {
    const box = card("📋 Вакансии", WHO.vacancies);
    if (!block.ok) return failed(box, block);
    const d = block.data;
    box.append(el("p", "mt-2 text-theme-sm", `Всего: ${d.total}${d.truncated ? " (показаны 200 новых)" : ""}`));
    const rows = d.rows || [];
    if (!rows.length) return box;
    box.append(table(["Вакансия", "Состояние", "Срок", "Показано", "Откликов", "Принято"],
      rows.map((v) => [
        `${vacancyName(v)}${v.urgent ? " · ⏰" : ""}`,
        `${STATE[v.state] || v.state}${v.close_reason ? ` · ${CLOSE[v.close_reason] || v.close_reason}` : ""}`,
        when(v.expires_at), num(v.shown), num(v.applied), num(v.hired),
      ])));
    return box;
  },
  deadlines(block) {
    const box = card("⌛ Сроки", WHO.deadlines);
    if (!block.ok) return failed(box, block);
    const d = block.data;
    const o = d.oldest || {};
    box.append(table(["Самое старое ожидание", "С"], [["Вакансия на проверке", when(o.vacancy_at)], ["Правка вакансии", when(o.edit_at)], ["Жалоба", when(o.report_at)]]));
    box.append(el("p", "mt-4 font-medium", d.expiring_total ? `Истекают за 3 дня: ${d.expiring_total}` : "За 3 дня ничего не истекает"));
    const rows = d.expiring || [];
    if (rows.length) box.append(table(["Вакансия", "Истекает", "Предупредили"], rows.map((v) => [vacancyName(v), when(v.expires_at), v.warned ? "да" : "нет"])));
    return box;
  },
};

function setStatus(text) {
  document.getElementById("status").textContent = text;
}

function render() {
  const content = document.getElementById("content");
  content.replaceChildren();
  document.querySelectorAll(".tab").forEach((b) => {
    const on = b.dataset.tab === state.tab;
    b.className = `tab whitespace-nowrap rounded-lg px-3 py-1 text-theme-sm ${on ? "bg-brand-500 text-white" : "text-gray-600 dark:text-gray-300"}`;
  });
  document.querySelectorAll(".period").forEach((b) => {
    const on = Number(b.dataset.days) === state.days;
    b.className = `period rounded-lg border px-3 py-1 text-theme-sm ${on ? "border-brand-500 bg-brand-500 text-white" : "border-gray-200 dark:border-gray-800"}`;
  });
  if (!state.data) return;
  const blocks = state.data.blocks || {};
  TABS[state.tab].forEach((name) => {
    const block = blocks[name];
    if (block && RENDER[name]) content.append(RENDER[name](block));
  });
  setStatus(`Обновлено: ${when(state.data.generated_at)}`);
}

async function load() {
  if (state.loading) return;
  if (!tg || !tg.initData) {
    setStatus("Откройте админку кнопкой «🖥 Админка» в /admin в боте.");
    return;
  }
  state.loading = true;
  setStatus("Загружаю…");
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ initData: tg.initData, op: "overview", args: { days: state.days } }),
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    if (res.status === 401) {
      state.data = null;
      render();
      setStatus("Вход устарел — откройте админку заново из /admin.");
      return;
    }
    if (res.status === 403) {
      state.data = null;
      render();
      setStatus("Нет доступа.");
      return;
    }
    const body = await res.json();
    if (!res.ok || !body.ok) throw new Error("bad response");
    state.data = body;
    render();
  } catch (_error) {
    setStatus("Не получилось загрузить. Попробуйте ещё раз.");
  } finally {
    state.loading = false;
  }
}

function start() {
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.colorScheme === "dark") document.documentElement.classList.add("dark");
  }
  // Убрать данные входа из адреса (они уже у Telegram.WebApp).
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => { state.tab = b.dataset.tab; render(); }));
  document.querySelectorAll(".period").forEach((b) => b.addEventListener("click", () => {
    const days = Number(b.dataset.days);
    if (days !== state.days) { state.days = days; load(); }
  }));
  render();
  load();
}

start();
