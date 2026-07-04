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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<any>(null);
  const hasStoppedMotions = useRef(false);
  const resumeMotionTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let appRef: any = null;

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
        appRef = app;

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

    return () => {
      if (resumeMotionTimeout.current) {
        clearTimeout(resumeMotionTimeout.current);
      }
      modelRef.current = null;
      if (appRef) {
        try { appRef.destroy(true, { children: true, texture: true }); } catch {}
        appRef = null;
      }
    };
  }, []);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;

    try {
      if (!hasStoppedMotions.current) {
        // Don't stop all motions — keep idle breathing
        model.internalModel.motionManager.state.reservedIdleGroup = "idle";
        // Set idle expression
        model.expression('f00');
        hasStoppedMotions.current = true;
      }
      // Subtle breathing when not speaking (mouthOpen ≈ 0)
      const breathValue = mouthOpen < 0.05
        ? 0.03 + Math.sin(Date.now() / 800) * 0.02
        : mouthOpen;
      model.internalModel.coreModel.setParamFloat("PARAM_MOUTH_OPEN_Y", Math.max(breathValue, mouthOpen));
      model.internalModel.coreModel.setParamFloat("PARAM_BREATH", 0.5 + Math.sin(Date.now() / 1200) * 0.3);
    } catch (error) {
      console.error("Live2D mouth animation error:", error);
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
    <div className="flex flex-col items-center justify-center bg-white rounded-[var(--shape-md)] shadow-elevation-1 border border-[var(--md-outline)] p-4 h-full overflow-hidden">
      <div className="flex items-center gap-2 mb-2 text-body-md text-[var(--md-on-surface-variant)]">
        <span className="w-2 h-2 rounded-[var(--shape-full)] bg-[#48BB78] animate-pulse" />
        {characterName || 'Character'} is here
      </div>
      <canvas ref={canvasRef} className="max-w-full max-h-full" />
    </div>
  );
};

export default DigitalHumanContainer;
