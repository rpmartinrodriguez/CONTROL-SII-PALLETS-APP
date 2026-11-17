import test from 'node:test';
import assert from 'node:assert/strict';
import { autoEnrollmentEnabled } from '../../netlify/lib/push-core.mjs';

test('Push universal está deshabilitado por defecto y nunca requiere UID manual', () => {
  const prev=process.env.SII_PUSH_AUTO_ENROLLMENT;
  const oldUid=process.env.SII_PUSH_ALLOWED_UIDS;
  try {
    delete process.env.SII_PUSH_AUTO_ENROLLMENT;
    process.env.SII_PUSH_ALLOWED_UIDS='uid-no-debe-influir';
    assert.equal(autoEnrollmentEnabled(),false);
    process.env.SII_PUSH_AUTO_ENROLLMENT='false';
    assert.equal(autoEnrollmentEnabled(),false);
    process.env.SII_PUSH_AUTO_ENROLLMENT='true';
    assert.equal(autoEnrollmentEnabled(),true);
  } finally {
    if(prev===undefined)delete process.env.SII_PUSH_AUTO_ENROLLMENT;
    else process.env.SII_PUSH_AUTO_ENROLLMENT=prev;
    if(oldUid===undefined)delete process.env.SII_PUSH_ALLOWED_UIDS;
    else process.env.SII_PUSH_ALLOWED_UIDS=oldUid;
  }
});
