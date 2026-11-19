import atlasUrl from '../assets/rider/material-atlas.jpg';

// Wing, neck, orbital skin, bill and gular textures are projected from Lee Karney's
// public-domain USFWS portrait, https://www.fws.gov/media/brown-pelican-7 .
// The woven cloth, foot scales, tire tread and saddle hide are procedural.
const surfaces = ['vane', 'contour', 'down', 'pouch', 'horn', 'fabric', 'scales', 'tread', 'leather'];
export function atlasTile(finish) { return surfaces.indexOf(finish); }
export function loadPlumageAtlas(T) {
  if (typeof document === 'undefined') return null;
  const texture = new T.TextureLoader().load(atlasUrl);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Build an asymmetric convex pennaceous feather. The outlines taper to a point;
// the rachis and fine angled barbs are mapped to the full length of every vane.
function vane(T, center, across, depth, width, seed) {
  const positions = [], uv = [], indices = [];
  const lengthSteps = 12, breadthSteps = 4;
  for (let i = 0; i <= lengthSteps; i++) {
    const t = i / lengthSteps, c = center(t), lateral = across(t), n = depth(t);
    const belly = Math.pow(Math.sin(Math.PI * Math.pow(t, .79)), .61);
    for (let j = 0; j <= breadthSteps; j++) {
      const u = j / breadthSteps, x = 2 * u - 1;
      const split = .96 + .04 * Math.sin(seed + 14 * t + .7 * x);
      const spread = width * (.012 + belly) * x * (x < 0 ? .87 : 1.03) * split;
      const raised = width * (.16 - .18 * x * x) * belly;
      const pos = c.clone().addScaledVector(lateral, spread).addScaledVector(n, raised);
      positions.push(pos.x, pos.y, pos.z);
      uv.push(u, 1 - t);
    }
  }
  for (let i=0; i<lengthSteps; i++) for (let j=0; j<breadthSteps; j++) {
    const a=i*(breadthSteps+1)+j,b=a+breadthSteps+1;
    indices.push(a,b,a+1, a+1,b,b+1);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setIndex(indices);
  g.computeVertexNormals();
  // Mirrored surface patches retain an outward facing normal on either flank.
  const mid = Math.floor(lengthSteps/2)*(breadthSteps+1)+2;
  if (new T.Vector3().fromBufferAttribute(g.attributes.normal,mid).dot(depth(.5)) < 0) {
    for (let i=0;i<indices.length;i+=3) [indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
    g.setIndex(indices);
    g.computeVertexNormals();
  }
  return g;
}

export const torsoSections = [
  [-.443,0,1.57,.025,.045],[-.36,0,1.585,.165,.198],[-.24,0,1.56,.255,.263],
  [-.09,0,1.55,.30,.293],[.055,0,1.525,.321,.3],[.22,0,1.495,.322,.269],
  [.39,0,1.475,.289,.218],[.55,0,1.452,.211,.132],[.69,0,1.438,.12,.072],[.80,0,1.425,.024,.019]
];
const mantle = [
  [-.42,.052,.098,1.58],[-.31,.217,.223,1.575],[-.17,.294,.283,1.556],
  [.02,.338,.302,1.534],[.20,.344,.288,1.503],[.40,.311,.236,1.484],
  [.61,.243,.169,1.464],[.78,.185,.104,1.447],[.97,.079,.044,1.426],[1.10,.030,.016,1.415]
];
function dimensions(z) {
  let row=1;
  while (row<mantle.length-1 && mantle[row][0]<z) row++;
  const a=mantle[row-1], b=mantle[row], t=Math.max(0,Math.min(1,(z-a[0])/(b[0]-a[0])));
  return a.slice(1).map((v,i)=>v+(b[i+1]-v)*t);
}
export function addFlightFeathers(T, bird, shape) {
  const vector = (x,y,z)=>new T.Vector3(x,y,z);
  // Long blackish primaries lie below progressively shorter overlapping coverts.
  const rows = [
    {count:13,start:.12,end:.94,width:.044,colors:[0x777979,0x808181,0x878989]},
    {count:13,start:-.055,end:.77,width:.049,colors:[0xbdbdbb,0xc1c0bd,0xc9c8c2]},
    {count:13,start:-.216,end:.54,width:.051,colors:[0xe6e5e0,0xe9e6e1,0xdbdcd9]},
    {count:12,start:-.345,end:.318,width:.050,colors:[0xe4e0d8,0xe9e6df,0xe0dfd9]},
    {count:10,start:-.365,end:.103,width:.048,colors:[0xe8e5dd,0xe4e3dd,0xece7dc]},
  ];
  for (const side of [-1,1]) rows.forEach((row,r)=>{
    for(let j=0;j<row.count;j++) {
      const k=j/(row.count-1);
      const a0=.035+k*2.17+(r%2)*.085;
      const offset=.014*Math.sin(j*8.7+r*5.2);
      const z0=row.start+.08*k+offset;
      const z1=row.end-.16*Math.abs(k-.37)+offset;
      const angle=t=>a0+.22*t-.10*Math.sin(Math.PI*t);
      const normal=t=>vector(side*Math.sin(angle(t)),Math.cos(angle(t)),.08).normalize();
      const across=t=>vector(side*Math.cos(angle(t)),-Math.sin(angle(t)),0);
      const center=t=>{
        const z=z0+t*(z1-z0), [w,h,y]=dimensions(z), a=angle(t);
        const lift=.006+r*.0035+.013*t*t;
        return vector(side*(w+lift)*Math.sin(a),y+(h+lift)*Math.cos(a),z);
      };
      const g=vane(T,center,across,normal,row.width,17*j+r);
      const positions=g.attributes.position,uv=g.attributes.uv;
      for(let i=0;i<positions.count;i++) {
        const z=positions.getZ(i),[w,h,y]=dimensions(z);
        const a=Math.atan2(Math.abs(positions.getX(i))/w,(positions.getY(i)-y)/h);
        uv.setXY(i,Math.max(.002,Math.min(.998,(z+.39)/1.39)),1-Math.max(.002,Math.min(.998,a/2.48)));
      }
      shape(bird,g,row.colors[(j+2*r)%row.colors.length],'vane');
    }
  });
  for (let j=-5;j<=5;j++) {
    const k=j/5, baseX=k*.095, tipX=k*.207;
    const center=t=>vector(baseX*(1-t)+tipX*t,1.453-.056*t-.024*k*k,.44+(.58-.095*Math.abs(k))*t);
    shape(bird,vane(T,center,()=>vector(1,0,0),()=>vector(0,1,0),.051,21*j),Math.abs(j)%2?0x545150:0x6e6962,'vane');
  }
}
