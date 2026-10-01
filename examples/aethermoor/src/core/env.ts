// Режимы сборки.
// VITE_STATIC=1 — статическая веб-версия без сервера (например, публикация одной страницей):
//   облачные сохранения и внешние аудиофайлы не запрашиваются, всё хранится в браузере.
// Отладочные хуки (window.__aether) доступны в режиме разработки и в QA-сборке (VITE_QA=1).
export const STATIC_BUILD = import.meta.env.VITE_STATIC === '1';
export const DEBUG_HOOKS = import.meta.env.DEV || import.meta.env.VITE_QA === '1';
