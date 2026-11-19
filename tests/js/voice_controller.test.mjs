import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const source = (await readFile(new URL('../../assets/src/controllers/voice_controller.js', import.meta.url), 'utf8'))
    .replace("import { Controller } from '@hotwired/stimulus';", 'class Controller {}')
    .replace("import { Utterance } from '../audio/utterance.js';", `import { Utterance } from '${new URL('../../assets/src/audio/utterance.js', import.meta.url).href}';`);
const { default: Voice } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function fixture(review = false) {
    const voice = new Voice();
    Object.assign(voice, {
        reviewTarget: { checked: review }, readAloudTarget: { checked: true },
        stopTarget: {}, recordTarget: {}, statusTarget: {}, element: { dataset: {} },
        canRecord: true, canSpeak: true, active: false, busy: false, generation: 0,
        finish() {}, releaseMicrophone() {}, listen() { this.listens = (this.listens || 0) + 1; },
        speak(text, done) { this.playbackDone = done; },
    });
    return voice;
}
const replay = { currentTarget: { closest: () => ({
    querySelector: () => ({ innerText: 'Would you like to know more?' }), dataset: { answerMode: 'voice' },
}) } };

test('hands-free replay starts the next turn after playback', () => {
    const voice = fixture();
    voice.readAnswer(replay);
    assert.equal(voice.active, true);
    assert.equal(voice.listens, undefined);
    voice.playbackDone();
    assert.equal(voice.listens, 1);
});

test('Stop during playback prevents the microphone reopening', () => {
    const voice = fixture();
    voice.readAnswer(replay);
    voice.stop();
    voice.playbackDone();
    assert.equal(voice.listens, undefined);
    assert.equal(voice.active, false);
});

test('review mode remains a one-shot read-aloud', () => {
    const voice = fixture(true);
    voice.readAnswer(replay);
    voice.playbackDone();
    assert.equal(voice.listens, undefined);
});

test('typed question in hands-free mode reads the answer and listens for a follow-up', () => {
    const voice = fixture();
    voice.questionStarted();
    voice.answerReceived({ detail: { text: 'Would you like more detail?', mode: 'voice' } });
    voice.playbackDone();
    assert.equal(voice.listens, 1);
    assert.equal(voice.voiceTurn, true);
});

test('Stop while waiting for the answer prevents automatic playback and listening', () => {
    const voice = fixture();
    voice.questionStarted();
    voice.stop();
    voice.answerReceived({ detail: { text: 'An answer.', mode: 'voice' } });
    assert.equal(voice.playbackDone, undefined);
    assert.equal(voice.listens, undefined);
});

test('interrupt stops playback and preserves the current microphone capture', () => {
    const voice = fixture();
    voice.active = true;
    voice.finishTarget = {};
    let paused = false;
    voice.player = { pause() { paused = true; } };
    const capture = { push() { return 'interrupt'; } };
    voice.utterance = capture;
    voice.captureSamples(new Float32Array(10));
    assert.equal(paused, true);
    assert.equal(voice.player, null);
    assert.equal(voice.utterance, capture);
    assert.equal(voice.active, true);
});

test('late microphone samples cannot interrupt after Stop', () => {
    const voice = fixture();
    let pushed = false;
    voice.utterance = { push() { pushed = true; } };
    voice.captureSamples(new Float32Array(10));
    assert.equal(pushed, false);
});
