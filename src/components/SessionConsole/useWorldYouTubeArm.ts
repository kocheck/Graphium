import { useCallback, useEffect, useState, type MutableRefObject, type RefObject } from 'react';

import {
  ARM_VIDEO_ID,
  ensureIframeApi,
  mountYouTubePlayer,
  RESTRICTED_YT_ERRORS,
  sendWorldEvent,
  SILENT_WAV,
  youtubeErrorMessage,
  type YouTubePlayer,
  type YouTubePlayerEvent,
} from './worldAudioYoutube';
import { getStageAudioContext } from './worldStageSfx';

interface ArmArgs {
  ytHostRef: RefObject<HTMLDivElement | null>;
  audioRef: RefObject<HTMLAudioElement | null>;
  playerRef: MutableRefObject<YouTubePlayer | null>;
  audioContextRef: MutableRefObject<AudioContext | null>;
  armPendingRef: MutableRefObject<boolean>;
  finishedArmRef: MutableRefObject<boolean>;
  pauseRequestedRef: MutableRefObject<boolean>;
  lastLoopRef: MutableRefObject<{ loop: boolean; youtubeId: string | null }>;
  clearFade: () => void;
  setArmed: (armed: boolean) => void;
}

export function useWorldYouTubeArm(args: ArmArgs): {
  armEnabled: boolean;
  handleArm: () => Promise<void>;
} {
  const [armEnabled, setArmEnabled] = useState(false);
  const {
    ytHostRef,
    audioRef,
    playerRef,
    audioContextRef,
    armPendingRef,
    finishedArmRef,
    pauseRequestedRef,
    lastLoopRef,
    clearFade,
    setArmed,
  } = args;

  const finishArm = useCallback(() => {
    if (finishedArmRef.current) {
      return;
    }
    finishedArmRef.current = true;
    armPendingRef.current = false;
    playerRef.current?.pauseVideo();
    playerRef.current?.seekTo(0, true);
    playerRef.current?.setVolume(0);
    playerRef.current?.unMute();
    setArmed(true);
    sendWorldEvent('armed');
  }, [armPendingRef, finishedArmRef, playerRef, setArmed]);

  const handleYouTubeError = useCallback(
    (event: YouTubePlayerEvent) => {
      if (!RESTRICTED_YT_ERRORS.has(event.data)) {
        return;
      }
      const message = youtubeErrorMessage(event.data);
      if (armPendingRef.current) {
        armPendingRef.current = false;
        sendWorldEvent('error', `Could not arm audio: ${message}`);
        return;
      }
      sendWorldEvent('error', message);
    },
    [armPendingRef],
  );

  const createPlayer = useCallback(() => {
    const host = ytHostRef.current;
    if (!host || playerRef.current) {
      return;
    }
    const player = mountYouTubePlayer(host, {
      onReady: () => {
        playerRef.current?.setVolume(0);
        setArmEnabled(true);
        sendWorldEvent('ready');
      },
      onStateChange: (event) => {
        if (armPendingRef.current && event.data === 1) {
          finishArm();
          return;
        }
        if (!armPendingRef.current && event.data === 1 && pauseRequestedRef.current) {
          playerRef.current?.pauseVideo();
          return;
        }
        if (event.data === 0 && lastLoopRef.current.loop && lastLoopRef.current.youtubeId) {
          playerRef.current?.seekTo(0);
          playerRef.current?.playVideo();
        }
      },
      onError: handleYouTubeError,
    });
    if (player) {
      playerRef.current = player;
    } else {
      setArmEnabled(true);
    }
  }, [
    armPendingRef,
    finishArm,
    handleYouTubeError,
    lastLoopRef,
    pauseRequestedRef,
    playerRef,
    ytHostRef,
  ]);

  useEffect(() => {
    let cancelled = false;
    const cleanupApi = ensureIframeApi(
      () => {
        if (!cancelled) {
          createPlayer();
        }
      },
      () => {
        if (!cancelled) {
          setArmEnabled(true);
        }
      },
    );
    return () => {
      cancelled = true;
      cleanupApi();
      clearFade();
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [clearFade, createPlayer, playerRef]);

  const handleArm = async (): Promise<void> => {
    if (armPendingRef.current || finishedArmRef.current) {
      return;
    }
    armPendingRef.current = true;
    audioContextRef.current = getStageAudioContext(audioContextRef.current);
    const player = playerRef.current;
    if (player) {
      player.mute();
      player.setVolume(0);
      player.loadVideoById({ videoId: ARM_VIDEO_ID, startSeconds: 0 });
    }
    const element = audioRef.current;
    if (!element) {
      return;
    }
    try {
      element.src = SILENT_WAV;
      element.volume = 0;
      await element.play();
      element.pause();
      finishArm();
    } catch {
      if (!player) {
        armPendingRef.current = false;
      }
    }
  };

  useEffect(() => {
    const disarm = (): void => {
      sendWorldEvent('unarmed');
      setArmed(false);
    };
    window.addEventListener('pagehide', disarm);
    return () => {
      window.removeEventListener('pagehide', disarm);
      disarm();
    };
  }, [setArmed]);

  return { armEnabled, handleArm };
}
