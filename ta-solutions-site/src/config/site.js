// ─────────────────────────────────────────────────────────────
//  Site copy & contact details. Edit here, not in components.
// ─────────────────────────────────────────────────────────────

export const SITE = {
  name: 'TA Solutions',
  shortName: 'TA',
  // PLACEHOLDER: replace with the real inbox before launch.
  email: 'hello@tasolutions.ai',
  location: 'Remote-first · Working worldwide',
  socials: [
    { label: 'LinkedIn', href: '#' },
    { label: 'Instagram', href: '#' },
    { label: 'X', href: '#' },
  ],
}

export const HERO = {
  eyebrow: 'AI solutions studio',
  titleA: 'Intelligence,',
  titleB: 'engineered.',
  sub: 'TA Solutions designs, builds and runs AI systems for ambitious businesses — from the ads that find your customers to the automations that serve them.',
  primaryCta: 'Start a project',
  secondaryCta: 'Explore services',
}

export const MANIFESTO = [
  'We build',
  'systems that',
  'think, sell',
  '& scale.',
]

export const SERVICES = [
  {
    id: 'advertising',
    index: '01',
    title: 'Advertising',
    blurb: 'AI-assisted creative and media buying that tests faster, spends smarter and compounds what works.',
    points: ['Paid social & search', 'Creative testing at scale', 'Attribution you can trust'],
    image: 'serviceAdvertising',
  },
  {
    id: 'websites',
    index: '02',
    title: 'Website Creation',
    blurb: 'Fast, considered websites and immersive brand experiences built to convert — like the one you are on.',
    points: ['Design systems', 'Immersive 3D & motion', 'CMS & e-commerce'],
    image: 'serviceWebsites',
  },
  {
    id: 'automation',
    index: '03',
    title: 'AI Automation',
    blurb: 'Agents and workflows that take repetitive work off your team — wired into the tools you already use.',
    points: ['Custom AI agents', 'CRM & ops workflows', 'Support & lead handling'],
    image: 'serviceAutomation',
  },
  {
    id: 'content',
    index: '04',
    title: 'Content Creation',
    blurb: 'On-brand imagery, video and copy produced with generative tooling and finished by human taste.',
    points: ['Generative visuals & video', 'Social content engines', 'Brand voice systems'],
    image: 'serviceContent',
  },
  {
    id: 'consultation',
    index: '05',
    title: 'Business Consultation',
    blurb: 'Clear-eyed strategy on where AI genuinely pays off in your business — and a roadmap to get there.',
    points: ['AI readiness audits', 'Opportunity mapping', 'Team enablement'],
    image: 'serviceConsultation',
  },
]

export const APPROACH = {
  title: ['Small team.', 'Serious systems.'],
  intro:
    'We work as an extension of your team: senior people, short loops, and no black boxes. Every engagement is measured against one question — did it move the business?',
  steps: [
    { k: '01', t: 'Diagnose', d: 'A focused audit of your funnel, operations and data to find the highest-leverage opportunities.' },
    { k: '02', t: 'Design', d: 'A scoped plan with clear outcomes, timelines and the exact systems we will build.' },
    { k: '03', t: 'Deploy', d: 'We build, integrate and launch in weeks — not quarters — with your team in the loop.' },
    { k: '04', t: 'Compound', d: 'We monitor, iterate and expand what works, so results keep improving after launch.' },
  ],
  stats: [
    { v: '2–6', u: 'weeks', l: 'Typical time to launch' },
    { v: '24/7', u: '', l: 'Automations that never clock off' },
    { v: '1', u: 'team', l: 'Strategy, build & growth under one roof' },
  ],
}

export const CONTACT = {
  title: ['Let’s build', 'something intelligent.'],
  sub: 'Tell us where you want to go. We will reply within one business day with next steps.',
  budgets: ['< £5k', '£5–15k', '£15–50k', '£50k+'],
}
