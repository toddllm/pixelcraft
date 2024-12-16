// Import the necessary components from three.js
import * as THREE from 'three';

// Player and movement parameters
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

(async function () {
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

  function placeCharacters(chars, startX, colorFn, geometryFn) {
    const spacing = 1.5;
    chars.forEach((char, i) => {
      const geo = geometryFn(char);
      const mat = new THREE.MeshLambertMaterial({ color: colorFn(char) });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = startX + i * spacing;
      mesh.position.y = 0.5;
      mesh.userData = { name: char.name };
      scene.add(mesh);
    });
  }

  function characterColor(char) {
    switch (char.role) {
      case 'ally':
        return 0x00ff00;
      case 'enemy':
        return 0xff0000;
      case 'mini-boss':
      case 'boss':
        return 0x800080;
      default:
        return 0xffffff;
    }
  }

  function characterGeometry(char) {
    if (char.role === 'ally') {
      return new THREE.SphereGeometry(0.5, 16, 16);
    } else if (char.role === 'enemy') {
      return new THREE.BoxGeometry(0.5, 0.5, 0.5);
    } else if (char.role === 'mini-boss' || char.role === 'boss') {
      return new THREE.SphereGeometry(0.7, 16, 16);
    } else {
      return new THREE.BoxGeometry(0.5, 0.5, 0.5);
    }
  }

  // Place allies, enemies, and bosses in different groups
  placeCharacters(allies, -5, characterColor, characterGeometry);
  placeCharacters(enemies, -1, characterColor, characterGeometry);
  placeCharacters(bosses, 3, characterColor, characterGeometry);

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
  // We will add simple lines or cubes at the boundaries
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
  // For simplicity, we only check collisions with scene children that are not the player and not the ground
  const raycaster = new THREE.Raycaster();

  function checkCollision(newPosition) {
    // Cast rays from the new position to detect collisions with obstacles
    // We'll do a basic check in front, back, left, right directions
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
        // Collision detected if something is closer than player's radius
        return true;
      }
    }

    return false;
  }

  // --- Movement and Gravity ---
  function applyMovement() {
    // Determine intended movement
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
    // If player is above ground level, apply gravity
    if (player.position.y > groundLevel + 0.001) {
      player.position.y -= gravity;
    } else {
      player.position.y = groundLevel;
    }

    // Movement state
    const isMovingNow = (keys.forward || keys.backward || keys.left || keys.right);
    if (isMovingNow && !player.userData.isMoving) {
      // Transition from idle to moving
      player.userData.isMoving = true;
    } else if (!isMovingNow && player.userData.isMoving) {
      // Transition from moving to idle
      player.userData.isMoving = false;
    }

    // Change player color based on movement
    const currentColor = new THREE.Color(playerMaterial.color.getHex());
    const targetColor = new THREE.Color(player.userData.isMoving ? 0xffffff : 0x888888);
    // Linear interpolation of color
    currentColor.lerp(targetColor, 0.1);
    playerMaterial.color.set(currentColor);

    // Log player position for debugging
    if (isMovingNow) {
      console.log(`Player Position: x=${player.position.x.toFixed(2)} y=${player.position.y.toFixed(2)} z=${player.position.z.toFixed(2)}`);
    }
  }

  // --- Camera Behavior ---
  function updateCamera() {
    // Third-person camera offset
    const offsetZ = 5;
    const offsetY = 3;
    camera.position.x = player.position.x;
    camera.position.y = player.position.y + offsetY;
    camera.position.z = player.position.z + offsetZ;
    camera.lookAt(player.position);
  }

  // Animation Loop
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
