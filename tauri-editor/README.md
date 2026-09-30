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
