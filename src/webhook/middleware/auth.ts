import { Request, Response, NextFunction } from 'express';
import { createHmac } from 'crypto';

/**
 * Middleware to verify GitHub webhook signatures
 */
export function verifyWebhookSignature(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['x-hub-signature-256'] as string;

      if (!signature) {
        res.status(401).json({
          error: 'Missing signature header',
          message: 'No X-Hub-Signature-256 header found in request',
        });
        return;
      }

      if (!secret) {
        res.status(500).json({
          error: 'Server configuration error',
          message: 'Webhook secret not configured',
        });
        return;
      }

      const payload = JSON.stringify(req.body);
      const expectedSignature =
        'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');

      if (!verifySignature(signature, expectedSignature)) {
        res.status(401).json({
          error: 'Invalid signature',
          message: 'Webhook signature verification failed',
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to verify webhook signature',
      });
    }
  };
}

/**
 * Securely compare two signature strings to prevent timing attacks
 */
function verifySignature(signature: string, expectedSignature: string): boolean {
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }

  return result === 0;
}
