'use strict';

/**
 * Built-in rewrite suggestions, used when no Gemini key is configured or the API fails.
 * Rules: start with a strong action verb, add at most two missing keywords per version,
 * and show where a number belongs with a [placeholder] instead of inventing one.
 */

const WEAK_OPENERS =
  /^(i\s+)?(was\s+)?(responsible for|worked on|working on|helped( with| to| in)?|assisted( in| with)?|involved in|participated in|tasked with|in charge of|duties included|did|handled|took care of|contributed to)\s+/i;

const GERUND_TO_VERB = {
  handling: 'Managed', managing: 'Managed', working: 'Delivered', making: 'Created', creating: 'Created',
  developing: 'Developed', building: 'Built', designing: 'Designed', writing: 'Wrote', testing: 'Tested',
  maintaining: 'Maintained', coordinating: 'Coordinated', supporting: 'Supported', analyzing: 'Analysed',
  analysing: 'Analysed', implementing: 'Implemented', organizing: 'Organised', organising: 'Organised',
  preparing: 'Prepared', conducting: 'Conducted', planning: 'Planned', researching: 'Researched',
  improving: 'Improved', automating: 'Automated', deploying: 'Deployed', training: 'Trained', leading: 'Led',
  running: 'Ran', monitoring: 'Monitored', updating: 'Updated', posting: 'Published', integrating: 'Integrated',
};

const VERB_GROUPS = [
  ['Built', 'Developed', 'Engineered'],
  ['Designed', 'Created', 'Crafted'],
  ['Managed', 'Led', 'Coordinated'],
  ['Analysed', 'Evaluated', 'Investigated'],
  ['Improved', 'Optimised', 'Streamlined'],
  ['Automated', 'Streamlined', 'Implemented'],
  ['Wrote', 'Authored', 'Produced'],
  ['Tested', 'Validated', 'Verified'],
  ['Deployed', 'Launched', 'Shipped'],
  ['Researched', 'Analysed', 'Identified'],
  ['Delivered', 'Executed', 'Drove'],
];

const PAST_VERB = /^(built|developed|engineered|designed|created|crafted|managed|led|coordinated|analy[sz]ed|evaluated|investigated|improved|optimi[sz]ed|streamlined|automated|implemented|wrote|authored|produced|tested|validated|verified|deployed|launched|shipped|researched|identified|delivered|executed|drove|maintained|integrated|organi[sz]ed|prepared|conducted|planned|trained|ran|monitored|updated|published|supported|collaborated|worked|made|used|set up|setup|migrated|refactored|reduced|increased|achieved|established|founded|mentored|presented|won)\b/i;

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function groupFor(verb) {
  const v = capitalise(verb.toLowerCase());
  return VERB_GROUPS.find((g) => g.includes(v)) || [v, ...VERB_GROUPS[10].filter((x) => x !== v)].slice(0, 3);
}

function guessVerb(body) {
  const b = body.toLowerCase();
  if (/\b(app|website|api|feature|dashboard|system|tool|model|pipeline|platform|bot|service)\b/.test(b)) return 'Built';
  if (/\b(design|ui|ux|layout|logo|graphic|canva|figma)\b/.test(b)) return 'Designed';
  if (/\b(social media|campaign|team|event|client|account|project)\b/.test(b)) return 'Managed';
  if (/\b(data|report|research|analysis|survey)\b/.test(b)) return 'Analysed';
  if (/\b(content|blog|article|post|documentation)\b/.test(b)) return 'Wrote';
  return 'Delivered';
}

/** Split a bullet into a lead verb and the rest of the sentence. */
function splitBullet(text) {
  let body = text.trim().replace(/[.;]+$/, '');
  let verb = null;
  const weak = body.match(WEAK_OPENERS);
  if (weak) body = body.slice(weak[0].length);

  const firstWord = (body.match(/^[A-Za-z]+/) || [''])[0].toLowerCase();
  if (GERUND_TO_VERB[firstWord]) {
    verb = GERUND_TO_VERB[firstWord];
    body = body.slice(firstWord.length).trim();
  } else if (!weak && PAST_VERB.test(body)) {
    const m = body.match(PAST_VERB);
    verb = capitalise(m[0].toLowerCase());
    body = body.slice(m[0].length).trim();
  }
  if (!verb) verb = guessVerb(body);
  body = body.charAt(0).toLowerCase() + body.slice(1);
  return { verb, body };
}

function joinKeywords(list) {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/**
 * @param {string} bullet
 * @param {string[]} keywords  missing keywords chosen for this bullet (max 3)
 * @returns {string[]} 3 rewritten versions
 */
function localRewrite(bullet, keywords = []) {
  const { verb, body } = splitBullet(bullet);
  const [v1, v2, v3] = groupFor(verb);
  const k = keywords.slice(0, 3);
  const a = k.slice(0, 2);
  const b = k.length > 2 ? [k[2], k[0]] : k.slice(0, 1);
  const c = k.length > 1 ? [k[1]] : k.slice(0, 1);

  const out = [
    `${v1} ${body}${a.length ? ` using ${joinKeywords(a)}` : ''}, resulting in [measurable result, e.g. 30% faster or 500+ users]`,
    `${v2} ${body}${b.length ? ` with ${joinKeywords(b)}` : ''}, improving [what improved] by [X%]`,
    `${v3} ${body} for [N users / clients / team members]${c.length ? `, applying ${joinKeywords(c)}` : ''} to [goal or outcome]`,
  ];
  return out.map((s) => s.replace(/\s{2,}/g, ' ').trim());
}

module.exports = { localRewrite, splitBullet };
