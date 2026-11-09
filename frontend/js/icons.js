"use strict";
/* Ikon SVG dan logo TitikTemu */

const IC = {
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  gamepad:
    '<path d="M7 8h10a4 4 0 0 1 4 4.2l-.6 3.6a2.2 2.2 0 0 1-3.8 1.1L15 15H9l-1.6 1.9a2.2 2.2 0 0 1-3.8-1.1L3 12.2A4 4 0 0 1 7 8z"/><path d="M8 10.5v3M6.5 12h3"/>',
  users:
    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.7c1.9.6 3.1 2.3 3.5 5.3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cash: '<rect x="3" y="7" width="18" height="10" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  bank: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h3v3M20 14v6h-3M14 20v-3"/>',
  trash:
    '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  logout:
    '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  upload: '<path d="M12 16V5M7.5 9.5 12 5l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  door: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M4 21h16"/><circle cx="14.5" cy="12.5" r="1"/>',
  power: '<path d="M12 3v9M6.3 6.8a8 8 0 1 0 11.4 0"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  power: '<path d="M12 3v9M6.3 6.8a8 8 0 1 0 11.4 0"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
};
const ic = (n) =>
  '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + IC[n] + "</svg>";
const logo = (s, tile) =>
  '<svg width="' +
  s +
  '" height="' +
  s +
  '" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="' +
  (tile || "#6C4DF5") +
  '"/><circle cx="52" cy="12" r="7" fill="#FF7A59"/><path d="M14 27c0-5 4-8 9-8h18c5 0 9 3 9 8l3 14c1 5-3 8-7 6l-6-4H24l-6 4c-4 2-8-1-7-6z" fill="' +
  (tile ? "#6C4DF5" : "#fff") +
  '"/><path d="M22 27v10M17 32h10" stroke="' +
  (tile ? "#fff" : "#6C4DF5") +
  '" stroke-width="3.2" stroke-linecap="round"/><circle cx="41" cy="29" r="2.6" fill="#FFC94D"/><circle cx="46" cy="35" r="2.6" fill="#3DDBB0"/></svg>';
