import { describe, expect, it } from 'vitest';
import { compareSemver, isPrereleaseVersion } from '../src/core/version';

describe('Quillvibe enterprise SemVer versioning', () => {
  it('identifies pre-release tags accurately', () => {
    expect(isPrereleaseVersion('3.2.0-rc.1')).toBe(true);
    expect(isPrereleaseVersion('3.2.0-rc.12')).toBe(true);
    expect(isPrereleaseVersion('3.2.0')).toBe(false);
    expect(isPrereleaseVersion('v3.1.2')).toBe(false);
  });

  it('orders pre-release candidates and stable releases strictly by SemVer rules', () => {
    expect(compareSemver('3.2.0-rc.1', '3.1.2')).toBe(1);
    expect(compareSemver('3.1.2', '3.2.0-rc.1')).toBe(-1);
    expect(compareSemver('3.2.0-rc.2', '3.2.0-rc.1')).toBe(1);
    expect(compareSemver('3.2.0-rc.10', '3.2.0-rc.2')).toBe(1);
    expect(compareSemver('3.2.0', '3.2.0-rc.9')).toBe(1);
    expect(compareSemver('v3.2.0', '3.2.0')).toBe(0);
    expect(compareSemver('3.2.1', '3.2.0')).toBe(1);
  });
});
