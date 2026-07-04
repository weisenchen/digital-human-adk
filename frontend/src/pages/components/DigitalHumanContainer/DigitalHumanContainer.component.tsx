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
    let appRef: any = null; // keep reference for cleanup

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
        appRef = app; // keep for cleanup

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

    // Cleanup: destroy PIXI app and model on unmount
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
        model.internalModel.motionManager.stopAllMotions();
        model.internalModel.motionManager.state.reservedIdleGroup = "idle";
        model.internalModel.motionManager.expressionManager.restoreExpression();
        hasStoppedMotions.current = true;
      }
      model.expression('f00');
      model.internalModel.coreModel.setParamFloat("PARAM_MOUTH_OPEN_Y", mouthOpen);
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
    <div className="flex flex-col items-center justify-center bg-white rounded-xl shadow-card border border-[#E2E8F0] p-4 h-full overflow-hidden">
      <div className="flex items-center gap-2 mb-2 text-sm text-[#4A5568]">
        <span className="w-2 h-2 rounded-full bg-[#48BB78] animate-pulse" />
        {characterName || 'Character'} is here
      </div>
      <canvas ref={canvasRef} className="max-w-full max-h-full" />
    </div>
  );
};

export default DigitalHumanContainer;
