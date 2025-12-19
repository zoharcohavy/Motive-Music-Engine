// public/audio-worklets/overdrive-processor.js
class OverdriveProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "drive",
        defaultValue: 2,
        minValue: 1,
        maxValue: 20,
        automationRate: "k-rate",
      },
      {
        name: "mix",
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
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

    const driveArr = parameters.drive;
    const mixArr = parameters.mix;
    const driveA = driveArr.length > 1;
    const mixA = mixArr.length > 1;

    for (let i = 0; i < outL.length; i++) {
      const drive = driveA ? driveArr[i] : driveArr[0];
      const mix = mixA ? mixArr[i] : mixArr[0];

      const xL = inL[i] || 0;
      const xR = inR[i] || 0;

      // Soft clip distortion (JSFX-like): tanh(drive*x) normalized
      const denom = Math.tanh(drive) || 1;
      const wetL = Math.tanh(drive * xL) / denom;
      const wetR = Math.tanh(drive * xR) / denom;

      outL[i] = xL * (1 - mix) + wetL * mix;
      outR[i] = xR * (1 - mix) + wetR * mix;
    }

    return true;
  }
}

registerProcessor("overdrive-processor", OverdriveProcessor);
