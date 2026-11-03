let input = ''
process.stdin
  .on('data', (c) => (input += c))
  .on('end', () => {
    const cmd = JSON.parse(input).tool_input?.command || ''
    if (!/\bgit\s+commit\b/.test(cmd)) process.exit(0)
    const branch = require('child_process').execSync('git branch --show-current').toString().trim()
    if (branch === 'main') {
      console.error('Blocked: never commit to main. Create a branch first.')
      process.exit(2)
    }
  })
