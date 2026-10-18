import { describe, it, expect } from 'vitest';
import { sanitizeStack, generateReportBody, SanitizedError } from './errorSanitizer';

describe('errorSanitizer', () => {
  describe('sanitizeStack', () => {
    it('should sanitize Unix-style paths with username', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at Object.<anonymous> (/Users/johnsmith/projects/graphium/src/App.tsx:10:5)
    at Module._compile (/Users/johnsmith/projects/graphium/node_modules/ts-node/src/index.ts:1056:36)`;

      const result = sanitizeStack(error, 'johnsmith');

      expect(result.stack).toContain('/Users/<USER>/projects/graphium/src/App.tsx');
      expect(result.stack).toContain('/Users/<USER>/projects/graphium/node_modules');
      expect(result.stack).not.toContain('johnsmith');
    });

    it('should sanitize Linux home directory paths', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at Object.<anonymous> (/home/developer/code/graphium/src/main.ts:5:10)`;

      const result = sanitizeStack(error, 'developer');

      expect(result.stack).toContain('/home/<USER>/code/graphium/src/main.ts');
      expect(result.stack).not.toContain('developer');
    });

    it('should sanitize Windows-style paths with username', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at Object.<anonymous> (C:\\Users\\jdoe\\Documents\\graphium\\src\\App.tsx:10:5)
    at Module._compile (C:/Users/jdoe/projects/graphium/index.ts:20:10)`;

      const result = sanitizeStack(error, 'jdoe');

      expect(result.stack).toContain('C:\\Users\\<USER>\\Documents');
      expect(result.stack).toContain('C:/Users/<USER>/projects');
      expect(result.stack).not.toContain('jdoe');
    });

    it('should sanitize username in error message', () => {
      const error = new Error('File not found: /Users/secretuser/data/file.txt');
      error.stack = 'Error: File not found: /Users/secretuser/data/file.txt\n    at test.ts:1:1';

      const result = sanitizeStack(error, 'secretuser');

      expect(result.message).toContain('/Users/<USER>/data/file.txt');
      expect(result.message).not.toContain('secretuser');
    });

    it('should handle empty username gracefully', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at /Users/someone/file.ts:1:1';

      const result = sanitizeStack(error, '');

      expect(result.name).toBe('Error');
      expect(result.message).toBe('Test error');
      expect(result.stack).toContain('/Users/someone/file.ts');
    });

    it('should handle errors without stack traces', () => {
      const error = new Error('No stack');
      error.stack = undefined;

      const result = sanitizeStack(error, 'testuser');

      expect(result.name).toBe('Error');
      expect(result.message).toBe('No stack');
      expect(result.stack).toBe('');
    });

    it('should handle errors without messages', () => {
      const error = new Error();
      error.stack = 'Error\n    at /home/user/test.ts:1:1';

      const result = sanitizeStack(error, 'user');

      expect(result.message).toBe('');
      expect(result.stack).toContain('/home/<USER>/test.ts');
    });

    it('should handle special regex characters in username', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at /home/user.name+test/file.ts:1:1';

      const result = sanitizeStack(error, 'user.name+test');

      expect(result.stack).toContain('/home/<USER>/file.ts');
      expect(result.stack).not.toContain('user.name+test');
    });

    it('should handle multiple occurrences of username', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at /Users/dev/project/src/a.ts:1:1
    at /Users/dev/project/src/b.ts:2:2
    at /Users/dev/project/src/c.ts:3:3`;

      const result = sanitizeStack(error, 'dev');

      const userCount = (result.stack.match(/<USER>/g) || []).length;
      expect(userCount).toBe(3);
      expect(result.stack).not.toContain('/Users/dev/');
    });

    it('should preserve error name', () => {
      const error = new TypeError('Invalid type');
      error.stack = 'TypeError: Invalid type\n    at test.ts:1:1';

      const result = sanitizeStack(error, 'testuser');

      expect(result.name).toBe('TypeError');
    });

    // PII Sanitization Tests
    describe('PII sanitization', () => {
      it('should sanitize email addresses', () => {
        const error = new Error('User john.doe@example.com not found');
        error.stack = 'Error: User john.doe@example.com not found\n    at auth.ts:1:1';

        const result = sanitizeStack(error, 'testuser');

        expect(result.message).toContain('<EMAIL>');
        expect(result.message).not.toContain('john.doe@example.com');
        expect(result.stack).not.toContain('john.doe@example.com');
      });

      it('should sanitize IPv4 addresses', () => {
        const error = new Error('Connection to 192.168.1.100 failed');
        error.stack = 'Error at 10.0.0.1:3000\n    at network.ts:1:1';

        const result = sanitizeStack(error, 'testuser');

        expect(result.message).toContain('<IP>');
        expect(result.message).not.toContain('192.168.1.100');
        expect(result.stack).not.toContain('10.0.0.1');
      });

      it('should sanitize UUIDs', () => {
        const error = new Error('User 550e8400-e29b-41d4-a716-446655440000 not found');
        error.stack = 'Error\n    at /app/users/550e8400-e29b-41d4-a716-446655440000.ts:1:1';

        const result = sanitizeStack(error, 'testuser');

        expect(result.message).toContain('<UUID>');
        expect(result.message).not.toContain('550e8400-e29b-41d4-a716-446655440000');
      });

      it('should sanitize Bearer tokens', () => {
        const error = new Error('Auth failed');
        error.stack =
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U\n    at auth.ts:1:1';

        const result = sanitizeStack(error, 'testuser');

        expect(result.stack).toContain('Bearer <TOKEN>');
        expect(result.stack).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      });

      it('should sanitize API keys in common formats', () => {
        const error = new Error('API error');
        error.stack = 'api_key=test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx\n    at api.ts:1:1';

        const result = sanitizeStack(error, 'testuser');

        expect(result.stack).toContain('<REDACTED>');
        expect(result.stack).not.toContain('test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx');
      });

      it('should sanitize environment variable patterns', () => {
        const error = new Error('Config error');
        error.stack = 'DATABASE_URL: postgres://user:pass@host/db\n    at config.ts:1:1';

        const result = sanitizeStack(error, 'testuser');

        expect(result.stack).toContain('<ENV_VAR>');
        expect(result.stack).not.toContain('postgres://user:pass@host/db');
      });

      it('should handle multiple PII types in same error', () => {
        const error = new Error('Error for user@test.com at 192.168.1.1');
        error.stack = 'Error at /home/devuser/app.ts:1:1';

        const result = sanitizeStack(error, 'devuser');

        expect(result.message).toContain('<EMAIL>');
        expect(result.message).toContain('<IP>');
        expect(result.stack).toContain('/home/<USER>/app.ts');
      });
    });
  });

  describe('generateReportBody', () => {
    it('should include app version', () => {
      const sanitizedError: SanitizedError = {
        name: 'Error',
        message: 'Test error',
        stack: 'Error: Test error\n    at test.ts:1:1',
      };

      const report = generateReportBody(sanitizedError);

      expect(report).toContain('App Version:');
    });

    it('should include platform information', () => {
      const sanitizedError: SanitizedError = {
        name: 'Error',
        message: 'Test error',
        stack: 'Error: Test error\n    at test.ts:1:1',
      };

      const report = generateReportBody(sanitizedError);

      expect(report).toContain('Platform:');
    });

    it('should include timestamp', () => {
      const sanitizedError: SanitizedError = {
        name: 'Error',
        message: 'Test error',
        stack: 'Error: Test error\n    at test.ts:1:1',
      };

      const report = generateReportBody(sanitizedError);

      expect(report).toContain('Timestamp:');
      // ISO timestamp format check
      expect(report).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include error details section', () => {
      const sanitizedError: SanitizedError = {
        name: 'TypeError',
        message: 'Cannot read property',
        stack: 'TypeError: Cannot read property\n    at file.ts:10:5',
      };

      const report = generateReportBody(sanitizedError);

      expect(report).toContain('## Error Details');
      expect(report).toContain('**Error Type:** TypeError');
      expect(report).toContain('**Message:** Cannot read property');
    });

    it('should include stack trace section', () => {
      const sanitizedError: SanitizedError = {
        name: 'Error',
        message: 'Test',
        stack: 'Error: Test\n    at /home/<USER>/project/file.ts:1:1',
      };

      const report = generateReportBody(sanitizedError);

      expect(report).toContain('### Stack Trace');
      expect(report).toContain('/home/<USER>/project/file.ts');
    });

    it('should have proper header', () => {
      const sanitizedError: SanitizedError = {
        name: 'Error',
        message: 'Test',
        stack: 'Error: Test',
      };

      const report = generateReportBody(sanitizedError);

      expect(report).toContain('## Description');
    });
  });
});
