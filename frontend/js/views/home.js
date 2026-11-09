"use strict";
/* Beranda customer: perkenalan, sampul game, tarif, tombol pesan */
async function homeView() {
  const info = await api("GET", "/publik/info");
  const t = info.tarif;
  return (
    '<main class="landing">' +
    '<section class="hero"><div class="hero-in">' +
    '<div class="hero-logo">' + logo(84, "#fff") + "</div>" +
    '<h1 class="hero-t">Titik<span>Temu</span></h1>' +
    '<p class="hero-s">Sewa PS, gampang &amp; seru.</p>' +
    '<p class="hero-d">Pilih PS, pilih ruangan, bayar, lalu langsung main bareng teman.</p>' +
    '<div class="hero-cta"><a class="btn btn-coral" href="#/pesan">' + ic("gamepad") + 'Pesan sekarang</a>' +
    '<a class="btn btn-light" href="#/pesanan">Cek pesanan saya</a></div>' +
    "</div></section>" +
    '<section class="wrap main-col">' +
    "<h2>Game seru yang tersedia</h2>" + gameStrip() +
    '<h2 class="sp">Tarif per jam</h2><div class="tarif">' +
    '<div class="tcard c1"><span class="small">PS5</span><b>' + rp(t.PS5) + "</b><span class=\"tiny\">per jam</span></div>" +
    '<div class="tcard c2"><span class="small">PS4</span><b>' + rp(t.PS4) + "</b><span class=\"tiny\">per jam</span></div></div>" +
    '<p class="small muted">Ditambah biaya ruangan per jam: VVIP +Rp 30.000, VIP +Rp 15.000, Reguler gratis.</p>' +
    '<h2 class="sp">Cara pesan</h2><ol class="how">' +
    "<li><b>1</b><span>Isi data diri</span></li><li><b>2</b><span>Pilih PS dan jam main</span></li>" +
    "<li><b>3</b><span>Pilih ruangan</span></li><li><b>4</b><span>Bayar: Tunai, Transfer, atau QRIS</span></li></ol>" +
    '<footer class="foot"><a href="#/admin">Masuk sebagai admin</a></footer></section></main>'
  );
}
