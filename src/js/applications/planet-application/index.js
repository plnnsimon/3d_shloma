import * as THREE from 'three';

import Sizes from '/src/pkg/utils/Sizes.js';
import ModelLoader from '/src/pkg/utils/GLTFLoader.js';
import ThreejsApplication from '/src/pkg/ThreejsApplication.js';

import SceneLights from './helpers/SceneLights.js';
import Camera from './helpers/Camera.js';
import Renderer from './helpers/Renderer.js';
import { addAtmosphere } from './add-atmosphere.js';

export class PlanetsApplication extends ThreejsApplication {
  constructor(objectPath) {
    super();

    this.objectPath = objectPath;

    this.canvas = null;
    this.canvasContainer = null;

    // this.eventEmitter = eventEmitter;
    this.raycaster = new THREE.Raycaster();
    this.observer = null;

    this.camera = null;
    this.scene = new THREE.Scene();
    this.renderer = null;
    this.loadedModel = null;
    this.fog = null;
    this.count = 0;
    this.sizes = null;
    this.sceneLights = null;
    this.gui = null;
    this.mixer = null;
    this.time = new THREE.Clock();

    this.rotateObj = false;
    this.parameters = {
      count: 100,
      size: 0.01
    };
    this.pointDirection = new THREE.Vector3(1, 1, 1);
  }

  async build(canvasContainerId) {
    const container = document.getElementById(canvasContainerId);
    if (!container) {
      console.log('Canvas container is not defined');
      return 
    }

    const canvas = document.createElement('canvas');
    this.canvas = canvas;

    container.appendChild(canvas);
    this.canvasContainer = container;
    this.sizes = new Sizes(container);

    this.camera = new Camera(this);
    this.renderer = new Renderer(this);
    this.sceneLights = new SceneLights(this);

    // resize event
    this.resize();
    this.sizes.subscribe('resize', () => {
      this.resize();
    });

    this.scene.scale.set(0.5, 0.5, 0.5);
    this.scene.position.set(0, 0, 0);
    this.camera.resize();

    if (!this.loadedModel) {
      console.log('Model is not defined');
      return
    }
    this.scene.add(this.loadedModel.scene);
    if (this.fog) {
      this.fog.visible = true;
      this.fog.material.needsUpdate = true;
    }
  }

  animateFrame() {
    this.animate();
  }

  resize() {
    this.camera.resize();
    this.renderer.resize();

    if (this.scene) {
      this.scene.traverse((el) => {
        if (el.material) {
          el.material.needsUpdate = true;
        }
      });
    }
  }

  animate() {
    const delta = this.time.getDelta();
    const elapsedTime = this.time.getElapsedTime();

    if (this.camera && this.renderer) {
      this.camera.update(delta);
      this.renderer.update(delta);
    }

    if (this.mixer) {
      this.mixer.update(delta);
    }
  }

  async init(callback) {
    if (this.scene) {
      this.scene.clear();
    }

    if (!this.objectPath) {
      console.log('Object is not defined');
      return 
    }

    const loader = new ModelLoader(this.objectPath, this);

    try {
      await loader.initGLTFLoader(callback);
      this.loadedModel.scene.position.set(0, 0, 0);

      const clips = this.loadedModel.animations;
      this.mixer = new THREE.AnimationMixer(this.loadedModel.scene);

      const circleClip = THREE.AnimationClip.findByName(
        clips,
        'bone_circle_animation_'
      );
      this.mixer.clipAction(circleClip).setLoop(THREE.LoopRepeat);

      const networkClip = THREE.AnimationClip.findByName(clips, 'Network');
      this.mixer.clipAction(networkClip).setLoop(THREE.LoopRepeat);

      const circleAction = this.mixer.clipAction(circleClip);
      circleAction.play();

      const networkAction = this.mixer.clipAction(networkClip);
      networkAction.play();

      const planet = this.loadedModel.scene.children[0];

      const options = {
        position: planet.position,
        scale: {
          x: planet.scale.x / 1.5,
          y: planet.scale.y / 1.5,
          z: planet.scale.z / 1.5
        },
        color: '#729f98'
      };
      this.fog = this.addPlanetLavaAtmosphere(options);
      this.fog.visible = false;
    } catch (err) {
      console.error(err);
    }
  }

  setObserver() {
    if (!this.canvas) {
      console.log('Canvas is not provided');
      return
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0
    };

    const callback = (entries, observer) => {
      const isIntersecting = entries.find((entry) => {
        return entry.isIntersecting;
      });
      if (isIntersecting) {
        console.log('isIntersecting');
        this.mount();
      }
      if (!isIntersecting) {
        console.log('no isIntersecting');
        this.unmount();
      }
    };

    this.observer = new IntersectionObserver(callback, options);
    this.observer.observe(this.canvas);
  }

  startAnimation() {
    this.setObserver();
  }

  stopAnimation() {
    this.unmount();
  }

  addPlanetLavaAtmosphere({ position, scale, color }) {
    const fog = addAtmosphere(position, scale, color);
    this.scene.add(fog);
    return fog;
  }

  dispose() {
    if (!this.renderer) return;

    while (this.scene && this.scene.children.length) {
      const child = this.scene.children[0];
      child.parent.remove(child);
    
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    }

    this.renderer.instance.dispose();
    this.renderer.instance.render(this.scene, this.camera.instance);
    THREE.Cache.remove();

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.scene) {
      this.scene.clear();
    }

    this.sizes.unsubscribe('resize', () => {
      this.resize();
    });
  }
}