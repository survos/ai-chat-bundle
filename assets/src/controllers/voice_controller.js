import { Controller } from '@hotwired/stimulus';
import { Utterance } from '../audio/utterance.js';

// Voice is a wrapper around the existing question form and chat events.
export default class extends Controller {
    static targets = ['input', 'form', 'review', 'readAloud', 'record', 'finish', 'stop', 'status', 'play'];
    static values = { url: String, token: String, speechUrl: String, captureUrl: String, name: { type: String, default: 'Assistant' } };

    connect() {
        this.active = false;
        this.busy = false;
        this.generation = 0;
        this.canRecord = !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia && window.AudioWorkletNode && window.AudioContext && this.hasCaptureUrlValue);
        this.canSpeak = this.hasSpeechUrlValue;
        this.recordTarget.disabled = !this.canRecord;
        this.readAloudTarget.disabled = !this.canSpeak;
        this.reviewTarget.disabled = !this.canSpeak;
        this.modeChanged();
        if (!this.canRecord) this.statusTarget.textContent = 'Voice input needs HTTPS and a browser with microphone support. You can still type a question.';
    }

    playTargetConnected(button) {
        button.hidden = !this.hasSpeechUrlValue;
    }

    disconnect() { this.stop(); }

    modeChanged() {
        if (this.active) this.stop();
        if (!this.reviewTarget.checked) this.readAloudTarget.checked = true;
        this.readAloudTarget.disabled = !this.canSpeak || !this.reviewTarget.checked;
        this.element.dataset.answerMode = this.reviewTarget.checked ? 'text' : 'voice';
        this.recordTarget.textContent = this.reviewTarget.checked ? '🎙 Record question' : `🎙 Start ${this.nameValue}`;
    }

    async start() {
        if (this.busy || this.active || !this.canRecord) return;
        this.active = true;
        this.stopTarget.hidden = false;
        this.recordTarget.disabled = true;
        this.voiceTurn = true;
        this.element.dataset.answerMode = 'voice';
        this.stopPlayback();
        await this.listen();
    }

    async listen(monitoring = false) {
        const generation = this.generation;
        this.releaseMicrophone();
        const captureId = this.captureId;
        if (!monitoring) this.statusTarget.textContent = 'Opening microphone…';
        let stream, context;
        const current = () => this.active && generation === this.generation && captureId === this.captureId;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }, video: false });
            if (!current()) { stream.getTracks().forEach(track => track.stop()); return; }
            this.stream = stream;
            context = new AudioContext();
            this.audioContext = context;
            await context.audioWorklet.addModule(this.captureUrlValue);
            if (!current()) return;
            const node = new AudioWorkletNode(context, 'chat-voice-capture');
            this.captureNode = node;
            this.utterance = new Utterance(context.sampleRate, monitoring);
            context.createMediaStreamSource(stream).connect(node);
            node.connect(context.destination);
            node.port.onmessage = event => {
                if (current()) this.captureSamples(event.data);
            };
            node.onprocessorerror = () => { if (current()) this.fail('Microphone processing stopped. Please try again.'); };
            await context.resume();
            if (!current()) return;
            this.finishTarget.hidden = monitoring;
            if (!monitoring) this.statusTarget.textContent = 'Listening—your turn. Speak naturally; pause when you are finished.';
        } catch (error) {
            if (current()) this.fail(error.name === 'NotAllowedError' ? 'Microphone permission was not granted. Enable it in your browser or type your question.' : 'Could not open the microphone. Please try again or type your question.');
        } finally {
            if (!current()) {
                stream?.getTracks().forEach(track => track.stop());
                if (context && context.state !== 'closed') context.close().catch(() => {});
            }
        }
    }

    captureSamples(samples) {
        if (!this.active || !this.utterance) return;
        const action = this.utterance.push(samples);
        if (action === 'interrupt') {
            // Keep this capture and its pre-roll; invalidate only the reply audio.
            this.stopPlayback();
            this.finishTarget.hidden = false;
            this.statusTarget.textContent = 'Listening—you interrupted. Go ahead.';
        } else if (action === 'finish') this.finish();
        else if (action === 'empty') this.fail('No speech heard. Tap Start when you are ready.');
    }

    finish() {
        this.finishTarget.hidden = true;
        const utterance = this.utterance;
        this.releaseMicrophone();
        if (this.active && utterance && !utterance.monitoring) {
            if (!utterance.heard) { this.fail('No speech heard. Please try again.'); return; }
            this.transcribe(utterance.wav(), this.generation);
        }
    }

    releaseMicrophone() {
        this.captureId = (this.captureId || 0) + 1;
        if (this.captureNode) {
            this.captureNode.port.onmessage = null;
            this.captureNode.disconnect();
            this.captureNode.port.close();
            this.captureNode = null;
        }
        this.utterance = null;
        this.stream?.getTracks().forEach(track => track.stop());
        this.stream = null;
        this.audioContext?.close().catch(() => {});
        this.audioContext = null;
    }

    async transcribe(blob, generation) {
        this.statusTarget.textContent = 'Transcribing…';
        const data = new FormData();
        data.append('_token', this.tokenValue);
        data.append('audio', blob, 'question.wav');
        this.abort = new AbortController();
        const timeout = window.setTimeout(() => this.abort?.abort(), 45000);
        const previousText = this.inputTarget.value;
        try {
            const response = await fetch(this.urlValue, { method: 'POST', body: data, signal: this.abort.signal });
            const result = await response.json();
            if (!this.active || generation !== this.generation) return;
            if (!response.ok) throw new Error(result.error ?? 'Transcription failed. Please try again.');
            if (this.inputTarget.value !== previousText) throw new Error('Your typed question was kept. Please finish editing it before recording again.');
            this.inputTarget.value = [previousText.trim(), result.text].filter(Boolean).join(' ');
            this.inputTarget.dispatchEvent(new Event('input', { bubbles: true }));
            if (this.inputTarget.maxLength > 0 && this.inputTarget.value.length > this.inputTarget.maxLength || !this.inputTarget.checkValidity()) throw new Error('Please shorten your question before sending.');
            if (this.reviewTarget.checked) {
                this.active = false;
                this.stopTarget.hidden = true;
                this.recordTarget.disabled = false;
                this.statusTarget.textContent = 'Review your question, then press Ask.';
                this.inputTarget.focus();
            } else {
                this.formTarget.requestSubmit();
            }
        } catch (error) {
            if (generation === this.generation) this.fail(error.name === 'AbortError' ? 'Transcription timed out. Please try again.' : error.message);
        } finally { window.clearTimeout(timeout); }
    }

    questionStarted() {
        this.busy = true;
        this.recordTarget.disabled = true;
        // Submitting a typed question in hands-free mode also starts a conversation.
        if (!this.reviewTarget.checked && this.canRecord) {
            this.active = true;
            this.voiceTurn = true;
            this.stopTarget.hidden = false;
        }
        // A typed submission cancels any capture, including a pending mic request.
        ++this.generation;
        this.releaseMicrophone();
        this.stopPlayback();
        this.statusTarget.textContent = 'Looking up your question…';
    }

    answerReceived(event) {
        this.busy = false;
        this.recordTarget.disabled = this.active || !this.canRecord;
        if (this.readAloudTarget.checked && this.voiceTurn && this.canSpeak) {
            this.speak(event.detail.text, () => {
                this.afterSpeaking();
            }, event.detail.mode);
        } else {
            this.stop();
        }
    }

    answerFailed() { this.busy = false; this.fail('The search could not finish. Please try again.'); }

    readAnswer(event) {
        this.stop();
        // Replay is part of the conversation when hands-free mode is selected.
        this.active = !this.reviewTarget.checked && this.canRecord;
        this.voiceTurn = this.active;
        const answer = event.currentTarget.closest('[data-voice-answer]');
        this.speak(answer.querySelector('[data-voice-text]').innerText, () => this.afterSpeaking(), answer.dataset.answerMode);
    }

    afterSpeaking() {
        if (this.active && !this.reviewTarget.checked) {
            this.listen();
        }
        else this.stop();
    }

    async speak(text, finished, mode = 'text') {
        if (!this.canSpeak || !text.trim()) { finished(); return; }
        this.stopPlayback();
        const generation = ++this.generation;
        const playbackId = this.playbackId;
        const current = () => generation === this.generation && playbackId === this.playbackId;
        this.stopTarget.hidden = false;
        this.recordTarget.disabled = true;
        this.statusTarget.textContent = 'Preparing the voice reply…';
        this.speechAbort = new AbortController();
        try {
            const response = await fetch(this.speechUrlValue, {
                method: 'POST',
                body: new URLSearchParams({ text, mode, _token: this.tokenValue }),
                signal: this.speechAbort.signal,
            });
            if (!response.ok) throw new Error((await response.json()).error || 'Voice generation failed.');
            const blob = await response.blob();
            if (!current()) return;
            this.audioUrl = URL.createObjectURL(blob);
            this.player = new Audio(this.audioUrl);
            this.player.onended = () => {
                if (!current()) return;
                this.releaseMicrophone();
                this.stopPlayback();
                finished();
            };
            this.player.onerror = () => { if (current()) this.fail('Audio playback failed. Please try again.'); };
            if (this.active && !this.reviewTarget.checked) await this.listen(true);
            if (!current()) return;
            await this.player.play();
            if (current()) this.statusTarget.textContent = this.active ? `${this.nameValue} is speaking—you can interrupt.` : `${this.nameValue} is speaking…`;
        } catch (error) {
            if (current() && error.name !== 'AbortError') this.fail(error.name === 'NotAllowedError' ? 'Tap Read aloud to allow audio playback in this browser.' : error.message);
        }
    }

    stopPlayback() {
        this.playbackId = (this.playbackId || 0) + 1;
        this.speechAbort?.abort();
        if (this.player) {
            this.player.onended = null;
            this.player.onerror = null;
            this.player.pause();
            this.player = null;
        }
        if (this.audioUrl) { URL.revokeObjectURL(this.audioUrl); this.audioUrl = null; }
    }

    stop() {
        this.active = false;
        this.voiceTurn = false;
        this.element.dataset.answerMode = this.reviewTarget.checked ? 'text' : 'voice';
        ++this.generation;
        this.abort?.abort();
        this.finish();
        this.releaseMicrophone();
        this.stopPlayback();
        this.stopTarget.hidden = true;
        this.recordTarget.disabled = this.busy || !this.canRecord;
        this.statusTarget.textContent = 'Voice stopped.';
    }

    fail(message) { this.stop(); this.statusTarget.textContent = message; }

    visibilityChanged() {
        if (document.hidden && (this.active || !this.stopTarget.hidden)) this.fail('Voice paused while this page is in the background. Tap Start to continue.');
    }
}
