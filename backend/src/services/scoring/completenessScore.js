'use strict';

/**
 * REQ-3.3: section completeness score. Points are earned for each expected part of a resume;
 * missing parts become plain-language tips on the report screen.
 */

function completenessScore(parsed) {
  const s = parsed.sections || {};
  const c = parsed.contact || {};
  const bullets = parsed.bullets || [];
  const has = (k) => Boolean(s[k] && s[k].trim().length > 0);
  const metricBullets = bullets.filter((b) => b.hasMetric).length;
  const metricRatio = bullets.length ? metricBullets / bullets.length : 0;

  const items = [
    { key: 'email', label: 'Email address', points: 8, earned: c.email ? 8 : 0, tip: 'Add a professional email address near the top.' },
    { key: 'phone', label: 'Phone number', points: 5, earned: c.phone ? 5 : 0, tip: 'Add a phone number with country code.' },
    {
      key: 'links',
      label: 'LinkedIn or GitHub link',
      points: 4,
      earned: c.linkedin || c.github ? 4 : 0,
      tip: 'Add your LinkedIn profile (and GitHub for technical roles).',
    },
    { key: 'summary', label: 'Summary section', points: 8, earned: has('summary') ? 8 : 0, tip: 'Add a 2-3 line summary tailored to this role.' },
    { key: 'skills', label: 'Skills section', points: 15, earned: has('skills') ? 15 : 0, tip: 'Add a "Skills" section listing tools and technologies by name.' },
    {
      key: 'experience',
      label: 'Experience section',
      points: 18,
      // Students often have projects instead of jobs; give partial credit.
      earned: has('experience') ? 18 : has('projects') ? 9 : 0,
      tip: has('projects')
        ? 'Add internships, freelance or part-time work under an "Experience" heading if you have any.'
        : 'Add an "Experience" section (internships, jobs, freelance work).',
    },
    { key: 'education', label: 'Education section', points: 15, earned: has('education') ? 15 : 0, tip: 'Add an "Education" section with your degree, college and year.' },
    { key: 'projects', label: 'Projects section', points: 10, earned: has('projects') ? 10 : has('experience') ? 5 : 0, tip: 'Add 2-3 projects that use the skills this job asks for.' },
    {
      key: 'certifications',
      label: 'Certifications',
      points: 2,
      earned: has('certifications') ? 2 : 0,
      tip: 'Optional: add relevant certifications or courses.',
    },
    {
      key: 'metrics',
      label: 'Results with numbers',
      points: 15,
      earned: Math.round(Math.min(1, metricRatio / 0.5) * 15),
      tip: `Only ${metricBullets} of ${bullets.length} bullet points include a number. Aim for at least half (e.g. "cut load time by 40%").`,
    },
  ];

  if (!bullets.length) {
    const m = items.find((i) => i.key === 'metrics');
    m.tip = 'Write your experience and projects as bullet points that start with an action verb and include a result.';
  }

  const total = items.reduce((a, i) => a + i.points, 0);
  const earned = items.reduce((a, i) => a + i.earned, 0);
  return {
    score: Math.round((earned / total) * 100),
    items: items.map((i) => ({ ...i, complete: i.earned >= i.points })),
    metricBullets,
    totalBullets: bullets.length,
  };
}

module.exports = { completenessScore };
