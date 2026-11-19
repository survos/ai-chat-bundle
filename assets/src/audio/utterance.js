// Keep a short pre-roll while the assistant speaks, so interrupting doesn't
// clip the first syllable. Only the utterance, never the whole reply, is sent.
export class Utterance {
    constructor(rate, monitoring = false) {
        this.rate = rate;
        this.monitoring = monitoring;
        this.chunks = [];
        this.duration = 0;
        this.speech = 0;
        this.silence = 0;
        this.heard = false;
    }
    push(samples) {
        const seconds = samples.length / this.rate;
        const rms = Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
        this.chunks.push(samples);
        this.duration += seconds;
        if (rms > (this.monitoring ? 0.035 : 0.02)) {
            this.speech += seconds;
            this.silence = 0;
        } else {
            this.speech = 0;
            this.silence += seconds;
        }
        if (this.monitoring) {
            while (this.duration > 0.4 && this.chunks.length > 1) this.duration -= this.chunks.shift().length / this.rate;
            if (this.speech >= 0.18) {
                this.monitoring = false;
                this.heard = true;
                return 'interrupt';
            }
            return null;
        }
        if (this.speech >= 0.12) this.heard = true;
        if (!this.heard && this.duration >= 15) return 'empty';
        if (this.duration >= 55 || (this.heard && this.silence >= 1.8)) return 'finish';
        return null;
    }
    wav() {
        // Resample to 16 kHz mono PCM: a 55-second question fits under 1.8 MB.
        const source = new Float32Array(this.chunks.reduce((n, chunk) => n + chunk.length, 0));
        let offset = 0;
        for (const chunk of this.chunks) { source.set(chunk, offset); offset += chunk.length; }
        const length = Math.floor(source.length * 16000 / this.rate);
        const buffer = new ArrayBuffer(44 + length * 2), view = new DataView(buffer);
        const label = (at, value) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
        label(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); label(8, 'WAVE'); label(12, 'fmt ');
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
        label(36, 'data'); view.setUint32(40, length * 2, true);
        for (let i = 0; i < length; i++) {
            const start = Math.floor(i * this.rate / 16000), end = Math.max(start + 1, Math.floor((i + 1) * this.rate / 16000));
            let sum = 0;
            for (let j = start; j < end; j++) sum += source[j] || 0;
            const value = Math.max(-1, Math.min(1, sum / (end - start)));
            view.setInt16(44 + i * 2, value * (value < 0 ? 32768 : 32767), true);
        }
        return new Blob([buffer], { type: 'audio/wav' });
    }
}
