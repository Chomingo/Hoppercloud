const GameUpdater = require('../utils/GameUpdater');
const fs = require('fs-extra');
const path = require('path');

describe('Updater Utils', () => {
    describe('compareVersions', () => {
        test('should return 1 when v1 > v2', () => {
            expect(GameUpdater.compareVersions('1.0.1', '1.0.0')).toBe(1);
            expect(GameUpdater.compareVersions('2.0.0', '1.9.9')).toBe(1);
        });

        test('should return -1 when v1 < v2', () => {
            expect(GameUpdater.compareVersions('1.0.0', '1.0.1')).toBe(-1);
            expect(GameUpdater.compareVersions('0.9.9', '1.0.0')).toBe(-1);
        });

        test('should return 0 when v1 == v2', () => {
            expect(GameUpdater.compareVersions('1.0.0', '1.0.0')).toBe(0);
        });

        test('should handle different lengths', () => {
            expect(GameUpdater.compareVersions('1.0', '1.0.0')).toBe(0);
            expect(GameUpdater.compareVersions('1.0.1', '1.0')).toBe(1);
        });
    });

    describe('calculateHash', () => {
        const testFilePath = path.join(__dirname, 'test-file.txt');
        const testContent = 'Hello World';
        // SHA1 of "Hello World" is 0a4d55a8d778e5022fab701977c5d840bbc486d0
        const expectedHash = '0a4d55a8d778e5022fab701977c5d840bbc486d0';
        const updater = new GameUpdater();

        beforeAll(async () => {
            await fs.writeFile(testFilePath, testContent);
        });

        afterAll(async () => {
            await fs.remove(testFilePath);
        });

        test('should calculate correct SHA1 hash', async () => {
            const hash = await updater.calculateHash(testFilePath);
            expect(hash).toBe(expectedHash);
        });
    });
});
