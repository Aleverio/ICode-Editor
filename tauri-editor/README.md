# Morrow Editor

Editor kode mobile-first berbasis Tauri 2, React, TypeScript, dan CodeMirror. File workspace disimpan lokal di perangkat; file eksternal dibuka dan disimpan lewat dialog native.

## Mulai

```sh
npm install
npm run dev
```

Untuk menjalankan shell desktop Tauri:

```sh
npm run tauri -- dev
```

## Android

Pasang Android Studio, Android SDK, dan JDK yang didukung Tauri 2. Atur `ANDROID_HOME`/`ANDROID_SDK_ROOT` dan `JAVA_HOME`, lalu jalankan:

```sh
npm run tauri:android:init
npm run tauri:android:dev
```

Build rilis dengan `npm run tauri:android:build`.

## iOS

iOS membutuhkan macOS dan Xcode. Dari Mac, jalankan:

```sh
npm run tauri:ios:init
npm run tauri:ios:dev
```

Build rilis dengan `npm run tauri:ios:build`.

## Cakupan editor

HTML, CSS, JavaScript/TypeScript, JSON, dan Markdown memiliki syntax highlighting. Workspace contoh serta file baru tersimpan otomatis di local storage; gunakan Open dan Save untuk file di penyimpanan perangkat.

## Struktur editor

- `src/App.tsx` mengorkestrasi workspace, state UI, dan aksi editor.
- `src/features/editor/types.ts` berisi kontrak file workspace, shortcut, dan command.
- `src/features/editor/workspace.ts` menangani pemulihan workspace, identitas file, dan label path.
- `src/features/editor/codeMirror.ts` memuat konfigurasi bahasa, tema, metrik line/gutter yang selaras, dan ruang scroll virtual tanpa menambah baris dokumen.
- `src/features/editor/commands.ts` menjadi katalog command dan keybinding.
- `src/features/editor/CommandPalette.tsx` menangani pencarian serta navigasi daftar command.
- `src/features/terminal/` memuat interpreter Morrow Shell virtual dan registry package internal.

## Command palette

Buka dengan `Ctrl+Shift+P` atau `⌘+Shift+P`, lalu cari perintah dan jalankan dengan `Enter`. Gunakan tombol panah untuk memilih dan `Escape` untuk menutup. Command yang tersedia mencakup Save, Open folder/files, Find, Create new file, Toggle file explorer, Toggle Morrow Shell, dan Close active tab. Shortcut lain: `Ctrl/⌘+S`, `Ctrl/⌘+O`, `Ctrl/⌘+F`, `Ctrl/⌘+N`, `Ctrl/⌘+J` untuk terminal, serta `Ctrl/⌘+B` atau `Ctrl/⌘+P` untuk file explorer.

`Open folder` pada desktop memuat file teks proyek secara rekursif tanpa batas jumlah atau ukuran buatan, mempertahankan path relatif, serta mengabaikan folder dependency/build dan symlink. Android/iOS memakai native multi-file picker karena Tauri dialog belum mendukung folder picker di platform tersebut.

## Morrow Shell

Terminal aplikasi memakai filesystem virtual `/workspace` dan tidak menjalankan command pada sistem operasi host. Command dasar: `help`, `pwd`, `ls`, `cd`, `cat`, `touch`, `echo`, `clear`, `whoami`, `uname`, dan `pkg`. Perintah di luar workspace ditolak.

Package manager menyimpan tool yang dipasang di storage aplikasi. Coba `pkg search`, `pkg install tree`, `pkg install json-tools`, `tree`, dan `jsonfmt <file.json>`. Registry versi pertama berisi tool bawaan aplikasi; paket ini bukan binary Linux dan tidak menjalankan skrip instalasi eksternal.
