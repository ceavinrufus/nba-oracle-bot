export interface TeamEntry { id: string; fullName: string; aliases: string[]; }

const NBA_TEAMS: TeamEntry[] = [
  { id: 'atlanta-hawks', fullName: 'Atlanta Hawks', aliases: ['hawks', 'atl'] },
  { id: 'boston-celtics', fullName: 'Boston Celtics', aliases: ['celtics', 'bos'] },
  { id: 'brooklyn-nets', fullName: 'Brooklyn Nets', aliases: ['nets', 'bkn', 'brk'] },
  { id: 'charlotte-hornets', fullName: 'Charlotte Hornets', aliases: ['hornets', 'cha', 'cho'] },
  { id: 'chicago-bulls', fullName: 'Chicago Bulls', aliases: ['bulls', 'chi'] },
  { id: 'cleveland-cavaliers', fullName: 'Cleveland Cavaliers', aliases: ['cavaliers', 'cavs', 'cle'] },
  { id: 'dallas-mavericks', fullName: 'Dallas Mavericks', aliases: ['mavericks', 'mavs', 'dal'] },
  { id: 'denver-nuggets', fullName: 'Denver Nuggets', aliases: ['nuggets', 'den'] },
  { id: 'detroit-pistons', fullName: 'Detroit Pistons', aliases: ['pistons', 'det'] },
  { id: 'golden-state-warriors', fullName: 'Golden State Warriors', aliases: ['warriors', 'gsw', 'golden state'] },
  { id: 'houston-rockets', fullName: 'Houston Rockets', aliases: ['rockets', 'hou'] },
  { id: 'indiana-pacers', fullName: 'Indiana Pacers', aliases: ['pacers', 'ind'] },
  { id: 'la-clippers', fullName: 'LA Clippers', aliases: ['clippers', 'lac', 'los angeles clippers'] },
  { id: 'los-angeles-lakers', fullName: 'Los Angeles Lakers', aliases: ['lakers', 'lal'] },
  { id: 'memphis-grizzlies', fullName: 'Memphis Grizzlies', aliases: ['grizzlies', 'mem'] },
  { id: 'miami-heat', fullName: 'Miami Heat', aliases: ['heat', 'mia'] },
  { id: 'milwaukee-bucks', fullName: 'Milwaukee Bucks', aliases: ['bucks', 'mil'] },
  { id: 'minnesota-timberwolves', fullName: 'Minnesota Timberwolves', aliases: ['timberwolves', 'wolves', 'min'] },
  { id: 'new-orleans-pelicans', fullName: 'New Orleans Pelicans', aliases: ['pelicans', 'nop', 'no'] },
  { id: 'new-york-knicks', fullName: 'New York Knicks', aliases: ['knicks', 'nyk', 'ny'] },
  { id: 'oklahoma-city-thunder', fullName: 'Oklahoma City Thunder', aliases: ['thunder', 'okc', 'oklahoma city'] },
  { id: 'orlando-magic', fullName: 'Orlando Magic', aliases: ['magic', 'orl'] },
  { id: 'philadelphia-76ers', fullName: 'Philadelphia 76ers', aliases: ['76ers', 'sixers', 'phi'] },
  { id: 'phoenix-suns', fullName: 'Phoenix Suns', aliases: ['suns', 'phx', 'pho'] },
  { id: 'portland-trail-blazers', fullName: 'Portland Trail Blazers', aliases: ['trail blazers', 'blazers', 'por'] },
  { id: 'sacramento-kings', fullName: 'Sacramento Kings', aliases: ['kings', 'sac'] },
  { id: 'san-antonio-spurs', fullName: 'San Antonio Spurs', aliases: ['spurs', 'sas'] },
  { id: 'toronto-raptors', fullName: 'Toronto Raptors', aliases: ['raptors', 'tor'] },
  { id: 'utah-jazz', fullName: 'Utah Jazz', aliases: ['jazz', 'uta'] },
  { id: 'washington-wizards', fullName: 'Washington Wizards', aliases: ['wizards', 'was', 'wsh'] },
];

export function resolveTeam(text: string): string | null {
  if (!text) return null;
  // Normalize: lowercase, strip non-alphanumeric except spaces, trim
  const lower = text.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim();
  // Also a version with hyphens replaced by spaces for matching
  const lowerNoHyphen = lower.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

  // Pass 1: exact match on fullName, id, or any alias
  for (const team of NBA_TEAMS) {
    const fullLower = team.fullName.toLowerCase();
    const idNorm = team.id.replace(/-/g, ' ');
    if (lower === team.id || lowerNoHyphen === fullLower || lowerNoHyphen === idNorm) return team.id;
    if (team.aliases.some(a => lowerNoHyphen === a)) return team.id;
  }

  // Pass 2: word-boundary substring matching
  for (const team of NBA_TEAMS) {
    const fullLower = team.fullName.toLowerCase();
    if (lowerNoHyphen.includes(fullLower)) return team.id;
    for (const alias of team.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`);
      if (re.test(lowerNoHyphen)) return team.id;
    }
  }

  return null;
}

export { NBA_TEAMS };
