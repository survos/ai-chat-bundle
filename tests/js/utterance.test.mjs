import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Utterance } from '../../assets/src/audio/utterance.js';
const frame = volume => new Float32Array(512).fill(volume);
test('silence and short noises do not interrupt; sustained speech keeps its beginning', async () => {
    const capture = new Utterance(16000, true);
    for (let i = 0; i < 1000; i++) assert.equal(capture.push(frame(0.001)), null);
    assert.ok(capture.duration <= 0.4);
    assert.equal(capture.push(frame(0.1)), null);
    capture.push(frame(0));
    let result;
    for (let i = 0; i < 6; i++) result = capture.push(frame(0.1));
    assert.equal(result, 'interrupt');
    assert.equal(capture.monitoring, false);
    assert.ok(capture.chunks.filter(chunk => chunk[0] > 0.09).length >= 6);
    const bytes = await capture.wav().arrayBuffer();
    assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'RIFF');
    assert.equal(new DataView(bytes).getUint32(24, true), 16000);
});
test('pause ends the question once; no-speech listening times out', () => {
    const capture = new Utterance(16000);
    for (let i = 0; i < 6; i++) capture.push(frame(0.1));
    let result;
    for (let i = 0; i < 57; i++) result = capture.push(frame(0));
    assert.equal(result, 'finish');
    const empty = new Utterance(16000);
    for (let i = 0; i < 469; i++) result = empty.push(frame(0));
    assert.equal(result, 'empty');
});
test('55-second recording stays below server limit even with 48kHz input', () => {
    const capture = new Utterance(48000);
    capture.chunks = [new Float32Array(48000 * 55)];
    assert.ok(capture.wav().size < 1800000);
});
