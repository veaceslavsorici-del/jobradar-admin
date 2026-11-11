// Страница ответа компании кандидату (кнопки в письме-отклике JobRadar). Адрес: answer.html?k=<i|r|f>&t=<токен>&l=<ru|ro|en>.
// Ответ записывает только нажатие кнопки (POST): почтовые сканеры, открывающие ссылки из писем, ничего не меняют.
// Значения из адреса на страницу не выводятся; весь текст — из словаря ниже, только через textContent.
const API = "https://grgsfcutzcyflnqogkbj.supabase.co/functions/v1/bright-worker?answer=1";
const TEXT = {
  ru: {
    q: { i: "Пригласить кандидата на собеседование?", r: "Сообщить кандидату, что он не подходит?", f: "Сообщить кандидату, что вакансия уже закрыта?" },
    btn: { i: "📞 Да, пригласить", r: "❌ Да, не подходит", f: "🔒 Да, уже нашли" },
    note: "Кандидат сразу получит ваш ответ в боте JobRadar.",
    sent: { i: "✅ Кандидат узнал, что вы его приглашаете. Позвоните ему — номер в письме.", iMail: "✅ Кандидат узнал, что вы его приглашаете. Он напишет вам на почту.", r: "✅ Ответ отправлен кандидату.", f: "✅ Ответ отправлен кандидату." },
    done: "✅ Вы уже ответили этому кандидату.",
    gone: "⚠️ Ссылка больше не работает: кандидат удалил свои данные или ссылка неверная.",
    fail: "⚠️ Не получилось отправить ответ. Попробуйте ещё раз через минуту.",
    post: "Разместить свою вакансию в JobRadar — бесплатно",
  },
  ro: {
    q: { i: "Invitați candidatul la interviu?", r: "Îi spuneți candidatului că nu se potrivește?", f: "Îi spuneți candidatului că postul este deja ocupat?" },
    btn: { i: "📞 Da, invit", r: "❌ Da, nu se potrivește", f: "🔒 Da, am găsit deja" },
    note: "Candidatul primește răspunsul imediat în botul JobRadar.",
    sent: { i: "✅ Candidatul a aflat că îl invitați. Sunați-l — numărul este în scrisoare.", iMail: "✅ Candidatul a aflat că îl invitați. Vă va scrie pe e-mail.", r: "✅ Răspunsul a fost trimis candidatului.", f: "✅ Răspunsul a fost trimis candidatului." },
    done: "✅ Ați răspuns deja acestui candidat.",
    gone: "⚠️ Linkul nu mai funcționează: candidatul și-a șters datele sau linkul este greșit.",
    fail: "⚠️ Răspunsul nu a fost trimis. Încercați din nou peste un minut.",
    post: "Publicați postul dvs. vacant în JobRadar — gratuit",
  },
  en: {
    q: { i: "Invite the candidate to an interview?", r: "Tell the candidate they are not a fit?", f: "Tell the candidate the job is already filled?" },
    btn: { i: "📞 Yes, invite", r: "❌ Yes, not a fit", f: "🔒 Yes, already filled" },
    note: "The candidate gets your answer right away in the JobRadar bot.",
    sent: { i: "✅ The candidate knows you are inviting them. Call them — the number is in the email.", iMail: "✅ The candidate knows you are inviting them. They will email you.", r: "✅ Your answer was sent to the candidate.", f: "✅ Your answer was sent to the candidate." },
    done: "✅ You have already answered this candidate.",
    gone: "⚠️ This link no longer works: the candidate deleted their data or the link is wrong.",
    fail: "⚠️ The answer was not sent. Please try again in a minute.",
    post: "Post your job in JobRadar — free",
  },
};

const params = new URLSearchParams(location.search);
const kind = ["i", "r", "f"].includes(params.get("k")) ? params.get("k") : null;
const token = /^\d{1,15}_\d{1,15}_[a-f0-9]{24}$/.test(params.get("t") ?? "") ? params.get("t") : null;
const text = TEXT[params.get("l")] ?? TEXT.ru;
const el = (id) => document.getElementById(id);

document.documentElement.lang = TEXT[params.get("l")] ? params.get("l") : "ru";

function finish(message) {
  el("question").hidden = true;
  el("confirm").hidden = true;
  el("note").hidden = true;
  el("result").textContent = message;
  el("result").hidden = false;
}

function offerPost() {
  el("post").textContent = text.post;
  el("post").href = `https://jobradar.md/src_mail_${token.split("_")[0]}`;
  el("more").hidden = false;
}

if (!kind || !token) {
  finish(text.gone);
} else {
  el("question").textContent = text.q[kind];
  el("note").textContent = text.note;
  el("confirm").textContent = text.btn[kind];
  el("confirm").hidden = false;
  el("confirm").addEventListener("click", async () => {
    el("confirm").disabled = true;
    try {
      const response = await fetch(API, { method: "POST", body: JSON.stringify({ kind, token }) });
      const answer = await response.json();
      if (response.status === 404) return finish(text.gone);
      if (!answer.ok) throw new Error("answer");
      finish(answer.state === "done" ? text.done : kind === "i" && !answer.phone ? text.sent.iMail : text.sent[kind]);
      offerPost();
    } catch {
      el("confirm").disabled = false;
      el("result").textContent = text.fail;
      el("result").hidden = false;
    }
  });
}
