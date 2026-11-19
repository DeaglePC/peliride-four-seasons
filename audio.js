export function rideAudio() {
  let ctx, master, surface, air, traffic, engine, exhaust, tyres, pan, contactNoise;
  let enabled = false;

  function connectNoise(output, frequency, q) {
    const source = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1;
      brown = .81 * brown + .19 * white;
      samples[i] = .65 * white + .35 * brown;
    }
    source.buffer = buffer;
    contactNoise ??= buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    source.connect(filter).connect(output);
    source.start();
    return filter;
  }

  function setup() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    surface = ctx.createGain();
    surface.gain.value = 0;
    surface.connect(master);
    air = connectNoise(surface, 850, .23);
    traffic = ctx.createGain();
    traffic.gain.value = 0;
    pan = ctx.createStereoPanner();
    traffic.connect(pan).connect(master);
    exhaust = ctx.createBiquadFilter();
    exhaust.type = 'lowpass';
    exhaust.frequency.value = 190;
    exhaust.Q.value = .55;
    const harmonics = ctx.createPeriodicWave(new Float32Array(6), new Float32Array([0, .82, .21, .15, .31, .08]));
    engine = ctx.createOscillator();
    engine.setPeriodicWave(harmonics);
    engine.frequency.value = 58;
    engine.connect(exhaust).connect(traffic);
    engine.start();
    tyres = ctx.createGain();
    tyres.gain.value = .31;
    tyres.connect(traffic);
    connectNoise(tyres, 2600, .28);
  }

  function tone(hz, duration, gain = .08, delay = 0) {
    if (!enabled || !ctx) return;
    const osc = ctx.createOscillator(), envelope = ctx.createGain(), t = ctx.currentTime + delay;
    osc.frequency.setValueAtTime(hz, t);
    envelope.gain.setValueAtTime(gain, t);
    envelope.gain.exponentialRampToValueAtTime(.0001, t + duration);
    osc.connect(envelope).connect(master);
    osc.start(t);
    osc.stop(t + duration + .02);
  }

  function contact(strength, scraping) {
    if (!enabled || !ctx) return;
    const t=ctx.currentTime, duration=scraping?.29+.18*strength:.14;
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),envelope=ctx.createGain();
    source.buffer=contactNoise;
    filter.type=scraping?'highpass':'lowpass';
    filter.frequency.setValueAtTime(scraping?1100:1700,t);
    filter.frequency.exponentialRampToValueAtTime(scraping?380:140,t+duration);
    envelope.gain.setValueAtTime(.04,t);
    envelope.gain.linearRampToValueAtTime((scraping?.15:.35)*(.65+.35*strength),t+.009);
    envelope.gain.exponentialRampToValueAtTime(.0001,t+duration);
    source.connect(filter).connect(envelope).connect(master);
    source.start(t,scraping?.6:0);source.stop(t+duration);
  }
  return {
    on(value) {
      if (value && !ctx) setup();
      enabled = value;
      if (!ctx) return;
      master.gain.setTargetAtTime(+value, ctx.currentTime, .035);
      if (value) ctx.resume().catch(() => {});
    },
    bell() { tone(1275, .48); tone(1884, .34, .041, .075); },
    hit(strength) { contact(strength,false);tone(91,.16,.14);tone(643,.12,.037,.018); },
    scrape(strength) { contact(strength,true);tone(417,.15,.035); },
    tumble(force) { tone(77+18*force,.095,.062*force);tone(196,.045,.018*force,.012); },
    catchFish() { tone(940,.13,.035);tone(1420,.21,.030,.085); },
    finish() { [660, 825, 990, 1320].forEach((f, i) => tone(f, .38, .065, i * .11)); },
    update(speed, weather, riding, car) {
      if (!ctx || !enabled) return;
      const t = ctx.currentTime, rain = weather === 'rain' || weather === 'rainNight', wind = weather === 'wind';
      air.frequency.setTargetAtTime(rain ? 3700 : wind ? 1450 : 460 + speed * 50, t, .22);
      surface.gain.setTargetAtTime(riding ? .028 + speed * .0016 + (rain ? .06 : wind ? .045 : 0) : .009, t, .25);
      if (!riding || !car) { traffic.gain.setTargetAtTime(0, t, .13); return; }
      const range = Math.hypot(car.x, car.z);
      const passing = 1 / (1 + (range / 5.5) ** 2);
      const pitch = Math.tanh(car.z / 4) * (car.direction < 0 ? 12 : 4);
      engine.frequency.setTargetAtTime((car.direction < 0 ? 66 : 51) + pitch, t, .075);
      exhaust.frequency.setTargetAtTime(140 + passing * 150, t, .1);
      pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, car.x / (2 + range * .22))), t, .07);
      traffic.gain.setTargetAtTime(passing * .12, t, .07);
      tyres.gain.setTargetAtTime(rain ? .77 : .30, t, .2);
    }
  };
}
