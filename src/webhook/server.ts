import express from 'express';
import { createPullRequestHandler } from './handlers/pull-request';
import { createIssueHandler } from './handlers/issue';
import { createPushHandler } from './handlers/push';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/webhook', (req, res) => {
  try {
    const eventType = req.headers['x-github-event'] as string;
    const payload = req.body;

    console.log(`Received GitHub webhook event: ${eventType}`);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    switch (eventType) {
      case 'pull_request':
        createPullRequestHandler(payload);
        break;
      case 'issues':
        createIssueHandler(payload);
        break;
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

app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
});

export default app;