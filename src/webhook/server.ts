import express from 'express';
import { PullRequestHandler } from './handlers/pull-request';
import { IssueHandler } from './handlers/issue';
import { ReviewCommentHandler } from './handlers/review-comment';
import { createPushHandler } from './handlers/push';
import { verifyWebhookSignature } from './middleware/auth';
import { environment, validateEnvironment } from '../config/environment';
import { Logger } from '../utils/logger';
import { defaultConfig } from '../config';

const app = express();

app.use(express.json());

validateEnvironment();

// Initialize dependencies
const logger = new Logger();
const pullRequestHandler = new PullRequestHandler(logger, defaultConfig);
const issueHandler = new IssueHandler(logger, defaultConfig);
const reviewCommentHandler = new ReviewCommentHandler(logger, defaultConfig);

app.post('/webhook', verifyWebhookSignature(environment.webhookSecret), async (req, res) => {
  try {
    const eventType = req.headers['x-github-event'] as string;
    const payload = req.body;

    console.log(`Received GitHub webhook event: ${eventType}`);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    switch (eventType) {
      case 'pull_request':
        await pullRequestHandler.handlePullRequest(payload, req, res);
        return; // Handler manages the response
      case 'issues':
        await issueHandler.handleIssue(payload, req, res);
        return; // Handler manages the response
      case 'issue_comment':
        await issueHandler.handleIssue(payload, req, res);
        return; // Handler manages the response
      case 'pull_request_review':
      case 'pull_request_review_comment':
        await reviewCommentHandler.handleReviewComment(payload, req, res);
        return; // Handler manages the response
      case 'push':
        createPushHandler(payload);
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    res.status(200).json({ message: 'Webhook received successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.listen(environment.port, () => {
  console.log(`Webhook server running on port ${environment.port}`);
});

export default app;
