import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  earliest,
  fillAnnouncementBody,
  fillAnnouncementTitle,
  fillTemplate,
  flairMatches,
  isExpiredMonthly,
  isInWindow,
  isRedditImageUrl,
  parseEndDate,
  textOrNull,
} from './rules.ts';

// node:test's describe/it return promises the runner awaits itself; `void`
// marks them as intentionally not awaited here.

void describe('textOrNull', () => {
  void it('trims text and treats blank as unset', () => {
    assert.equal(textOrNull('  Sunsets  '), 'Sunsets');
    assert.equal(textOrNull('   '), null);
    assert.equal(textOrNull(undefined), null);
  });
});

void describe('parseEndDate', () => {
  void it('ends at the last millisecond of the day in UTC', () => {
    const result = parseEndDate('2026-06-30');
    assert.equal(result?.text, '2026-06-30');
    assert.equal(result?.endsAt.toISOString(), '2026-06-30T23:59:59.999Z');
  });

  void it('accepts surrounding spaces', () => {
    assert.equal(parseEndDate(' 2026-12-31 ')?.text, '2026-12-31');
  });

  void it('rejects blank, wrong formats and impossible dates', () => {
    for (const value of [
      undefined,
      '',
      '30-06-2026',
      '2026/06/30',
      '2026-6-3',
    ]) {
      assert.equal(parseEndDate(value), null, String(value));
    }
    assert.equal(parseEndDate('2026-02-30'), null);
    assert.equal(parseEndDate('2026-13-01'), null);
  });

  void it('handles leap years', () => {
    assert.notEqual(parseEndDate('2028-02-29'), null);
    assert.equal(parseEndDate('2027-02-29'), null);
  });
});

void describe('earliest', () => {
  const a = new Date('2026-01-01T00:00:00Z');
  const b = new Date('2026-02-01T00:00:00Z');
  void it('picks the earlier date, or whichever is set', () => {
    assert.equal(earliest(a, b), a);
    assert.equal(earliest(b, a), a);
    assert.equal(earliest(null, b), b);
    assert.equal(earliest(a, null), a);
    assert.equal(earliest(null, null), null);
  });
});

void describe('flairMatches', () => {
  void it('matches every post when no flair is configured', () => {
    assert.equal(flairMatches(undefined, null), true);
    assert.equal(flairMatches('Anything', null), true);
  });

  void it('ignores case, emoji, punctuation and spacing', () => {
    assert.equal(flairMatches('📸 | photo contest', 'Photo Contest'), true);
    assert.equal(flairMatches('PHOTO-CONTEST!', 'Photo Contest'), true);
  });

  void it('reads decorative Unicode as plain letters', () => {
    assert.equal(
      flairMatches('📸 | 𝗣𝗵𝗼𝘁𝗼𝗴𝗿𝗮𝗽𝗵𝘆 𝗖𝗼𝗻𝘁𝗲𝘀𝘁', 'Photography Contest'),
      true
    );
  });

  void it('rejects different flairs and posts without flair', () => {
    assert.equal(flairMatches('Photo Contest 2', 'Photo Contest'), false);
    assert.equal(flairMatches('Discussion', 'Photo Contest'), false);
    assert.equal(flairMatches(undefined, 'Photo Contest'), false);
  });

  void it('needs an exact match for emoji-only flairs', () => {
    assert.equal(flairMatches('📸', '📸'), true);
    assert.equal(flairMatches('🏆', '📸'), false);
  });
});

void describe('fillTemplate', () => {
  void it('fills placeholders in any order', () => {
    assert.equal(
      fillTemplate('🏆 {theme} {year}', { theme: 'Sunsets', year: '2026' }),
      '🏆 Sunsets 2026'
    );
    assert.equal(
      fillTemplate('{year} {theme} 🏆', { theme: 'Sunsets', year: '2026' }),
      '2026 Sunsets 🏆'
    );
  });

  void it('ignores case and inner spaces in placeholder names', () => {
    assert.equal(
      fillTemplate('{Month} { YEAR }', { month: 'October', year: '2026' }),
      'October 2026'
    );
  });

  void it('leaves unknown placeholders as typed', () => {
    assert.equal(
      fillTemplate('{yr} {theme}', { theme: 'Sunsets' }),
      '{yr} Sunsets'
    );
  });
});

void describe('isExpiredMonthly', () => {
  // On 1 Nov 2027 October 2027 has just finished: Oct 2026 … Oct 2027 stay.
  const nov2027 = new Date('2027-11-01T00:05:00Z');
  const dec2027 = new Date('2027-12-01T00:05:00Z');

  void it('keeps the month just finished and the 12 before it', () => {
    assert.equal(isExpiredMonthly('monthly:2027-10', nov2027), false);
    assert.equal(isExpiredMonthly('monthly:2026-10', nov2027), false);
  });

  void it('expires anything older', () => {
    assert.equal(isExpiredMonthly('monthly:2026-09', nov2027), true);
    assert.equal(isExpiredMonthly('monthly:2026-10', dec2027), true);
    assert.equal(isExpiredMonthly('monthly:2026-11', dec2027), false);
  });

  void it('works across a January boundary', () => {
    const jan2027 = new Date('2027-01-15T12:00:00Z');
    assert.equal(isExpiredMonthly('monthly:2025-12', jan2027), false);
    assert.equal(isExpiredMonthly('monthly:2025-11', jan2027), true);
  });

  void it('never expires competitions or unknown IDs', () => {
    assert.equal(
      isExpiredMonthly('competition:photo-contest:2020-01-01', dec2027),
      false
    );
    assert.equal(isExpiredMonthly('monthly:bad', dec2027), false);
  });
});

void describe('isInWindow', () => {
  const after = new Date('2026-10-31T23:59:59.999Z');
  const until = new Date('2026-11-30T23:59:59.999Z');

  void it('counts posts between the previous end and this end', () => {
    assert.equal(isInWindow('2026-11-15T10:00:00Z', { after, until }), true);
    assert.equal(isInWindow(until.toISOString(), { after, until }), true);
  });

  void it('skips posts from the previous competition and late posts', () => {
    assert.equal(isInWindow('2026-10-20T10:00:00Z', { after, until }), false);
    assert.equal(isInWindow(after.toISOString(), { after, until }), false);
    assert.equal(isInWindow('2026-12-01T00:00:01Z', { after, until }), false);
  });

  void it('has no limit on a side that is null', () => {
    assert.equal(
      isInWindow('2020-01-01T00:00:00Z', { after: null, until }),
      true
    );
    assert.equal(
      isInWindow('2030-01-01T00:00:00Z', { after, until: null }),
      true
    );
  });

  void it('rejects unreadable dates', () => {
    assert.equal(isInWindow('not a date', { after: null, until: null }), false);
  });
});

void describe('fillAnnouncementTitle', () => {
  void it('fills placeholders', () => {
    assert.equal(
      fillAnnouncementTitle('Congrats {user} for {Theme} {year}', {
        user: 'u/jane',
        theme: 'Sunsets',
        year: '2026',
      }),
      'Congrats u/jane for Sunsets 2026'
    );
  });

  void it("cuts titles to Reddit's 300 characters", () => {
    const title = fillAnnouncementTitle('x'.repeat(400), {});
    assert.equal(title.length, 300);
    assert.ok(title.endsWith('…'));
  });
});

void describe('fillAnnouncementBody', () => {
  const values = { user: 'u/jane', post: 'https://reddit.com/p/1' };

  void it('fills {user} and {post} where the mods put them', () => {
    assert.equal(
      fillAnnouncementBody('Well done {User}! See { post }', values),
      'Well done u/jane! See https://reddit.com/p/1'
    );
  });

  void it('adds the winner when {user} is missing', () => {
    assert.equal(
      fillAnnouncementBody('Great photo: {post}', values),
      'Great photo: https://reddit.com/p/1\n\nWinner: u/jane'
    );
  });

  void it('adds the post link when {post} is missing', () => {
    assert.equal(
      fillAnnouncementBody('Congrats {user}!', values),
      'Congrats u/jane!\n\nWinning post: https://reddit.com/p/1'
    );
  });

  void it('adds both when neither is used', () => {
    assert.equal(
      fillAnnouncementBody('Thanks everyone', values),
      'Thanks everyone\n\nWinner: u/jane\n\nWinning post: https://reddit.com/p/1'
    );
  });
});

void describe('isRedditImageUrl', () => {
  void it('accepts Reddit-hosted uploads', () => {
    for (const url of [
      'https://i.redd.it/abc123.gif',
      'https://preview.redd.it/x.png?width=640&s=1',
      'https://styles.redditmedia.com/t5_1/styles/banner.jpg',
      'https://www.redditstatic.com/icon.png',
    ]) {
      assert.equal(isRedditImageUrl(url), true, url);
    }
  });

  void it('rejects other sites, http and non-strings', () => {
    for (const url of [
      'https://example.com/a.gif',
      'https://i.redd.it.evil.com/a.gif',
      'https://notredd.it/a.png',
      'http://i.redd.it/a.gif',
      'javascript:alert(1)',
      '',
      'not a url',
    ]) {
      assert.equal(isRedditImageUrl(url), false, url);
    }
    assert.equal(isRedditImageUrl(undefined), false);
    assert.equal(isRedditImageUrl(42), false);
  });
});
