"use client";

import { useState, useEffect, useRef } from "react";

const ROUNDS = 6;
const DEFAULT_EXERCISE = 60;
const DEFAULT_REST = 30;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function buildSequence(exerciseDur, restDur) {
  const seq = [];
  for (let i = 0; i < ROUNDS; i++) {
    seq.push({ type: "exercise", round: i + 1, duration: exerciseDur });
    seq.push({ type: "rest", round: i + 1, duration: restDur });
  }
  return seq;
}

export default function WorkoutTimer() {
  const [exerciseDur, setExerciseDur] = useState(DEFAULT_EXERCISE);
  const [restDur, setRestDur] = useState(DEFAULT_REST);
  const [sequence, setSequence] = useState(() => buildSequence(DEFAULT_EXERCISE, DEFAULT_REST));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(sequence[0].duration);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const intervalRef = useRef(null);
  const elapsedRef = useRef(null);
  // Persistent AudioContext — created once on first user interaction
  const audioCtxRef = useRef(null);

  const current = sequence[currentIndex];
  const isExercise = current?.type === "exercise";

  // Initialize or resume AudioContext — MUST be called inside a user gesture
  function ensureAudio() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  }

  function playBeep(type = "switch") {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state === "suspended") return;
      const configs = {
        switch:    [{ freq: 880, dur: 0.15 }, { freq: 1320, dur: 0.15 }],
        done:      [{ freq: 523, dur: 0.18 }, { freq: 659, dur: 0.18 }, { freq: 784, dur: 0.35 }],
        countdown: [{ freq: 440, dur: 0.10 }],
      };
      const notes = configs[type] || configs.switch;
      let t = ctx.currentTime + 0.02;
      notes.forEach(({ freq, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.55, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t);
        osc.stop(t + dur + 0.02);
        t += dur + 0.06;
      });
    } catch (e) {
      console.warn("Beep error:", e);
    }
  }

  // Elapsed counter
  useEffect(() => {
    if (running && !done) {
      elapsedRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      clearInterval(elapsedRef.current);
    }
    return () => clearInterval(elapsedRef.current);
  }, [running, done]);

  // Main countdown
  useEffect(() => {
    if (running && !done) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            setCurrentIndex((idx) => {
              const next = idx + 1;
              if (next >= sequence.length) {
                setDone(true);
                setRunning(false);
                playBeep("done");
                return idx;
              }
              setTimeLeft(sequence[next].duration);
              playBeep("switch");
              return next;
            });
            return 0;
          }
          if (t === 4) playBeep("countdown");
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, done, sequence]);

  function handleStart() {
    if (done) return;
    // ensureAudio MUST be called directly inside this click handler to satisfy browser policy
    ensureAudio();
    setRunning((r) => !r);
  }

  function handleReset() {
    clearInterval(intervalRef.current);
    clearInterval(elapsedRef.current);
    const seq = buildSequence(exerciseDur, restDur);
    setSequence(seq);
    setCurrentIndex(0);
    setTimeLeft(seq[0].duration);
    setRunning(false);
    setDone(false);
    setElapsed(0);
  }

  function applySettings() {
    handleReset();
  }

  const progress = done ? 1 : (1 - timeLeft / current.duration);
  const circumference = 2 * Math.PI * 88;
  const dashOffset = circumference * (1 - progress);

  const rounds = Array.from({ length: ROUNDS }, (_, i) => {
    const exIdx = i * 2;
    const restIdx = i * 2 + 1;
    return {
      i,
      exDone:    currentIndex > exIdx || done,
      restDone:  currentIndex > restIdx || done,
      exActive:  currentIndex === exIdx && !done,
      restActive: currentIndex === restIdx && !done,
    };
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Courier New', monospace",
      color: "#fff",
      padding: "24px",
      boxSizing: "border-box",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; }
        .btn {
          cursor: pointer;
          border: none;
          font-family: 'Bebas Neue', sans-serif;
          letter-spacing: 2px;
          transition: all 0.15s;
        }
        .btn:hover { transform: scale(1.04); }
        .btn:active { transform: scale(0.97); }
        input[type=number] {
          background: #1a1a2e;
          border: 1px solid #333;
          color: #fff;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 14px;
          padding: 6px 10px;
          border-radius: 6px;
          width: 70px;
          text-align: center;
          outline: none;
        }
        input[type=number]:focus { border-color: #f6d860; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
      `}</style>

      {/* Title */}
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 6, color: "#555", marginBottom: 8 }}>
        WORKOUT TIMER
      </div>

      {/* Main timer ring */}
      <div style={{ position: "relative", width: 220, height: 220, marginBottom: 24 }}>
        <svg width="220" height="220" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="110" cy="110" r="88" fill="none" stroke="#1a1a2e" strokeWidth="10" />
          <circle
            cx="110" cy="110" r="88" fill="none"
            stroke={done ? "#4ade80" : isExercise ? "#f6d860" : "#60a5fa"}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 4,
        }}>
          {done ? (
            <>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: "#4ade80", lineHeight: 1 }}>DONE!</div>
              <div style={{ fontSize: 12, color: "#555", letterSpacing: 3 }}>GREAT WORK</div>
            </>
          ) : (
            <>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 56,
                lineHeight: 1,
                color: isExercise ? "#f6d860" : "#60a5fa",
                animation: running && timeLeft <= 3 ? "pulse 0.6s infinite" : "none",
              }}>
                {formatTime(timeLeft)}
              </div>
              <div style={{
                fontSize: 11,
                letterSpacing: 4,
                color: isExercise ? "#f6d860aa" : "#60a5faaa",
                fontFamily: "'IBM Plex Mono', monospace",
              }}>
                {isExercise ? "EXERCISE" : "REST"} · R{current.round}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
        <button className="btn" onClick={handleStart} style={{
          background: running ? "#1a1a2e" : isExercise ? "#f6d860" : "#60a5fa",
          color: running ? "#fff" : "#0a0a0f",
          fontSize: 22,
          padding: "12px 40px",
          borderRadius: 8,
          border: running ? "1px solid #333" : "none",
        }}>
          {running ? "PAUSE" : done ? "DONE" : "START"}
        </button>
        <button className="btn" onClick={handleReset} style={{
          background: "#1a1a2e",
          color: "#888",
          fontSize: 22,
          padding: "12px 24px",
          borderRadius: 8,
          border: "1px solid #333",
        }}>
          RESET
        </button>
      </div>

      {/* Round indicators */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {rounds.map(({ i, exDone, restDone, exActive, restActive }) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ fontSize: 9, color: "#444", letterSpacing: 1, fontFamily: "'IBM Plex Mono', monospace" }}>R{i + 1}</div>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: exDone ? "#f6d860" : exActive ? "#f6d860aa" : "#222",
              border: exActive ? "1px solid #f6d860" : "1px solid #333",
              transition: "all 0.3s",
            }} />
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: restDone ? "#60a5fa" : restActive ? "#60a5faaa" : "#222",
              border: restActive ? "1px solid #60a5fa" : "1px solid #333",
              transition: "all 0.3s",
            }} />
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, fontSize: 10, letterSpacing: 2, color: "#555", fontFamily: "'IBM Plex Mono', monospace" }}>
        <span style={{ color: "#f6d86088" }}>● EXERCISE</span>
        <span style={{ color: "#60a5fa88" }}>● REST</span>
      </div>

      {/* Elapsed Time */}
      <div style={{
        background: "#111",
        border: "1px solid #1e1e2e",
        borderRadius: 8,
        padding: "10px 28px",
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <span style={{ fontSize: 9, letterSpacing: 4, color: "#444", fontFamily: "'IBM Plex Mono', monospace" }}>ELAPSED</span>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 28,
          color: "#4ade8099",
          letterSpacing: 2,
        }}>
          {formatTime(elapsed)}
        </span>
      </div>

      {/* Settings */}
      <div style={{
        background: "#111",
        border: "1px solid #222",
        borderRadius: 10,
        padding: "16px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        alignItems: "center",
        width: "100%",
        maxWidth: 300,
      }}>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "#444", fontFamily: "'IBM Plex Mono', monospace" }}>SETTINGS</div>
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <label style={{ fontSize: 9, color: "#f6d86088", letterSpacing: 2 }}>EXERCISE (s)</label>
            <input type="number" value={exerciseDur} min={5} max={600}
              onChange={(e) => setExerciseDur(Number(e.target.value))} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <label style={{ fontSize: 9, color: "#60a5fa88", letterSpacing: 2 }}>REST (s)</label>
            <input type="number" value={restDur} min={5} max={300}
              onChange={(e) => setRestDur(Number(e.target.value))} />
          </div>
        </div>
        <button className="btn" onClick={applySettings} style={{
          background: "#1a1a2e",
          color: "#888",
          fontSize: 14,
          padding: "8px 20px",
          borderRadius: 6,
          border: "1px solid #333",
          marginTop: 4,
        }}>
          APPLY & RESET
        </button>
      </div>
    </div>
  );
}