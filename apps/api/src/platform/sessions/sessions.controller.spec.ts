import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

describe('SessionsController', () => {
  let sessionsService: {
    createSession: jest.Mock;
    rotateSession: jest.Mock;
    listActiveSessions: jest.Mock;
    revokeAllSessions: jest.Mock;
    revokeSession: jest.Mock;
  };
  let controller: SessionsController;

  beforeEach(() => {
    sessionsService = {
      createSession: jest.fn(),
      rotateSession: jest.fn(),
      listActiveSessions: jest.fn(),
      revokeAllSessions: jest.fn(),
      revokeSession: jest.fn(),
    };
    controller = new SessionsController(sessionsService as unknown as SessionsService);
  });

  it('creates a session for the authenticated user', async () => {
    sessionsService.createSession.mockResolvedValue({ sessionId: 's1' });
    const req = { user: { userId: 'u1' } } as never;

    const result = await controller.create(req);

    expect(sessionsService.createSession).toHaveBeenCalledWith('u1');
    expect(result).toEqual({ sessionId: 's1' });
  });

  it('rotates using the refresh token attached to the request by the guard', async () => {
    sessionsService.rotateSession.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    const req = { refreshToken: 'old-token' } as never;

    const result = await controller.refresh(req);

    expect(sessionsService.rotateSession).toHaveBeenCalledWith('old-token');
    expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('lists active sessions for the authenticated user', async () => {
    sessionsService.listActiveSessions.mockResolvedValue([]);
    const req = { user: { userId: 'u1' } } as never;

    await controller.list(req);

    expect(sessionsService.listActiveSessions).toHaveBeenCalledWith('u1');
  });

  it('revokes all sessions for the authenticated user', async () => {
    const req = { user: { userId: 'u1' } } as never;

    await controller.revokeAll(req);

    expect(sessionsService.revokeAllSessions).toHaveBeenCalledWith('u1');
  });

  it('revokes a single session scoped to the authenticated user', async () => {
    const req = { user: { userId: 'u1' } } as never;

    await controller.revoke(req, 's1');

    expect(sessionsService.revokeSession).toHaveBeenCalledWith('s1', 'u1');
  });
});
