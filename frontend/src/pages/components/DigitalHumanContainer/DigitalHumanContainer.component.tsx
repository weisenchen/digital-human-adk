"use client";

import { useEffect, useRef, useContext } from 'react';
import dynamic from 'next/dynamic';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';

const loadPixi = async () => {
  const PIXI = (await import('pixi.js'));
  const { Live2DModel } = await import('pixi-live2d-display');
  return { PIXI, Live2DModel };
};

declare global {
  interface Window {
    PIXI: typeof import('pixi.js');
  }
}

const DigitalHumanContainer = () => {
  const {
    mouthOpen,
  } = useContext(VoiceAssistantContext);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<any>(null);
  const hasStoppedMotions = useRef(false);
  const resumeMotionTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initializePixi = async () => {
      try {
        const { PIXI, Live2DModel } = await loadPixi();
        window.PIXI = PIXI;
        Live2DModel.registerTicker(PIXI.Ticker);

        const canvas = canvasRef.current;
        if (!canvas) return;

        const app = new PIXI.Application({
          view: canvas,
          height: 650,
          width: 650,
          autoDensity: true,
          antialias: true,
          resolution: window.devicePixelRatio,
          transparent: true,
        });

        const url = `${window.location.origin}/shizuku_model/shizuku.model.json`;
        const model = await Live2DModel.from(url);
        model.autoInteract = false;

        app.stage.addChild(model);
        model.scale.set(0.5);
        model.position.set(30, -30);

        modelRef.current = model;
      } catch (error) {
        console.error("Failed to initialize Live2D:", error);
      }
    };

    initializePixi();
  }, []);

  useEffect(() => {
    if (modelRef.current) {
      if (!hasStoppedMotions.current) {
        modelRef.current.internalModel.motionManager.stopAllMotions();
        modelRef.current.internalModel.motionManager.state.reservedIdleGroup = "idle";
        modelRef.current.internalModel.motionManager.expressionManager.restoreExpression();
        hasStoppedMotions.current = true;
      }
      modelRef.current.expression('f00');
      modelRef.current.internalModel.coreModel.setParamFloat("PARAM_MOUTH_OPEN_Y", mouthOpen);
    }

    if (resumeMotionTimeout.current) {
      clearTimeout(resumeMotionTimeout.current);
    }

    resumeMotionTimeout.current = setTimeout(() => {
      if (modelRef.current) {
        modelRef.current.internalModel.motionManager.expressionManager.resetExpression();
        modelRef.current.internalModel.motionManager.state.reset();
      }
    }, 5000);

  }, [mouthOpen]);

  return (
    <div className="flex flex-col items-center justify-center bg-white rounded-xl shadow-card border border-[#E2E8F0] p-4 h-full overflow-hidden">
      <div className="flex items-center gap-2 mb-2 text-sm text-[#4A5568]">
        <span className="w-2 h-2 rounded-full bg-[#48BB78] animate-pulse" />
        Xiao Wei is here
      </div>
      <canvas ref={canvasRef} className="max-w-full max-h-full" />
    </div>
  );
};

export default DigitalHumanContainer;
