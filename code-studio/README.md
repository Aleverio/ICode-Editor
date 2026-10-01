# Code Studio

Editor desktop ringan berbasis Tauri 2, React, TypeScript, dan CodeMirror 6.

## Menjalankan

Prasyarat: Node.js, Rust, serta dependensi desktop Tauri untuk sistem operasi yang digunakan.

```sh
npm install
npm run tauri -- dev
```

`npm run dev` menjalankan preview antarmuka di browser. Fitur buka folder, baca/tulis file, dan terminal hanya aktif di aplikasi desktop Tauri.

## Fitur

- Explorer folder dengan file tree dan pembuatan file/folder.
- Tab editor dengan syntax highlighting untuk TypeScript, JavaScript, JSON, HTML, CSS, dan Markdown.
- Simpan file, pencarian cepat, serta command palette.
- Terminal yang menjalankan perintah di folder workspace aktif.

## Pintasan

- `Ctrl+P`: buka command palette.
- `Ctrl+O`: buka folder project.
- `Ctrl+S`: simpan file aktif.
- `Ctrl+Shift+T`: tampilkan atau sembunyikan terminal.

Perintah terminal dijalankan oleh shell sistem dengan hak akses pengguna saat ini.

## Struktur Source

```text
src/
	components/       Komponen UI yang dipakai lintas fitur
	features/
		editor/         CodeMirror, dukungan bahasa, dan tipe dokumen
		explorer/       File tree
		terminal/       Panel terminal
		workbench/      Komposisi layout editor
		workspace/      State workspace dan operasi file
	index.css         Reset global
	workbench.css     Token dan layout workbench
src-tauri/src/
	commands/         Command filesystem dan terminal
	lib.rs            Composition root aplikasi Tauri
```

Editor membaca file teks UTF-8 sampai 5 MiB. File yang lebih besar atau bukan teks ditolak dengan pesan yang jelas.
