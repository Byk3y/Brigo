/**
 * UUID Utility Tests
 * Tests for the UUID v4 generator function
 */

import { uuidv4 } from '@/lib/utils/uuid';

describe('uuid utility', () => {
    describe('uuidv4', () => {
        it('should generate a valid UUID v4 format string', () => {
            const uuid = uuidv4();

            // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
            // where y is one of [8, 9, a, b]
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

            expect(uuid).toMatch(uuidRegex);
        });

        it('should generate unique IDs on each call', () => {
            const uuids = new Set<string>();

            for (let i = 0; i < 100; i++) {
                uuids.add(uuidv4());
            }

            // All 100 UUIDs should be unique
            expect(uuids.size).toBe(100);
        });

        it('should have the version 4 indicator in the correct position', () => {
            const uuid = uuidv4();
            const parts = uuid.split('-');

            // Version indicator is the first character of the 3rd segment
            expect(parts[2][0]).toBe('4');
        });

        it('should have a valid variant indicator', () => {
            const uuid = uuidv4();
            const parts = uuid.split('-');

            // Variant indicator is the first character of the 4th segment
            // Should be 8, 9, a, or b
            expect(['8', '9', 'a', 'b']).toContain(parts[3][0]);
        });

        it('should return a 36-character string', () => {
            const uuid = uuidv4();

            expect(uuid.length).toBe(36);
        });
    });
});
