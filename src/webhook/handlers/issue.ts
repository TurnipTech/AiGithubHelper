export function createIssueHandler(payload: any) {
  console.log('Processing issue event...');
  
  const action = payload.action;
  const issue = payload.issue;
  const repository = payload.repository;
  
  console.log(`Issue ${action}:`);
  console.log(`- Repository: ${repository.full_name}`);
  console.log(`- Issue #${issue.number}: ${issue.title}`);
  console.log(`- Author: ${issue.user.login}`);
  console.log(`- State: ${issue.state}`);
}