// Never connect microphone samples to the output: the output stays silent.
class CaptureProcessor extends AudioWorkletProcessor {
    constructor() { super(); this.samples = []; }
    process(inputs) {
        const input = inputs[0]?.[0];
        if (input) {
            this.samples.push(...input);
            if (this.samples.length >= sampleRate * 0.032) {
                const samples = Float32Array.from(this.samples);
                this.port.postMessage(samples, [samples.buffer]);
                this.samples = [];
            }
        }
        return true;
    }
}
registerProcessor('chat-voice-capture', CaptureProcessor);
