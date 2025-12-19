// ************************************************
// ************************************************
// ************************************************
// ************************************************
// THIS FILE IS UNUNSED, IT CAN BE DELETED ********
// ************************************************
// ************************************************
// ************************************************


class ReverbProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    const sr = sampleRate;
    const length = sr * 2;
    this.impulseL = new Float32Array(length);
    this.impulseR = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 2);
      const v = (Math.random() * 2 - 1) * decay;
      this.impulseL[i] = v;
      this.impulseR[i] = v;
    }

    this.bufferL = new Float32Array(length);
    this.bufferR = new Float32Array(length);
    this.index = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const inL = input[0];
    const inR = input[1] || input[0];
    const outL = output[0];
    const outR = output[1] || output[0];

    for (let i = 0; i < outL.length; i++) {
      const idx = this.index;

      this.bufferL[idx] = inL[i] || 0;
      this.bufferR[idx] = inR[i] || 0;

      let sumL = 0;
      let sumR = 0;

      for (let j = 0; j < this.impulseL.length; j++) {
        const k = (idx - j + this.impulseL.length) % this.impulseL.length;
        sumL += this.bufferL[k] * this.impulseL[j];
        sumR += this.bufferR[k] * this.impulseR[j];
      }

      outL[i] = sumL * 0.2;
      outR[i] = sumR * 0.2;

      this.index = (idx + 1) % this.impulseL.length;
    }

    return true;
  }
}

registerProcessor("reverb-processor", ReverbProcessor);
