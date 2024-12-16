// Import the necessary components from three.js
import * as THREE from 'three';

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
  camera.position.z = 10;

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

  // Log dimensions for future visualization
  dimensions.forEach((dim) => {
    console.log(`Dimension: ${dim.name}, Difficulty: ${dim.difficulty_level}`);
  });

// Add player movement controls with debugging
const movementSpeed = 0.1;
const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

// Debugging: Print when keys are pressed or released
window.addEventListener('keydown', (e) => {
  console.log(`Key down: ${e.key}`);
  if (e.key === 'w') keys.forward = true;
  if (e.key === 's') keys.backward = true;
  if (e.key === 'a') keys.left = true;
  if (e.key === 'd') keys.right = true;
});

window.addEventListener('keyup', (e) => {
  console.log(`Key up: ${e.key}`);
  if (e.key === 'w') keys.forward = false;
  if (e.key === 's') keys.backward = false;
  if (e.key === 'a') keys.left = false;
  if (e.key === 'd') keys.right = false;
});

// Function to apply movement based on key presses
function handleMovement() {
  if (keys.forward) {
    console.log("Moving forward");
    camera.position.z -= movementSpeed;
  }
  if (keys.backward) {
    console.log("Moving backward");
    camera.position.z += movementSpeed;
  }
  if (keys.left) {
    console.log("Moving left");
    camera.position.x -= movementSpeed;
  }
  if (keys.right) {
    console.log("Moving right");
    camera.position.x += movementSpeed;
  }
}

// Call handleMovement in the animation loop
function animate() {
  requestAnimationFrame(animate);
  handleMovement(); // Ensure this is being called
  renderer.render(scene, camera);
}
animate();

  // Add click interaction
  window.addEventListener('click', (event) => {
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
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
