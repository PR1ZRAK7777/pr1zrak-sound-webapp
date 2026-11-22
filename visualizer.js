// visualizer.js - Монохромная 360° неоновая флюидная аура-кольцо под биты
// Пиксель-перфектное центрирование, строгая симметрия, глубокая темная пустота в центре,
// без винила и плеера в середине, динамически расширяется под бит.

export function makeVisualizer(auraCanvas, legacySpectrum = null, legacySleeve = null) {
  let ctx = null;
  let analyser = null;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const aCtx = auraCanvas && auraCanvas.getContext ? auraCanvas.getContext("2d") : null;
  const VIRTUAL_SIZE = 340;
  const cx = VIRTUAL_SIZE / 2; // 170.0
  const cy = VIRTUAL_SIZE / 2; // 170.0

  function syncCanvasSize() {
    if (!auraCanvas || !aCtx) return;
    const rect = auraCanvas.getBoundingClientRect();
    const displaySize = Math.round(rect.width) || 320;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelSize = Math.round(displaySize * dpr);
    if (auraCanvas.width !== pixelSize || auraCanvas.height !== pixelSize) {
      auraCanvas.width = pixelSize;
      auraCanvas.height = pixelSize;
    }
    const scale = pixelSize / VIRTUAL_SIZE;
    aCtx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  syncCanvasSize();
  window.addEventListener("resize", syncCanvasSize);

  // Система 160 монохромных светящихся флюидных частиц-искр
  const PARTICLE_COUNT = 160;
  const particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.1;
    particles.push({
      angle,
      dist: 82 + (Math.random() - 0.5) * 20,
      baseOffset: (Math.random() - 0.5) * 20,
      radialVel: 0,
      angularVel: (Math.random() - 0.5) * 0.018,
      size: 0.8 + Math.random() * 2.0,
      alpha: 0.35 + Math.random() * 0.65
    });
  }

  // Параметрическая сетка волнового кольца (26 полос x 144 точки = 3744 частицы)
  const BANDS = 26;
  const POINTS_PER_BAND = 144;

  let animFrame = null;
  let prevTime = performance.now();
  let beatPhase = 0;
  let smoothedBass = 0;
  let isCurrentlyPlaying = false;
  let externalTimeGetter = null;

  function renderFrame(now) {
    const dt = Math.min((now - prevTime) / 1000, 0.1);
    prevTime = now;

    // 1. Получение басовой энергии
    let bass = 0;
    let treble = 0;
    let bins = null;

    if (analyser) {
      bins = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(bins);
      const subBins = bins.slice(0, 4);
      const kickBins = bins.slice(4, 9);
      const subEnergy = subBins.reduce((a, b) => a + b, 0) / (subBins.length * 255);
      const kickEnergy = kickBins.reduce((a, b) => a + b, 0) / (kickBins.length * 255);
      const trebleEnergy = bins.slice(20, 40).reduce((a, b) => a + b, 0) / (20 * 255);

      const rawBass = Math.max(subEnergy * 1.35, kickEnergy * 1.15);
      if (rawBass > 0.04) {
        bass = Math.min(1.0, rawBass);
        treble = trebleEnergy;
      }
    }

    // Если нет сигнала от analyser, но плеер активен — ритмическая физика битов (128 BPM)
    if (bass === 0 && isCurrentlyPlaying) {
      const curTime = externalTimeGetter ? externalTimeGetter() : (now / 1000);
      const bpm = 128;
      const beatFreq = bpm / 60; // ~2.133 Гц
      const beatProgress = (curTime * beatFreq) % 1;

      // Четкая атака бочки (Kick) на сильную долю и быстрый спад
      const kickImpulse = Math.max(0, Math.exp(-beatProgress * 7.5));
      const subRumble = Math.abs(Math.sin(curTime * Math.PI * 4)) * 0.28;
      bass = Math.min(1.0, kickImpulse * 0.90 + subRumble);
      treble = Math.abs(Math.sin(curTime * 14)) * 0.4;
    } else if (!isCurrentlyPlaying && bass === 0) {
      // Состояние покоя/паузы: спокойное дыхание кольца
      bass = (Math.sin(now / 750) + 1) * 0.08;
      treble = 0.04;
    }

    // Плавное сглаживание: мгновенная атака удара, плавный спад
    if (bass > smoothedBass) {
      smoothedBass += (bass - smoothedBass) * 0.82; // взрывная атака
    } else {
      smoothedBass += (bass - smoothedBass) * 0.16; // естественное затухание
    }

    beatPhase += dt * (2.0 + smoothedBass * 4.2);

    // 2. Отрисовка круговой флюидной ауры на Canvas (340x340)
    if (aCtx && auraCanvas) {
      aCtx.clearRect(0, 0, VIRTUAL_SIZE, VIRTUAL_SIZE);

      // ДИНАМИЧЕСКИЙ РАДИУС АУРЫ: УВЕЛИЧИВАЕТСЯ ПОД БИТ!
      // В покое: 78px, при сильном басе: 112px (+43% расширение)
      const baseRadius = 78;
      const currentRadius = baseRadius + smoothedBass * 34;
      const ribbonWidth = 24 + smoothedBass * 16;

      // А. Фоновое мягкое неоновое свечение (Smoky White Bloom)
      // Внутри радиуса пустота, свечение снаружи
      const innerVoidR = Math.max(12, currentRadius * 0.45);
      const outerBloomR = currentRadius * 1.5;
      const glowGrad = aCtx.createRadialGradient(cx, cy, innerVoidR, cx, cy, outerBloomR);
      glowGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
      glowGrad.addColorStop(0.35, `rgba(255, 255, 255, ${0.04 + smoothedBass * 0.09})`);
      glowGrad.addColorStop(0.68, `rgba(230, 238, 255, ${0.07 + smoothedBass * 0.17})`);
      glowGrad.addColorStop(0.92, `rgba(180, 195, 220, ${0.02 + smoothedBass * 0.06})`);
      glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      aCtx.fillStyle = glowGrad;
      aCtx.beginPath();
      aCtx.arc(cx, cy, outerBloomR, 0, Math.PI * 2);
      aCtx.fill();

      // Б. Вспышки лучей (Radial Bloom Needles) при басовых ударах
      if (smoothedBass > 0.20) {
        const rayCount = 32;
        aCtx.save();
        const rayAlpha = Math.min(0.85, (smoothedBass - 0.20) * 1.15);
        aCtx.strokeStyle = `rgba(255, 255, 255, ${rayAlpha})`;
        aCtx.lineWidth = 1.1;
        aCtx.shadowBlur = 8;
        aCtx.shadowColor = "#ffffff";
        for (let r = 0; r < rayCount; r++) {
          const rayAngle = (r / rayCount) * Math.PI * 2 + beatPhase * 0.06;
          const rInner = currentRadius + ribbonWidth * 0.38;
          const rOuter = currentRadius + ribbonWidth * 0.48 + 8 + smoothedBass * 32;
          aCtx.beginPath();
          aCtx.moveTo(cx + Math.cos(rayAngle) * rInner, cy + Math.sin(rayAngle) * rInner);
          aCtx.lineTo(cx + Math.cos(rayAngle) * rOuter, cy + Math.sin(rayAngle) * rOuter);
          aCtx.stroke();
        }
        aCtx.restore();
      }

      // В. Отрисовка объёмной 3D-сетки флюидного волнового кольца (Particle Mesh Ribbon)
      // СТРОГО СИММЕТРИЧНЫЕ ЧЁТНЫЕ ГАРМОНИКИ (4, 6, 8): центр ауры ВСЕГДА в идеальном центре (cx, cy)
      for (let b = 0; b < BANDS; b++) {
        const v = (b / (BANDS - 1)) - 0.5; // от -0.5 до +0.5
        const bandOffset = v * ribbonWidth;
        const isCore = Math.abs(v) < 0.18;

        // Цвет и прозрачность слоя
        let layerAlpha = (1.0 - Math.abs(v) * 1.1) * (0.45 + smoothedBass * 0.55);
        layerAlpha = Math.max(0.12, Math.min(1.0, layerAlpha));

        const baseFill = isCore ? `rgba(255, 255, 255, ${layerAlpha})` : `rgba(225, 230, 242, ${layerAlpha * 0.8})`;
        aCtx.fillStyle = baseFill;

        for (let p = 0; p < POINTS_PER_BAND; p++) {
          const u = (p / POINTS_PER_BAND) * Math.PI * 2;

          // Волновые гармоники с четными коэффициентами для абсолютной осевой симметрии
          const w1 = Math.sin(u * 4 + beatPhase * 2.4 + v * 1.6) * (3.5 + smoothedBass * 9);
          const w2 = Math.cos(u * 6 - beatPhase * 1.8 + v * 2.2) * (2.0 + smoothedBass * 6);
          const w3 = Math.sin(u * 8 + beatPhase * 3.0) * (1.2 + smoothedBass * 4);

          let freqWarp = 0;
          if (bins) {
            // Симметричное распределение частот по 4 квадрантам
            const quadU = Math.abs(Math.sin(u * 2));
            const bIdx = Math.min(31, Math.floor(quadU * 28));
            freqWarp = (bins[bIdx] / 255) * (4 + smoothedBass * 10);
          }

          const r = currentRadius + bandOffset + w1 + w2 + w3 + freqWarp;

          // 3D-глубина для объёмного эффекта (четная гармоника 4 для симметрии)
          const z = Math.cos(u * 4 + beatPhase * 1.4) * 12 + Math.sin(v * Math.PI) * 10;
          const depthScale = 1.0 + (z / 120);

          const px = cx + Math.cos(u) * r * depthScale;
          const py = cy + Math.sin(u) * r * depthScale;

          // Размер точки-частицы
          const pSize = (0.9 + Math.cos(v * Math.PI) * 1.0) * depthScale * (1 + smoothedBass * 0.22);

          // Рисуем точку сетки
          aCtx.fillRect(px - pSize * 0.5, py - pSize * 0.5, pSize, pSize);
        }
      }

      // Г. Отрисовка флюидных монохромных частиц-искр (Blooming Sparks)
      aCtx.save();
      aCtx.shadowBlur = 6;
      aCtx.shadowColor = "#ffffff";
      for (let i = 0; i < particles.length; i++) {
        const pt = particles[i];
        pt.angle += pt.angularVel + (smoothedBass * 0.007);

        // Импульс от баса: частицы взрываются наружу
        if (smoothedBass > 0.18) {
          pt.radialVel += smoothedBass * 22 * dt;
        }

        pt.dist += pt.radialVel;
        pt.radialVel *= 0.90; // затухание скорости

        // Мягкое притяжение к текущему радиусу кольца
        const targetD = currentRadius + pt.baseOffset;
        pt.dist += (targetD - pt.dist) * 0.08;

        const px = cx + Math.cos(pt.angle) * pt.dist;
        const py = cy + Math.sin(pt.angle) * pt.dist;

        const pAlpha = Math.min(1.0, pt.alpha * (0.65 + smoothedBass * 0.65));
        aCtx.fillStyle = `rgba(255, 255, 255, ${pAlpha})`;
        aCtx.beginPath();
        aCtx.arc(px, py, pt.size * (1 + smoothedBass * 0.35), 0, Math.PI * 2);
        aCtx.fill();

        // Небольшой лучевой хвост при сильном басе
        if (smoothedBass > 0.38 && pt.dist > currentRadius + 5) {
          const tailLen = 3 + smoothedBass * 8;
          const tx = px + Math.cos(pt.angle) * tailLen;
          const ty = py + Math.sin(pt.angle) * tailLen;
          aCtx.strokeStyle = `rgba(255, 255, 255, ${pAlpha * 0.55})`;
          aCtx.lineWidth = 0.8;
          aCtx.beginPath();
          aCtx.moveTo(px, py);
          aCtx.lineTo(tx, ty);
          aCtx.stroke();
        }
      }
      aCtx.restore();

      // Д. Тёмная сердцевина ауры (Dark Void Core): глубокий космический чёрный центр
      // Гарантирует абсолютную чистоту центра без плеера и винила
      const coreVoidRadius = currentRadius - ribbonWidth * 0.56;
      if (coreVoidRadius > 10) {
        aCtx.save();
        aCtx.globalCompositeOperation = "destination-out";
        aCtx.fillStyle = "rgba(0, 0, 0, 0.96)";
        aCtx.beginPath();
        aCtx.arc(cx, cy, coreVoidRadius, 0, Math.PI * 2);
        aCtx.fill();
        aCtx.restore();
      }
    }

    if (!reduce.matches) {
      animFrame = requestAnimationFrame(renderFrame);
    }
  }

  function startLoop() {
    if (!animFrame) {
      prevTime = performance.now();
      animFrame = requestAnimationFrame(renderFrame);
    }
  }

  startLoop();

  return {
    setPlaying: (playing, timeGetter = null) => {
      isCurrentlyPlaying = Boolean(playing);
      if (timeGetter) externalTimeGetter = timeGetter;
    },
    setHue: () => {}, // Строго монохромный режим: оттенки не требуются
    start: async function (externalAudioCtx = null, externalAnalyser = null) {
      if (externalAudioCtx) ctx = externalAudioCtx;
      if (externalAnalyser) analyser = externalAnalyser;
      syncCanvasSize();
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
