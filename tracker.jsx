import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "tracker-v1";

const MONTHS = [
  "Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec",
  "Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"
];
const DAYS = ["Pn","Wt","Śr","Cz","Pt","Sb","Nd"];

const C = {
  crimson: "#C81D3A",
  coral:   "#FF5C8A",
  blush:   "#FF9FB5",
  pale:    "#FFE3EC",
  dark:    "#7A2E40",
  text:    "#3d1520",
};

async function load() {
  try {
    const r = await window.storage.get(STORAGE_KEY);
    return r ? JSON.parse(r.value) : {};
  } catch { return {}; }
}

async function persist(d) {
  try { await window.storage.set(STORAGE_KEY, JSON.stringify(d)); } catch {}
}

function fmtKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function buildCells(y, m) {
  const first = new Date(y, m, 1).getDay();
  const offset = (first + 6) % 7;
  const total = new Date(y, m + 1, 0).getDate();
  const cells = Array(offset).fill(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  return cells;
}

export default function App() {
  const now    = new Date();
  const todayKey = fmtKey(now.getFullYear(), now.getMonth(), now.getDate());

  const [data,      setData]      = useState({});
  const [yr,        setYr]        = useState(now.getFullYear());
  const [mo,        setMo]        = useState(now.getMonth());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selDate,   setSelDate]   = useState(todayKey);
  const [slideDir,  setSlideDir]  = useState(0);
  const [animKey,   setAnimKey]   = useState(0);
  const [loaded,    setLoaded]    = useState(false);

  const touchX = useRef(null);

  useEffect(() => {
    load().then(d => { setData(d); setLoaded(true); });
  }, []);

  const toggle = async (field) => {
    const entry = { ...(data[selDate] || {}) };
    entry[field] = !entry[field];
    const next = { ...data };
    if (!entry.tabletka && !entry.freaky) delete next[selDate];
    else next[selDate] = entry;
    setData(next);
    await persist(next);
  };

  const goMonth = (dir) => {
    setSlideDir(dir);
    setAnimKey(k => k + 1);
    if (dir < 0) {
      if (mo === 0) { setYr(y => y - 1); setMo(11); }
      else setMo(m => m - 1);
    } else {
      if (mo === 11) { setYr(y => y + 1); setMo(0); }
      else setMo(m => m + 1);
    }
  };

  const goToday = () => {
    setYr(now.getFullYear());
    setMo(now.getMonth());
  };

  const openDay = (key) => {
    setSelDate(key);
    setSheetOpen(true);
  };

  const selData   = data[selDate] || {};
  const cells     = buildCells(yr, mo);

  const [sdy, sdm, sdd] = selDate.split("-");
  const selLabel = selDate === todayKey
    ? "Dzisiaj"
    : `${parseInt(sdd)} ${MONTHS[parseInt(sdm) - 1]} ${sdy}`;

  const isCurrentMonth = yr === now.getFullYear() && mo === now.getMonth();

  if (!loaded) {
    return (
      <div style={{ background: C.pale, minHeight: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif" }}>
        <div style={{ color: C.crimson, fontSize: 16, fontWeight: 700 }}>Ładowanie…</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        body { background: ${C.pale}; overscroll-behavior: none; }
        .day-btn { transition: transform 0.12s ease, background 0.15s ease; }
        .day-btn:active { transform: scale(0.88) !important; }
        .nav-btn { transition: transform 0.1s ease, background 0.15s ease; }
        .nav-btn:active { transform: scale(0.9); }
        .toggle-row { transition: all 0.22s cubic-bezier(0.34,1.2,0.64,1); }
        .toggle-row:active { transform: scale(0.97); }
        @keyframes slideRight {
          from { opacity: 0; transform: translateX(32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideLeft {
          from { opacity: 0; transform: translateX(-32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .anim-right { animation: slideRight 0.28s cubic-bezier(0.22,1,0.36,1) both; }
        .anim-left  { animation: slideLeft  0.28s cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>

      <div
        style={{ fontFamily: "'Nunito', sans-serif", background: C.pale,
          minHeight: "100vh", maxWidth: 430, margin: "0 auto",
          position: "relative", userSelect: "none" }}
        onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 48) goMonth(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {/* Safe area top */}
        <div style={{ height: 52 }} />

        {/* ── Month header ── */}
        <div style={{ display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "0 20px 18px" }}>
          <button className="nav-btn" onClick={() => goMonth(-1)}
            style={{ width: 42, height: 42, borderRadius: "50%",
              background: "white", border: "none", cursor: "pointer",
              fontSize: 22, color: C.crimson, display: "flex",
              alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 12px rgba(200,29,58,0.12)" }}>
            ‹
          </button>

          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.crimson,
              letterSpacing: -0.5 }}>
              {MONTHS[mo]}
            </div>
            <div style={{ display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 600,
                color: C.dark, opacity: 0.45 }}>{yr}</span>
              {!isCurrentMonth && (
                <button onClick={goToday}
                  style={{ fontSize: 11, fontWeight: 800, color: C.crimson,
                    background: C.pale, border: "none", borderRadius: 8,
                    padding: "2px 8px", cursor: "pointer", letterSpacing: 0.5 }}>
                  DZIŚ
                </button>
              )}
            </div>
          </div>

          <button className="nav-btn" onClick={() => goMonth(1)}
            style={{ width: 42, height: 42, borderRadius: "50%",
              background: "white", border: "none", cursor: "pointer",
              fontSize: 22, color: C.crimson, display: "flex",
              alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 12px rgba(200,29,58,0.12)" }}>
            ›
          </button>
        </div>

        {/* ── Calendar card ── */}
        <div style={{ margin: "0 14px", background: "white",
          borderRadius: 28, padding: "18px 12px 24px",
          boxShadow: "0 4px 32px rgba(200,29,58,0.07)" }}>

          {/* Day labels */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)",
            marginBottom: 6 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 11,
                fontWeight: 800, color: C.blush, padding: "0 0 8px",
                letterSpacing: 0.8 }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div
            key={animKey}
            className={animKey === 0 ? "" : slideDir >= 0 ? "anim-right" : "anim-left"}
            style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "3px 0" }}
          >
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const key = fmtKey(yr, mo, day);
              const isToday   = key === todayKey;
              const isSel     = key === selDate && sheetOpen;
              const dayData   = data[key] || {};
              const hasT      = dayData.tabletka;
              const hasF      = dayData.freaky;

              return (
                <button key={key} className="day-btn"
                  onClick={() => openDay(key)}
                  style={{
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    padding: "7px 2px", borderRadius: 14, cursor: "pointer",
                    border: "none",
                    background: isToday
                      ? C.crimson
                      : isSel
                        ? C.pale
                        : "transparent",
                    outline: isSel && !isToday
                      ? `2px solid ${C.coral}`
                      : "none",
                  }}>
                  <span style={{
                    fontSize: 16, lineHeight: 1.2,
                    fontWeight: isToday ? 900 : 600,
                    color: isToday ? "white" : C.text,
                  }}>
                    {day}
                  </span>
                  <div style={{ display: "flex", gap: 3, marginTop: 3, height: 7, alignItems: "center" }}>
                    {hasT && (
                      <div style={{ width: 6, height: 6, borderRadius: "50%",
                        background: isToday ? "rgba(255,255,255,0.85)" : C.coral }} />
                    )}
                    {hasF && (
                      <div style={{ width: 6, height: 6, borderRadius: "50%",
                        background: isToday ? "rgba(255,255,255,0.65)" : C.dark }} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Legend ── */}
        <div style={{ display: "flex", gap: 18, justifyContent: "center", padding: "16px 0 100px" }}>
          {[
            { color: C.coral, label: "Tabletka" },
            { color: C.dark,  label: "Freaky" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.dark, opacity: 0.6 }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* ── FAB ── */}
        {!sheetOpen && (
          <button
            onClick={() => openDay(todayKey)}
            style={{
              position: "fixed", bottom: 30, left: "50%",
              transform: "translateX(-50%)",
              background: C.crimson,
              border: "none", borderRadius: 28,
              padding: "17px 38px",
              color: "white", fontSize: 16, fontWeight: 800,
              cursor: "pointer",
              boxShadow: `0 8px 28px rgba(200,29,58,0.42)`,
              display: "flex", alignItems: "center", gap: 10,
              zIndex: 5, letterSpacing: 0.4, whiteSpace: "nowrap",
            }}>
            <span style={{ fontSize: 21, lineHeight: 1 }}>+</span>
            Zaznacz dzień
          </button>
        )}

        {/* ── Overlay ── */}
        {sheetOpen && (
          <div
            onClick={() => setSheetOpen(false)}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(122,46,64,0.22)",
              zIndex: 10, backdropFilter: "blur(3px)",
            }}
          />
        )}

        {/* ── Bottom Sheet ── */}
        <div style={{
          position: "fixed", bottom: 0, left: "50%",
          transform: `translateX(-50%) translateY(${sheetOpen ? "0" : "105%"})`,
          width: "100%", maxWidth: 430,
          background: "white", borderRadius: "30px 30px 0 0",
          padding: "14px 22px 52px",
          zIndex: 11,
          transition: "transform 0.38s cubic-bezier(0.34,1.2,0.64,1)",
          boxShadow: "0 -6px 48px rgba(200,29,58,0.16)",
        }}>
          {/* Handle */}
          <div style={{ width: 40, height: 4, borderRadius: 2,
            background: C.pale, margin: "0 auto 22px" }} />

          {/* Date label */}
          <div style={{ fontSize: 12, fontWeight: 800, color: C.blush,
            letterSpacing: 1.8, marginBottom: 18, textTransform: "uppercase" }}>
            {selLabel}
          </div>

          {/* Toggles */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              {
                field: "tabletka",
                emoji: "",
                label: "Tabletka",
                activeBg: C.coral,
                activeShadow: "rgba(255,92,138,0.35)",
              },
              {
                field: "freaky",
                emoji: "",
                label: "Freaky",
                activeBg: C.crimson,
                activeShadow: "rgba(200,29,58,0.35)",
              },
            ].map(item => {
              const on = !!selData[item.field];
              return (
                <button key={item.field} className="toggle-row"
                  onClick={() => toggle(item.field)}
                  style={{
                    padding: "19px 22px",
                    borderRadius: 20, border: "none", cursor: "pointer",
                    background: on ? item.activeBg : C.pale,
                    color: on ? "white" : C.crimson,
                    fontSize: 18, fontWeight: 800,
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between",
                    boxShadow: on ? `0 6px 20px ${item.activeShadow}` : "none",
                    transform: on ? "scale(1.02)" : "scale(1)",
                  }}>
                  <span>{item.emoji} {item.label}</span>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: on ? "rgba(255,255,255,0.22)" : "rgba(200,29,58,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 17, color: on ? "white" : C.crimson,
                    fontWeight: 900,
                    transition: "all 0.2s ease",
                  }}>
                    {on ? "✓" : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
