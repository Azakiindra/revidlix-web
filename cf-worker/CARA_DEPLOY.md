# Cara Deploy Cloudflare Worker untuk RevIDLIX

## Kenapa perlu ini?
Cloudflare memblokir SEMUA IP Vercel (AWS Lambda) dari mengakses `z2.idlixku.com`.
Cloudflare Worker berjalan di dalam jaringan Cloudflare sendiri, sehingga bisa menembus blokir ini.

---

## Langkah 1: Buat akun Cloudflare (gratis)
Buka: https://dash.cloudflare.com/sign-up
Daftar dengan email — **tidak perlu domain atau kartu kredit**.

---

## Langkah 2: Buat Worker baru
1. Login ke https://dash.cloudflare.com
2. Klik **"Workers & Pages"** di sidebar kiri
3. Klik **"Create"** → **"Create Worker"**
4. Beri nama: `revidlix-proxy` (atau nama apapun)
5. Klik **"Deploy"** (abaikan kode contoh dulu)

---

## Langkah 3: Paste kode Worker
1. Setelah deploy, klik **"Edit code"**
2. **Hapus semua kode yang ada**
3. **Copy isi file `cf-worker/worker.js`** dari repo ini
4. Paste ke editor
5. Klik **"Deploy"**

---

## Langkah 4: Catat URL Worker
Setelah deploy, kamu akan dapat URL seperti:
```
https://revidlix-proxy.YOUR_SUBDOMAIN.workers.dev
```
**Catat URL ini!**

---

## Langkah 5: Set Environment Variable di Vercel
1. Buka https://vercel.com → Project RevIDLIX
2. **Settings** → **Environment Variables**
3. Tambahkan 2 variable:

| Name | Value | Environment |
|---|---|---|
| `CF_PROXY_URL` | `https://revidlix-proxy.YOUR_SUBDOMAIN.workers.dev` | Production, Preview, Development |
| `NEXT_PUBLIC_CF_PROXY_URL` | `https://revidlix-proxy.YOUR_SUBDOMAIN.workers.dev` | Production, Preview, Development |

4. Klik **Save**
5. **Redeploy** project di Vercel (Deployments → Redeploy)

---

## Verifikasi
Buka browser, akses:
```
https://revidlix-proxy.YOUR_SUBDOMAIN.workers.dev/z2/api/movies/the-conjuring-2013
```
Harus tampil **JSON** (bukan halaman Cloudflare challenge).

Lalu test di app:
```
https://revidlix-web.vercel.app/
```
Masukkan `the-conjuring-2013` dan klik Resolve.

---

## Batas Free Plan
- 100,000 request per hari → lebih dari cukup untuk pemakaian normal
- Tidak butuh kartu kredit
