import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, PoseLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';
import type { TrackedPerson, TrackedHand, CameraStatus, PoseLandmark } from '../types';
import { Point3DOneEuroFilter } from '../utils/oneEuroFilter';

export interface VisionTrackingState {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoElement: HTMLVideoElement | null;
  cameraStatus: CameraStatus;
  latestPeopleRef: React.MutableRefObject<TrackedPerson[]>;
  latestHandsRef: React.MutableRefObject<TrackedHand[]>;
  poseFps: number;
  detectionMs: number;
  activeDelegate: string;
  retryCamera: () => void;
}

export function useVisionTracking(): VisionTrackingState {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isDetectingRef = useRef<boolean>(false);
  const retryIntervalRef = useRef<number | null>(null);

  const latestPeopleRef = useRef<TrackedPerson[]>([]);
  const latestHandsRef = useRef<TrackedHand[]>([]);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('initializing');
  const [poseFps, setPoseFps] = useState<number>(0);
  const [detectionMs, setDetectionMs] = useState<number>(0);
  const [activeDelegate, setActiveDelegate] = useState<string>('Initializing...');

  const handFiltersRef = useRef<Point3DOneEuroFilter[]>([
    new Point3DOneEuroFilter(1.4, 0.01),
    new Point3DOneEuroFilter(1.4, 0.01),
    new Point3DOneEuroFilter(1.4, 0.01),
    new Point3DOneEuroFilter(1.4, 0.01)
  ]);

  const bodyFiltersRef = useRef<Point3DOneEuroFilter[]>([
    new Point3DOneEuroFilter(1.2, 0.008),
    new Point3DOneEuroFilter(1.2, 0.008),
    new Point3DOneEuroFilter(1.2, 0.008),
    new Point3DOneEuroFilter(1.2, 0.008)
  ]);

  const prevHandsPosRef = useRef<{ x: number; y: number; time: number }[]>([
    { x: 0.5, y: 0.5, time: 0 },
    { x: 0.5, y: 0.5, time: 0 },
    { x: 0.5, y: 0.5, time: 0 },
    { x: 0.5, y: 0.5, time: 0 }
  ]);

  // Persistent gesture debouncing memory per hand slot
  const handGestureDebounceRef = useRef<{ isFist: boolean; candidateFist: boolean; changedAt: number }[]>([
    { isFist: false, candidateFist: false, changedAt: 0 },
    { isFist: false, candidateFist: false, changedAt: 0 },
    { isFist: false, candidateFist: false, changedAt: 0 },
    { isFist: false, candidateFist: false, changedAt: 0 }
  ]);

  const lastVideoTimeRef = useRef<number>(-1);
  const lastDetectionTimeRef = useRef<number>(0);
  const cvFrameCountRef = useRef<number>(0);
  const lastFpsCalcRef = useRef<number>(performance.now());
  const stepCounterRef = useRef<number>(0);

  // Initialize MediaPipe with GPU Delegate
  const initVision = useCallback(async () => {
    try {
      const wasmPath = `${window.location.origin}/wasm`;
      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks(wasmPath);
      } catch {
        vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
      }

      const poseModelPath = `${window.location.origin}/models/pose_landmarker_lite.task`;
      const handModelPath = `${window.location.origin}/models/hand_landmarker.task`;

      let delegateType = 'GPU';

      try {
        poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: poseModelPath, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 4,
          minPoseDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: handModelPath, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 4,
          minHandDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        setActiveDelegate('GPU');
      } catch (gpuErr) {
        console.warn('[Vision] GPU delegate fallback to CPU:', gpuErr);
        delegateType = 'CPU (Fallback)';

        poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: poseModelPath, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numPoses: 4
        });

        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: handModelPath, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numHands: 4
        });

        setActiveDelegate(delegateType);
      }

      return true;
    } catch (err) {
      console.error('[Vision] Critical error:', err);
      setActiveDelegate('ERROR');
      return false;
    }
  }, []);

  // Webcam stream capped at 640x480 @ 30fps
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('not-found');
      return;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640, max: 640 },
          height: { ideal: 480, max: 480 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: 'user'
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setVideoElement(videoRef.current);
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
          setVideoElement(videoRef.current);
          setCameraStatus('active');
        };

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            setCameraStatus('reconnecting');
            triggerRetry();
          };
        }
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraStatus('denied');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraStatus('not-found');
      } else {
        setCameraStatus('reconnecting');
      }
      triggerRetry();
    }
  }, []);

  const triggerRetry = useCallback(() => {
    if (retryIntervalRef.current) return;
    retryIntervalRef.current = window.setInterval(async () => {
      if (cameraStatus !== 'active') {
        try {
          await startCamera();
        } catch {}
      } else {
        if (retryIntervalRef.current) {
          clearInterval(retryIntervalRef.current);
          retryIntervalRef.current = null;
        }
      }
    }, 2000);
  }, [cameraStatus, startCamera]);

  // Staggered Detection Loop
  useEffect(() => {
    let isActive = true;
    let timerId: number | null = null;

    const runDetection = () => {
      if (!isActive) return;

      const now = performance.now();
      const minInterval = 1000 / 30;

      if (now - lastDetectionTimeRef.current >= minInterval) {
        const video = videoRef.current;
        const poseLandmarker = poseLandmarkerRef.current;
        const handLandmarker = handLandmarkerRef.current;

        if (
          video &&
          video.readyState >= 2 &&
          !video.paused &&
          !isDetectingRef.current
        ) {
          if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            lastDetectionTimeRef.current = now;
            isDetectingRef.current = true;

            const detectStart = performance.now();
            const step = stepCounterRef.current++;

            try {
              // Staggered alternation: Hands on even frames, Pose on odd frames
              if (step % 2 === 0 && handLandmarker) {
                const handResults = handLandmarker.detectForVideo(video, now);
                const handsLandmarks = handResults.landmarks;

                if (handsLandmarks && handsLandmarks.length > 0) {
                  const detectedHands: TrackedHand[] = [];

                  handsLandmarks.forEach((hLms, hIdx) => {
                    if (hIdx >= 4) return;

                    const mirrored: PoseLandmark[] = hLms.map((lm) => ({
                      x: 1 - lm.x,
                      y: lm.y,
                      z: lm.z,
                      visibility: 1
                    }));

                    const wrist = mirrored[0];
                    const mcp9 = mirrored[9];

                    const rawPalmX = (wrist.x + mcp9.x) / 2;
                    const rawPalmY = (wrist.y + mcp9.y) / 2;
                    const handSpan = Math.hypot(wrist.x - mcp9.x, wrist.y - mcp9.y);
                    const rawDepth = Math.max(0, Math.min(1, (handSpan - 0.05) / (0.22 - 0.05)));

                    const filter = handFiltersRef.current[hIdx];
                    const filtered = filter.filter(rawPalmX, rawPalmY, rawDepth, now);

                    // Fist vs Open calculation
                    const tips = [mirrored[8], mirrored[12], mirrored[16], mirrored[20]];
                    const mcps = [mirrored[5], mirrored[9], mirrored[13], mirrored[17]];

                    let totalExtension = 0;
                    for (let f = 0; f < 4; f++) {
                      const tipDist = Math.hypot(tips[f].x - wrist.x, tips[f].y - wrist.y);
                      const mcpDist = Math.hypot(mcps[f].x - wrist.x, mcps[f].y - wrist.y);
                      totalExtension += tipDist / Math.max(0.01, mcpDist);
                    }
                    const avgExtension = totalExtension / 4;
                    const rawIsFist = avgExtension < 1.22;

                    // 150ms Gesture Debounce
                    const deb = handGestureDebounceRef.current[hIdx];
                    if (rawIsFist !== deb.candidateFist) {
                      deb.candidateFist = rawIsFist;
                      deb.changedAt = now;
                    } else if (now - deb.changedAt >= 150) {
                      deb.isFist = rawIsFist;
                    }

                    const isFist = deb.isFist;
                    const isOpen = !isFist && avgExtension >= 1.40;

                    // Speed calculation
                    const prev = prevHandsPosRef.current[hIdx];
                    const dtSec = Math.max(0.01, (now - prev.time) / 1000);
                    const vx = (filtered.x - prev.x) / dtSec;
                    const vy = (filtered.y - prev.y) / dtSec;
                    const speed = Math.hypot(vx, vy);

                    prevHandsPosRef.current[hIdx] = {
                      x: filtered.x,
                      y: filtered.y,
                      time: now
                    };

                    detectedHands.push({
                      id: hIdx + 1,
                      palmX: filtered.x,
                      palmY: filtered.y,
                      handSpan,
                      depth: filtered.z,
                      isFist,
                      isOpen,
                      rawIsFist,
                      gestureChangedAt: deb.changedAt,
                      speed,
                      velocityX: vx,
                      velocityY: vy,
                      landmarks: mirrored,
                      active: true,
                      lastSeen: now
                    });
                  });

                  latestHandsRef.current = detectedHands;
                } else {
                  latestHandsRef.current = [];
                }
              } else if (poseLandmarker) {
                const poseResults = poseLandmarker.detectForVideo(video, now);
                const poses = poseResults.landmarks;

                if (poses && poses.length > 0) {
                  const detectedPeople: TrackedPerson[] = [];

                  poses.forEach((personLms, pIdx) => {
                    if (pIdx >= 4) return;

                    const mirrored: PoseLandmark[] = personLms.map((lm) => ({
                      x: 1 - lm.x,
                      y: lm.y,
                      z: lm.z,
                      visibility: lm.visibility
                    }));

                    const nose = mirrored[0];
                    const lShoulder = mirrored[11];
                    const rShoulder = mirrored[12];

                    let shoulderSpan = 0.16;
                    let nosePos = { x: 0.5, y: 0.35, visible: false };

                    if (lShoulder && rShoulder) {
                      shoulderSpan = Math.hypot(lShoulder.x - rShoulder.x, lShoulder.y - rShoulder.y);
                    }

                    if (nose && (nose.visibility ?? 1) > 0.5) {
                      const filter = bodyFiltersRef.current[pIdx];
                      const filteredNose = filter.filter(nose.x, nose.y, 0.5, now);
                      nosePos = { x: filteredNose.x, y: filteredNose.y, visible: true };
                    }

                    const depth = Math.max(0, Math.min(1, (shoulderSpan - 0.07) / (0.28 - 0.07)));

                    detectedPeople.push({
                      id: pIdx + 1,
                      nosePos,
                      shoulderWidth: shoulderSpan,
                      depth,
                      influencePoints: [],
                      landmarks: mirrored,
                      active: true,
                      lastSeen: now
                    });
                  });

                  latestPeopleRef.current = detectedPeople;
                } else {
                  latestPeopleRef.current = [];
                }
              }

              const duration = performance.now() - detectStart;
              setDetectionMs(Number(duration.toFixed(1)));

              cvFrameCountRef.current++;
              if (now - lastFpsCalcRef.current >= 500) {
                const fps = Math.round(
                  (cvFrameCountRef.current * 1000) / (now - lastFpsCalcRef.current)
                );
                setPoseFps(fps);
                cvFrameCountRef.current = 0;
                lastFpsCalcRef.current = now;
              }
            } catch {
              // Catch dropped frame
            } finally {
              isDetectingRef.current = false;
            }
          }
        }
      }

      timerId = window.setTimeout(runDetection, 16);
    };

    timerId = window.setTimeout(runDetection, 16);

    return () => {
      isActive = false;
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const ok = await initVision();
      if (ok && mounted) {
        await startCamera();
      }
    }
    init();
    return () => {
      mounted = false;
      if (retryIntervalRef.current) clearInterval(retryIntervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (poseLandmarkerRef.current) poseLandmarkerRef.current.close();
      if (handLandmarkerRef.current) handLandmarkerRef.current.close();
    };
  }, [initVision, startCamera]);

  return {
    videoRef,
    videoElement,
    cameraStatus,
    latestPeopleRef,
    latestHandsRef,
    poseFps,
    detectionMs,
    activeDelegate,
    retryCamera: startCamera
  };
}
