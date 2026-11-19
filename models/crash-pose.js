import {crashEase as ease, crashForwardTravel, crashMotion, crashRollProgress, crashRootTravel} from './crash-motion.js';

const clamp01 = value => Math.max(0, Math.min(1, value));
const fullTurn = Math.PI * 2;
function arc(start, end, time) {
  const t = clamp01((time - start) / (end - start));
  return 4 * t * (1 - t);
}

// These transforms are relative to the same graded road plane as the rider root.
// Using the visible mesh vertices gives each handlebar, bill, boot and hat its
// real support height, even as outfits change and the wheel and leg joints move.
export function createCrashPose(T, root, bicycle, pelican) {
  const bikePivot = new T.Vector3(0, .65, -.09);
  const birdPivot = new T.Vector3(0, 1.55, .07);
  const framingPoint = new T.Vector3(0, 1.26, 0);
  const roadInverse = new T.Matrix4(), toRoad = new T.Matrix4();
  const offset = new T.Vector3(), birdFocus = new T.Vector3(), bikeFocus = new T.Vector3();
  const orientation = new T.Euler(0, 0, 0, 'YZX');
  let state = null;

  function floorHeight(obj) {
    let bottom = Infinity;
    obj.updateWorldMatrix(true, true);
    roadInverse.copy(root.matrixWorld).invert();
    obj.traverseVisible(mesh => {
      if (!mesh.isMesh) return;
      toRoad.multiplyMatrices(roadInverse, mesh.matrixWorld);
      const e = toRoad.elements;
      const geometry = mesh.geometry, p = geometry.attributes.position.array;
      // The local bounding sphere skips most of the feathers and frame fittings.
      const sphere = geometry.boundingSphere;
      if (sphere) {
        const c = sphere.center;
        const low = e[1]*c.x + e[5]*c.y + e[9]*c.z + e[13] -
          sphere.radius * Math.hypot(e[1], e[5], e[9]);
        if (low >= bottom) return;
      }
      const a = e[1], b = e[5], c = e[9], y = e[13];
      for (let i = 0; i < p.length; i += 3) {
        const h = a*p[i] + b*p[i + 1] + c*p[i + 2] + y;
        if (h < bottom) bottom = h;
      }
    });
    return Number.isFinite(bottom) ? bottom : 0;
  }

  function mounted(lean) {
    bicycle.position.set(0, 0, 0);
    pelican.position.set(0, 0, 0);
    bicycle.rotation.set(0, 0, lean);
    pelican.rotation.set(0, 0, lean);
    framingPoint.set(0, 1.26, 0);
  }

  function begin(crash, speed, lean) {
    if (!crash) {
      state = null;
      return null;
    }
    const elapsed = Math.max(0, crash.elapsed);
    if (!state || elapsed < state.elapsed) {
      const motion = crash.motion ?? crashMotion(crash.speed ?? speed, crash.severity, crash.headOn);
      mounted(lean);
      state = {
        elapsed, motion, severity: motion.severity, side: crash.side < 0 ? -1 : 1,
        headOn: !!crash.headOn, initialLean: lean, rollSpeed: motion.speed,
        standingHeight: floorHeight(pelican),
      };
    }
    const m = state.motion;
    const remount = crash.recover ? clamp01((elapsed-m.remountStart)/(m.endTime-m.remountStart)) : 0;
    state.elapsed = elapsed;
    state.recover = !!crash.recover;
    state.travelScale = clamp01(crash.travelScale ?? 1);
    state.remount = remount;
    state.bikeReturn = ease(0, .48, remount);
    state.birdReturn = ease(.30, 1, remount);
    state.release = ease(.025, .53*m.landTime, elapsed) * (1-state.birdReturn);
    state.kick = arc(.06*m.landTime, .87*m.landTime, elapsed) * (1-state.birdReturn);
    state.tuck = m.rolls ? ease(.32*m.landTime,m.landTime,elapsed) *
      (1-ease(m.restTime-.20,m.restTime+.14,elapsed)) : 0;
    const catchFraction = clamp01((remount-.18)/.68);
    state.bikeRetrievalSpeed = state.travelScale*m.bikeGap*(6*catchFraction*(1-catchFraction))/
      (.68*(m.endTime-m.remountStart));
    return state;
  }

  function pivotPose(obj, pivot, x, z, pitch, yaw, roll, order) {
    orientation.set(pitch, yaw, roll, order);
    obj.quaternion.setFromEuler(orientation);
    offset.copy(pivot).applyQuaternion(obj.quaternion);
    obj.position.set(pivot.x + x - offset.x, pivot.y - offset.y, pivot.z + z - offset.z);
  }

  function place(hit, lean) {
    if (!hit || hit.elapsed === 0 || hit.remount === 1) {
      mounted(lean);
      return;
    }
    const m = hit.motion, t = hit.elapsed, side = hit.side;
    const flight = clamp01(t/m.landTime);
    const ground = clamp01((t-m.landTime)/(m.restTime-m.landTime));
    const rollTravel = crashRollProgress(m,t);
    const birdForward = crashForwardTravel(m,t);
    const origin = crashRootTravel(m,t,hit.recover);
    const relativeZ = metres => (origin-metres)*hit.travelScale;
    const contact = ease(0, .06, t);
    const landing = ease(0, .91, flight);
    const bikeLanding = ease(.07, .96, flight);
    const bikeGroundProgress = 1-(1-ground)**2.05;
    const bikeFlightDistance = (m.throwDistance*(.44+.23*m.pace));
    const stoppedBike = m.totalDistance-m.bikeGap;
    const bikeForward = bikeFlightDistance*(1-(1-flight)**1.45) +
      (stoppedBike-bikeFlightDistance)*bikeGroundProgress +
      m.bikeGap*ease(.18,.86,hit.remount);
    const bikeRight = hit.bikeReturn;
    const bikePitch = -(hit.headOn ? .56+1.89*m.pace+.16*hit.severity : .23+.64*m.pace)*
      ease(0,.88,flight) + .10*arc(.83*m.landTime,1.11*m.landTime,t);
    const bikeRoll = -side*(1.56*bikeLanding+.19*arc(.86*m.landTime,1.15*m.landTime,t));
    const bikeX = side*(.32+.51*m.pace)*(.66*landing+.34*bikeGroundProgress)*
      (1-ease(.19,.86,hit.remount));
    pivotPose(bicycle,bikePivot,bikeX,relativeZ(bikeForward),
      bikePitch*(1-bikeRight), side*(hit.headOn ? .35:.63)*bikeLanding*(1-bikeRight),
      bikeRoll*(1-bikeRight)+lean*bikeRight+hit.initialLean*(1-contact),'YZX');
    const bikeRise = (.05+m.pace*(hit.headOn ? .42:.20))*arc(.075*m.landTime,m.landTime,t);
    const bikeBounce = (.019+.045*m.pace)*arc(m.landTime,m.landTime+.17,t);
    const bikeFloor = floorHeight(bicycle);
    const bikeClear = (bikeRise+bikeBounce+.004*contact)*(1-bikeRight);
    bicycle.position.y += Math.max(-bikeFloor,contact*(bikeClear-bikeFloor));

    const birdSide = side*((.40+.78*m.pace)*flight + (.25+.31*m.pace)*rollTravel);
    const birdX = birdSide*(1-ease(.29,.96,hit.remount));
    const righting = ease(0,.62,hit.remount);
    const shoulderDip = (hit.headOn ? .38+.36*m.pace : .22+.30*m.pace)*landing;
    // Keep the completed revolutions in the angle during the remount. Only the
    // residual shoulder dip and sideways lean straighten up when the bird stands.
    const birdPitch = -fullTurn*m.rolls*rollTravel - shoulderDip*(1-righting);
    const landingBank = m.rolls ? .48+.16*(1-m.pace) : 1.15;
    const restingBank = 1.46;
    const bank = landingBank*landing+(restingBank-landingBank)*ease(.39,1,ground);
    const roll = -side*bank*(1-righting) + lean*righting + hit.initialLean*(1-contact);
    const yaw = -side*(.12+.16*m.pace)*landing*(1-righting);
    // YXZ applies forward rotations about the transverse shoulder axis even when
    // the torso is banked. The bird rolls in the same direction it travels.
    pivotPose(pelican,birdPivot,birdX,relativeZ(birdForward),birdPitch,yaw,roll,'YXZ');
    const falldrop = hit.standingHeight*(1-flight)+m.airHeight*(4*flight*(1-flight));
    const firstBounce = m.rolls ? .014 : .026;
    const rebound = firstBounce*arc(m.landTime,m.landTime+.14,t);
    const birdFloor = floorHeight(pelican);
    const remountHop = (.19+.11*m.pace)*arc(.36,.96,hit.remount);
    const birdClear = (falldrop+rebound+.004*contact)*(1-hit.birdReturn) +
      hit.standingHeight*hit.birdReturn + remountHop;
    pelican.position.y += Math.max(-birdFloor,contact*(birdClear-birdFloor));

    birdFocus.set(0,1.56,-.11).applyQuaternion(pelican.quaternion).add(pelican.position);
    bikeFocus.set(0,.74,0).applyQuaternion(bicycle.quaternion).add(bicycle.position);
    // Hold a steadier vertical target during the ground rotations while following travel.
    const onGround = ease(.84*m.landTime,m.landTime+.12,t)*(1-righting);
    birdFocus.y += (.72-birdFocus.y)*onGround*.75;
    framingPoint.copy(bikeFocus).lerp(birdFocus,.72+.06*m.pace);
    framingPoint.lerp(offset.set(0,1.26,0),ease(.88,1,hit.remount));
  }
  return {begin, place, framingPoint};
}
