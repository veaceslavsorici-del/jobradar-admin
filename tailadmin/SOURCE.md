# Источник стилей

- TailAdmin, HTML-версия: https://github.com/TailAdmin/tailadmin-free-tailwind-dashboard-template
- Коммит: `1bd2dc42a8467ae0281cf00bd0050da4c9c4be07`
- Лицензия: MIT © 2023 TailAdmin — `tailadmin/LICENSE`.
- Взят только `src/css/style.css` (тема и классы). Убран `@import` Google Fonts, шрифт Outfit заменён на системный.
  JS TailAdmin (Alpine, ApexCharts, i18next) не используется.
- `admin.v1.css` собран Tailwind CSS standalone CLI v4.3.3 (sha256 `dc61b3ac6b8c9ca874c0cc4c57b2409791a64c5540404ca5f5367360babc313a`,
  сверен с `sha256sums.txt` релиза): `tailwindcss-linux-x64 -i src/input.css -o admin.v1.css --minify`. Сам CLI в хранилище не лежит.
