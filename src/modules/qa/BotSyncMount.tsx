import { useBotSyncRunner } from './botSync'

// Renders nothing — its only job is to run the bot folder-sync loop for as long
// as it's mounted. Lazy-loaded and mounted from Layout only when QA is enabled,
// so botSync (and its qaStore / bot-bridge deps) stay out of the initial chunk
// while QA is paused.
export default function BotSyncMount() {
  useBotSyncRunner()
  return null
}
