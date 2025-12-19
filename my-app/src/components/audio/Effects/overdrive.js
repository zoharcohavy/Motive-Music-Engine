// src/components/audio/Effects/overdrive.js
//
// AudioWorklet module as a Blob URL so it can live inside /src.
// This processor implements hard clipping using Math.min/Math.max with a ceiling.

let cachedUrl = null;

export function getOverdriveWorkletUrl() {
  if (cachedUrl) return cachedUrl;

  const code = `
  class OverdriveProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return [
        {
          name: "ceiling",
          defaultValue: 0.6,
          minValue: 0.01,
          maxValue: 1.0,
          automationRate: "k-rate",
        },
        {
          name: "mix",
          defaultValue: 1.0,
          minValue: 0.0,
          maxValue: 1.0,
          automationRate: "k-rate",
        },
      ];
    }

    process(inputs, outputs, parameters) {
      const input = inputs[0];
      const output = outputs[0];
      if (!input || input.length === 0) return true;

      const inL = input[0];
      const inR = input[1] || input[0];
      const outL = output[0];
      const outR = output[1] || output[0];

      const ceilingArr = parameters.ceiling;
      const mixArr = parameters.mix;
      const ceilingA = ceilingArr.length > 1;
      const mixA = mixArr.length > 1;

      for (let i = 0; i < outL.length; i++) {
        const c0 = ceilingA ? ceilingArr[i] : ceilingArr[0];
        const c = Math.max(0.0001, Math.min(1.0, c0));
        const mix = mixA ? mixArr[i] : mixArr[0];

        const xL = inL ? (inL[i] || 0) : 0;
        const xR = inR ? (inR[i] || 0) : 0;

        const wetL = Math.max(-c, Math.min(xL, c));
        const wetR = Math.max(-c, Math.min(xR, c));

        outL[i] = xL * (1 - mix) + wetL * mix;
        outR[i] = xR * (1 - mix) + wetR * mix;
      }

      return true;
    }
  }

  registerProcessor("overdrive-processor", OverdriveProcessor);
  `;

  const blob = new Blob([code], { type: "text/javascript" });
  cachedUrl = URL.createObjectURL(blob);
  return cachedUrl;
}
