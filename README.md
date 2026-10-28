# 🎮 Game Hub - Arcade Portal & Global Leaderboard

[![Live Demo](https://img.shields.io/badge/Demo-game.dwicky.dev-00ffcc?style=for-the-badge&logo=google-chrome&logoColor=black)](https://game.dwicky.dev/)
[![Status](https://img.shields.io/badge/Status-Online-brightgreen?style=for-the-badge)](https://game.dwicky.dev/)
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20PWA-orange?style=for-the-badge)](https://game.dwicky.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE.txt)

Portal game arcade web modern dan responsif yang menghadirkan **7 game arcade klasik & modern**, dilengkapi dengan sistem autentikasi akun berproteksi PIN 6-digit, papan peringkat global (*live leaderboard*), kustomisasi avatar & skin, serta dukungan Progressive Web App (PWA) untuk perangkat mobile dan desktop.

🌐 **Akses Game Hub:** [https://game.dwicky.dev/](https://game.dwicky.dev/)

---

## 🕹️ Daftar Game yang Tersedia

Game Hub mengumpulkan 7 koleksi game arcade yang dapat dimainkan langsung di browser tanpa perlu instalasi aplikasi:

| Game | Deskripsi | Fitur Spesial |
| :--- | :--- | :--- |
| **🔢 2048** | Puzzle geser angka adiktif untuk mencapai ubin 2048. | Best score tracking & smooth tile animation. |
| **🐦 Flappy Bird** | Kendalikan burung melewati celah pipa berjarak. | Dynamic score themes (Sky, Deep Space, Nebula), collectible stars, Retina HiDPI graphics & skin selector. |
| **🐍 Snake Neon** | Game ular klasik dengan gaya visual neon modern. | Responsive touch/keyboard arena, zoom-center view, dan skin kustom. |
| **🟡 Pacman** | Jelajahi labirin menghindari hantu dan makan semua pelet. | Classic arcade sound & gameplay, responsive control pad, dan skin kustom. |
| **🧱 Tetris** | Susun dan putar balok yang jatuh untuk menghapus baris. | Smooth drop physics, level progression, dan line clear counter. |
| **🃏 Memory Game** | Tantangan mencocokkan pasangan kartu bergambar. | Timer, move counter, dan difficulty challenge. |
| **❌ X O X (Tic-Tac-Toe)** | Permainan adu strategi klasik X dan O. | Fast-match gameplay vs AI/lawan. |

---

## ✨ Fitur Unggulan

### 🏆 1. Live Global Leaderboard & Top 3 Champions
- Papan peringkat langsung (*real-time*) untuk masing-masing game.
- Banner **Top 3 Juara Global** di bagian atas portal yang menampilkan pemain terbaik secara keseluruhan.
- Modal pratinjau profil pemain lengkap dengan statistik skor tertinggi.

### 🔐 2. Autentikasi Pemain & Keamanan PIN 6-Digit
- Sistem akun instan tanpa ribet menggunakan username dan **PIN 6-digit**.
- Fitur pemulihan lupa PIN menggunakan **Pertanyaan Keamanan (Security Question Recovery)**.
- Dukungan ganti avatar dan kustomisasi profil pemain.

### 🎨 3. Sistem Skin & Tema Visual
- Pemilih skin karakter untuk game seperti Flappy Bird, Snake, dan Pacman.
- Transisi tema latar atmosferik dinamis pada Flappy Bird saat skor bertambah (25+ pts).

### 📱 4. PWA & Mobile-First Experience
- Teroptimasi untuk layar smartphone maupun monitor desktop.
- Dukungan instalasi PWA (*Progressive Web App*) langsung ke Home Screen perangkat.
- Popup interaktif **Fullscreen Mode** untuk pengalaman bermain *arcade* yang imersif dan bebas distraksi.
- Caching offline cepat menggunakan Service Worker (`sw.js`).

---

## 🛠️ Tech Stack & Arsitektur

- **Frontend:**
  - HTML5 & CSS3 (Glassmorphism UI, Neon Arcade Theme, Plus Jakarta Sans typography)
  - Vanilla JavaScript (ES6+) modular & Canvas rendering
  - Service Worker & Web App Manifest (PWA)
- **Backend & API:**
  - PHP 8.3 FPM REST API (`/api/auth.php`, `/api/leaderboard.php`)
- **Database:**
  - SQLite 3 (`/data/leaderboard.sqlite`) dengan indeks komposit skor dan nama pengguna
- **Infrastructure:**
  - Nginx Web Server
  - Cloudflare Tunnel & CDN

---

## 📁 Struktur Direktori

```text
├── api/
│   ├── auth.php            # Endpoint login, registrasi PIN & pemulihan akun
│   └── leaderboard.php     # Endpoint skor global & leaderboard per game
├── data/
│   └── leaderboard.sqlite  # Database SQLite (terproteksi dari akses publik)
├── games/
│   ├── 2048/               # Game puzzle 2048
│   ├── flappy/             # Game Flappy Bird
│   ├── memory/             # Game Memory Card
│   ├── pacman/             # Game Pacman
│   ├── snake/              # Game Snake Neon
│   ├── tetris/             # Game Tetris
│   └── xox/                # Game Tic-Tac-Toe
├── js/                     # Modul logika hub, auth modal, profile, audio & event handler
├── style/                  # Master stylesheet hub.css & tema neon arcade
├── meta/                   # Aset ikon PWA, manifest, dan meta tag
├── index.html              # Landing page utama Game Hub
├── sw.js                   # Service Worker untuk PWA & caching
└── manifest.webmanifest    # Manifest web app
```

---

## 🚀 Menjalankan Secara Lokal / Server Sendiri

### Persyaratan:
- Web server (Nginx atau Apache)
- PHP 8.1+ dengan ekstensi `pdo_sqlite` terpasang

### Langkah Setup:
1. Clone repositori:
   ```bash
   git clone https://github.com/BDwicky/Game-s.git
   cd Game-s
   ```
2. Pastikan direktori `data/` memiliki izin tulis untuk user web server:
   ```bash
   mkdir -p data
   chmod 775 data
   chown -R www-data:www-data data
   ```
3. Arahkan *document root* web server Anda ke folder repositori ini.
4. Pastikan direktori `/data/` diblokir dari akses HTTP langsung di konfigurasi web server:
   ```nginx
   location ^~ /data/ {
       deny all;
       return 404;
   }
   ```

---

## 📄 Lisensi & Atribusi

Proyek portal Game Hub ini dikembangkan dan dirancang oleh **[BDwicky](https://github.com/BDwicky)**.  
Game-game di dalam repositori ini menggunakan dan mengadaptasi berbagai pustaka open-source klasik di bawah lisensi [MIT License](LICENSE.txt).
