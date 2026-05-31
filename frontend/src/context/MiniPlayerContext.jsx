import React, { createContext, useState, useContext } from 'react';

const MiniPlayerContext = createContext();

export function MiniPlayerProvider({ children }) {
  const [activeVideo, setActiveVideo] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [miniPlayerActive, setMiniPlayerActive] = useState(false);

  const startMiniPlayer = (video, time, playingState, mutedState, volState) => {
    setActiveVideo(video);
    setCurrentTime(time);
    setIsPlaying(playingState);
    setIsMuted(mutedState);
    setVolume(volState !== undefined ? volState : 1);
    setMiniPlayerActive(true);
  };

  const closeMiniPlayer = () => {
    setActiveVideo(null);
    setMiniPlayerActive(false);
    setIsPlaying(false);
  };

  return (
    <MiniPlayerContext.Provider value={{
      activeVideo,
      currentTime,
      isPlaying,
      isMuted,
      volume,
      miniPlayerActive,
      setCurrentTime,
      setIsPlaying,
      setIsMuted,
      setVolume,
      setMiniPlayerActive,
      startMiniPlayer,
      closeMiniPlayer
    }}>
      {children}
    </MiniPlayerContext.Provider>
  );
}

export function useMiniPlayer() {
  return useContext(MiniPlayerContext);
}
