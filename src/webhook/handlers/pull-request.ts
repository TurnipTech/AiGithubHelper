export function createPullRequestHandler(payload: any) {
  console.log('Processing pull request event...');
  
  const action = payload.action;
  const pullRequest = payload.pull_request;
  const repository = payload.repository;
  
  console.log(`Pull request ${action}:`);
  console.log(`- Repository: ${repository.full_name}`);
  console.log(`- PR #${pullRequest.number}: ${pullRequest.title}`);
  console.log(`- Author: ${pullRequest.user.login}`);
  console.log(`- Base branch: ${pullRequest.base.ref}`);
  console.log(`- Head branch: ${pullRequest.head.ref}`);
}