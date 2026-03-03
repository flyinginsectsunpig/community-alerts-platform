export const $ = (id) => document.getElementById(id);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
