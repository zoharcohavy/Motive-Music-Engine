// src/components/audio/Effects/reverb.js

/**
 * Simple procedural reverb (noise impulse into a ConvolverNode).
 * Cache the generated impulse using the provided ref (typically convolverRef).
 */

export function getReverbImpulse(ctx, cacheRef) {
  const cache = cacheRef?.current;
  if (cache && cache.__impulse) return cache.__impulse;

  const length = Math.floor(ctx.sampleRate * 2); // ~2s IR
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let ch = 0; ch < impulse.numberOfChannels; ch++) {
    const channelData = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 2);
      channelData[i] = (Math.random() * 2 - 1) * decay;
    }
  }

  // Stash impulse on a plain object so we don't have to keep a ConvolverNode around.
  if (cacheRef) {
    if (!cacheRef.current || typeof cacheRef.current !== "object") {
      cacheRef.current = {};
    }
    cacheRef.current.__impulse = impulse;
  }

  return impulse;
}

export function createReverbNode(ctx, cacheRef) {
  const convolver = ctx.createConvolver();
  convolver.buffer = getReverbImpulse(ctx, cacheRef);
  return convolver;
}
