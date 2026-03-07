const EXPRESSION_KEYWORDS: [string, string[]][] = [
  ['angry', [
    'growl', 'snarl', 'rage', 'fury', 'furious', 'anger', 'yell', 'shout',
    'scream', 'curse', 'slam', 'punch', 'hostile', 'livid', 'angry', 'mad',
    'enraged', 'irritated', 'frustrated',
  ]],
  ['surprised', [
    'gasp', 'shocked', 'surprised', 'stunned', 'astonished', 'amazed',
    'wide-eyed', 'bewildered', 'startled', 'jolt', 'incredulous',
  ]],
  ['embarrassed', [
    'blush', 'flush', 'embarrass', 'stammer', 'stutter', 'flustered',
    'sheepish', 'awkward', 'mortified', 'cringe',
  ]],
  ['sad', [
    'cry', 'tear', 'sob', 'weep', 'mourn', 'sorrow', 'melancholy', 'grief',
    'heartbreak', 'sad', 'upset', 'depressed', 'lonely', 'miserable',
  ]],
  ['happy', [
    'laugh', 'smile', 'grin', 'chuckle', 'giggle', 'beam', 'joy', 'cheerful',
    'delighted', 'happy', 'amused', 'excited', 'elated', 'pleased',
  ]],
  ['thinking', [
    'ponder', 'think', 'consider', 'contemplate', 'muse', 'reflect', 'wonder',
    'hmm', 'thought', 'deliberate',
  ]],
];

export function detectExpression(text: string): string {
  const lower = text.toLowerCase();

  for (const [emotion, keywords] of EXPRESSION_KEYWORDS) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return emotion;
      }
    }
  }

  return 'neutral';
}
