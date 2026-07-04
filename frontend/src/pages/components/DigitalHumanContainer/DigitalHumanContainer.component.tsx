"use client";

import { useEffect, useRef, useContext } from 'react';
import dynamic from 'next/dynamic';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';

const loadPixi = async () => {
  const PIXI = (await import('pixi.js'));
  const { Live2DModel } = await import('pixi-live2d-display');
  return { PIXI, Live2DModel };
};

const DigitalHumanContainer = () => {
  const {
    mouthOpen,
    characterName = 'Xiao Wei',
  } = useContext(VoiceAssistantContext);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<any>(null);
  const appRef = useRef<any>(null);
  const hasStoppedMotions = useRef(false);
  const resumeMotionTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initializePixi = async () => {
      try {
        const { PIXI, Live2DModel } = await loadPixi();
        window.PIXI = PIXI;
        Live2DModel.registerTicker(PIXI.Ticker);

        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        // Create PIXI app — resizeTo matches the parent container size
        const app = new PIXI.Application({
          view: canvas,
          resizeTo: container,
          autoDensity: true,
          antialias: true,
          resolution: window.devicePixelRatio,
          transparent: true,
          backgroundColor: null,
        });
        appRef.current = app;

        const url = `${window.location.origin}/shizuku_model/shizuku.model.json`;
        const model = await Live2DModel.from(url);
        model.autoInteract = false;

        app.stage.addChild(model);

        // Scale model proportionally based on container width
        const scaleModel = () => {
          const w = container.clientWidth;
          if (w > 0 && modelRef.current) {
            const s = Math.min(0.5, (w / 1300) * 0.6);
            modelRef.current.scale.set(s);
            modelRef.current.position.set(0, -10);
          }
        };

        scaleModel();
        modelRef.current = model;

        // Watch container size changes and re-scale model + renderer
        const ro = new ResizeObserver(() => {
          app.renderer.resize(container.clientWidth, container.clientHeight);
          scaleModel();
        });
        ro.observe(container);

        // Cleanup observer when effect cleans up
        (app as any).__resizeObserver = ro;
      } catch (error) {
        console.error("Failed to initialize Live2D:", error);
      }
    };

    initializePixi();

    return () => {
      if (resumeMotionTimeout.current) {
        clearTimeout(resumeMotionTimeout.current);
      }
      modelRef.current = null;
      if (appRef.current) {
        if (appRef.current.__resizeObserver) {
          appRef.current.__resizeObserver.disconnect();
        }
        try { appRef.current.destroy(true, { children: true, texture: true }); } catch {}
        appRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;

    try {
      if (!hasStoppedMotions.current) {
        model.internalModel.motionManager.state.reservedIdleGroup = "idle";
        model.expression('f00');
        hasStoppedMotions.current = true;
      }
      // Subtle breathing when not speaking
      const breathValue = mouthOpen < 0.05
        ? 0.03 + Math.sin(Date.now() / 800) * 0.02
        : mouthOpen;
      model.internalModel.coreModel.setParamFloat("PARAM_MOUTH_OPEN_Y", Math.max(breathValue, mouthOpen));
      model.internalModel.coreModel.setParamFloat("PARAM_BREATH", 0.5 + Math.sin(Date.now() / 1200) * 0.3);
    } catch (error) {
      console.error("Live2D animation error:", error);
    }

    if (resumeMotionTimeout.current) {
      clearTimeout(resumeMotionTimeout.current);
    }

    resumeMotionTimeout.current = setTimeout(() => {
      try {
        if (modelRef.current) {
          modelRef.current.internalModel.motionManager.expressionManager.resetExpression();
          modelRef.current.internalModel.motionManager.state.reset();
        }
      } catch {}
    }, 5000);

  }, [mouthOpen]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center bg-white rounded-[var(--shape-md)] shadow-elevation-1 border border-[var(--md-outline)] p-3 sm:p-4 h-full w-full overflow-hidden"
    >
      <div className="flex items-center gap-2 mb-1 sm:mb-2 text-label-sm sm:text-body-md text-[var(--md-on-surface-variant)]">
        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-[var(--shape-full)] bg-[#48BB78] animate-pulse" />
        {characterName || 'Character'} is here
      </div>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export default DigitalHumanContainer;
