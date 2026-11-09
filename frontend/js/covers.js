"use strict";
/* Sampul game: hanya tampilan di halaman depan */
const SHOWCASE = [
  { judul: "EA SPORTS FC 25", genre: "Sport", img: "assets/games/fc25.jpg" },
  { judul: "NBA 2K25", genre: "Sport", img: "assets/games/nba2k25.jpg" },
  { judul: "Gran Turismo 7", genre: "Racing", img: "assets/games/gt7.jpg" },
];
const gameStrip = () =>
  '<div class="game-strip">' +
  SHOWCASE.map(
    (g) =>
      '<figure class="gs"><div class="cover"><img src="' + esc(g.img) + '" alt="Sampul ' + esc(g.judul) + '" loading="lazy"></div>' +
      "<figcaption><b>" + esc(g.judul) + '</b><span class="small muted">' + esc(g.genre) + "</span></figcaption></figure>",
  ).join("") +
  "</div>";
