// visualizer.js - Монохромная 360° неоновая аура-кольцо под биты с частицами и спектром
// Строго чёрно-белая (Pure White / Silver / Deep Black), расширяется под басы

export function makeVisualizer(audio, spectrumCanvas, sleeve, auraCanvas) {
  let ctx = null;
  let analyser = null;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Настройка Canvas для Retina / Mobile экранов
  const sCtx = spectrumCanvas && spectrumCanvas.getContext ? spectrumCanvas.getContext("2d") : null;
  const aCtx = auraCanvas && auraCanvas.getContext ? auraCanvas.getContext("2d") : null;

  function resizeCanvas(c, width, height) {
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = width * dpr;
    c.height = height * dpr;
    c.style.width = width + "px";
    c.style.height = height + "px";
    const context = c.getContext("2d");
    if (context) context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resizeCanvas(spectrumCanvas, 384, 36);
  resizeCanvas(auraCanvas, 340, 340);

  // Спектр: пиковые значения
  const peaks = new Float32Array(32);

  // Система 180 флюидных монохромных частиц ауры (как в референсе)
  const PARTICLE_COUNT = 180;
  const particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.1;
    particles.push({
      angle,
      dist: 82 + (Math.random() - 0.5) * 22,
      baseDist: 82 + (Math.random() - 0.5) * 16,
      radialVel: 0,
      angularVel: (Math.random() - 0.5) * 0.015,
      size: 0.8 + Math.random() * 2.2,
      alpha: 0.25 + Math.random() * 0.75,
      streakLen: 1
    });
  }

  let animFrame = null;
  let prevTime = performance.now();
  let beatPhase = 0;
  let smoothedBass = 0;

  // Рендеринг круговой флюидной ауры и спектра
  function renderFrame(now) {
    const dt = Math.min((now - prevTime) / 1000, 0.1);
    prevTime = now;

    const isPlaying = audio && !audio.paused;

    // 1. Получение басовой энергии
    let bass = 0;
    let treble = 0;
    let bins = null;

    if (analyser) {
      bins = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(bins);
      const bassBins = bins.slice(0, 8);
      const trebleBins = bins.slice(24, 48);
      const rawBass = bassBins.reduce((a, b) => a + b, 0) / (bassBins.length * 255);
      const rawTreble = trebleBins.reduce((a, b) => a + b, 0) / (trebleBins.length * 255);
      if (rawBass > 0.05) {
        bass = rawBass;
        treble = rawTreble;
      }
    }

    // Если нет активного анализатора Web Audio, используем живую физику битов от времени трека
    if (bass === 0 && isPlaying) {
      const curTime = (audio && audio.currentTime > 0) ? audio.currentTime : (now / 1000);
      const bpm = 128;
      const beatFreq = bpm / 60; // ~2.13 Гц
      const beatProgress = (curTime * beatFreq) % 1;
      
      // Четкая атака бочки (Kick) на сильную долю и быстрый спад
      const kickImpulse = Math.max(0, Math.exp(-beatProgress * 7.5));
      const subRumble = Math.abs(Math.sin(curTime * Math.PI * 4)) * 0.25;
      bass = Math.min(1.0, kickImpulse * 0.85 + subRumble);
      treble = Math.abs(Math.sin(curTime * 14)) * 0.45;
    } else if (!isPlaying) {
      // Состояние паузы: спокойное дыхание кольца
      bass = (Math.sin(now / 700) + 1) * 0.08;
      treble = 0.05;
    }

    // Плавное сглаживание баса: аккуратная сбалансированная реакция без резких скачков
    if (bass > smoothedBass) {
      smoothedBass += (bass - smoothedBass) * 0.40; // мягкий подъем
    } else {
      smoothedBass += (bass - smoothedBass) * 0.12; // плавное шелковистое затухание
    }

    beatPhase += dt * (2.0 + smoothedBass * 2.8);

    // 2. Пульсация центрального диска с обложкой
    if (sleeve) {
      const sleeveScale = 1 + smoothedBass * 0.05;
      sleeve.style.transform = `scale(${sleeveScale})`;
      sleeve.style.boxShadow = `0 0 ${16 + smoothedBass * 24}px rgba(255, 255, 255, ${0.30 + smoothedBass * 0.30}), inset 0 0 25px rgba(0, 0, 0, 0.9)`;
    }

    // 3. Отрисовка круговой флюидной ауры (Aura Canvas)
    if (aCtx && auraCanvas) {
      const w = 340;
      const h = 340;
      const cx = w / 2;
      const cy = h / 2;
      aCtx.clearRect(0, 0, w, h);

      // Радиус ауры (аккуратная сбалансированная пульсация ровно до +20px)
      const baseRadius = 82;
      const currentRadius = baseRadius + smoothedBass * 20;

      // А. Фоновое мягкое неоновое свечение (Bloom)
      const glowGrad = aCtx.createRadialGradient(cx, cy, currentRadius * 0.6, cx, cy, currentRadius * 1.55);
      glowGrad.addColorStop(0, `rgba(255, 255, 255, ${0.05 + smoothedBass * 0.12})`);
      glowGrad.addColorStop(0.5, `rgba(220, 225, 235, ${0.08 + smoothedBass * 0.18})`);
      glowGrad.addColorStop(0.85, `rgba(180, 190, 210, ${0.02 + smoothedBass * 0.08})`);
      glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      aCtx.fillStyle = glowGrad;
      aCtx.beginPath();
      aCtx.arc(cx, cy, currentRadius * 1.55, 0, Math.PI * 2);
      aCtx.fill();

      // Б. Вспышки лучей (Radial Bloom Rays) при акцентированном басе
      if (smoothedBass > 0.45) {
        const rayCount = 14;
        aCtx.save();
        aCtx.strokeStyle = `rgba(255, 255, 255, ${(smoothedBass - 0.45) * 0.32})`;
        aCtx.lineWidth = 1.0;
        aCtx.shadowBlur = 8;
        aCtx.shadowColor = "#ffffff";
        for (let r = 0; r < rayCount; r++) {
          const rayAngle = (r / rayCount) * Math.PI * 2 + beatPhase * 0.08;
          const rInner = currentRadius + 6;
          const rOuter = currentRadius + 14 + smoothedBass * 16;
          aCtx.beginPath();
          aCtx.moveTo(cx + Math.cos(rayAngle) * rInner, cy + Math.sin(rayAngle) * rInner);
          aCtx.lineTo(cx + Math.cos(rayAngle) * rOuter, cy + Math.sin(rayAngle) * rOuter);
          aCtx.stroke();
        }
        aCtx.restore();
      }

      // В. Отрисовка волнистого флюидного кольца (Monochrome Soundwave Ring)
      const SEGMENTS = 140;
      const wavePoints = [];
      for (let i = 0; i < SEGMENTS; i++) {
        const ang = (i / SEGMENTS) * Math.PI * 2;
        const w1 = Math.sin(ang * 6 + beatPhase * 2.5) * (3 + smoothedBass * 7);
        const w2 = Math.cos(ang * 10 - beatPhase * 1.8) * (2 + smoothedBass * 5);
        const w3 = Math.sin(ang * 3 + beatPhase * 1.0) * (3 + smoothedBass * 6);
        
        let freqAdd = 0;
        if (bins) {
          const bIdx = Math.floor((i / SEGMENTS) * 32);
          freqAdd = (bins[bIdx] / 255) * (6 + smoothedBass * 12);
        }

        const r = currentRadius + w1 + w2 + w3 + freqAdd;
        wavePoints.push({
          x: cx + Math.cos(ang) * r,
          y: cy + Math.sin(ang) * r
        });
      }

      // Проход 1: широкое дымчатое свечение
      aCtx.save();
      aCtx.beginPath();
      aCtx.moveTo(wavePoints[0].x, wavePoints[0].y);
      for (let i = 1; i < wavePoints.length; i++) {
        aCtx.lineTo(wavePoints[i].x, wavePoints[i].y);
      }
      aCtx.closePath();
      aCtx.strokeStyle = `rgba(255, 255, 255, ${0.16 + smoothedBass * 0.20})`;
      aCtx.lineWidth = 12;
      aCtx.shadowBlur = 20;
      aCtx.shadowColor = "#ffffff";
      aCtx.stroke();
      aCtx.restore();

      // Проход 2: яркое серебристое неоновое кольцо
      aCtx.save();
      aCtx.beginPath();
      aCtx.moveTo(wavePoints[0].x, wavePoints[0].y);
      for (let i = 1; i < wavePoints.length; i++) {
        aCtx.lineTo(wavePoints[i].x, wavePoints[i].y);
      }
      aCtx.closePath();
      aCtx.strokeStyle = `rgba(240, 243, 250, ${0.60 + smoothedBass * 0.30})`;
      aCtx.lineWidth = 3.2;
      aCtx.shadowBlur = 10;
      aCtx.shadowColor = "#ffffff";
      aCtx.stroke();
      aCtx.restore();

      // Проход 3: тончайшая ультра-белая линия керна
      aCtx.save();
      aCtx.beginPath();
      aCtx.moveTo(wavePoints[0].x, wavePoints[0].y);
      for (let i = 1; i < wavePoints.length; i++) {
        aCtx.lineTo(wavePoints[i].x, wavePoints[i].y);
      }
      aCtx.closePath();
      aCtx.strokeStyle = "#ffffff";
      aCtx.lineWidth = 1.4;
      aCtx.shadowBlur = 5;
      aCtx.shadowColor = "#ffffff";
      aCtx.stroke();
      aCtx.restore();

      // Г. Отрисовка флюидных монохромных частиц (Blooming Sparks)
      aCtx.save();
      aCtx.shadowBlur = 6;
      aCtx.shadowColor = "#ffffff";
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.angle += p.angularVel + (smoothedBass * 0.008);

        // Импульс от баса: умеренный плавный вылет
        if (smoothedBass > 0.25) {
          p.radialVel += smoothedBass * 9 * dt;
        }

        p.dist += p.radialVel;
        p.radialVel *= 0.92; // мягкое затухание скорости

        // Мягкое притяжение к текущему радиусу волны
        const targetD = currentRadius + (p.baseDist - 82);
        p.dist += (targetD - p.dist) * 0.07;

        const px = cx + Math.cos(p.angle) * p.dist;
        const py = cy + Math.sin(p.angle) * p.dist;

        // Рисуем светящуюся белую точку-искру
        const pAlpha = Math.min(1.0, p.alpha * (0.6 + smoothedBass * 0.7));
        aCtx.fillStyle = `rgba(255, 255, 255, ${pAlpha})`;
        aCtx.beginPath();
        aCtx.arc(px, py, p.size * (1 + smoothedBass * 0.3), 0, Math.PI * 2);
        aCtx.fill();

        // Небольшой лучевой хвост при сильном басе
        if (smoothedBass > 0.4 && p.dist > currentRadius + 5) {
          const tailLen = 4 + smoothedBass * 8;
          const tx = px + Math.cos(p.angle) * tailLen;
          const ty = py + Math.sin(p.angle) * tailLen;
          aCtx.strokeStyle = `rgba(255, 255, 255, ${pAlpha * 0.6})`;
          aCtx.lineWidth = 0.8;
          aCtx.beginPath();
          aCtx.moveTo(px, py);
          aCtx.lineTo(tx, ty);
          aCtx.stroke();
        }
      }
      aCtx.restore();
    }

    // 4. Отрисовка спектра (Spectrum Canvas) внизу
    if (sCtx && spectrumCanvas) {
      const sw = 384;
      const sh = 36;
      sCtx.clearRect(0, 0, sw, sh);

      const barCount = 32;
      const barWidth = 8;
      const gap = 4;

      for (let i = 0; i < barCount; i++) {
        let barHeight = 0;
        if (bins) {
          barHeight = (bins[i * 3] / 255) * (sh - 4);
        } else if (isPlaying) {
          const t = now / 140;
          barHeight = (Math.abs(Math.sin(t + i * 0.3)) * 0.7 + smoothedBass * 0.6) * (sh - 4);
        } else {
          barHeight = Math.abs(Math.sin(now / 500 + i * 0.2)) * 4;
        }

        barHeight = Math.max(2, Math.min(sh - 4, barHeight));

        // Монохромный градиент для полосы спектра
        const barGrad = sCtx.createLinearGradient(0, sh - barHeight, 0, sh);
        barGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        barGrad.addColorStop(1, "rgba(160, 165, 175, 0.35)");
        sCtx.fillStyle = barGrad;
        sCtx.fillRect(i * (barWidth + gap), sh - barHeight, barWidth, barHeight);

        // Белая шапка пика
        peaks[i] = Math.max(barHeight, peaks[i] - 0.6);
        if (peaks[i] > 3) {
          sCtx.fillStyle = "#ffffff";
          sCtx.shadowBlur = 4;
          sCtx.shadowColor = "#ffffff";
          sCtx.fillRect(i * (barWidth + gap), sh - peaks[i] - 2, barWidth, 1.5);
          sCtx.shadowBlur = 0;
        }
      }
    }

    if (!reduce.matches) {
      animFrame = requestAnimationFrame(renderFrame);
    }
  }

  // Запуск постоянного цикла анимации
  function startLoop() {
    if (!animFrame) {
      prevTime = performance.now();
      animFrame = requestAnimationFrame(renderFrame);
    }
  }

  startLoop();

  return {
    setHue: () => {}, // Строго монохромный режим: цветовые оттенки не требуются
    start: async function (externalAudioCtx = null, externalAnalyser = null) {
      if (externalAudioCtx && externalAnalyser) {
        ctx = externalAudioCtx;
        analyser = externalAnalyser;
      }
      startLoop();
    },
    stop: function () {
      if (animFrame) {
        cancelAnimationFrame(animFrame);
        animFrame = null;
      }
    }
  };
}
