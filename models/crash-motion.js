const clamp01 = value => Math.max(0, Math.min(1, value));
export function crashEase(start, end, time) {
  const t = clamp01((time - start) / (end - start));
  return t * t * (3 - 2 * t);
}

// Distances use metres and durations use seconds. Ground rotations and travel
// use the cyclist's speed immediately before impact, independently of traffic speed.
export function crashMotion(speed, severity = 0, headOn = false) {
  const velocity = Math.max(3.4, Math.min(18.6, Number.isFinite(speed) ? speed : 3.4));
  const extra = velocity - 3.4;
  const pace = extra / 15.2;
  const impact = clamp01(Number.isFinite(severity) ? severity : 0);
  const rolls = velocity < 6.8 ? 0 : velocity < 11.0 ? 1 : velocity < 15.4 ? 2 : 3;
  const landTime = .51 + (.69 + (headOn ? .08 : 0)) * pace;
  const rollTime = .46 + .65 * pace + .58 * rolls;
  const restTime = landTime + rollTime;
  const remountStart = restTime + .21 + .09 * pace;
  const endTime = remountStart + 1.20 + .48 * pace;
  const throwDistance = (.66 + .42 * extra + .023 * extra * extra) * (headOn ? 1.05 : 1);
  const rollDistance = .34 + .23 * extra + .014 * extra * extra;
  const totalDistance = throwDistance + rollDistance;
  return {
    speed: velocity, severity: impact, pace, rolls, landTime, restTime, remountStart, endTime,
    throwDistance, rollDistance, totalDistance,
    airHeight: .14 + (1.02 + .13 * impact + (headOn ? .14 : 0)) * pace ** 1.24,
    bikeGap: Math.min(totalDistance * .63, .89 + 2.10 * pace),
  };
}

// Angular travel decreases continuously during the ground roll and stops at the
// exact final revolution. It drives the longitudinal position at the same time.
export function crashRollProgress(motion, elapsed) {
  const t = clamp01((elapsed - motion.landTime) / (motion.restTime - motion.landTime));
  return 1 - (1 - t) ** 1.76;
}

export function crashForwardTravel(motion, elapsed) {
  const flight = clamp01(elapsed / motion.landTime);
  const forward = motion.throwDistance * flight * (1.10 - .10 * flight);
  return forward + motion.rollDistance * crashRollProgress(motion, elapsed);
}

// The world advances this far from the impact point. During the remount the
// road origin catches up to the landing site, so the bird gets up where it fell.
export function crashRootTravel(motion, elapsed, recover = false) {
  const movingOrigin = .56 * crashForwardTravel(motion, elapsed);
  const catchUp = recover ? crashEase(motion.remountStart, motion.endTime, elapsed) : 0;
  return movingOrigin + (motion.totalDistance - movingOrigin) * catchUp;
}
