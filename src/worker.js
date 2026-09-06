// ============================================================================
// 🔔 TRACKAPP - CLOUDFLARE WORKER WEB PUSH NOTIFICATIONS
// ============================================================================
// Wklej ten plik bezpośrednio do edytora w Cloudflare Workers.
// Wygeneruj darmowe klucze VAPID (np. na https://vapidkeys.com)
// i wpisz je DOKŁADNIE w poniższych linijkach:

const VAPID_PUBLIC_KEY  = "BMSZje0Fq3PYVAtpCrOttQVRrkGcMS3Zf9jwIZ_4qn7xSmQ37VSfqcBGOrJA04deQtV0wLSyOijpOKt4F2KYQtU";    // <-- LINIA 8: KLUCZ PUBLICZNY VAPID
const VAPID_SUBJECT     = "domgwizdz@gmail.com"; // <-- LINIA 10: TWÓJ EMAIL LUB ADRES WWW

// ============================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Nagłówki CORS umożliwiające komunikację z aplikacją
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const pubKey = env.VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY;
    const privKey = env.VAPID_PRIVATE_KEY || VAPID_PRIVATE_KEY;
    const subject = env.VAPID_SUBJECT || VAPID_SUBJECT;

    // 1. Zapis subskrypcji z aplikacji
    if (url.pathname === "/subscribe" && request.method === "POST") {
      try {
        const { subscription, time } = await request.json();
        if (!subscription || !subscription.endpoint) {
          return new Response(JSON.stringify({ error: "Brak danych subskrypcji" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const id = subscription.endpoint;
        // Zapisujemy subskrypcję i wybraną godzinę (np. "20:00") w KV
        await env.SUBSCRIPTIONS.put(id, JSON.stringify({
          subscription,
          time: time || "20:00",
          updatedAt: new Date().toISOString()
        }));

        return new Response(JSON.stringify({ success: true, message: "Subskrypcja zapisana pomyślnie!" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 2. Natychmiastowy test wysyłki powiadomienia
    if (url.pathname === "/test" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        let targetSub = body.subscription;

        // Jeśli nie przesłano subskrypcji w żądaniu, pobierz pierwszą z bazy KV
        if (!targetSub) {
          const list = await env.SUBSCRIPTIONS.list({ limit: 1 });
          if (list.keys.length > 0) {
            const data = await env.SUBSCRIPTIONS.get(list.keys[0].name, { type: "json" });
            targetSub = data?.subscription;
          }
        }

        if (!targetSub) {
          return new Response(JSON.stringify({ error: "Brak zarejestrowanych urządzeń do wysłania testu" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const result = await sendWebPush(targetSub, {
          title: "Trackapp 💊",
          body: "🔔 Test powiadomienia w tle z Cloudflare Workera!"
        }, { pubKey, privKey, subject });

        return new Response(JSON.stringify({ success: true, pushStatus: result.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 3. Status Workera
    if (url.pathname === "/status" || url.pathname === "/") {
      const list = await env.SUBSCRIPTIONS.list();
      return new Response(JSON.stringify({
        status: "ok",
        activeSubscriptions: list.keys.length,
        vapidConfigured: pubKey !== "TUTAJ_WKLEJ_PUBLIC_KEY" && !!pubKey
      }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },

  // 4. Harmonogram Cron (uruchamiany co minutę)
  async scheduled(event, env, ctx) {
    const pubKey = env.VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY;
    const privKey = env.VAPID_PRIVATE_KEY || VAPID_PRIVATE_KEY;
    const subject = env.VAPID_SUBJECT || VAPID_SUBJECT;

    // Pobierz aktualną godzinę w strefie czasowej Polski (Europe/Warsaw)
    const formatter = new Intl.DateTimeFormat("pl-PL", {
      timeZone: "Europe/Warsaw",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const hour = parts.find(p => p.type === "hour")?.value.padStart(2, "0") || "00";
    const minute = parts.find(p => p.type === "minute")?.value.padStart(2, "0") || "00";
    const currentTime = `${hour}:${minute}`;

    const { keys } = await env.SUBSCRIPTIONS.list();

    for (const key of keys) {
      const item = await env.SUBSCRIPTIONS.get(key.name, { type: "json" });
      if (item && item.time === currentTime) {
        ctx.waitUntil(
          (async () => {
            try {
              const res = await sendWebPush(item.subscription, {
                title: "Trackapp 💊",
                body: "Pamiętaj o wzięciu tabletki! 💕"
              }, { pubKey, privKey, subject });

              // Jeśli endpoint wygasł lub subskrypcja została anulowana (404 lub 410 Gone)
              if (res.status === 404 || res.status === 410) {
                await env.SUBSCRIPTIONS.delete(key.name);
              }
            } catch (err) {
              console.error("Błąd wysyłki powiadomienia:", err);
            }
          })()
        );
      }
    }
  }
};

// ============================================================================
// SILNIK WEB PUSH (RFC 8292 VAPID + RFC 8291 AES-128-GCM)
// ============================================================================

function base64UrlToBytes(str) {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function bytesToBase64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function concatBytes(...arrays) {
  const total = arrays.reduce((acc, a) => acc + a.length, 0);
  const res = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    res.set(a, off);
    off += a.length;
  }
  return res;
}

async function hmacSha256(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, dataBytes);
  return new Uint8Array(sig);
}

async function getVapidCryptoKey(privKeyStr, pubKeyStr) {
  const privBytes = base64UrlToBytes(privKeyStr.trim());
  if (privBytes.length === 32) {
    const pubBytes = base64UrlToBytes(pubKeyStr.trim());
    const x = bytesToBase64Url(pubBytes.slice(1, 33));
    const y = bytesToBase64Url(pubBytes.slice(33, 65));
    const d = bytesToBase64Url(privBytes);
    return await crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", x, y, d, ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
  } else {
    return await crypto.subtle.importKey(
      "pkcs8",
      privBytes,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
  }
}

async function createVapidHeader(endpoint, pubKeyStr, privCryptoKey, subject) {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + (12 * 3600); // 12h
  const enc = new TextEncoder();

  const headerB64 = bytesToBase64Url(enc.encode(JSON.stringify({ alg: "ES256", typ: "JWT" })));
  const payloadB64 = bytesToBase64Url(enc.encode(JSON.stringify({ aud, exp, sub: subject })));
  const unsigned = `${headerB64}.${payloadB64}`;

  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privCryptoKey,
    enc.encode(unsigned)
  );

  const sigB64 = bytesToBase64Url(new Uint8Array(sigBuf));
  const jwt = `${unsigned}.${sigB64}`;
  return `vapid t=${jwt}, k=${pubKeyStr.trim()}`;
}

async function encryptPayload(payloadJsonStr, subscription) {
  if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
    return null;
  }

  const clientPubRaw = base64UrlToBytes(subscription.keys.p256dh);
  const authSecret = base64UrlToBytes(subscription.keys.auth);

  const localKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey));

  const clientPubKey = await crypto.subtle.importKey("raw", clientPubRaw, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: clientPubKey }, localKeyPair.privateKey, 256));

  const enc = new TextEncoder();
  const prk = await hmacSha256(authSecret, sharedSecret);
  const keyInfo = concatBytes(enc.encode("WebPush: info\0"), clientPubRaw, localPubRaw);
  const ikm = await hmacSha256(prk, concatBytes(keyInfo, new Uint8Array([1])));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prkCek = await hmacSha256(salt, ikm);

  const cekInfo = enc.encode("Content-Encoding: aes128gcm\0");
  const cek = (await hmacSha256(prkCek, concatBytes(cekInfo, new Uint8Array([1])))).slice(0, 16);

  const nonceInfo = enc.encode("Content-Encoding: nonce\0");
  const nonce = (await hmacSha256(prkCek, concatBytes(nonceInfo, new Uint8Array([1])))).slice(0, 12);

  // 0x02 to ogranicznik końca rekordu RFC 8291
  const record = concatBytes(enc.encode(payloadJsonStr), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, record));

  // Nagłówek aes128gcm: salt (16B) || rs=4096 (4B) || idlen=65 (1B) || localPub (65B)
  const header = concatBytes(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([65]), localPubRaw);
  return concatBytes(header, ciphertext);
}

async function sendWebPush(subscription, payloadObj, { pubKey, privKey, subject }) {
  const privCryptoKey = await getVapidCryptoKey(privKey, pubKey);
  const vapidHeader = await createVapidHeader(subscription.endpoint, pubKey, privCryptoKey, subject);

  const headers = {
    "Authorization": vapidHeader,
    "TTL": "86400",
    "Urgency": "high"
  };

  let body = null;
  if (payloadObj) {
    try {
      const encrypted = await encryptPayload(JSON.stringify(payloadObj), subscription);
      if (encrypted) {
        body = encrypted;
        headers["Content-Type"] = "application/octet-stream";
        headers["Content-Encoding"] = "aes128gcm";
      }
    } catch (e) {
      console.warn("Szyfrowanie payloadu nie powiodło się, wysyłam pusty push (wake-up):", e);
    }
  }

  return await fetch(subscription.endpoint, {
    method: "POST",
    headers,
    body
  });
}