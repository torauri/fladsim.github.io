import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

// Python x/y maps to world x/z. Arena radius is one world unit.
export function createArena(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor('#101b23');
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.32, 1.32, 1.32, -1.32, .01, 20);
  const initialElevation = Math.atan2(3.3, 2.3);
  let azimuth = 0, elevation = initialElevation;
  const topElevation = Math.PI / 2 - .001;
  const minElevation = Math.PI / 6;
  let obliqueElevation = elevation;
  const cameraTarget = new THREE.Vector3(0, .06, .72);
  function positionCamera() {
    const distance = Math.cos(elevation) * 4;
    camera.position.set(cameraTarget.x + Math.sin(azimuth) * distance,
      cameraTarget.y + Math.sin(elevation) * 4, cameraTarget.z + Math.cos(azimuth) * distance);
    camera.up.set(-Math.sin(azimuth), 0, -Math.cos(azimuth));
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld();
  }
  positionCamera();
  scene.add(new THREE.HemisphereLight('#d4f6ff', '#24363b', 2.4));
  const sun = new THREE.DirectionalLight('#fff0d2', 3);
  sun.position.set(-2, 5, 3); scene.add(sun);
  const standard = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .65, metalness: .25, ...options });
  const mesh = (geometry, material, parent = scene) => { const object = new THREE.Mesh(geometry, material); parent.add(object); return object; };
  const platform = mesh(new THREE.CylinderGeometry(1, 1, .075, 128), standard('#243e49'));
  platform.position.y = -.04;
  function ring(radius, color, y = .008, thickness = .003, parent = scene) {
    const object = mesh(new THREE.TorusGeometry(radius, thickness, 8, 128), new THREE.MeshBasicMaterial({ color }), parent);
    object.rotation.x = Math.PI / 2; object.position.y = y; return object;
  }
  ring(1, '#7c9da8', .004, .004);
  ring(1.025, '#324e5a', -.04);
  ring(.73, '#3d5c67', .002, .001);
  for (let i = -3; i <= 3; i++) {
    const p = i / 4, edge = Math.sqrt(1 - p * p);
    for (const positions of [[-edge,.001,p,edge,.001,p], [p,.001,-edge,p,.001,edge]]) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      scene.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({color:'#34535f'})));
    }
  }
  function label(text, color, scale = .12) {
    const bitmap = document.createElement('canvas'); bitmap.width = bitmap.height = 128;
    const context = bitmap.getContext('2d');
    context.fillStyle = '#14252ee6'; context.beginPath(); context.roundRect(12,12,104,104,18); context.fill();
    context.strokeStyle = color; context.lineWidth = 4; context.stroke();
    context.fillStyle = color; context.font = 'bold 72px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text,64,69);
    const texture = new THREE.CanvasTexture(bitmap); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));
    sprite.scale.set(scale,scale,1); scene.add(sprite); return sprite;
  }
  const labels = ['A','2','B','3','C','4','D','1'];
  const colors = ['#cf81ee','#ebd88b','#e97c7c','#ebd88b','#83b8f2','#ebd88b','#93d6a4','#ebd88b'];
  labels.forEach((text,i) => {
    const angle = -Math.PI/2 + i * Math.PI/4;
    const x = Math.cos(angle)*.88, z = Math.sin(angle)*.88;
    const base = mesh(new THREE.CylinderGeometry(.045,.055,.035,24),standard(colors[i],{transparent:true,opacity:.55}));
    base.position.set(x,.018,z);
    const marker = label(text,colors[i]); marker.position.set(x,.105,z);
  });
  ring(.46,'#e48780',.012,.004);
  const front = mesh(new THREE.ConeGeometry(.02,.045,3),new THREE.MeshBasicMaterial({color:'#e48780'}));
  front.rotation.x = -Math.PI/2; front.position.set(0,.02,-.46);
  // Original geometric characters: no third-party game assets.
  const boss = new THREE.Group(); scene.add(boss);
  const body = mesh(new THREE.CylinderGeometry(.07,.11,.22,6),standard('#6b7b8d'),boss); body.position.y=.16;
  const crown = mesh(new THREE.OctahedronGeometry(.075),standard('#c89c74',{emissive:'#553020'}),boss); crown.position.y=.32;
  for (const side of [-1,1]) {
    const shoulder = mesh(new THREE.BoxGeometry(.055,.085,.11),standard('#91a2af'),boss); shoulder.position.set(side*.10,.22,0);
    const foot = mesh(new THREE.BoxGeometry(.045,.05,.07),standard('#586775'),boss); foot.position.set(side*.055,.04,0);
  }
  const eye = mesh(new THREE.BoxGeometry(.06,.014,.012),new THREE.MeshBasicMaterial({color:'#ff9f85'}),boss); eye.position.set(0,.33,-.06);
  const player = new THREE.Group(); scene.add(player);
  const playerMaterial = standard('#93f1dc',{emissive:'#24695b',emissiveIntensity:.7});
  const torso = mesh(new THREE.CylinderGeometry(.019,.027,.068,10),playerMaterial,player); torso.position.y=.063;
  const head = mesh(new THREE.SphereGeometry(.024,16,12),playerMaterial,player); head.position.y=.115;
  for (const side of [-1,1]) {
    const leg = mesh(new THREE.BoxGeometry(.012,.036,.017),playerMaterial,player); leg.position.set(side*.011,.022,0);
  }
  ring(.035,'#b3ffe8',.006,.002,player);

  // Clip each band polygon to the circular arena instead of showing a rectangle outside it.
  function bandGeometry(angle) {
    const a = angle*Math.PI/180, nx = Math.cos(a), nz = Math.sin(a);
    let polygon = Array.from({length:192},(_,i) => {const t=i*Math.PI*2/192;return [Math.cos(t),Math.sin(t)];});
    for (const [bound, sign] of [[0,1],[.5,-1]]) {
      const result=[];
      for(let i=0;i<polygon.length;i++) {
        const p=polygon[i], q=polygon[(i+1)%polygon.length];
        const dp=sign*(p[0]*nx+p[1]*nz-bound), dq=sign*(q[0]*nx+q[1]*nz-bound);
        if(dp>=0) result.push(p);
        if((dp>=0)!==(dq>=0)) {const t=dp/(dp-dq);result.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
      }
      polygon=result;
    }
    const positions=[];
    for(let i=1;i<polygon.length-1;i++) for(const p of [polygon[0],polygon[i],polygon[i+1]]) positions.push(p[0],.02,p[1]);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();return geometry;
  }
  const bandMaterial = new THREE.MeshBasicMaterial({color:'#efa657',transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false});
  const bands = Array.from({length:4},(_,i)=> {
    const area=mesh(new THREE.BufferGeometry(),bandMaterial.clone()); area.visible=false;
    const number=label(String(i+1),'#ffe1aa',.085);number.visible=false;
    return {area,number,angle:null};
  });
  function draw(state) {
    player.position.set(state.x,0,state.y);
    cameraTarget.set(state.x, .06, state.y);
    positionCamera();
    const hit=state.hits.some(i=>state.time>=6+i&&state.time<6.6+i);
    playerMaterial.color.set(hit?'#ff6470':'#93f1dc');
    bands.forEach(({area,number})=>{area.visible=false;number.visible=false;});
    for(const t of state.telegraphs) {
      const band=bands[t.index];
      if(band.angle!==t.angle) {band.area.geometry.dispose();band.area.geometry=bandGeometry(t.angle);band.angle=t.angle;}
      band.area.visible=band.number.visible=true;
      band.area.material.color.set(t.attack?'#ff5868':'#efa657');band.area.material.opacity=t.attack?.8:.5;
      const a=t.angle*Math.PI/180;band.number.position.set(Math.cos(a)*.29,.06,Math.sin(a)*.29);
    }
    renderer.render(scene,camera);
  }
  return {
    draw,
    resize() {const bounds=canvas.getBoundingClientRect();renderer.setSize(bounds.width,bounds.height,false);camera.left=-1.32* bounds.width/bounds.height;camera.right=1.32*bounds.width/bounds.height;camera.updateProjectionMatrix();},
    resetCamera() {azimuth=0;elevation=obliqueElevation=initialElevation;positionCamera();},
    movement(dx,dy) {return {dx:dx*Math.cos(azimuth)+dy*Math.sin(azimuth),dy:dy*Math.cos(azimuth)-dx*Math.sin(azimuth)};},
    rotate(delta) {azimuth+=delta;positionCamera();},
    orbit(horizontal, vertical) {
      azimuth = (azimuth + horizontal) % (Math.PI * 2);
      elevation = Math.max(minElevation, Math.min(topElevation, elevation + vertical));
      if (elevation < topElevation) obliqueElevation = elevation;
      positionCamera();
      return elevation >= topElevation;
    },
    toggleView() {
      const overhead = elevation < topElevation;
      elevation = overhead ? topElevation : obliqueElevation;
      positionCamera();
      return overhead;
    }
  };
}
