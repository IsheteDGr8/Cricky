import { createAuthService } from '../auth';
import { DataError } from '../errors';

describe('deleteAccount', () => {
  it('refuses when nobody is signed in', async () => {
    const auth = {
      currentUser: null,
      delete: async () => {
        throw new Error('should not run');
      },
    };
    const access = { watchRole: () => () => {} };
    const service = createAuthService(auth as never, access as never);
    await expect(service.deleteAccount()).rejects.toBeInstanceOf(DataError);
  });
});
