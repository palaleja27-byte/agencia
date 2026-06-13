const https = require('https');

function getLogs(jobId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/palaleja27-byte/agencia/actions/jobs/${jobId}/logs`,
      headers: {
        'User-Agent': 'NodeJS-Agent',
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    https.get(options, (res) => {
      // GitHub redirects logs to a secure S3 URL
      if (res.statusCode === 302 || res.statusCode === 307) {
        const redirectUrl = res.headers.location;
        https.get(redirectUrl, (res2) => {
          let data = '';
          res2.on('data', chunk => data += chunk);
          res2.on('end', () => resolve(data));
        }).on('error', reject);
      } else {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(`Error: status ${res.statusCode}: ${data}`));
      }
    }).on('error', reject);
  });
}

async function run() {
  try {
    const jobId = '81192595063';
    console.log(`Fetching logs for job ${jobId}...`);
    const logs = await getLogs(jobId);
    console.log("=== JOB LOGS ===");
    console.log(logs.substring(logs.length - 3000)); // Show last 3000 characters
  } catch (e) {
    console.error("Error:", e);
  }
}

run();
