// ---------------------------------------------------------------------------
// Step-by-step guides for the systems people have to use but rarely touch.
//
// These are not course material and not Field Guide links — they are the
// answers to questions the office gets asked repeatedly, written down once so
// nobody has to be found to answer them again. Rendered in-app rather than
// linked out, because a crew member looking for their fuel PIN at a pump has
// no patience for a portal.
// ---------------------------------------------------------------------------

export interface HowToStep {
  title: string
  /** One bullet per action. Keep them literal — this is read on a phone. */
  detail: string[]
}

export interface HowToGuide {
  id: string
  icon: string
  title: string
  /** What this gets you, in one line. */
  summary: string
  /** Shown before the steps where getting it wrong wastes real time. */
  before?: { label: string; value: string }[]
  steps: HowToStep[]
  /** The whole path on one line, for someone who has done it before. */
  quickPath?: string
  /** Things that look like failures but are not. */
  gotchas?: string[]
  /** Safety or handling note, shown as a warning. */
  caution?: string
  /** Who to ask when the guide does not resolve it. */
  escalation?: string
}

export const HOW_TO_GUIDES: HowToGuide[] = [
  {
    id: 'wex-pin',
    icon: '⛽',
    title: 'Find your WEX fuel PIN',
    summary:
      'Your WEX PIN authorises fuel purchases. It lives in Workday under your personal IDs — not on the card, and not with the truck.',
    steps: [
      {
        title: 'Log in to Okta',
        detail: [
          'Open the Okta app, or go to your Okta portal in a browser.',
          'Sign in with your GMR credentials.',
        ],
      },
      {
        title: 'Select Workday',
        detail: ['From the Okta Apps dashboard, tap OneGMR Workday.'],
      },
      {
        title: 'Open the menu and select Personal',
        detail: [
          'Tap the hamburger menu (three lines) in the top left.',
          'Under the Personal section, tap Personal Information.',
        ],
      },
      {
        title: 'Navigate to Personal Information',
        detail: [
          'On a phone, tap Show More if the option is not visible.',
          'Your contact and personal details will appear.',
        ],
      },
      {
        title: 'Tap More, then IDs',
        detail: ['At the top of the page, tap the More tab.', 'Select IDs from the dropdown menu.'],
      },
      {
        title: 'Scroll to Other IDs and find your WEX PIN',
        detail: [
          'Scroll to the bottom of the IDs page.',
          'Locate the Other IDs section.',
          'Find the row labelled Wex Pin.',
          'Tap the three dots (…) to reveal the full PIN.',
        ],
      },
    ],
    quickPath:
      'Okta → OneGMR Workday → Menu → Personal Information → More tab → IDs → Other IDs → Wex Pin',
    caution:
      'Your WEX PIN authorises fuel purchases against the company account. Treat it like a card PIN — do not write it on the vehicle, the card, or a shared board, and do not share it with another crew member. If you think it has been seen, tell your supervisor.',
    escalation: 'Your supervisor or the AMR KC Training team.',
  },
  {
    id: 'imagetrend-login',
    icon: '📝',
    title: 'Log in to ImageTrend Elite',
    summary:
      'ePCR charting. Most people need the password reset on their first attempt — that is expected, not a fault.',
    before: [
      { label: 'Site', value: 'imagetrendelite.com/Elite/Organizationgmr' },
      { label: 'Username', value: 'Your employee number' },
      { label: 'E-mail address', value: 'Your GMR email' },
    ],
    steps: [
      {
        title: 'Open the sign-in page',
        detail: [
          'Go to imagetrendelite.com/Elite/Organizationgmr.',
          'Your username is your employee number — not your email, and not your name.',
        ],
      },
      {
        title: 'First time in? Reset the password',
        detail: [
          'Tap "Forgot your password?" under the Sign In button.',
          'Most accounts have no password set until you do this, so this is the normal first step rather than a sign anything is wrong.',
        ],
      },
      {
        title: 'Complete the reset form',
        detail: [
          'E-mail Address: your GMR email.',
          'Username: your employee number.',
          'Last Name: as it appears in Workday.',
          'Tap Submit Reset.',
        ],
      },
      {
        title: 'Check your GMR email and set a password',
        detail: [
          'Open the reset link from the email.',
          'Set your password, then return to the sign-in page and log in with your employee number.',
        ],
      },
    ],
    gotchas: [
      'The reset email can take a minute or two to arrive on the first attempt. Wait before requesting another — a second request invalidates the first link.',
      'If all three fields are right and it still refuses, the last name on file may differ from what you typed. Check how it appears in Workday.',
      'Username is the employee number. Entering the GMR email there is the most common reason a login fails.',
    ],
    escalation: 'Your supervisor or the AMR KC Training team.',
  },
]
