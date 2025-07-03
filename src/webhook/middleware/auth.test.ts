import { Request, Response } from 'express';
import { createHmac } from 'crypto';
import { verifyWebhookSignature } from './auth';

describe('verifyWebhookSignature', () => {
  const mockSecret = 'test-secret';
  const mockPayload = { action: 'opened', test: 'data' };
  const mockPayloadString = JSON.stringify(mockPayload);
  
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      headers: {},
      body: mockPayload
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
  });

  it('should call next() for valid signature', () => {
    const validSignature = 'sha256=' + createHmac('sha256', mockSecret)
      .update(mockPayloadString)
      .digest('hex');
    
    mockReq.headers = { 'x-hub-signature-256': validSignature };
    
    const middleware = verifyWebhookSignature(mockSecret);
    middleware(mockReq as Request, mockRes as Response, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 401 for missing signature', () => {
    const middleware = verifyWebhookSignature(mockSecret);
    middleware(mockReq as Request, mockRes as Response, mockNext);
    
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Missing signature header',
      message: 'No X-Hub-Signature-256 header found in request'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 for invalid signature', () => {
    mockReq.headers = { 'x-hub-signature-256': 'sha256=invalid-signature' };
    
    const middleware = verifyWebhookSignature(mockSecret);
    middleware(mockReq as Request, mockRes as Response, mockNext);
    
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Invalid signature',
      message: 'Webhook signature verification failed'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 500 for missing secret', () => {
    const validSignature = 'sha256=' + createHmac('sha256', mockSecret)
      .update(mockPayloadString)
      .digest('hex');
    
    mockReq.headers = { 'x-hub-signature-256': validSignature };
    
    const middleware = verifyWebhookSignature('');
    middleware(mockReq as Request, mockRes as Response, mockNext);
    
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Server configuration error',
      message: 'Webhook secret not configured'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });
});