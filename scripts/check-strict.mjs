// `npm run check`, with CES_CHECK_STRICT=1 set, on every platform.
//
// This was `"check:strict": "CES_CHECK_STRICT=1 npm run check"`, which is
// POSIX shell syntax. npm hands a script to cmd.exe on Windows, where that
// line is not an assignment followed by a command — it is a command called
// `CES_CHECK_STRICT=1`, and it fails before the checks start.
//
// cross-env is the usual answer and is deliberately not used here. This is a
// *checking* command, and the point of the strict flag is to say whether the
// checks really ran. Putting it behind a dependency means it fails on a fresh
// clone until someone installs — which is the same shape as the skips it
// exists to catch, one level up. Spawning it ourselves costs about fifteen
// lines and nothing else.
//
// npm sets npm_execpath to its own CLI when it runs a script, so re-entering
// through this node binary avoids both npm.cmd and shell:true, and with it
// every quoting difference between cmd.exe and sh.

import { spawn } from 'node:child_process'

const execpath = process.env.npm_execpath
const useNode = execpath && /\.[cm]?js$/.test(execpath)

const cmd = useNode ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm'
const args = useNode ? [execpath, 'run', 'check'] : ['run', 'check']

const child = spawn(cmd, args, {
  stdio: 'inherit',
  env: { ...process.env, CES_CHECK_STRICT: '1' },
  // Only when falling back to a bare `npm.cmd`, which cmd.exe has to resolve.
  shell: !useNode && process.platform === 'win32',
})

child.on('error', (e) => {
  console.error(`check-strict: could not run the check suite — ${e.message}`)
  process.exit(1)
})
// A check killed by a signal is not a check that passed.
child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 1))
