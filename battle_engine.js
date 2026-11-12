import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { STATS } from './stats.js';
import { RagdollPhysicsEngine } from './physics_ragdoll.js';

class Spring3D {
    constructor(stiffness = 165, damping = 14.5) {
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.target = new THREE.Vector3();
        this.stiffness = stiffness;
        this.damping = damping;
    }
    applyImpulse(x, y, z) {
        this.velocity.x += x;
        this.velocity.y += y;
        this.velocity.z += z;
    }
    update(dt) {
        const step = Math.min(dt, 0.033);
        const fx = (this.target.x - this.position.x) * this.stiffness - this.velocity.x * this.damping;
        const fy = (this.target.y - this.position.y) * this.stiffness - this.velocity.y * this.damping;
        const fz = (this.target.z - this.position.z) * this.stiffness - this.velocity.z * this.damping;
        this.velocity.x += fx * step;
        this.velocity.y += fy * step;
        this.velocity.z += fz * step;
        this.position.x += this.velocity.x * step;
        this.position.y += this.velocity.y * step;
        this.position.z += this.velocity.z * step;
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.noiseBuffer = null;
        this.engineNode = null;
    }
    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        const sr = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, sr * 1.5, sr);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    }
    playGunshot(distance = 0, isHeavy = false) {
        if (!this.ctx || !this.noiseBuffer) return;
        const now = this.ctx.currentTime;
        const atten = Math.max(0.04, Math.min(1.0, 26.0 / (distance + 20.0)));
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(isHeavy ? 380 : 1250, now);
        filter.frequency.exponentialRampToValueAtTime(140, now + (isHeavy ? 0.42 : 0.17));
        filter.Q.value = 0.9;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime((isHeavy ? 1.25 : 0.78) * atten, now + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (isHeavy ? 0.46 : 0.21));

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        src.start(now);
        src.stop(now + (isHeavy ? 0.48 : 0.23));

        const osc = this.ctx.createOscillator();
        const punchGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isHeavy ? 98 : 195, now);
        osc.frequency.exponentialRampToValueAtTime(28, now + 0.11);
        punchGain.gain.setValueAtTime(0.62 * atten, now);
        punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.115);
        osc.connect(punchGain);
        punchGain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
    }
    playExplosion(distance = 0) {
        if (!this.ctx || !this.noiseBuffer) return;
        const now = this.ctx.currentTime;
        const atten = Math.max(0.08, Math.min(1.0, 55.0 / (distance + 18.0)));
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;

        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(540, now);
        lp.frequency.exponentialRampToValueAtTime(42, now + 1.45);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(1.4 * atten, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

        src.connect(lp);
        lp.connect(gain);
        gain.connect(this.ctx.destination);
        src.start(now);
        src.stop(now + 1.55);
    }
    playHitMarker(isHeadshot = false) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = isHeadshot ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(isHeadshot ? 1680 : 920, now);
        osc.frequency.exponentialRampToValueAtTime(isHeadshot ? 620 : 340, now + 0.075);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.085);
    }
    playReloadClick(pitch = 640) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(pitch, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.045);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.055);
    }
    createDroneMotorNode() {
        if (!this.ctx) return null;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 390;
        gain.gain.value = 0.0;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        return { osc, gain };
    }
    updateVehicleEngineSound(active, speedKmh, throttle) {
        if (!this.ctx) return;
        if (!this.engineNode) {
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = 48;
            filter.type = 'lowpass';
            filter.frequency.value = 190;
            gain.gain.value = 0.0;
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            this.engineNode = { osc, filter, gain };
        }
        if (!active) {
            this.engineNode.gain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.08);
            return;
        }
        const rpmFreq = 46 + Math.min(85, speedKmh * 1.15 + Math.abs(throttle) * 28);
        this.engineNode.osc.frequency.setTargetAtTime(rpmFreq, this.ctx.currentTime, 0.06);
        this.engineNode.filter.frequency.setTargetAtTime(160 + rpmFreq * 2.2, this.ctx.currentTime, 0.06);
        this.engineNode.gain.gain.setTargetAtTime(0.11, this.ctx.currentTime, 0.08);
    }
}

export class BattleEngine {
    constructor() {
        this.container = document.getElementById('viewport');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x98a5b0);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.06, 600);
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.06;
        this.container.appendChild(this.renderer.domElement);

        this.customRenderHook = null;
        this.customLocationHook = null;
        this.provingGroundGroup = new THREE.Group();
        this.scene.add(this.provingGroundGroup);

        window.BATTLE_ENGINE = {
            instance: this,
            renderer: this.renderer,
            scene: this.scene,
            camera: this.camera,
            provingGroundGroup: this.provingGroundGroup,
            setCustomRenderHook: (fn) => { this.customRenderHook = fn; },
            setLocationBuilder: (fn) => {
                this.customLocationHook = fn;
                if (typeof fn === 'function') {
                    fn(this.scene, this.octree, this.ragdollPhysics);
                }
            }
        };

        this.sound = new SoundEngine();
        this.ragdollPhysics = new RagdollPhysicsEngine(this.scene);
        this.octree = new Octree();
        this.loader = new GLTFLoader();
        this.rawAssets = new Map();

        this.playerFaction = 'RU';
        this.isStarted = false;
        this.isPointerLocked = false;

        this.playerCollider = new Capsule(
            new THREE.Vector3(0, 0.36, 28),
            new THREE.Vector3(0, 1.44, 28),
            STATS.PLAYER.capsuleRadius
        );
        this.playerVelocity = new THREE.Vector3();
        this.playerDirection = new THREE.Vector3();
        this.playerOnFloor = false;
        this.playerHp = STATS.PLAYER.maxHp;
        this.killsCount = 0;
        this.headshotsCount = 0;

        this.yaw = 0;
        this.pitch = 0;
        this.targetLean = 0;
        this.currentLean = 0;
        this.isCrouching = false;
        this.isSprinting = false;
        this.isAiming = false;
        this.isFiring = false;
        this.bobTimer = 0;
        this.smoothYawVel = 0;
        this.smoothPitchVel = 0;

        this.cameraMount = new THREE.Group();
        this.scene.add(this.cameraMount);
        this.cameraMount.add(this.camera);

        this.viewmodelRoot = new THREE.Group();
        this.camera.add(this.viewmodelRoot);
        this.posSpring = new Spring3D(175, 15.5);
        this.rotSpring = new Spring3D(150, 13.5);

        this.loadoutKeys = ['ak12', 'm4a1', 'ak74m', 'rpg7'];
        this.currentWeaponIdx = 0;
        this.weaponStates = {};
        for (const k of this.loadoutKeys) {
            const st = STATS.WEAPONS[k];
            this.weaponStates[k] = {
                mag: st.magCapacity,
                chambered: true,
                reserve: st.reserveAmmo,
                reloading: false,
                reloadState: 'READY',
                reloadTimer: 0,
                reloadTotal: 0,
                lastFireTime: 0,
                meshGroup: null
            };
        }

        this.muzzleLight = new THREE.PointLight(0xffaa33, 0, 12.0);
        this.camera.add(this.muzzleLight);
        this.muzzleLight.position.set(0.12, -0.08, -0.78);

        this.keys = {};
        this.units = [];
        this.drones = [];
        this.projectiles = [];
        this.particles = [];
        this.brassCasings = [];
        this.dynamicLights = [];
        this.staticShootableMeshes = [];

        this.playerVehicleState = {
            vehicle: null,
            role: null,
            desantSlotIndex: -1,
            thirdPersonCamera: true
        };
        this.nearestInteractVehicle = null;

        this.fpvMode = {
            active: false,
            droneType: 'KAMIKAZE',
            droneMesh: null,
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            yaw: 0,
            pitch: 0,
            roll: 0,
            battery: 100,
            motorAudio: null
        };

        this.squadOrderMode = 'HOLD';
        this.clock = new THREE.Clock();
        this.raycaster = new THREE.Raycaster();
    }

    async boot() {
        this.setupLighting();
        await this.ragdollPhysics.init();
        this.buildCleanPolygonFloorAndRamps();
        await this.loadAllModelsWithProgress();
        this.populateMilitaryLineupRows();
        this.setupViewmodelMeshes();
        this.bindEvents();
        this.updateWeaponHUD();

        const loadOverlay = document.getElementById('loading-overlay');
        const startPanel = document.getElementById('start-panel');
        if (loadOverlay) loadOverlay.style.display = 'none';
        if (startPanel) startPanel.style.display = 'flex';

        this.animate();
    }

    setupLighting() {
        const hemiLight = new THREE.HemisphereLight(0xc2d0dc, 0x423d35, 0.92);
        hemiLight.position.set(0, 70, 0);
        this.scene.add(hemiLight);

        this.sunLight = new THREE.DirectionalLight(0xfff3df, 2.6);
        this.sunLight.position.set(65, 95, 55);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 4096;
        this.sunLight.shadow.mapSize.height = 4096;
        this.sunLight.shadow.camera.near = 1.0;
        this.sunLight.shadow.camera.far = 280;
        const d = 105;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        this.sunLight.shadow.bias = -0.0004;
        this.scene.add(this.sunLight);
    }

    buildCleanPolygonFloorAndRamps() {
        const floorGeo = new THREE.PlaneGeometry(600, 600);
        floorGeo.rotateX(-Math.PI / 2);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x3b3e38,
            roughness: 0.9,
            metalness: 0.05
        });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.receiveShadow = true;
        this.provingGroundGroup.add(floorMesh);
        this.octree.fromGraphNode(floorMesh);
        this.staticShootableMeshes.push(floorMesh);

        const gridHelper = new THREE.GridHelper(240, 120, 0x626b5c, 0x494f44);
        gridHelper.position.y = 0.01;
        this.provingGroundGroup.add(gridHelper);

        const bumpPositions = [
            { x: -18, z: -2, w: 6.0, h: 0.38, d: 2.2 },
            { x: -9,  z: -2, w: 6.0, h: 0.35, d: 2.0 },
            { x: 0,   z: -2, w: 6.0, h: 0.35, d: 2.0 },
            { x: 9,   z: -2, w: 6.0, h: 0.38, d: 2.2 },
            { x: -9,  z: -8, w: 6.0, h: 0.42, d: 2.4 },
            { x: 0,   z: -8, w: 6.0, h: 0.42, d: 2.4 }
        ];
        const rampMat = new THREE.MeshStandardMaterial({ color: 0x565a52, roughness: 0.82 });
        for (const bp of bumpPositions) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(bp.w, bp.h, bp.d), rampMat);
            mesh.position.set(bp.x, bp.h * 0.5, bp.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.provingGroundGroup.add(mesh);
            this.octree.fromGraphNode(mesh);
            this.staticShootableMeshes.push(mesh);
            this.ragdollPhysics.addStaticBoxCollider(
                mesh.position,
                { x: bp.w * 0.5, y: bp.h * 0.5, z: bp.d * 0.5 }
            );
        }
    }

    async loadAllModelsWithProgress() {
        const barFill = document.getElementById('loading-bar-fill');
        const statusTxt = document.getElementById('loading-status-text');
        const total = STATS.MODELS.length;
        let loadedCount = 0;

        const loadSingle = (entry) => new Promise((resolve) => {
            this.loader.load(
                entry.file,
                (gltf) => {
                    this.rawAssets.set(entry.key, { gltf, entry });
                    loadedCount++;
                    const pct = Math.round((loadedCount / total) * 100);
                    if (barFill) barFill.style.width = `${pct}%`;
                    if (statusTxt) statusTxt.textContent = `ЗАГРУЗКА 3D МОДЕЛЕЙ: ${loadedCount} / ${total} (${entry.key.toUpperCase()})`;
                    resolve();
                },
                undefined,
                () => {
                    loadedCount++;
                    if (barFill) barFill.style.width = `${Math.round((loadedCount / total) * 100)}%`;
                    resolve();
                }
            );
        });

        const batchSize = 5;
        for (let i = 0; i < STATS.MODELS.length; i += batchSize) {
            const slice = STATS.MODELS.slice(i, i + batchSize);
            await Promise.all(slice.map(loadSingle));
        }
    }

    instantiateStaticModel(key, targetSpanOverride = null) {
        const item = this.rawAssets.get(key);
        const wrapper = new THREE.Group();
        if (!item || !item.gltf || !item.gltf.scene) {
            const fallback = new THREE.Mesh(
                new THREE.BoxGeometry(1.5, 1.2, 2.5),
                new THREE.MeshStandardMaterial({ color: 0x4a5240, roughness: 0.8 })
            );
            fallback.position.y = 0.6;
            wrapper.add(fallback);
            return wrapper;
        }

        const clone = item.gltf.scene.clone(true);
        clone.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                    child.material.side = THREE.DoubleSide;
                }
            }
        });

        clone.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(clone);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const desiredSpan = targetSpanOverride || item.entry.targetSize || 2.0;
        const scale = desiredSpan / maxDim;

        clone.scale.multiplyScalar(scale);
        clone.updateMatrixWorld(true);

        const scaledBox = new THREE.Box3().setFromObject(clone);
        const scaledCenter = new THREE.Vector3();
        scaledBox.getCenter(scaledCenter);

        clone.position.set(
            clone.position.x - scaledCenter.x,
            clone.position.y - scaledBox.min.y,
            clone.position.z - scaledCenter.z
        );

        wrapper.add(clone);
        return wrapper;
    }

    instantiateSkinnedSoldier(faction) {
        const key = faction === 'RU' ? 'soldier_ru' : 'soldier_ua';
        const item = this.rawAssets.get(key);
        const root = new THREE.Group();

        if (!item || !item.gltf || !item.gltf.scene) {
            const fallback = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.28, 1.25, 6, 12),
                new THREE.MeshStandardMaterial({ color: faction === 'RU' ? 0x3b4832 : 0x525840 })
            );
            fallback.position.y = 0.9;
            root.add(fallback);
            return { root, bones: {} };
        }

        const clonedScene = SkeletonUtils.clone(item.gltf.scene);
        const toRemove = [];
        clonedScene.traverse((child) => {
            if (child.name && child.name.startsWith('Armband_')) {
                toRemove.push(child);
            }
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.frustumCulled = false;
            }
        });
        for (const rem of toRemove) {
            if (rem.parent) rem.parent.remove(rem);
        }

        clonedScene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(clonedScene);
        const size = new THREE.Vector3();
        box.getSize(size);
        const currentHeight = Math.max(size.y, 0.1);
        const scale = 1.82 / currentHeight;
        clonedScene.scale.multiplyScalar(scale);
        clonedScene.updateMatrixWorld(true);

        const sBox = new THREE.Box3().setFromObject(clonedScene);
        const sCenter = new THREE.Vector3();
        sBox.getCenter(sCenter);
        clonedScene.position.set(
            clonedScene.position.x - sCenter.x,
            clonedScene.position.y - sBox.min.y,
            clonedScene.position.z - sCenter.z
        );

        root.add(clonedScene);
        const bones = this.ragdollPhysics.extractSoldierBones(clonedScene);

        const bandColor = faction === 'RU' ? 0xd91b1b : 0x155ce6;
        const bandMat = new THREE.MeshStandardMaterial({
            color: bandColor,
            roughness: 0.55,
            metalness: 0.08,
            emissive: bandColor,
            emissiveIntensity: 0.18
        });

        const attachBoneArmband = (armBone) => {
            if (!armBone) return;
            const bandGeo = new THREE.CylinderGeometry(8.5, 8.5, 11.0, 14);
            const bandMesh = new THREE.Mesh(bandGeo, bandMat);
            bandMesh.position.set(0, 12.0, 0);
            armBone.add(bandMesh);
        };
        attachBoneArmband(bones.upperArmL);
        attachBoneArmband(bones.upperArmR);

        const weaponKey = faction === 'RU' ? 'weapon_ak12' : 'weapon_m4a1';
        const rifleMesh = this.instantiateStaticModel(weaponKey, 0.78);
        if (bones.chest) {
            rifleMesh.position.set(0.16, -0.05, 0.34);
            rifleMesh.rotation.set(0, Math.PI, 0);
            root.add(rifleMesh);
            root.userData.rifleMesh = rifleMesh;
        }

        return { root, bones, modelNode: clonedScene };
    }

    addStaticObstacleCollider(obj3d, shrink = 0.85) {
        obj3d.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(obj3d);
        if (box.isEmpty()) return;
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        if (size.x < 0.2 || size.y < 0.2 || size.z < 0.2) return;

        const colMesh = new THREE.Mesh(
            new THREE.BoxGeometry(size.x * shrink, size.y * shrink, size.z * shrink),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        colMesh.position.copy(center);
        this.scene.add(colMesh);
        this.octree.fromGraphNode(colMesh);
        this.staticShootableMeshes.push(colMesh);

        this.ragdollPhysics.addStaticBoxCollider(
            center,
            { x: size.x * shrink * 0.5, y: size.y * shrink * 0.5, z: size.z * shrink * 0.5 }
        );
    }

    populateMilitaryLineupRows() {
        const armorRowKeys = [
            { key: 't90m_ru',    x: -27, z: 12, yaw: 0 },
            { key: 't72b3_ru',   x: -18, z: 12, yaw: 0 },
            { key: 'btr80_ru',   x: -9,  z: 12, yaw: 0 },
            { key: 'bmp2_ua',    x: 0,   z: 12, yaw: 0 },
            { key: 'bradley_ua', x: 9,   z: 12, yaw: 0 },
            { key: 'humvee_ua',  x: 18,  z: 12, yaw: 0 },
            { key: 'uaz452',     x: 27,  z: 12, yaw: 0 }
        ];

        for (const item of armorRowKeys) {
            const spec = STATS.VEHICLE_SPECS[item.key];
            const vMesh = this.instantiateStaticModel(spec.key, spec.span);
            this.scene.add(vMesh);
            const vObj = this.ragdollPhysics.createPhysicalVehicle(
                spec,
                vMesh,
                new THREE.Vector3(item.x, 0.0, item.z),
                item.yaw
            );
            if (vObj && vObj.hitProxyMesh) {
                this.staticShootableMeshes.push(vObj.hitProxyMesh);
            }
        }

        const standMat = new THREE.MeshStandardMaterial({ color: 0x2c343b, roughness: 0.7, metalness: 0.3 });
        const droneStandRow = [
            { key: 'drone_fpv',    span: 0.65, x: -10.0, z: 22.0 },
            { key: 'drone_fpv',    span: 0.65, x: -6.0,  z: 22.0 },
            { key: 'drone_lancet', span: 1.45, x: -2.0,  z: 22.0 },
            { key: 'drone_lancet', span: 1.45, x: 2.0,   z: 22.0 },
            { key: 'drone_mavic',  span: 0.52, x: 6.0,   z: 22.0 },
            { key: 'drone_mavic',  span: 0.52, x: 10.0,  z: 22.0 }
        ];
        for (const ds of droneStandRow) {
            const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), standMat);
            pedestal.position.set(ds.x, 0.45, ds.z);
            pedestal.castShadow = true;
            pedestal.receiveShadow = true;
            this.scene.add(pedestal);
            this.addStaticObstacleCollider(pedestal, 0.95);

            const dMesh = this.instantiateStaticModel(ds.key, ds.span);
            dMesh.position.set(ds.x, 0.92, ds.z);
            this.scene.add(dMesh);
        }

        const weaponStandRow = [
            { key: 'weapon_ak12',  span: 0.95, x: -8.0, z: 25.5 },
            { key: 'weapon_m4a1',  span: 0.92, x: -4.0, z: 25.5 },
            { key: 'weapon_ak74m', span: 0.95, x: 0.0,  z: 25.5 },
            { key: 'weapon_rpg7',  span: 1.15, x: 4.0,  z: 25.5 },
            { key: 'unit_javelin', span: 1.72, x: 8.0,  z: 25.5 }
        ];
        for (const ws of weaponStandRow) {
            if (ws.key === 'unit_javelin') {
                const jav = this.instantiateStaticModel(ws.key, ws.span);
                jav.position.set(ws.x, 0, ws.z);
                jav.rotation.y = Math.PI;
                this.scene.add(jav);
            } else {
                const rack = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 0.7), standMat);
                rack.position.set(ws.x, 0.425, ws.z);
                rack.castShadow = true;
                this.scene.add(rack);
                const wMesh = this.instantiateStaticModel(ws.key, ws.span);
                wMesh.position.set(ws.x, 0.95, ws.z);
                wMesh.rotation.y = Math.PI * 0.5;
                this.scene.add(wMesh);
            }
        }

        for (let i = 0; i < 8; i++) {
            const xPos = -10.5 + i * 3.0;
            this.spawnSoldierUnit('RU', i, new THREE.Vector3(xPos, 0, 17.5), Math.PI, true);
        }

        const btrVehicle = this.ragdollPhysics.vehicles.find((v) => v.spec.key === 'btr80_ru');
        if (btrVehicle) {
            this.mountSquadOnVehicle(btrVehicle, 4);
        }

        const fortRowZ = -24.0;
        for (let i = -20; i <= 20; i += 5.0) {
            const dtMesh = this.instantiateStaticModel('dragons_teeth', 3.4);
            dtMesh.position.set(i, 0, fortRowZ);
            this.scene.add(dtMesh);
            this.addStaticObstacleCollider(dtMesh, 0.82);
        }

        const hescoRowCoords = [-18, -12, -6, 6, 12, 18];
        for (const hx of hescoRowCoords) {
            const hesco = this.instantiateStaticModel('hesco_bastion', 4.3);
            hesco.position.set(hx, 0, -29.0);
            this.scene.add(hesco);
            this.addStaticObstacleCollider(hesco, 0.88);
        }

        const trenchTarget = this.instantiateStaticModel('trench_system', 24.0);
        trenchTarget.position.set(0, -0.25, -36.0);
        this.scene.add(trenchTarget);

        for (let i = 0; i < 12; i++) {
            const xPos = -22.0 + i * 4.0;
            this.spawnSoldierUnit('UA', i, new THREE.Vector3(xPos, 0, -31.5 - (i % 2) * 3.0), 0, false);
        }

        const enemyTargetVehicles = [
            { key: 'bmp2_ua',    x: -14, z: -42, yaw: 0 },
            { key: 'bradley_ua', x: 0,   z: -42, yaw: 0 },
            { key: 'humvee_ua',  x: 14,  z: -42, yaw: 0 }
        ];
        for (const ev of enemyTargetVehicles) {
            const spec = STATS.VEHICLE_SPECS[ev.key];
            const vMesh = this.instantiateStaticModel(spec.key, spec.span);
            this.scene.add(vMesh);
            const vObj = this.ragdollPhysics.createPhysicalVehicle(
                spec,
                vMesh,
                new THREE.Vector3(ev.x, 0.0, ev.z),
                ev.yaw
            );
            if (vObj && vObj.hitProxyMesh) {
                this.staticShootableMeshes.push(vObj.hitProxyMesh);
            }
        }

        this.spawnAutonomousDrones();
    }

    spawnSoldierUnit(faction, slotIndex, customPos = null, customYaw = 0, isAlliedDesant = false) {
        const built = this.instantiateSkinnedSoldier(faction);
        const pos = customPos || new THREE.Vector3((slotIndex - 4) * 3.5, 0, faction === 'RU' ? 17.5 : -31.5);
        built.root.position.copy(pos);
        built.root.rotation.y = customYaw;
        this.scene.add(built.root);

        const unit = {
            id: `${faction}_${slotIndex}_${Math.floor(Math.random() * 9999)}`,
            name: faction === 'RU' ? `Десантник ВС РФ #${slotIndex + 1}` : `Боец ВСУ #${slotIndex + 1}`,
            faction,
            slotIndex,
            isAlliedDesant,
            homePos: pos.clone(),
            homeYaw: customYaw,
            root: built.root,
            bones: built.bones,
            hp: 100,
            maxHp: 100,
            isDead: false,
            mountedVehicle: null,
            animPhase: Math.random() * Math.PI * 2,
            flinchAmount: 0,
            fireTimer: 0.8 + Math.random() * 1.5,
            moveTarget: pos.clone(),
            respawnCountdown: 0,
            hitboxes: []
        };

        this.ragdollPhysics.attachAnatomicalHitboxes(unit);
        this.units.push(unit);
        return unit;
    }

    mountSquadOnVehicle(vehicle, maxToMount = 6) {
        if (!vehicle || vehicle.destroyed) return 0;
        let mountedCount = 0;
        const availableAllies = this.units.filter((u) => !u.isDead && u.isAlliedDesant && !u.mountedVehicle);

        for (let sIdx = 0; sIdx < vehicle.desantUnits.length; sIdx++) {
            if (vehicle.desantUnits[sIdx] !== null) continue;
            if (vehicle.playerSeatedMode === 'DESANT' && vehicle.playerDesantSlot === sIdx) continue;
            const soldier = availableAllies.shift();
            if (!soldier) break;

            vehicle.desantUnits[sIdx] = soldier;
            soldier.mountedVehicle = vehicle;
            if (soldier.bones.upperLegL && soldier.bones.upperLegR) {
                soldier.bones.upperLegL.rotation.x = -0.65;
                soldier.bones.upperLegR.rotation.x = -0.65;
            }
            mountedCount++;
            if (mountedCount >= maxToMount) break;
        }
        return mountedCount;
    }

    dismountSquadFromVehicle(vehicle) {
        if (!vehicle) return 0;
        let count = 0;
        for (let sIdx = 0; sIdx < vehicle.desantUnits.length; sIdx++) {
            const soldier = vehicle.desantUnits[sIdx];
            if (!soldier) continue;
            vehicle.desantUnits[sIdx] = null;
            soldier.mountedVehicle = null;

            const sideSign = (sIdx % 2 === 0) ? -1 : 1;
            const dropOffset = new THREE.Vector3(
                sideSign * (vehicle.spec.halfExtents[0] + 1.4),
                0,
                (sIdx - 2) * 1.1
            ).applyQuaternion(vehicle.chassisQuat);

            soldier.root.position.copy(vehicle.chassisPos).add(dropOffset);
            soldier.root.position.y = 0.0;
            soldier.moveTarget.copy(soldier.root.position).add(new THREE.Vector3(0, 0, -6.0));
            if (soldier.bones.upperLegL && soldier.bones.upperLegR) {
                soldier.bones.upperLegL.rotation.x = 0;
                soldier.bones.upperLegR.rotation.x = 0;
            }
            count++;
        }
        return count;
    }

    toggleSquadTransportOnNearestVehicle() {
        const targetVeh = this.playerVehicleState.vehicle || this.nearestInteractVehicle;
        if (!targetVeh) return;

        const currentlyMounted = targetVeh.desantUnits.filter((u) => u !== null).length;
        const banner = document.getElementById('squad-order-banner');
        this.sound.playReloadClick(780);

        if (currentlyMounted > 0) {
            const dismounted = this.dismountSquadFromVehicle(targetVeh);
            if (banner) {
                banner.textContent = `ДЕСАНТ СПЕШЕН С БРОНИ [${targetVeh.name}]: ${dismounted} БОЙЦОВ ВСТУПИЛИ В БОЙ`;
                banner.classList.add('active-assault');
            }
        } else {
            const mounted = this.mountSquadOnVehicle(targetVeh, targetVeh.spec.desantSlots.length);
            if (banner) {
                banner.textContent = `ДЕСАНТ ПОСАЖЕН НА БРОНЮ [${targetVeh.name}]: ${mounted} БОЙЦОВ НА БРОНЕ`;
                banner.classList.remove('active-assault');
            }
        }
    }

    enterVehicleAsDriver(vehicle) {
        if (!vehicle || vehicle.destroyed) return;
        if (this.playerVehicleState.vehicle) {
            this.exitCurrentVehicle();
        }
        this.playerVehicleState.vehicle = vehicle;
        this.playerVehicleState.role = 'DRIVER';
        this.playerVehicleState.desantSlotIndex = -1;
        this.playerVehicleState.thirdPersonCamera = true;
        vehicle.playerSeatedMode = 'DRIVER';
        vehicle.turretYaw = this.yaw;
        vehicle.turretPitch = 0;

        this.viewmodelRoot.visible = false;
        this.sound.playReloadClick(520);
        this.updateWeaponHUD();
    }

    enterVehicleAsArmorDesant(vehicle) {
        if (!vehicle || vehicle.destroyed) return;
        if (this.playerVehicleState.vehicle) {
            this.exitCurrentVehicle();
        }

        let freeSlot = -1;
        for (let i = 0; i < vehicle.desantSlots?.length || vehicle.spec.desantSlots.length; i++) {
            if (vehicle.desantUnits[i] === null) {
                freeSlot = i;
                break;
            }
        }
        if (freeSlot === -1) freeSlot = 0;

        this.playerVehicleState.vehicle = vehicle;
        this.playerVehicleState.role = 'DESANT';
        this.playerVehicleState.desantSlotIndex = freeSlot;
        this.playerVehicleState.thirdPersonCamera = false;
        vehicle.playerSeatedMode = 'DESANT';
        vehicle.playerDesantSlot = freeSlot;

        this.viewmodelRoot.visible = true;
        this.sound.playReloadClick(640);
        this.updateWeaponHUD();
    }

    exitCurrentVehicle() {
        const veh = this.playerVehicleState.vehicle;
        if (!veh) return;

        veh.controls.throttle = 0;
        veh.controls.steer = 0;
        veh.controls.brake = true;
        veh.playerSeatedMode = null;
        veh.playerDesantSlot = -1;

        const exitOffset = new THREE.Vector3(-(veh.spec.halfExtents[0] + 1.65), 0, 0).applyQuaternion(veh.chassisQuat);
        const exitPos = veh.chassisPos.clone().add(exitOffset);
        exitPos.y = Math.max(0.36, exitPos.y + 0.36);

        this.playerCollider.start.set(exitPos.x, exitPos.y, exitPos.z);
        this.playerCollider.end.set(exitPos.x, exitPos.y + 1.08, exitPos.z);
        this.playerVelocity.set(0, 0, 0);

        this.playerVehicleState.vehicle = null;
        this.playerVehicleState.role = null;
        this.playerVehicleState.desantSlotIndex = -1;

        this.viewmodelRoot.visible = !this.fpvMode.active;
        this.sound.updateVehicleEngineSound(false, 0, 0);
        this.sound.playReloadClick(420);
        this.updateWeaponHUD();
    }

    toggleVehicleAutopilot() {
        const veh = this.playerVehicleState.vehicle || this.nearestInteractVehicle;
        if (!veh || veh.destroyed) return;
        veh.controls.aiAutopilot = !veh.controls.aiAutopilot;
        if (!veh.controls.aiAutopilot) {
            veh.controls.throttle = 0;
            veh.controls.brake = true;
        }
        this.sound.playReloadClick(910);
        const banner = document.getElementById('squad-order-banner');
        if (banner) {
            banner.textContent = veh.controls.aiAutopilot
                ? `АВТОПИЛОТ МЕХВОДА [${veh.name}]: ВКЛЮЧЕН (ДВИЖЕНИЕ С ДЕСАНТОМ НА БРОНЕ)`
                : `АВТОПИЛОТ МЕХВОДА [${veh.name}]: ОСТАНОВЛЕН`;
        }
    }

    spawnAutonomousDrones() {
        const droneConfigs = [
            { key: 'drone_fpv',    type: 'KAMIKAZE', faction: 'RU', span: 0.62, y: 15, radius: 26, speed: 14.0 },
            { key: 'drone_lancet', type: 'LANCET',   faction: 'RU', span: 1.45, y: 24, radius: 34, speed: 18.5 },
            { key: 'drone_mavic',  type: 'RECON',    faction: 'UA', span: 0.50, y: 19, radius: 20, speed: 7.5 }
        ];

        for (let i = 0; i < droneConfigs.length; i++) {
            const cfg = droneConfigs[i];
            const mesh = this.instantiateStaticModel(cfg.key, cfg.span);
            const angle = (i / droneConfigs.length) * Math.PI * 2;
            mesh.position.set(Math.cos(angle) * cfg.radius, cfg.y, Math.sin(angle) * cfg.radius);
            this.scene.add(mesh);

            const navLight = new THREE.PointLight(cfg.faction === 'RU' ? 0xff2222 : 0x2277ff, 1.4, 8.0);
            navLight.position.set(0, -0.1, 0);
            mesh.add(navLight);

            this.drones.push({
                mesh,
                config: cfg,
                angle,
                diveTarget: null,
                diveTimer: 14.0 + Math.random() * 12.0,
                isDiving: false
            });
        }
    }

    setupViewmodelMeshes() {
        for (const key of this.loadoutKeys) {
            const wStat = STATS.WEAPONS[key];
            const wState = this.weaponStates[key];
            const group = new THREE.Group();
            const model = this.instantiateStaticModel(wStat.modelKey, wStat.scale);
            model.rotation.set(wStat.rotOffset[0], wStat.rotOffset[1], wStat.rotOffset[2]);
            group.add(model);
            group.visible = (key === this.loadoutKeys[this.currentWeaponIdx]);
            this.viewmodelRoot.add(group);
            wState.meshGroup = group;
        }
    }

    selectFactionAndStart(faction) {
        this.playerFaction = faction;
        this.currentWeaponIdx = faction === 'RU' ? 0 : 1;
        this.switchWeapon(this.currentWeaponIdx);

        this.playerCollider.start.set(-4.0, 0.36, 20.5);
        this.playerCollider.end.set(-4.0, 1.44, 20.5);
        this.yaw = 0.0;
        this.pitch = -0.05;
        this.playerHp = STATS.PLAYER.maxHp;

        this.sound.init();
        const startPanel = document.getElementById('start-panel');
        if (startPanel) startPanel.style.display = 'none';
        this.isStarted = true;
        this.renderer.domElement.requestPointerLock();
        this.updateWeaponHUD();
    }

    switchWeapon(index) {
        if (index < 0 || index >= this.loadoutKeys.length) return;
        this.currentWeaponIdx = index;
        const activeKey = this.loadoutKeys[this.currentWeaponIdx];
        for (const k of this.loadoutKeys) {
            const st = this.weaponStates[k];
            if (st.meshGroup) st.meshGroup.visible = (k === activeKey);
        }
        this.posSpring.applyImpulse(0, -1.2, 0.6);
        this.rotSpring.applyImpulse(-1.8, 0, 0.8);
        this.sound.playReloadClick(520);
        this.updateWeaponHUD();
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        const btnRu = document.getElementById('btn-faction-ru');
        const btnUa = document.getElementById('btn-faction-ua');
        if (btnRu) btnRu.addEventListener('click', () => this.selectFactionAndStart('RU'));
        if (btnUa) btnUa.addEventListener('click', () => this.selectFactionAndStart('UA'));

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = (document.pointerLockElement === this.renderer.domElement);
        });

        this.renderer.domElement.addEventListener('mousedown', (e) => {
            if (!this.isStarted) return;
            this.sound.init();
            if (!this.isPointerLocked) {
                this.renderer.domElement.requestPointerLock();
                return;
            }
            if (e.button === 0) {
                if (this.fpvMode.active) {
                    this.detonatePlayerFpvDrone();
                } else if (this.playerVehicleState.vehicle && this.playerVehicleState.role === 'DRIVER') {
                    this.isFiring = true;
                    this.tryFireVehicleWeapon(this.playerVehicleState.vehicle);
                } else {
                    this.isFiring = true;
                    this.tryFireCurrentWeapon();
                }
            } else if (e.button === 2) {
                this.isAiming = true;
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.isFiring = false;
            if (e.button === 2) this.isAiming = false;
        });

        window.addEventListener('contextmenu', (e) => e.preventDefault());

        document.addEventListener('mousemove', (e) => {
            if (!this.isPointerLocked) return;
            const sens = this.isAiming ? 0.0013 : 0.0021;
            const dx = e.movementX || 0;
            const dy = e.movementY || 0;

            if (this.fpvMode.active) {
                this.fpvMode.yaw -= dx * 0.0024;
                this.fpvMode.pitch = Math.max(-1.35, Math.min(1.15, this.fpvMode.pitch - dy * 0.0022));
                this.fpvMode.roll = THREE.MathUtils.lerp(this.fpvMode.roll, -dx * 0.012, 0.35);
                return;
            }

            this.yaw -= dx * sens;
            this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - dy * sens));
            this.smoothYawVel += dx * 0.00025;
            this.smoothPitchVel += dy * 0.00025;

            if (this.playerVehicleState.vehicle && this.playerVehicleState.role === 'DRIVER') {
                this.playerVehicleState.vehicle.turretYaw = this.yaw;
                this.playerVehicleState.vehicle.turretPitch = Math.max(-0.18, Math.min(0.48, this.pitch));
            }
        });

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (!this.isStarted) return;

            if (e.code === 'Digit1') this.switchWeapon(0);
            else if (e.code === 'Digit2') this.switchWeapon(1);
            else if (e.code === 'Digit3') this.switchWeapon(2);
            else if (e.code === 'Digit4') this.switchWeapon(3);
            else if (e.code === 'KeyR' && !this.fpvMode.active && this.playerVehicleState.role !== 'DRIVER') {
                this.triggerTacticalReload();
            } else if (e.code === 'KeyF') {
                if (this.playerVehicleState.vehicle) {
                    this.exitCurrentVehicle();
                } else if (this.nearestInteractVehicle) {
                    this.enterVehicleAsDriver(this.nearestInteractVehicle);
                }
            } else if (e.code === 'KeyB') {
                if (this.playerVehicleState.vehicle && this.playerVehicleState.role === 'DESANT') {
                    this.exitCurrentVehicle();
                } else {
                    const targetV = this.playerVehicleState.vehicle || this.nearestInteractVehicle;
                    if (targetV) this.enterVehicleAsArmorDesant(targetV);
                }
            } else if (e.code === 'KeyH') {
                this.toggleSquadTransportOnNearestVehicle();
            } else if (e.code === 'KeyT') {
                this.toggleVehicleAutopilot();
            } else if (e.code === 'KeyK' && this.playerVehicleState.vehicle && this.playerVehicleState.role === 'DRIVER') {
                this.playerVehicleState.thirdPersonCamera = !this.playerVehicleState.thirdPersonCamera;
            } else if (e.code === 'KeyC' && !this.fpvMode.active && !this.playerVehicleState.vehicle) {
                this.isCrouching = !this.isCrouching;
            } else if (e.code === 'KeyV') {
                this.togglePlayerFpvDrone('KAMIKAZE');
            } else if (e.code === 'KeyN') {
                this.togglePlayerFpvDrone('LANCET');
            } else if (e.code === 'KeyG') {
                this.issueSquadAssaultOrder();
            } else if (e.code === 'KeyQ') {
                this.targetLean = -1;
            } else if (e.code === 'KeyE') {
                this.targetLean = 1;
            } else if (e.code === 'Space' && this.playerOnFloor && !this.fpvMode.active && !this.playerVehicleState.vehicle) {
                this.playerVelocity.y = STATS.PLAYER.jumpImpulse;
                this.playerOnFloor = false;
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (e.code === 'KeyQ' && this.targetLean < 0) this.targetLean = 0;
            if (e.code === 'KeyE' && this.targetLean > 0) this.targetLean = 0;
        });
    }

    tryFireVehicleWeapon(vehicle) {
        if (!vehicle || vehicle.destroyed) return;
        const now = performance.now() * 0.001;
        if (now - vehicle.fireTimer < vehicle.spec.fireCooldown) return;
        vehicle.fireTimer = now;

        const muzzleLocal = new THREE.Vector3(
            vehicle.spec.muzzleOffset[0],
            vehicle.spec.muzzleOffset[1],
            vehicle.spec.muzzleOffset[2]
        );
        const muzzleWorld = muzzleLocal.applyQuaternion(vehicle.chassisQuat).add(vehicle.chassisPos);

        const aimDir = new THREE.Vector3(
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch)
        ).normalize();

        this.sound.playGunshot(0, vehicle.spec.isHeavyCannon);
        this.ragdollPhysics.applyCannonRecoil(vehicle, aimDir);

        const flashLight = new THREE.PointLight(0xffaa33, vehicle.spec.isHeavyCannon ? 28.0 : 12.0, 18.0);
        flashLight.position.copy(muzzleWorld);
        this.scene.add(flashLight);
        this.dynamicLights.push({ light: flashLight, ttl: 0.14, maxTtl: 0.14 });

        if (vehicle.spec.isHeavyCannon) {
            const shellGroup = new THREE.Group();
            const shellMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.06, 0.55, 8),
                new THREE.MeshBasicMaterial({ color: 0xffbb44 })
            );
            shellMesh.rotation.x = Math.PI * 0.5;
            shellGroup.add(shellMesh);
            shellGroup.position.copy(muzzleWorld);
            shellGroup.lookAt(muzzleWorld.clone().add(aimDir));
            this.scene.add(shellGroup);

            this.projectiles.push({
                mesh: shellGroup,
                vel: aimDir.clone().multiplyScalar(vehicle.spec.shellVelocity),
                radius: vehicle.spec.blastRadius,
                force: vehicle.spec.blastForce,
                damage: vehicle.spec.damage,
                weaponName: `${vehicle.name} (${vehicle.spec.weaponName})`,
                sourceVehicle: vehicle,
                ttl: 4.5
            });
        } else {
            const endPoint = muzzleWorld.clone().addScaledVector(aimDir, 180.0);
            this.raycaster.set(muzzleWorld, aimDir);
            this.raycaster.far = 180.0;

            for (const u of this.units) {
                this.ragdollPhysics.syncSoldierHitboxes(u);
            }
            const targets = [...this.ragdollPhysics.hitboxMeshes, ...this.staticShootableMeshes];
            const hits = this.raycaster.intersectObjects(targets, false);

            for (const hit of hits) {
                if (hit.object === vehicle.hitProxyMesh) continue;
                endPoint.copy(hit.point);
                if (hit.object.userData && hit.object.userData.isSoldierHitbox) {
                    const unit = hit.object.userData.unit;
                    const zoneKey = hit.object.userData.zone;
                    const partName = hit.object.userData.partName;
                    this.applyBulletHitToSoldier(
                        unit,
                        zoneKey,
                        partName,
                        hit.point,
                        aimDir,
                        {
                            damage: vehicle.spec.damage,
                            bulletMass: 0.18,
                            muzzleVelocity: 940,
                            name: `${vehicle.name} (${vehicle.spec.weaponName})`
                        },
                        'ВЫ'
                    );
                } else {
                    this.triggerHighExplosiveBlast(
                        hit.point,
                        vehicle.spec.blastRadius,
                        vehicle.spec.blastForce,
                        vehicle.spec.damage,
                        `${vehicle.name} (${vehicle.spec.weaponName})`
                    );
                }
                break;
            }
            this.spawnTracerBeam(muzzleWorld, endPoint, 0xffaa22);
        }
    }

    issueSquadAssaultOrder() {
        this.squadOrderMode = this.squadOrderMode === 'ASSAULT' ? 'HOLD' : 'ASSAULT';
        this.sound.playReloadClick(880);
        const orderBanner = document.getElementById('squad-order-banner');
        if (orderBanner) {
            orderBanner.textContent = this.squadOrderMode === 'ASSAULT'
                ? 'ПРИКАЗ ОТРЯДУ: ШТУРМ РУБЕЖА ПРОТИВНИКА [АКТИВЕН]'
                : 'ПРИКАЗ ОТРЯДУ: ВЕРНУТЬСЯ К БРОНЕТЕХНИКЕ [G — ШТУРМ]';
            orderBanner.classList.toggle('active-assault', this.squadOrderMode === 'ASSAULT');
        }
    }

    togglePlayerFpvDrone(type = 'KAMIKAZE') {
        if (this.fpvMode.active) {
            this.exitPlayerFpvDrone();
            return;
        }
        if (this.playerVehicleState.vehicle) {
            this.exitCurrentVehicle();
        }
        this.fpvMode.active = true;
        this.fpvMode.droneType = type;
        this.viewmodelRoot.visible = false;
        this.fpvMode.position.copy(this.cameraMount.position).add(new THREE.Vector3(0, 2.5, -1.5));
        this.fpvMode.velocity.set(0, 5.5, -12.0);
        this.fpvMode.yaw = this.yaw;
        this.fpvMode.pitch = -0.08;
        this.fpvMode.roll = 0;
        this.fpvMode.battery = 100;

        if (this.fpvMode.droneMesh) {
            this.scene.remove(this.fpvMode.droneMesh);
        }
        const modelKey = type === 'LANCET' ? 'drone_lancet' : 'drone_fpv';
        const span = type === 'LANCET' ? 1.35 : 0.58;
        this.fpvMode.droneMesh = this.instantiateStaticModel(modelKey, span);
        this.scene.add(this.fpvMode.droneMesh);

        if (!this.fpvMode.motorAudio) {
            this.fpvMode.motorAudio = this.sound.createDroneMotorNode();
        }
        if (this.fpvMode.motorAudio) {
            this.fpvMode.motorAudio.gain.gain.value = 0.09;
        }

        const fpvHud = document.getElementById('fpv-osd');
        if (fpvHud) fpvHud.style.display = 'block';
    }

    exitPlayerFpvDrone() {
        this.fpvMode.active = false;
        this.viewmodelRoot.visible = (this.playerVehicleState.role !== 'DRIVER');
        if (this.fpvMode.droneMesh) this.fpvMode.droneMesh.visible = false;
        if (this.fpvMode.motorAudio) this.fpvMode.motorAudio.gain.gain.value = 0.0;
        const fpvHud = document.getElementById('fpv-osd');
        if (fpvHud) fpvHud.style.display = 'none';
    }

    detonatePlayerFpvDrone() {
        if (!this.fpvMode.active) return;
        const blastPos = this.fpvMode.position.clone();
        const label = this.fpvMode.droneType === 'LANCET' ? 'БПЛА «ЛАНЦЕТ-3»' : 'FPV-ДРОН ПГ-7ВЛ';
        this.exitPlayerFpvDrone();
        this.triggerHighExplosiveBlast(blastPos, STATS.FPV.blastRadius, STATS.FPV.blastForce, STATS.FPV.damage, label);
    }

    triggerTacticalReload() {
        const key = this.loadoutKeys[this.currentWeaponIdx];
        const wStat = STATS.WEAPONS[key];
        const wState = this.weaponStates[key];
        if (wState.reloading || wState.reserve <= 0) return;

        const maxPossible = wState.chambered ? wStat.magCapacity + 1 : wStat.magCapacity;
        if (wState.mag >= maxPossible) return;

        wState.reloading = true;
        if (wState.mag > 0) {
            wState.reloadState = 'TACTICAL_RELOAD';
            wState.reloadTotal = wStat.tacticalReloadTime;
            wState.chambered = true;
            wState.mag -= 1;
        } else {
            wState.reloadState = 'DRY_RELOAD';
            wState.reloadTotal = wStat.dryReloadTime;
            wState.chambered = false;
        }
        wState.reloadTimer = wState.reloadTotal;
        this.sound.playReloadClick(440);
        this.posSpring.applyImpulse(0, -1.6, 0.4);
        this.rotSpring.applyImpulse(-2.4, 0.6, 1.4);
        this.updateWeaponHUD();
    }

    updateReloadStateMachine(dt) {
        const key = this.loadoutKeys[this.currentWeaponIdx];
        const wStat = STATS.WEAPONS[key];
        const wState = this.weaponStates[key];
        if (!wState.reloading) return;

        wState.reloadTimer -= dt;
        if (wState.reloadTimer <= 0) {
            const needed = wStat.magCapacity - wState.mag;
            const take = Math.min(needed, wState.reserve);
            wState.mag += take;
            wState.reserve -= take;

            if (wState.chambered && wState.reserve > 0) {
                wState.mag += 1;
                wState.reserve -= 1;
            } else if (!wState.chambered && wState.mag > 0) {
                wState.chambered = true;
            }

            wState.reloading = false;
            wState.reloadState = 'READY';
            this.sound.playReloadClick(760);
            this.posSpring.applyImpulse(0, 0.9, -0.5);
            this.rotSpring.applyImpulse(1.5, -0.3, -0.9);
            this.updateWeaponHUD();
        }
    }

    tryFireCurrentWeapon() {
        if (this.fpvMode.active || this.playerVehicleState.role === 'DRIVER') return;
        const key = this.loadoutKeys[this.currentWeaponIdx];
        const wStat = STATS.WEAPONS[key];
        const wState = this.weaponStates[key];
        if (wState.reloading) return;

        const now = performance.now() * 0.001;
        const interval = 60.0 / wStat.rpm;
        if (now - wState.lastFireTime < interval) return;

        if (wState.mag <= 0) {
            wState.chambered = false;
            this.sound.playReloadClick(310);
            this.triggerTacticalReload();
            return;
        }

        wState.lastFireTime = now;
        wState.mag -= 1;
        if (wState.mag === 0) wState.chambered = false;
        this.updateWeaponHUD();

        this.sound.playGunshot(0, wStat.isExplosive);
        this.muzzleLight.intensity = wStat.isExplosive ? 12.0 : 6.5;

        const adsMult = this.isAiming ? 0.58 : 1.0;
        this.posSpring.applyImpulse(
            (Math.random() - 0.5) * 0.45 * adsMult,
            wStat.recoilRise * 28.0 * adsMult,
            wStat.recoilKickBack * 42.0 * adsMult
        );
        this.rotSpring.applyImpulse(
            wStat.recoilPitch * 32.0 * adsMult,
            (Math.random() - 0.5) * wStat.recoilYaw * 48.0 * adsMult,
            (Math.random() - 0.5) * wStat.recoilRoll * 40.0 * adsMult
        );

        this.pitch = Math.min(1.35, this.pitch + wStat.recoilPitch * 0.19 * adsMult);
        this.yaw += (Math.random() - 0.5) * wStat.recoilYaw * 0.25 * adsMult;

        if (!wStat.isExplosive) {
            this.spawnBrassCasing();
            this.performBallisticRaycast(wStat);
        } else {
            this.launchRpgRocket(wStat);
        }
    }

    spawnBrassCasing() {
        const geo = new THREE.CylinderGeometry(0.007, 0.007, 0.036, 6);
        geo.rotateZ(Math.PI * 0.5);
        const mat = new THREE.MeshStandardMaterial({ color: 0xd8a838, metalness: 0.85, roughness: 0.22 });
        const mesh = new THREE.Mesh(geo, mat);

        const spawnPos = new THREE.Vector3(0.18, -0.09, -0.35);
        spawnPos.applyMatrix4(this.camera.matrixWorld);
        mesh.position.copy(spawnPos);
        this.scene.add(mesh);

        const rightVec = new THREE.Vector3(1, 0.45, 0.1).applyQuaternion(this.camera.quaternion).normalize();
        const vel = rightVec.multiplyScalar(3.4 + Math.random() * 1.4);
        vel.add(this.playerVelocity);

        this.brassCasings.push({
            mesh,
            vel,
            rotVel: new THREE.Vector3(Math.random() * 18, Math.random() * 18, Math.random() * 18),
            ttl: 2.2
        });
    }

    performBallisticRaycast(wStat) {
        const origin = new THREE.Vector3();
        const dir = new THREE.Vector3(0, 0, -1);
        this.camera.getWorldPosition(origin);
        dir.applyQuaternion(this.camera.quaternion);

        const spread = this.isAiming ? 0.002 : 0.01;
        dir.x += (Math.random() - 0.5) * spread;
        dir.y += (Math.random() - 0.5) * spread;
        dir.z += (Math.random() - 0.5) * spread;
        dir.normalize();

        const tracerEnd = origin.clone().addScaledVector(dir, 160.0);
        this.raycaster.set(origin, dir);
        this.raycaster.far = 160.0;

        for (const u of this.units) {
            this.ragdollPhysics.syncSoldierHitboxes(u);
        }

        const targets = [...this.ragdollPhysics.hitboxMeshes, ...this.staticShootableMeshes];
        const hits = this.raycaster.intersectObjects(targets, false);

        if (hits.length > 0) {
            const hit = hits[0];
            tracerEnd.copy(hit.point);

            if (hit.object.userData && hit.object.userData.isSoldierHitbox) {
                const unit = hit.object.userData.unit;
                const zoneKey = hit.object.userData.zone;
                const partName = hit.object.userData.partName;
                this.applyBulletHitToSoldier(unit, zoneKey, partName, hit.point, dir, wStat);
            } else if (hit.object.userData && hit.object.userData.isVehicleHitbox) {
                const veh = hit.object.userData.vehicle;
                this.spawnImpactParticles(hit.point, dir.clone().negate(), 0xffaa33, 8);
                if (veh && veh.body) {
                    veh.body.applyImpulseAtPoint(
                        { x: dir.x * 180, y: dir.y * 180, z: dir.z * 180 },
                        { x: hit.point.x, y: hit.point.y, z: hit.point.z },
                        true
                    );
                }
            } else {
                this.spawnImpactParticles(hit.point, hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0), 0x8a7962, 9);
            }
        }

        this.spawnTracerBeam(
            origin.clone().addScaledVector(dir, 0.65).add(new THREE.Vector3(0, -0.06, 0)),
            tracerEnd,
            this.playerFaction === 'RU' ? 0x44ff55 : 0xff4433
        );
    }

    applyBulletHitToSoldier(unit, zoneKey, partName, hitPoint, bulletDir, wStat, attackerName = 'ВЫ') {
        if (unit.isDead) return;
        const zoneSpec = STATS.HITBOX[zoneKey] || STATS.HITBOX.TORSO;
        const finalDmg = Math.round(wStat.damage * zoneSpec.mult);
        unit.hp -= finalDmg;
        unit.flinchAmount = 1.0;

        this.spawnImpactParticles(hitPoint, bulletDir.clone().negate(), 0x9e0b0b, zoneKey === 'HEAD' ? 22 : 13);

        if (attackerName === 'ВЫ') {
            this.sound.playHitMarker(zoneKey === 'HEAD');
            this.flashCrosshairHit(zoneKey === 'HEAD');
        }

        if (unit.hp <= 0) {
            this.killSoldierWithRagdoll(unit, zoneKey, partName, hitPoint, bulletDir, wStat, attackerName);
        }
    }

    killSoldierWithRagdoll(unit, zoneKey, partName, hitPoint, impactDir, wStat, attackerName = 'ВЫ') {
        if (unit.isDead) return;
        unit.isDead = true;
        unit.respawnCountdown = 10.0;

        const momentumMag = wStat.bulletMass * wStat.muzzleVelocity * (zoneKey === 'HEAD' ? 1.55 : 1.15);
        const impulseVec = impactDir.clone().normalize().multiplyScalar(momentumMag);
        impulseVec.y += 14.0;

        if (zoneKey === 'HEAD' && unit.bones.head) {
            const headPos = new THREE.Vector3();
            unit.bones.head.getWorldPosition(headPos);
            this.ragdollPhysics.spawnFlyingHelmet(headPos, impulseVec, unit.faction);
        }

        this.ragdollPhysics.triggerArticulatedRagdoll(unit, partName, impulseVec, hitPoint);

        const dist = Math.round(this.cameraMount.position.distanceTo(unit.root.position));
        if (attackerName === 'ВЫ') {
            this.killsCount++;
            if (zoneKey === 'HEAD') this.headshotsCount++;
            this.updateScoreHUD();
        }
        this.pushKillFeed(attackerName, unit.name, STATS.HITBOX[zoneKey]?.label || 'ТОРC', dist, wStat.name);
    }

    launchRpgRocket(wStat) {
        const origin = new THREE.Vector3();
        const dir = new THREE.Vector3(0, 0, -1);
        this.camera.getWorldPosition(origin);
        dir.applyQuaternion(this.camera.quaternion).normalize();

        const rocketGroup = new THREE.Group();
        const bodyMesh = new THREE.Mesh(
            new THREE.ConeGeometry(0.06, 0.42, 8),
            new THREE.MeshStandardMaterial({ color: 0x3d482e, roughness: 0.5 })
        );
        bodyMesh.rotation.x = Math.PI * 0.5;
        rocketGroup.add(bodyMesh);

        const tailLight = new THREE.PointLight(0xff7722, 4.5, 9.0);
        tailLight.position.set(0, 0, 0.25);
        rocketGroup.add(tailLight);

        rocketGroup.position.copy(origin).addScaledVector(dir, 0.8);
        rocketGroup.lookAt(rocketGroup.position.clone().add(dir));
        this.scene.add(rocketGroup);

        this.projectiles.push({
            mesh: rocketGroup,
            vel: dir.multiplyScalar(wStat.muzzleVelocity),
            radius: wStat.blastRadius,
            force: wStat.blastForce,
            damage: wStat.damage,
            weaponName: wStat.name,
            sourceVehicle: null,
            ttl: 4.5
        });
    }

    triggerHighExplosiveBlast(epicenter, radius, force, maxDamage, sourceLabel = 'ОФС 125мм') {
        this.sound.playExplosion(this.cameraMount.position.distanceTo(epicenter));

        const flashLight = new THREE.PointLight(0xff8822, 26.0, radius * 2.5);
        flashLight.position.copy(epicenter).add(new THREE.Vector3(0, 1.2, 0));
        this.scene.add(flashLight);
        this.dynamicLights.push({ light: flashLight, ttl: 0.34, maxTtl: 0.34 });

        this.spawnImpactParticles(epicenter, new THREE.Vector3(0, 1, 0), 0xff6611, 34);
        this.spawnImpactParticles(epicenter, new THREE.Vector3(0, 1, 0), 0x2a241e, 38);

        const camDist = this.cameraMount.position.distanceTo(epicenter);
        if (camDist < radius * 2.2) {
            const shake = Math.pow(1.0 - camDist / (radius * 2.2), 1.5) * 3.8;
            this.posSpring.applyImpulse((Math.random() - 0.5) * shake, shake * 0.8, shake);
            this.rotSpring.applyImpulse((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
        }

        for (const unit of this.units) {
            if (unit.isDead) continue;
            const d = unit.root.position.distanceTo(epicenter);
            if (d < radius) {
                const falloff = Math.pow(1.0 - d / radius, 1.35);
                const dmg = Math.round(maxDamage * falloff);
                unit.hp -= dmg;
                if (unit.hp <= 0) {
                    const blastDir = unit.root.position.clone().sub(epicenter).normalize();
                    blastDir.y += 0.75;
                    blastDir.normalize();
                    this.killSoldierWithRagdoll(
                        unit,
                        d < radius * 0.35 ? 'HEAD' : 'TORSO',
                        'torso',
                        unit.root.position.clone().add(new THREE.Vector3(0, 1.0, 0)),
                        blastDir,
                        { bulletMass: 1.8, muzzleVelocity: force * falloff, name: sourceLabel },
                        'ВЫ'
                    );
                }
            }
        }

        this.ragdollPhysics.applyExplosionBlastToRagdolls(epicenter, radius, force);

        for (const veh of this.ragdollPhysics.vehicles) {
            if (veh.destroyed) continue;
            const d = veh.chassisPos.distanceTo(epicenter);
            if (d < radius) {
                const dmg = Math.round(maxDamage * (1.0 - d / radius));
                veh.hp = Math.max(0, veh.hp - dmg);
                if (veh.hp <= 0) {
                    veh.destroyed = true;
                    this.dismountSquadFromVehicle(veh);
                    this.ragdollPhysics.spawnBlownTurretDebris(veh);
                    this.pushKillFeed('ВЫ', veh.name, 'ДЕТОНАЦИЯ БК / СРЫВ БАШНИ', Math.round(camDist), sourceLabel);
                    this.spawnImpactParticles(veh.chassisPos.clone().add(new THREE.Vector3(0, 1.8, 0)), new THREE.Vector3(0, 1, 0), 0xff4400, 48);
                }
            }
        }
    }

    spawnTracerBeam(startPos, endPos, hexColor) {
        const dist = startPos.distanceTo(endPos);
        if (dist < 0.5) return;
        const geo = new THREE.CylinderGeometry(0.016, 0.016, dist, 5);
        geo.rotateX(Math.PI * 0.5);
        const mat = new THREE.MeshBasicMaterial({ color: hexColor, transparent: true, opacity: 0.9 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(startPos).lerp(endPos, 0.5);
        mesh.lookAt(endPos);
        this.scene.add(mesh);
        this.particles.push({ mesh, vel: new THREE.Vector3(), ttl: 0.07, maxTtl: 0.07, isTracer: true });
    }

    spawnImpactParticles(pos, normal, hexColor, count = 12) {
        for (let i = 0; i < count; i++) {
            const size = 0.035 + Math.random() * 0.065;
            const geo = new THREE.BoxGeometry(size, size, size);
            const mat = new THREE.MeshStandardMaterial({
                color: hexColor,
                roughness: 0.6,
                emissive: hexColor === 0xff6611 || hexColor === 0xff4400 ? 0xff4400 : 0x000000,
                emissiveIntensity: hexColor === 0xff6611 || hexColor === 0xff4400 ? 1.6 : 0
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(pos);
            this.scene.add(mesh);

            const vel = normal.clone().multiplyScalar(2.5 + Math.random() * 6.5);
            vel.x += (Math.random() - 0.5) * 6.0;
            vel.y += Math.random() * 5.5;
            vel.z += (Math.random() - 0.5) * 6.0;

            this.particles.push({
                mesh,
                vel,
                ttl: 0.45 + Math.random() * 0.55,
                maxTtl: 1.0,
                isTracer: false
            });
        }
    }

    updateNearestVehiclePrompt() {
        const promptEl = document.getElementById('vehicle-interact-prompt');
        if (!promptEl) return;

        if (this.fpvMode.active) {
            promptEl.style.display = 'none';
            return;
        }

        if (this.playerVehicleState.vehicle) {
            const v = this.playerVehicleState.vehicle;
            const desantCount = v.desantUnits.filter((u) => u !== null).length;
            const roleStr = this.playerVehicleState.role === 'DRIVER' ? 'МЕХВОД + НАВОДЧИК' : 'ДЕСАНТ НА БРОНЕ (СТРЕЛЬБА С ХОДУ)';
            promptEl.style.display = 'block';
            promptEl.innerHTML = `
                <b>${v.name}</b> [${roleStr}] | СКОРОСТЬ: <b>${v.speedKmh} КМ/Ч</b> | БРОНЯ: <b>${v.hp}/${v.maxHp}</b> | ДЕСАНТ НА БРОНЕ: <b>${desantCount}/${v.spec.desantSlots.length}</b><br>
                <b>[F]</b> Спешиться &nbsp; <b>[B]</b> Пересесть на броню/внутрь &nbsp; <b>[H]</b> Посадить/Спешить отряд десанта &nbsp; <b>[T]</b> Автопилот мехвода &nbsp; <b>[K]</b> Камера 1-е/3-е лицо
            `;
            return;
        }

        let bestVeh = null;
        let bestDist = 7.2;
        const playerPos = this.playerCollider.start;

        for (const veh of this.ragdollPhysics.vehicles) {
            if (veh.destroyed) continue;
            const d = veh.chassisPos.distanceTo(playerPos);
            if (d < bestDist) {
                bestDist = d;
                bestVeh = veh;
            }
        }

        this.nearestInteractVehicle = bestVeh;
        if (bestVeh) {
            const desantCount = bestVeh.desantUnits.filter((u) => u !== null).length;
            promptEl.style.display = 'block';
            promptEl.innerHTML = `
                РЯДОМ: <b>${bestVeh.name}</b> — ${bestVeh.spec.role} (Десант на броне: <b>${desantCount}/${bestVeh.spec.desantSlots.length}</b>)<br>
                <b>[F]</b> Управлять (${bestVeh.spec.weaponName}) &nbsp; <b>[B]</b> Сесть десантом НА БРОНЮ &nbsp; <b>[H]</b> Посадить/Спешить пехоту на броню
            `;
        } else {
            promptEl.style.display = 'none';
        }
    }

    updatePlayerController(dt) {
        this.updateNearestVehiclePrompt();

        if (this.fpvMode.active) {
            this.updatePlayerFpvFlight(dt);
            return;
        }

        if (this.playerVehicleState.vehicle) {
            this.updatePlayerInVehicle(dt);
            return;
        }

        const pStat = STATS.PLAYER;
        this.isSprinting = Boolean(this.keys['ShiftLeft'] && this.keys['KeyW'] && !this.isCrouching && !this.isAiming);
        const speed = this.isCrouching ? pStat.crouchSpeed : (this.isSprinting ? pStat.sprintSpeed : pStat.walkSpeed);

        const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

        this.playerDirection.set(0, 0, 0);
        if (this.keys['KeyW']) this.playerDirection.add(forward);
        if (this.keys['KeyS']) this.playerDirection.sub(forward);
        if (this.keys['KeyD']) this.playerDirection.add(right);
        if (this.keys['KeyA']) this.playerDirection.sub(right);
        if (this.playerDirection.lengthSq() > 0) this.playerDirection.normalize();

        const accel = this.playerOnFloor ? speed : speed * 0.32;
        this.playerVelocity.x += this.playerDirection.x * accel * dt;
        this.playerVelocity.z += this.playerDirection.z * accel * dt;

        let damping = Math.exp(-pStat.damping * dt) - 1;
        if (!this.playerOnFloor) {
            this.playerVelocity.y -= pStat.gravity * dt;
            damping *= 0.12;
        }
        this.playerVelocity.addScaledVector(this.playerVelocity, damping);

        const subSteps = 3;
        const subDt = dt / subSteps;
        for (let s = 0; s < subSteps; s++) {
            this.playerCollider.translate(this.playerVelocity.clone().multiplyScalar(subDt));
            const result = this.octree.capsuleIntersect(this.playerCollider);
            this.playerOnFloor = false;
            if (result) {
                this.playerOnFloor = result.normal.y > 0.25;
                if (!this.playerOnFloor) {
                    this.playerVelocity.addScaledVector(result.normal, -result.normal.dot(this.playerVelocity));
                } else if (this.playerVelocity.y < 0) {
                    this.playerVelocity.y = 0;
                }
                this.playerCollider.translate(result.normal.multiplyScalar(result.depth));
            }
        }

        for (const veh of this.ragdollPhysics.vehicles) {
            const localPos = this.playerCollider.start.clone().sub(veh.chassisPos);
            const invQ = veh.chassisQuat.clone().invert();
            localPos.applyQuaternion(invQ);
            const hx = veh.spec.halfExtents[0];
            const hy = veh.spec.halfExtents[1];
            const hz = veh.spec.halfExtents[2];

            if (Math.abs(localPos.x) < hx * 1.05 && Math.abs(localPos.z) < hz * 1.05) {
                const roofY = veh.chassisPos.y + hy * 1.85;
                if (this.playerCollider.start.y >= roofY - 0.55 && this.playerCollider.start.y <= roofY + 0.85) {
                    const lift = roofY - this.playerCollider.start.y;
                    this.playerCollider.translate(new THREE.Vector3(
                        veh.frameDeltaPos.x,
                        Math.max(0, lift) + veh.frameDeltaPos.y,
                        veh.frameDeltaPos.z
                    ));
                    this.playerVelocity.y = Math.max(0, this.playerVelocity.y);
                    this.playerOnFloor = true;
                }
            }
        }

        const desiredHeight = this.isCrouching ? pStat.crouchHeight : pStat.standHeight;
        const currentSpan = this.playerCollider.end.y - this.playerCollider.start.y;
        const nextSpan = THREE.MathUtils.lerp(currentSpan, desiredHeight - pStat.capsuleRadius, Math.min(1.0, dt * 10.0));
        this.playerCollider.end.y = this.playerCollider.start.y + nextSpan;

        const horizSpeed = Math.hypot(this.playerVelocity.x, this.playerVelocity.z);
        if (horizSpeed > 0.45 && this.playerOnFloor) {
            const bobFreq = this.isSprinting ? 13.5 : 8.8;
            this.bobTimer += dt * bobFreq;
        } else {
            this.bobTimer += dt * 1.6;
        }

        const bobAmp = this.playerOnFloor ? Math.min(1.0, horizSpeed / 8.0) : 0.1;
        const bobX = Math.cos(this.bobTimer * 0.5) * 0.026 * bobAmp;
        const bobY = Math.abs(Math.sin(this.bobTimer)) * 0.038 * bobAmp;
        const bobRoll = Math.sin(this.bobTimer * 0.5) * 0.016 * bobAmp;

        this.currentLean = THREE.MathUtils.lerp(this.currentLean, this.targetLean, Math.min(1.0, dt * 9.5));
        this.smoothYawVel = THREE.MathUtils.lerp(this.smoothYawVel, 0, Math.min(1.0, dt * 12.0));
        this.smoothPitchVel = THREE.MathUtils.lerp(this.smoothPitchVel, 0, Math.min(1.0, dt * 12.0));

        this.cameraMount.position.copy(this.playerCollider.end);
        const leanWorld = right.clone().multiplyScalar(this.currentLean * pStat.leanOffset);
        this.cameraMount.position.add(leanWorld);
        this.cameraMount.position.y += bobY;

        const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
        const qRoll = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 0, 1),
            -this.currentLean * pStat.maxTiltAngle + bobRoll - this.smoothYawVel * 0.45
        );
        this.camera.quaternion.copy(qYaw).multiply(qPitch).multiply(qRoll);

        this.updateViewmodelTransform(dt, bobX, bobY);

        const activeKey = this.loadoutKeys[this.currentWeaponIdx];
        const wStat = STATS.WEAPONS[activeKey];
        if (this.isFiring && !wStat.isExplosive) {
            this.tryFireCurrentWeapon();
        }
    }

    updateViewmodelTransform(dt, bobX = 0, bobY = 0) {
        this.posSpring.update(dt);
        this.rotSpring.update(dt);

        const activeKey = this.loadoutKeys[this.currentWeaponIdx];
        const wStat = STATS.WEAPONS[activeKey];
        const basePos = this.isAiming ? wStat.adsPos : wStat.hipPos;

        this.viewmodelRoot.position.set(
            basePos[0] + bobX * 0.45 + this.posSpring.position.x - this.smoothYawVel * 0.12,
            basePos[1] + bobY * 0.45 + this.posSpring.position.y + this.smoothPitchVel * 0.12,
            basePos[2] + this.posSpring.position.z
        );
        this.viewmodelRoot.rotation.set(
            this.rotSpring.position.x,
            this.rotSpring.position.y,
            this.rotSpring.position.z - this.currentLean * 0.15
        );
    }

    updatePlayerInVehicle(dt) {
        const veh = this.playerVehicleState.vehicle;
        if (!veh || veh.destroyed) {
            this.exitCurrentVehicle();
            return;
        }

        if (this.playerVehicleState.role === 'DRIVER') {
            let throttle = 0;
            let steer = 0;
            if (this.keys['KeyW']) throttle += 1.0;
            if (this.keys['KeyS']) throttle -= 0.85;
            if (this.keys['KeyA']) steer += 1.0;
            if (this.keys['KeyD']) steer -= 1.0;

            veh.controls.throttle = throttle;
            veh.controls.steer = steer;
            veh.controls.brake = Boolean(this.keys['Space']);

            this.sound.updateVehicleEngineSound(true, veh.speedKmh, throttle);

            const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
            const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
            const lookQuat = qYaw.multiply(qPitch);

            if (this.playerVehicleState.thirdPersonCamera) {
                const pivot = veh.chassisPos.clone().add(new THREE.Vector3(0, veh.spec.chaseCamOffset[1] * 0.62, 0));
                const backVec = new THREE.Vector3(0, 1.4, veh.spec.chaseCamOffset[2]).applyQuaternion(lookQuat);
                this.cameraMount.position.copy(pivot).add(backVec);
                if (this.cameraMount.position.y < 0.6) this.cameraMount.position.y = 0.6;
                this.camera.quaternion.copy(lookQuat);
            } else {
                const camLocal = new THREE.Vector3(
                    veh.spec.driverCamOffset[0],
                    veh.spec.driverCamOffset[1],
                    veh.spec.driverCamOffset[2]
                ).applyQuaternion(veh.chassisQuat);
                this.cameraMount.position.copy(veh.chassisPos).add(camLocal);
                this.camera.quaternion.copy(lookQuat);
            }

            if (this.isFiring) {
                this.tryFireVehicleWeapon(veh);
            }
        } else if (this.playerVehicleState.role === 'DESANT') {
            const slotIdx = Math.max(0, Math.min(this.playerVehicleState.desantSlotIndex, veh.spec.desantSlots.length - 1));
            const slot = veh.spec.desantSlots[slotIdx];
            const seatWorld = new THREE.Vector3(slot[0], slot[1] + 0.95, slot[2])
                .applyQuaternion(veh.chassisQuat)
                .add(veh.chassisPos);

            this.cameraMount.position.copy(seatWorld);
            this.playerCollider.start.copy(seatWorld).add(new THREE.Vector3(0, -0.9, 0));
            this.playerCollider.end.copy(seatWorld);

            this.sound.updateVehicleEngineSound(true, veh.speedKmh, veh.controls.throttle);

            const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
            const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
            this.camera.quaternion.copy(qYaw).multiply(qPitch);

            this.updateViewmodelTransform(dt, 0, 0);
            const activeKey = this.loadoutKeys[this.currentWeaponIdx];
            const wStat = STATS.WEAPONS[activeKey];
            if (this.isFiring && !wStat.isExplosive) {
                this.tryFireCurrentWeapon();
            }
        }
    }

    updatePlayerFpvFlight(dt) {
        const fpv = this.fpvMode;
        const forward = new THREE.Vector3(
            -Math.sin(fpv.yaw) * Math.cos(fpv.pitch),
            Math.sin(fpv.pitch),
            -Math.cos(fpv.yaw) * Math.cos(fpv.pitch)
        ).normalize();
        const right = new THREE.Vector3(Math.cos(fpv.yaw), 0, -Math.sin(fpv.yaw));

        let thrust = 18.0;
        if (this.keys['KeyW']) thrust = STATS.FPV.thrustAccel;
        else if (this.keys['KeyS']) thrust = 4.0;

        fpv.velocity.addScaledVector(forward, thrust * dt);
        if (this.keys['KeyD']) fpv.velocity.addScaledVector(right, 18.0 * dt);
        if (this.keys['KeyA']) fpv.velocity.addScaledVector(right, -18.0 * dt);
        if (this.keys['Space']) fpv.velocity.y += 15.0 * dt;
        if (this.keys['KeyC']) fpv.velocity.y -= 15.0 * dt;

        fpv.velocity.y -= 9.8 * dt;
        fpv.velocity.multiplyScalar(Math.exp(-STATS.FPV.drag * dt));
        if (fpv.velocity.length() > STATS.FPV.maxSpeed) {
            fpv.velocity.setLength(STATS.FPV.maxSpeed);
        }

        fpv.position.addScaledVector(fpv.velocity, dt);
        fpv.roll = THREE.MathUtils.lerp(fpv.roll, 0, Math.min(1.0, dt * 4.5));

        if (fpv.droneMesh) {
            fpv.droneMesh.position.copy(fpv.position);
            fpv.droneMesh.rotation.set(fpv.pitch, fpv.yaw, fpv.roll, 'YXZ');
        }

        this.cameraMount.position.copy(fpv.position).addScaledVector(forward, 0.28);
        const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), fpv.yaw);
        const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), fpv.pitch);
        const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), fpv.roll);
        this.camera.quaternion.copy(qYaw).multiply(qPitch).multiply(qRoll);

        if (fpv.motorAudio) {
            const spdRatio = fpv.velocity.length() / STATS.FPV.maxSpeed;
            fpv.motorAudio.osc.frequency.value = 360 + spdRatio * 520;
        }

        fpv.battery = Math.max(0, fpv.battery - dt * 2.2);
        const batEl = document.getElementById('fpv-battery-val');
        const altEl = document.getElementById('fpv-alt-val');
        const spdEl = document.getElementById('fpv-spd-val');
        if (batEl) batEl.textContent = `${Math.round(fpv.battery)}%`;
        if (altEl) altEl.textContent = `${fpv.position.y.toFixed(1)} М`;
        if (spdEl) spdEl.textContent = `${Math.round(fpv.velocity.length() * 3.6)} КМ/Ч`;

        if (fpv.position.y <= 0.35 || fpv.battery <= 0) {
            this.detonatePlayerFpvDrone();
            return;
        }

        for (const u of this.units) {
            if (!u.isDead && u.root.position.distanceTo(fpv.position) < 1.5) {
                this.detonatePlayerFpvDrone();
                return;
            }
        }
        for (const v of this.ragdollPhysics.vehicles) {
            if (!v.destroyed && v.chassisPos.distanceTo(fpv.position) < 3.5) {
                this.detonatePlayerFpvDrone();
                return;
            }
        }
    }

    updateUnitsAndSquadAI(dt) {
        for (const unit of this.units) {
            if (unit.isDead) {
                unit.respawnCountdown -= dt;
                if (unit.respawnCountdown <= 0) {
                    this.respawnDeadSoldier(unit);
                }
                continue;
            }

            let nearestEnemy = null;
            let bestDist = 110.0;
            for (const other of this.units) {
                if (other.isDead || other.faction === unit.faction) continue;
                const d = unit.root.position.distanceTo(other.root.position);
                if (d < bestDist) {
                    bestDist = d;
                    nearestEnemy = other;
                }
            }

            if (unit.mountedVehicle) {
                unit.flinchAmount = Math.max(0, unit.flinchAmount - dt * 4.5);
                unit.fireTimer -= dt;
                if (unit.fireTimer <= 0 && nearestEnemy && bestDist < 85.0) {
                    unit.fireTimer = 0.9 + Math.random() * 1.4;
                    const muzzlePos = unit.root.position.clone().add(new THREE.Vector3(0, 1.25, 0));
                    const targetPos = nearestEnemy.root.position.clone().add(new THREE.Vector3(
                        (Math.random() - 0.5) * 1.8,
                        0.9 + Math.random() * 0.6,
                        (Math.random() - 0.5) * 1.8
                    ));
                    this.spawnTracerBeam(muzzlePos, targetPos, unit.faction === 'RU' ? 0x44ff55 : 0xff4433);
                    const distToCam = this.cameraMount.position.distanceTo(muzzlePos);
                    if (distToCam < 65.0) {
                        this.sound.playGunshot(distToCam, false);
                    }
                    if (Math.random() < 0.24) {
                        const shotDir = targetPos.clone().sub(muzzlePos).normalize();
                        const wUsed = unit.faction === 'RU' ? STATS.WEAPONS.ak12 : STATS.WEAPONS.m4a1;
                        this.applyBulletHitToSoldier(nearestEnemy, 'TORSO', 'torso', targetPos, shotDir, wUsed, `${unit.name} (С БРОНИ)`);
                    }
                }
                continue;
            }

            if (unit.isAlliedDesant) {
                if (this.squadOrderMode === 'ASSAULT' && nearestEnemy) {
                    unit.moveTarget.copy(nearestEnemy.root.position).add(new THREE.Vector3(0, 0, 12.0));
                } else {
                    unit.moveTarget.copy(unit.homePos);
                }
            }

            const toWaypoint = unit.moveTarget.clone().sub(unit.root.position);
            toWaypoint.y = 0;
            const distToWp = toWaypoint.length();
            let isMoving = false;

            if (distToWp > 0.6) {
                isMoving = true;
                toWaypoint.normalize();
                const moveSpd = this.squadOrderMode === 'ASSAULT' ? 4.8 : 3.4;
                unit.root.position.x += toWaypoint.x * moveSpd * dt;
                unit.root.position.z += toWaypoint.z * moveSpd * dt;
            }

            if (nearestEnemy) {
                const dx = nearestEnemy.root.position.x - unit.root.position.x;
                const dz = nearestEnemy.root.position.z - unit.root.position.z;
                const desiredYaw = Math.atan2(dx, dz);
                unit.root.rotation.y = THREE.MathUtils.lerp(unit.root.rotation.y, desiredYaw, Math.min(1.0, dt * 6.0));
            } else {
                unit.root.rotation.y = THREE.MathUtils.lerp(unit.root.rotation.y, unit.homeYaw, Math.min(1.0, dt * 4.0));
            }

            unit.animPhase += dt * (isMoving ? 9.2 : 2.2);
            unit.flinchAmount = Math.max(0, unit.flinchAmount - dt * 4.5);

            const b = unit.bones;
            if (b.upperLegL && b.upperLegR) {
                if (isMoving) {
                    const swing = Math.sin(unit.animPhase) * 0.42;
                    b.upperLegL.rotation.x = swing;
                    b.upperLegR.rotation.x = -swing;
                } else {
                    b.upperLegL.rotation.x = 0;
                    b.upperLegR.rotation.x = 0;
                }
            }
            if (b.chest) {
                b.chest.rotation.x = Math.sin(unit.animPhase * 0.5) * 0.04 - unit.flinchAmount * 0.38;
            }

            unit.fireTimer -= dt;
            if (unit.fireTimer <= 0 && nearestEnemy && bestDist < 75.0 && this.squadOrderMode === 'ASSAULT') {
                unit.fireTimer = 1.1 + Math.random() * 1.5;
                const muzzlePos = unit.root.position.clone().add(new THREE.Vector3(0, 1.38, 0));
                const targetPos = nearestEnemy.root.position.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 1.6,
                    0.9 + Math.random() * 0.7,
                    (Math.random() - 0.5) * 1.6
                ));

                this.spawnTracerBeam(muzzlePos, targetPos, unit.faction === 'RU' ? 0x44ff55 : 0xff4433);
                const distToCam = this.cameraMount.position.distanceTo(muzzlePos);
                if (distToCam < 65.0) {
                    this.sound.playGunshot(distToCam, false);
                }
                if (Math.random() < 0.2) {
                    const shotDir = targetPos.clone().sub(muzzlePos).normalize();
                    const wUsed = unit.faction === 'RU' ? STATS.WEAPONS.ak12 : STATS.WEAPONS.m4a1;
                    this.applyBulletHitToSoldier(nearestEnemy, 'TORSO', 'torso', targetPos, shotDir, wUsed, unit.name);
                }
            }
        }
    }

    respawnDeadSoldier(unit) {
        const idx = this.ragdollPhysics.ragdolls.findIndex((r) => r.unit === unit);
        if (idx !== -1) {
            const rag = this.ragdollPhysics.ragdolls[idx];
            for (const body of Object.values(rag.bodies)) {
                this.ragdollPhysics.world.removeRigidBody(body);
            }
            this.ragdollPhysics.ragdolls.splice(idx, 1);
        }

        this.scene.remove(unit.root);
        const built = this.instantiateSkinnedSoldier(unit.faction);
        built.root.position.copy(unit.homePos);
        built.root.rotation.y = unit.homeYaw;
        this.scene.add(built.root);

        unit.root = built.root;
        unit.bones = built.bones;
        unit.hp = unit.maxHp;
        unit.isDead = false;
        unit.mountedVehicle = null;
        this.ragdollPhysics.attachAnatomicalHitboxes(unit);
    }

    updateAutonomousDrones(dt) {
        for (const d of this.drones) {
            if (!d.isDiving) {
                d.angle += (d.config.speed / d.config.radius) * dt;
                d.mesh.position.set(
                    Math.cos(d.angle) * d.config.radius,
                    d.config.y + Math.sin(d.angle * 3.0) * 1.2,
                    Math.sin(d.angle) * d.config.radius
                );
                d.mesh.rotation.y = -d.angle;

                if (d.config.type !== 'RECON') {
                    d.diveTimer -= dt;
                    if (d.diveTimer <= 0) {
                        const enemies = this.units.filter((u) => !u.isDead && u.faction !== d.config.faction);
                        if (enemies.length > 0) {
                            d.diveTarget = enemies[Math.floor(Math.random() * enemies.length)].root.position.clone();
                            d.isDiving = true;
                        } else {
                            d.diveTimer = 10.0;
                        }
                    }
                }
            } else if (d.diveTarget) {
                const dir = d.diveTarget.clone().sub(d.mesh.position);
                const dist = dir.length();
                if (dist < 1.2) {
                    this.triggerHighExplosiveBlast(
                        d.diveTarget,
                        9.0,
                        55.0,
                        220,
                        d.config.type === 'LANCET' ? 'БПЛА «Ланцет-3»' : 'FPV Камикадзе'
                    );
                    d.isDiving = false;
                    d.diveTimer = 15.0 + Math.random() * 10.0;
                } else {
                    dir.normalize();
                    d.mesh.position.addScaledVector(dir, 26.0 * dt);
                    d.mesh.lookAt(d.diveTarget);
                }
            }
        }
    }

    updateProjectilesAndParticles(dt) {
        if (this.muzzleLight.intensity > 0) {
            this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 95.0);
        }

        for (let i = this.dynamicLights.length - 1; i >= 0; i--) {
            const dl = this.dynamicLights[i];
            dl.ttl -= dt;
            if (dl.ttl <= 0) {
                this.scene.remove(dl.light);
                this.dynamicLights.splice(i, 1);
            } else {
                dl.light.intensity = 24.0 * (dl.ttl / dl.maxTtl);
            }
        }

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.ttl -= dt;
            p.vel.y -= 4.2 * dt;
            const nextPos = p.mesh.position.clone().addScaledVector(p.vel, dt);

            this.spawnImpactParticles(p.mesh.position, new THREE.Vector3(0, 1, 0), 0x888888, 1);

            let detonated = false;
            if (nextPos.y <= 0.15 || p.ttl <= 0) {
                detonated = true;
            } else {
                for (const u of this.units) {
                    if (!u.isDead && u.root.position.distanceTo(nextPos) < 1.6) {
                        detonated = true;
                        break;
                    }
                }
                for (const v of this.ragdollPhysics.vehicles) {
                    if (v === p.sourceVehicle) continue;
                    if (v.chassisPos.distanceTo(nextPos) < 3.4) {
                        detonated = true;
                        break;
                    }
                }
            }

            if (detonated) {
                this.triggerHighExplosiveBlast(nextPos, p.radius, p.force, p.damage, p.weaponName);
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
            } else {
                p.mesh.position.copy(nextPos);
            }
        }

        for (let i = this.brassCasings.length - 1; i >= 0; i--) {
            const c = this.brassCasings[i];
            c.ttl -= dt;
            if (c.ttl <= 0) {
                this.scene.remove(c.mesh);
                c.mesh.geometry.dispose();
                c.mesh.material.dispose();
                this.brassCasings.splice(i, 1);
                continue;
            }
            c.vel.y -= 18.0 * dt;
            c.mesh.position.addScaledVector(c.vel, dt);
            c.mesh.rotation.x += c.rotVel.x * dt;
            c.mesh.rotation.y += c.rotVel.y * dt;
            if (c.mesh.position.y < 0.04) {
                c.mesh.position.y = 0.04;
                c.vel.y *= -0.35;
                c.vel.x *= 0.7;
                c.vel.z *= 0.7;
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.ttl -= dt;
            if (pt.ttl <= 0) {
                this.scene.remove(pt.mesh);
                pt.mesh.geometry.dispose();
                pt.mesh.material.dispose();
                this.particles.splice(i, 1);
                continue;
            }
            if (!pt.isTracer) {
                pt.vel.y -= 14.0 * dt;
                pt.mesh.position.addScaledVector(pt.vel, dt);
                pt.mesh.scale.multiplyScalar(0.97);
            }
        }
    }

    flashCrosshairHit(isHeadshot) {
        const hm = document.getElementById('hit-marker');
        if (!hm) return;
        hm.className = isHeadshot ? 'hit-head' : 'hit-body';
        hm.style.opacity = '1';
        clearTimeout(this._hmTimer);
        this._hmTimer = setTimeout(() => {
            hm.style.opacity = '0';
        }, 140);
    }

    pushKillFeed(killer, victim, zoneLabel, distMeters, weaponName) {
        const feed = document.getElementById('kill-feed');
        if (!feed) return;
        const row = document.createElement('div');
        row.className = 'kill-item';
        row.innerHTML = `<span class="k-atk">${killer}</span> <span class="k-wep">[${weaponName} • ${zoneLabel}]</span> <span class="k-vic">${victim}</span> <span class="k-dst">${distMeters}м</span>`;
        feed.prepend(row);
        while (feed.children.length > 6) {
            feed.removeChild(feed.lastChild);
        }
        setTimeout(() => {
            if (row.parentNode) row.parentNode.removeChild(row);
        }, 7500);
    }

    updateScoreHUD() {
        const kEl = document.getElementById('hud-kills');
        const hEl = document.getElementById('hud-headshots');
        if (kEl) kEl.textContent = String(this.killsCount);
        if (hEl) hEl.textContent = String(this.headshotsCount);
    }

    updateWeaponHUD() {
        const wNameEl = document.getElementById('hud-weapon-name');
        const wAmmoEl = document.getElementById('hud-ammo-count');
        const wStateEl = document.getElementById('hud-reload-state');

        if (this.playerVehicleState.vehicle && this.playerVehicleState.role === 'DRIVER') {
            const v = this.playerVehicleState.vehicle;
            if (wNameEl) wNameEl.textContent = `${v.name} • ${v.spec.weaponName}`;
            if (wAmmoEl) wAmmoEl.textContent = `${v.speedKmh} КМ/Ч | БК: ∞`;
            if (wStateEl) {
                const desantCount = v.desantUnits.filter((u) => u !== null).length;
                wStateEl.textContent = `ДЕСАНТ НА БРОНЕ: ${desantCount}/${v.spec.desantSlots.length} БОЙЦОВ [H — ПОСАДКА/ВЫСАДКА]`;
                wStateEl.style.color = '#8fe88f';
            }
            return;
        }

        const key = this.loadoutKeys[this.currentWeaponIdx];
        const wStat = STATS.WEAPONS[key];
        const wState = this.weaponStates[key];

        if (wNameEl) wNameEl.textContent = wStat.name;
        if (wAmmoEl) {
            if (wState.mag > wStat.magCapacity) {
                wAmmoEl.textContent = `${wStat.magCapacity}+1 / ${wState.reserve}`;
            } else {
                wAmmoEl.textContent = `${wState.mag} / ${wState.reserve}`;
            }
        }
        if (wStateEl) {
            if (wState.reloading) {
                wStateEl.textContent = wState.reloadState === 'TACTICAL_RELOAD'
                    ? 'ТАКТИЧЕСКАЯ ПЕРЕЗАРЯДКА (ПАТРОН В ПАТРОННИКЕ)...'
                    : 'ПОЛНАЯ ПЕРЕЗАРЯДКА (ЗАТВОР)...';
                wStateEl.style.color = '#ffaa33';
            } else {
                wStateEl.textContent = wState.chambered ? 'ГОТОВ К БОЮ [ПАТРОН В ПАТРОННИКЕ]' : 'ПУСТОЙ МАГАЗИН [R]';
                wStateEl.style.color = wState.chambered ? '#8fe88f' : '#ff5555';
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const dt = Math.min(this.clock.getDelta(), 0.05);

        if (this.isStarted) {
            this.ragdollPhysics.step(dt, this.units, (veh, victimUnit, impactVel) => {
                this.killSoldierWithRagdoll(
                    victimUnit,
                    'TORSO',
                    'torso',
                    victimUnit.root.position.clone().add(new THREE.Vector3(0, 0.9, 0)),
                    impactVel.clone().normalize(),
                    { bulletMass: 3.5, muzzleVelocity: impactVel.length() * 14.0, name: `${veh.name} (ТАРАН БРОНЕЙ)` },
                    'ВЫ'
                );
            });
            this.updateReloadStateMachine(dt);
            this.updatePlayerController(dt);
            this.updateUnitsAndSquadAI(dt);
            this.updateAutonomousDrones(dt);
            this.updateProjectilesAndParticles(dt);
            if (this.playerVehicleState.vehicle && this.playerVehicleState.role === 'DRIVER') {
                this.updateWeaponHUD();
            }
        }

        if (typeof this.customRenderHook === 'function') {
            this.customRenderHook(this.renderer, this.scene, this.camera, dt);
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

const engine = new BattleEngine();
engine.boot();
