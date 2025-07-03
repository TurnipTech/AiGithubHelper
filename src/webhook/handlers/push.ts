export function createPushHandler(payload: any) {
  console.log('Processing push event...');
  
  const repository = payload.repository;
  const pusher = payload.pusher;
  const commits = payload.commits;
  const ref = payload.ref;
  
  console.log(`Push event:`);
  console.log(`- Repository: ${repository.full_name}`);
  console.log(`- Pusher: ${pusher.name}`);
  console.log(`- Branch: ${ref.replace('refs/heads/', '')}`);
  console.log(`- Commits: ${commits.length}`);
  
  if (commits.length > 0) {
    commits.forEach((commit: any, index: number) => {
      console.log(`  ${index + 1}. ${commit.message} (${commit.author.name})`);
    });
  }
}