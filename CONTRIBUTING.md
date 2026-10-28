# Contributing to Game Hub

Terima kasih atas minat Anda untuk berkontribusi pada **Game Hub**! Kontribusi dalam bentuk perbaikan bug, penambahan game baru, peningkatan performa, maupun pembaruan UI/UX sangat kami hargai.

---

## 🚀 Alur Berkontribusi

1. **Fork** repositori ini ke akun GitHub Anda.
2. Buat branch fitur baru:
   ```bash
   git checkout -b fitur/nama-fitur-anda
   ```
3. Lakukan perubahan kode dan uji secara menyeluruh pada resolusi desktop maupun mobile.
4. Commit perubahan Anda dengan pesan yang deskriptif:
   ```bash
   git commit -m "feat: tambah game baru / perbaikan responsivitas"
   ```
5. Push ke repositori fork Anda:
   ```bash
   git push origin fitur/nama-fitur-anda
   ```
6. Buka **Pull Request (PR)** ke branch `master` di repositori utama.

---

## 📌 Panduan & Standar Kode

- **PWA & Mobile-First:** Pastikan setiap elemen atau game baru dapat berjalan lancar pada perangkat layar sentuh (touchscreen) dan desktop keyboard.
- **Integrasi Leaderboard & Auth:** Jika menambahkan game baru, gunakan API yang sudah disediakan di folder `api/` agar skor pemain tersinkronisasi secara otomatis ke sistem leaderboard global.
- **Konsistensi UI:** Ikuti tema visual arcade/dark theme dengan font Plus Jakarta Sans dan palet warna neon yang selaras.
- **Keamanan:** Jangan mengekspos endpoint atau data sensitif dari folder `/data/`.
