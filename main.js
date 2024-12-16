// Import necessary components from three.js
import * as THREE from 'three';
import { characterModels } from './src/generatedModels.js';

// Player and environment setup
const playerSpeed = 0.1;
const playerInitialPosition = new THREE.Vector3(0, 1, 0);
const gravity = 0.01;
const groundLevel = 0;
const moveBounds = {
  xMin: -10,
  xMax: 10,
  zMin: -10,
  zMax: 10
};

// Function to create geometry based on shape and size
function createGeometry(shape, size) {
  // size is [x, y, z]
  switch (shape.toLowerCase()) {
    case 'sphere':
      // Typically sphere sizes are uniform radius, but here we might just use the x component as radius
      return new THREE.SphereGeometry(size[0], 16, 16);
    case 'block':
    case 'box':
      return new THREE.BoxGeometry(size[0], size[1], size[2]);
    case 'cylinder':
      // Interpreting size as [radius, height, radius] or [diameter, height, diameter]
      // We'll assume size[0] is radius, size[1] height, and size[2] maybe ignored or same as radius
      return new THREE.CylinderGeometry(size[0], size[0], size[1], 16);
    case 'plane':
      return new THREE.PlaneGeometry(size[0], size[1]);
    case 'cylinder (leg)':
      // Just a note if needed, but we'll stick to the standard cylinder:
      return new THREE.CylinderGeometry(size[0], size[0], size[1], 16);
    default:
      // Default to a box if undefined
      return new THREE.BoxGeometry(size[0] || 0.5, size[1] || 0.5, size[2] || 0.5);
  }
}

// Function to create material based on color (simple Lambert for now)
function createMaterial(color, transparency) {
  const matParams = { color: color };
  if (typeof transparency === 'number' && transparency < 1) {
    matParams.transparent = true;
    matParams.opacity = transparency;
  }
  return new THREE.MeshLambertMaterial(matParams);
}

// Create a character from its model definition
function createCharacterModel(name) {
  const modelDef = characterModels[name];
  if (!modelDef) {
    console.warn("No model definition found for character:", name);
    return null;
  }

  // Create a group to hold all parts
  const group = new THREE.Group();
  group.name = name;

  // First, create all parts as meshes
  const parts = {};
  for (let p of modelDef.parts) {
    const geo = createGeometry(p.shape, p.size);
    const col = new THREE.Color(p.color);
    const mat = createMaterial(col);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.position[0], p.position[1], p.position[2]);
    parts[p.name] = mesh;
  }

  // Weld parts by adding them as children of their parent parts
  // The main assumption: part0 is the parent, part1 is the child
  for (let w of modelDef.welds) {
    if (parts[w.part0] && parts[w.part1]) {
      parts[w.part0].add(parts[w.part1]);
    }
  }

  // Find all parts that are not children of others (those will be parent-level)
  // We do this by checking if a part is a child of another. If not, attach it to the group
  const weldedParts = new Set(modelDef.welds.map(w => w.part1));
  for (let pName in parts) {
    if (!weldedParts.has(pName)) {
      group.add(parts[pName]);
    }
  }

  return group;
}

(async function () {
  // Fetch the character and dimension data from the mock backend
  const response = await fetch('/gamedata');
  const { characters, dimensions } = await response.json();
  console.log("Loaded characters:", characters);
  console.log("Loaded dimensions:", dimensions);

  // Set up the scene, camera, and renderer
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202020);

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  // Initial camera offset will be applied once player is created
  camera.position.set(0, 3, 5);

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Add lighting
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(10, 10, 10).normalize();
  scene.add(light);

  // Place characters in the scene based on their role
  const allies = characters.filter((c) => c.role === 'ally');
  const enemies = characters.filter((c) => c.role === 'enemy');
  const bosses = characters.filter((c) => c.role === 'boss' || c.role === 'mini-boss');

  function placeCharacters(chars, startX) {
    const spacing = 1.5;
    chars.forEach((char, i) => {
      const charModel = createCharacterModel(char.name);
      if (charModel) {
        charModel.position.x = startX + i * spacing;
        charModel.position.y = 0.5;
        // Store character name in userData for interaction
        charModel.userData = { name: char.name };
        scene.add(charModel);
      } else {
        // If no model defined in characterModels, fall back to basic shape
        const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.x = startX + i * spacing;
        mesh.position.y = 0.5;
        mesh.userData = { name: char.name };
        scene.add(mesh);
      }
    });
  }

  placeCharacters(allies, -5);
  placeCharacters(enemies, -1);
  placeCharacters(bosses, 3);

  // Log dimensions for debugging
  dimensions.forEach((dim) => {
    console.log(`Dimension: ${dim.name}, Difficulty: ${dim.difficulty_level}`);
  });

  // --- Player Setup ---
  const playerGeometry = new THREE.SphereGeometry(0.5, 16, 16);
  const playerMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const player = new THREE.Mesh(playerGeometry, playerMaterial);
  player.position.copy(playerInitialPosition);
  player.userData.isOnGround = false;
  player.userData.isMoving = false;
  scene.add(player);

  // --- Ground Plane for reference ---
  const groundGeometry = new THREE.PlaneGeometry(50, 50);
  const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  // --- Boundary Markers for Debugging ---
  function addBoundaryMarker(x, z) {
    const markerGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(x, 0.1, z);
    scene.add(marker);
  }

  // Mark corners of the bounding box
  addBoundaryMarker(moveBounds.xMin, moveBounds.zMin);
  addBoundaryMarker(moveBounds.xMin, moveBounds.zMax);
  addBoundaryMarker(moveBounds.xMax, moveBounds.zMin);
  addBoundaryMarker(moveBounds.xMax, moveBounds.zMax);

  // --- Movement Controls ---
  const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false
  };

  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'w') keys.forward = true;
    if (e.key.toLowerCase() === 's') keys.backward = true;
    if (e.key.toLowerCase() === 'a') keys.left = true;
    if (e.key.toLowerCase() === 'd') keys.right = true;
  });

  window.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() === 'w') keys.forward = false;
    if (e.key.toLowerCase() === 's') keys.backward = false;
    if (e.key.toLowerCase() === 'a') keys.left = false;
    if (e.key.toLowerCase() === 'd') keys.right = false;
  });

  // --- Collision Detection ---
  const raycaster = new THREE.Raycaster();
  function checkCollision(newPosition) {
    const directions = [
      new THREE.Vector3(1,0,0),
      new THREE.Vector3(-1,0,0),
      new THREE.Vector3(0,0,1),
      new THREE.Vector3(0,0,-1),
    ];

    for (let dir of directions) {
      raycaster.set(newPosition.clone(), dir.clone().normalize());
      const intersects = raycaster.intersectObjects(scene.children, true).filter(obj => obj.object !== player && obj.object !== ground);
      if (intersects.length > 0 && intersects[0].distance < 0.5) {
        // Collision detected
        return true;
      }
    }

    return false;
  }

  // --- Movement and Gravity ---
  function applyMovement() {
    let moveX = 0;
    let moveZ = 0;
    if (keys.forward) moveZ -= playerSpeed;
    if (keys.backward) moveZ += playerSpeed;
    if (keys.left) moveX -= playerSpeed;
    if (keys.right) moveX += playerSpeed;

    const newPosition = player.position.clone();
    newPosition.x += moveX;
    newPosition.z += moveZ;

    // Check boundaries
    newPosition.x = Math.max(moveBounds.xMin, Math.min(moveBounds.xMax, newPosition.x));
    newPosition.z = Math.max(moveBounds.zMin, Math.min(moveBounds.zMax, newPosition.z));

    // Check collisions
    if (!checkCollision(newPosition)) {
      player.position.copy(newPosition);
    }

    // Gravity
    if (player.position.y > groundLevel + 0.001) {
      player.position.y -= gravity;
    } else {
      player.position.y = groundLevel;
    }

    // Movement state
    const isMovingNow = (keys.forward || keys.backward || keys.left || keys.right);
    if (isMovingNow && !player.userData.isMoving) {
      player.userData.isMoving = true;
    } else if (!isMovingNow && player.userData.isMoving) {
      player.userData.isMoving = false;
    }

    // Change player color based on movement
    const currentColor = new THREE.Color(playerMaterial.color.getHex());
    const targetColor = new THREE.Color(player.userData.isMoving ? 0xffffff : 0x888888);
    currentColor.lerp(targetColor, 0.1);
    playerMaterial.color.set(currentColor);
  }

  // --- Camera Behavior ---
  function updateCamera() {
    const offsetZ = 5;
    const offsetY = 3;
    camera.position.x = player.position.x;
    camera.position.y = player.position.y + offsetY;
    camera.position.z = player.position.z + offsetZ;
    camera.lookAt(player.position);
  }

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    applyMovement();
    updateCamera();
    renderer.render(scene, camera);
  }

  animate();

  // Add click interaction
  window.addEventListener('click', (event) => {
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycasterClick = new THREE.Raycaster();
    raycasterClick.setFromCamera(mouse, camera);
    const intersects = raycasterClick.intersectObjects(scene.children, true);
    if (intersects.length > 0) {
      console.log("Clicked on:", intersects[0].object.userData.name);
    }
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

})();
