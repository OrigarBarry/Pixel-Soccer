'use strict';
// ====================================================================
//  SHARED DATA: default teams, jersey styles, emblems, names
// ====================================================================

// Default team identities. colors: p = primary, s = secondary, a = accent
const DEFAULT_TEAMS = {
  eagles:   { id:'eagles',   city:'Chersinoff', nick:'Eagles',   abbr:'CHE', colors:{ p:'#203a7a', s:'#0f1d40', a:'#e8b923' }, style:'shoulder',  emblem:'eagle' },
  blizzard: { id:'blizzard', city:'Arctic',     nick:'Blizzard', abbr:'BLZ', colors:{ p:'#2f6fe8', s:'#1b3f94', a:'#ffffff' }, style:'classic',   emblem:'flake' },
  inferno:  { id:'inferno',  city:'Harbour',    nick:'Inferno',  abbr:'INF', colors:{ p:'#e23b30', s:'#8f1d17', a:'#ffe2a8' }, style:'chevron',   emblem:'flame' },
  timber:   { id:'timber',   city:'Northwood',  nick:'Timber',   abbr:'TMB', colors:{ p:'#2f9e4f', s:'#1a5c2d', a:'#f1e3b5' }, style:'plaid',     emblem:'tree' },
  thunder:  { id:'thunder',  city:'Prairie',    nick:'Thunder',  abbr:'THU', colors:{ p:'#7b4fd6', s:'#47288f', a:'#ffd23f' }, style:'bands',     emblem:'bolt' },
  glaciers: { id:'glaciers', city:'Coastal',    nick:'Glaciers', abbr:'GLA', colors:{ p:'#1fb3b8', s:'#11686b', a:'#ffffff' }, style:'minimal',   emblem:'mountain' },
  steel:    { id:'steel',    city:'Iron City',  nick:'Steel',    abbr:'STL', colors:{ p:'#3a3f4b', s:'#1d2027', a:'#ff8a1f' }, style:'pinstripe', emblem:'shield' },
  comets:   { id:'comets',   city:'Sunvale',    nick:'Comets',   abbr:'CMT', colors:{ p:'#f2a51a', s:'#9a620a', a:'#1b2a5c' }, style:'diagonal',  emblem:'star' },
  wolves:   { id:'wolves',   city:'Granite Falls', nick:'Wolves',  abbr:'GRF', colors:{ p:'#5a6170', s:'#2b2f39', a:'#d8dce6' }, style:'shoulder',  emblem:'wolf' },
  grizzlies:{ id:'grizzlies',city:'Kodiak Bay',  nick:'Grizzlies', abbr:'KDK', colors:{ p:'#6b4423', s:'#3a2412', a:'#f1c27a' }, style:'bands',     emblem:'bear' },
  hawks:    { id:'hawks',    city:'Redcliff',   nick:'Hawks',    abbr:'RED', colors:{ p:'#b3202a', s:'#5e1015', a:'#f4f4f4' }, style:'diagonal',  emblem:'hawk' },
  lions:    { id:'lions',    city:'Port Regal', nick:'Lions',    abbr:'PRL', colors:{ p:'#c98a1a', s:'#6e4a0c', a:'#fff1c4' }, style:'classic',   emblem:'lion' },
  dragons:  { id:'dragons',  city:'Ember Valley', nick:'Dragons', abbr:'EMB', colors:{ p:'#1f7a3e', s:'#0f3f1f', a:'#ff8a1f' }, style:'chevron',   emblem:'dragon' },
  royals:   { id:'royals',   city:'Kingsbridge', nick:'Royals',  abbr:'KNG', colors:{ p:'#4a2a8f', s:'#25144a', a:'#ffd23f' }, style:'pinstripe', emblem:'crown' },
  rebels:   { id:'rebels',   city:'Riverton',   nick:'Rebels',   abbr:'RVT', colors:{ p:'#222630', s:'#0b0d14', a:'#e23b30' }, style:'minimal',   emblem:'puck' },
  mariners: { id:'mariners', city:'Saltmarsh',  nick:'Mariners', abbr:'SLT', colors:{ p:'#14406b', s:'#0a2038', a:'#7fd1d6' }, style:'bands',     emblem:'anchor' },
  moose:    { id:'moose',    city:'Pinecrest',  nick:'Moose',    abbr:'PNC', colors:{ p:'#7a5230', s:'#40291a', a:'#e8d7b0' }, style:'plaid',     emblem:'moose' },
  owls:     { id:'owls',     city:'Lantern Hill', nick:'Night Owls', abbr:'LTH', colors:{ p:'#2b2350', s:'#141028', a:'#f2a51a' }, style:'shoulder', emblem:'owl' },
  breakers: { id:'breakers', city:'Bayshore',   nick:'Breakers', abbr:'BAY', colors:{ p:'#1b8fc4', s:'#0d4f6e', a:'#ffffff' }, style:'diagonal',  emblem:'wave' },
  suns:     { id:'suns',     city:'Mesa Verde', nick:'Suns',     abbr:'MSV', colors:{ p:'#e86a1a', s:'#8a3a0a', a:'#ffd23f' }, style:'chevron',   emblem:'sun' },
  knights:  { id:'knights',  city:'Castlegate', nick:'Knights',  abbr:'CGT', colors:{ p:'#8a8f9c', s:'#3a3f4b', a:'#c0392b' }, style:'pinstripe', emblem:'sword' },
  rockets:  { id:'rockets',  city:'Orbit City', nick:'Rockets',  abbr:'ORB', colors:{ p:'#c2457a', s:'#6e1d3c', a:'#ffffff' }, style:'classic',   emblem:'rocket' },
  bison:    { id:'bison',    city:'Plainsfield', nick:'Bison',   abbr:'PLF', colors:{ p:'#5a3a1e', s:'#2e1d0e', a:'#7ac74f' }, style:'minimal',   emblem:'bison' },
  clovers:  { id:'clovers',  city:'Shamrock Falls', nick:'Clovers', abbr:'SHF', colors:{ p:'#7ac74f', s:'#2d6b1e', a:'#ffffff' }, style:'bands',  emblem:'clover' },
};
// the 24-franchise league (identities are permanent; divisions are redrawn every season)
const LEAGUE_TEAM_IDS = Object.keys(DEFAULT_TEAMS);
const CONF_NAMES = ['Aurora Conference', 'Frontier Conference'];
const DIV_NAMES = ['Polar Division', 'Summit Division', 'Prairie Division', 'Harbour Division'];   // divisions 0-1: Aurora, 2-3: Frontier
const QUICK_TEAM_IDS = Object.keys(DEFAULT_TEAMS);

const JERSEY_STYLES = [
  { id:'classic',   name:'Classic' },
  { id:'shoulder',  name:'Shoulder Stripe' },
  { id:'bands',     name:'Horizontal Bands' },
  { id:'diagonal',  name:'Diagonal' },
  { id:'minimal',   name:'Minimalist' },
  { id:'chevron',   name:'Chevron' },
  { id:'plaid',     name:'Lumberjack' },
  { id:'pinstripe', name:'Pinstripe' },
  { id:'goldsash',  name:'Gold Sash', cos:'jersey_gold' },          // account unlock (achievement)
  { id:'heritage',  name:'Heritage Laces', cos:'jersey_heritage' },  // account unlock (achievement)
  { id:'hoops',     name:'Hoops' },
  { id:'yoke',      name:'Yoke' },
  { id:'split',     name:'Split' },
  { id:'dots',      name:'Polka Dots' },
  { id:'galaxy',    name:'Galaxy', cos:'jersey_galaxy' },              // account unlock (achievement)
  { id:'flames',    name:'Flames', cos:'jersey_flames' },              // account unlock (achievement)
  { id:'checker',   name:'Checkered Band' },
  { id:'aurora',    name:'Northern Lights', cos:'jersey_aurora' },     // account unlock (achievement)
  { id:'sunset',    name:'Sunset', cos:'jersey_sunset' },
  { id:'laststand', name:'Last Stand', cos:'jersey_laststand' },     // Quick Play unlock: win the Penalty Kill Game               // account unlock (achievement)
];

const PRESET_COLORS = [
  '#ffffff', '#d8dce6', '#8a92a8', '#3a3f4b', '#1d2027', '#0b0d1a',
  '#e23b30', '#8f1d17', '#ff8a1f', '#f2a51a', '#e8b923', '#ffd23f',
  '#2f9e4f', '#1a5c2d', '#7ac74f', '#1fb3b8', '#11686b', '#5ad1e6',
  '#2f6fe8', '#1b3f94', '#203a7a', '#0f1d40', '#7b4fd6', '#47288f',
  '#c2457a', '#6e1d3c', '#a8714a', '#5a3a1e', '#f1e3b5', '#ffe2a8',
];

// 16x16 pixel emblems. Symmetric ones are written as the left 8 columns and mirrored.
// a = accent, s = secondary, w = white, k = outline, y = gold, o = orange, r = red, g = grey, b = brown
const EMBLEMS = {
  eagle:   { name:'Eagle', rows:[
    '................',
    '.....kkkkk......',
    '...kkwwwwwkk....',
    '..kwwwwwwwwwkk..',
    '..kwwwwwwkwwyyk.',
    '.kwwwwwwwwwyyyyk',
    '.kwwwwwwwwwwyyk.',
    '.kwwwwwwwwwwkk..',
    '.kawwwwwwwwk....',
    '.kaaawwwwwwk....',
    '.kaaaaaawwwk....',
    '..kaaaaaaaak....',
    '..kaaaaaaaak....',
    '...kaaaaaak.....',
    '....kkkkkk......',
    '................'] },
  wolf: { name:'Wolf', rows:[
    'k..............k', 'kk............kk', 'ksk..........ksk', 'ksak........kask', 'kaaakkkkkkkkaaak', 'kaaaaaaaaaaaaaak', 'kaasaaaaaaaasaak', '.kaykksaaskkyak.', '.kaaaaassaaaaak.', '.kaaaswwwwsaaak.', '..kaswwwwwwsak..', '..kawkkkkkkwak..', '...kwkwkkwkwk...', '....kwkwwkwk....', '.....kkkkkk.....', '................'] },
  bear:    { name:'Bear', sym:true, rows:[
    '........',
    '.kkk....',
    'kaaak...',
    'kaaakkkk',
    '.kaaaaaa',
    'kaaaaaaa',
    'kaaaaaaa',
    'kaakwaaa',
    'kaaaaaaa',
    'kaaaaggg',
    'kaaagggk',
    '.kaagggg',
    '..kaaagg',
    '...kaaaa',
    '....kkkk',
    '........'] },
  hawk:    { name:'Hawk', sym:true, rows:[
    '........',
    'k.......',
    'kak.....',
    'kaak....',
    '.kaak...',
    '.kaaak.k',
    '..kaaakw',
    '..kaaawk',
    '...kaaay',
    '....kaaa',
    '.....kaa',
    '.....kaa',
    '....kaaa',
    '....kak.',
    '.....k..',
    '........'] },
  lion:    { name:'Lion', sym:true, rows:[
    '....kkkk', '..kkoooo', '.koooooo', '.kooyyyy', 'kooyyyyy', 'koyykyyy', 'koyykyyy', 'koyyyyyy', 'koyyyykk', 'koyyywwk', 'koyywkww', 'koyyykkw', '.kooyyyy', '.koooooy', '..kkoooo', '....kkkk'] },
  dragon:  { name:'Dragon', rows:[
    'kk............kk', 'kwk..........kwk', '.kwk........kwk.', '.kwwkkkkkkkkwwk.', '..kkaaassaaakk..', '.kaaaassssaaaak.', 'kakkaaaaaaaakkak', 'kaaakyyaayykaaak', '.kaaaakaakaaaak.', '..kaaaaaaaaaak..', '...kaaaaaaaak...', '....kaaaaaak....', '....kakaakak....', '....kaaaaaak....', '....kwkkkkwk....', '.....kkkkkk.....'] },
  shield:  { name:'Shield', sym:true, rows:[
    '........',
    'kkkkkkkk',
    'kaaaaaaa',
    'kawwwwwa',
    'kawwwwwa',
    'kawwwwwa',
    'kaaaaaaa',
    'kawwwwwa',
    'kawwwwwa',
    '.kawwwwa',
    '.kawwwwa',
    '..kawwwa',
    '...kawwa',
    '....kaaa',
    '.....kkk',
    '........'] },
  star:    { name:'Star', sym:true, rows:[
    '........',
    '.......k',
    '......ka',
    '......ka',
    '.....kaa',
    'kkkkkkaa',
    'kaaaaaaa',
    '.kaaaaaw',
    '..kaaaaa',
    '...kaaaa',
    '...kaaaa',
    '..kaaaak',
    '..kaakk.',
    '.kakk...',
    '.kk.....',
    '........'] },
  bolt:    { name:'Lightning', rows:[
    '................',
    '.........kkkk...',
    '........kaaak...',
    '.......kaaak....',
    '......kaaak.....',
    '.....kaaak......',
    '....kaaakkkkk...',
    '...kaaaaaaaak...',
    '...kkkkkaaak....',
    '.......kaaak....',
    '......kaaak.....',
    '.....kaaak......',
    '.....kaak.......',
    '....kaak........',
    '....kkk.........',
    '................'] },
  mountain:{ name:'Mountain', rows:[
    '................',
    '................',
    '......kk........',
    '.....kwwk.......',
    '....kwwwwk......',
    '....kwaawk..kk..',
    '...kaaaaaakkwwk.',
    '..kaaaaaaaakwwwk',
    '..kaaaaaaaaaaaak',
    '.kaaaaaaaaaaaaak',
    '.kaaaaaaaaaaaaak',
    'kaaaaaaaaaaaaaak',
    'kkkkkkkkkkkkkkkk',
    '.wwwwwwwwwwwwww.',
    '................',
    '................'] },
  laurel:  { name:'Champions\' Laurel', sym:true, cos:'emblem_laurel', rows:[
    '........',
    '..y.....',
    '.yy.....',
    '.y..y...',
    'yy.yy...',
    'y..y....',
    'yy.yy..k',
    '.y..y.ka',
    '.yy..yka',
    '..yy..ka',
    '...yy..k',
    '....yy..',
    '.....yyy',
    '.......y',
    '........',
    '........'] },
  crown:   { name:'Crown', sym:true, rows:[
    '........',
    '........',
    '.k......',
    'kyk....k',
    'kyyk..ky',
    'kyyyk.ky',
    'kyyyykyy',
    'kyyyyyyy',
    'kyyryyyy',
    'kyyyyyyy',
    'kkkkkkkk',
    'kaaaaaaa',
    'kaaaaaaa',
    'kkkkkkkk',
    '........',
    '........'] },
  puck:    { name:'Soccer Ball', sym:true, rows:[
    '........',
    '........',
    '.....kkk',
    '...kkwww',
    '..kwwwkk',
    '.kwwwkkk',
    '.kwwwwkk',
    'kkwwwwww',
    'kwkkwwww',
    'kwkkkwww',
    'kwkkwwww',
    '.kwwwwwk',
    '.kwwwwkk',
    '..kwwwkk',
    '...kkwww',
    '.....kkk'] },
  flake:   { name:'Snowflake', sym:true, rows:[
    '.......k',
    '.....k.a',
    '......ka',
    '.k....ka',
    '..k...ka',
    '...ak.ka',
    '....akaa',
    'kaaaaaaa',
    '....akaa',
    '...ak.ka',
    '..k...ka',
    '.k....ka',
    '......ka',
    '.....k.a',
    '.......k',
    '........'] },
  flame:   { name:'Flame', sym:true, rows:[
    '.......k',
    '......ka',
    '.....kaa',
    '....kaaa',
    '...kaaaa',
    '..kaaaao',
    '.kaaaaoo',
    '.kaaaooo',
    'kaaaoooy',
    'kaaooyyy',
    'kaaooyyy',
    'kaaooyyy',
    '.kaaooyy',
    '..kaaoow',
    '...kkkkk',
    '........'] },
  tree:    { name:'Pine Tree', sym:true, rows:[
    '.......k',
    '......ka',
    '.....kaa',
    '....kaaa',
    '...kkaaa',
    '....kaaa',
    '...kaaaa',
    '..kkaaaa',
    '...kaaaa',
    '..kaaaaa',
    '.kaaaaaa',
    'kkkkkkkk',
    '......kb',
    '......kb',
    '......kk',
    '........'] },
  anchor:  { name:'Anchor', sym:true, rows:[
    '......kk', '.....kaa', '.....ka.', '.....kaa', '..kkkkka', '..kaaaaa', '..kkkkka', '......ka',
    '......ka', '......ka', 'k.....ka', 'ka....ka', 'kaa...ka', '.kaa..ka', '..kaaaaa', '...kkkkk'] },
  moose: { name:'Moose', rows:[
    '.k.k........k.k.', 'kakak......kakak', 'kaaak......kaaak', '.kaaakk..kkaaak.', '..kkaaakkaaakk..', '....kaaaaaak....', '...kaaaaaaaak...', '...kawkaakwak...', '...kaaaaaaaak...', '...kaaaaaaaak...', '....kaaaaaak....', '....kaassaak....', '....kssssssk....', '....kssssssk....', '.....kssssk.....', '......kkkk......'] },
  owl:     { name:'Owl', sym:true, rows:[
    '..k.....', '..kk....', '..kakkkk', '..kaaaaa', '.kawwwaa', '.kawkwaa', '.kawwwaa', '.kaaaayy',
    '.kaasaay', '.kasasaa', '.kaasasa', '.kasasaa', '..kaaaaa', '..kkyyky', '...k.kkk', '........'] },
  wave:    { name:'Seagull', rows:[
    '................', '................', '..kk........kk..', '.kwwk......kwwk.', 'kwwwwk....kwwwwk', '.kkwwwk..kwwwkk.', '...kkwwkkwwkk...', '.....kwwwwk.....', '......kywk......', '.......kk.......', '................', '..kk....kkk.....', '.kwwk..kwwwk..kk', 'kssswkkssssskksw', 'ksssssssssssssss', 'kkkkkkkkkkkkkkkk'] },
  sun:     { name:'Sun', sym:true, rows:[
    '.......y', '..y....y', '...y...k', '....kkkk', '...kyyyy', '...kyooo', 'yy.kyooo', '..kyooow',
    '..kyoooo', 'yy.kyooo', '...kyooo', '...kyyyy', '....kkkk', '...y...k', '..y....y', '.......y'] },
  sword:   { name:'Sword', sym:true, rows:[
    '.......k', '......kw', '......kw', '......kw', '......kw', '......kw', '......kw', '......kw',
    '......kw', '..kkkkkk', '..kyyyyy', '..kkkkky', '......kb', '......kb', '.....kyy', '.....kkk'] },
  rocket:  { name:'Rocket', sym:true, rows:[
    '.......k', '......ka', '......ka', '.....kaa', '.....kww', '.....kwk', '.....kww', '.....kaa',
    '.....kaa', '....kkaa', '...kakaa', '..kaakaa', '..kkkkkk', '......oy', '.......o', '.......r'] },
  bison:   { name:'Bison', sym:true, rows:[
    '........', 'k.......', 'wk......', 'wwk.....', '.wwkkkkk', '..kbbbbb', '.kbbbbbb', '.kbwbbbb',
    '.kbbbbbb', '..kbbbbb', '..kbbbbb', '...kbbbb', '...kbbbb', '....kbbk', '.....kkk', '........'] },
  sticks: { name:'Boot', rows:[
    '................', '................', '......kkkk......', '......kaak......', '......kaak......', '......kaak......', '......kaakk.....', '.....kaaaaakk...', '.....kawaaaaakk.', '.....kaaaaaaaaak', '.....kssssssssk.', '.....kkkkkkkkkk.', '......k.k.k.k...', '................', '................', '................'] },
  shark:   { name:'Shark', rows:[
    '................',
    '................',
    '.......kk.......',
    '......kaak......',
    '.....kaaak....kk',
    '...kkaaaaakk.kak',
    '..kaaaaaaaaakaak',
    '.kaaakaaaaaaaaak',
    'kaaaaaaaaaaaaak.',
    'kkwkwkaaaaaaaak.',
    '.kwwwwwwaaaakkak',
    '..kkwwwwwwkk..kk',
    '....kkkkkk......',
    '................',
    '................',
    '................'] },
  phoenix: { name:'Phoenix', sym:true, cos:'emblem_phoenix', rows:[
    '........', 'r......y', 'or.....y', 'oor...ky', '.oor.kyy', '..oorkyy', '...oorry', '....orry',
    '.....rry', '....oryy', '...or.ry', '..or..oy', '.......o', '......o.', '.......o', '........'] },
  clover:  { name:'Clover', rows:[
    '................',
    '.....kkkkkk.....',
    '....kaaaaaak....',
    '...kaaaaaaaak...',
    '.kkkaaaaaaaakkk.',
    'kaaakaaaaaakaaak',
    'kaaaakaaaakaaaak',
    'kaaaaakaakaaaaak',
    'kaaaaaakkaaaaaak',
    'kaaaaakaakaaaaak',
    '.kaaaakkkkaaaak.',
    '..kkkk.kbk.kkk..',
    '.......kbk......',
    '........kbk.....',
    '.........kk.....',
    '................'] },
  fox:     { name:'Fox', sym:true, rows:[
    '........', 'kk......', 'kok.....', 'kwok....', 'kwwok...', 'kooookkk', 'kooooooo', 'koookooo', 'kooooooo', 'kwoooooo', 'kwwwwooo', '.kwwwwww', '..kwwwww', '...kwwkk', '....kkkk', '........'] },
  castle:  { name:'Castle', sym:true, rows:[
    '........', 'kkkk....', 'kaak....', 'kaak.kkk', 'kaakkaaa', 'kaaaaaaa', 'kaaaaaaa', 'kaawaaaa',
    'kaawaaaa', 'kaaaaaaa', 'kaaaaakk', 'kaaaaakk', 'kaaaaakk', 'kaaaaakk', 'kkkkkkkk', '........'] },
  penguin: { name:'Penguin', sym:true, rows:[
    '........', '.....kkk', '....kkkk', '...kkkkk', '...kkwkk', '...kkkky', '..kkkkww', '..kkkwww',
    '.kkkwwww', '.kkkwwww', '.kkkwwww', '..kkwwww', '..kkkwww', '...kkkkk', '...yyy..', '........'] },
  lighthouse: { name:'Lighthouse', sym:true, rows:[
    '.......y', '......yy', '......kk', '.....kyy', '......kk', '......ka', '......kw', '.....kaa',
    '.....kww', '.....kaa', '....kwww', '....kaaa', '...kwwww', 'kkkkkkkk', '.kaaaaaa', '........'] },
  tiger:   { name:'Tiger', sym:true, cos:'emblem_tiger', rows:[
    '........', '.kk.....', 'kook....', 'kooookkk', 'koookooo', 'kooooooo', 'kkoooooo', 'koowkooo',
    'koooooko', 'kooooooo', '.kowwwww', '.kowwwkk', '..kowwww', '...kkwww', '.....kkk', '........'] },
  mask:    { name:'Keeper Gloves', sym:true, cos:'emblem_mask', rows:[   // SOCCER: a pair of keeper gloves (was a goalie mask)
    '........', '..k.k...', '.kwkwk..', '.kwkwkk.', '.kwkwkwk', '.kwwwwwk', 'kkwwwwwk', 'kwkwwwwk', 'kwwwwwwk', '.kwwwwwk', '..kaaaak', '..kaaaak', '..kkkkkk', '........', '........', '........'] },
  snake: { name:'Snake', rows:[
    '.........kkkk...', '........kaaaak..', '.......kaayaaak.', '.......kaaaaakrr', '........kkaak..r', '...kkkkkkkaak...', '..kaasasaaaak...', '.kaakkkkkkkk....', '.kak............', '.kaakkkkkkkk....', '..kaasasaaaakk..', '...kkkkkkkkaaak.', '...........kak..', '..kkkkkkkkkaak..', '.kaasasaaaaak...', '..kkkkkkkkkk....'] },
  hornet: { name:'Hornet', rows:[
    '................', '...kk......kk...', '..kwwk....kwwk..', '..kwwwk..kwwwk..', '...kwwwkkwwwk...', '....kkkaakkk....', '.....kykkyk.....', '....kyyyyyyk....', '....kkkkkkkk....', '....kyyyyyyk....', '....kkkkkkkk....', '.....kyyyyk.....', '......kkkk......', '.......kk.......', '.......k........', '................'] },
  orca: { name:'Orca', rows:[
    '................', '.......k........', '......kak.......', '.....kaak.......', '...kkaaaakkk....', '..kaaaaaaaaakk..', '.kawwaaaaaaaaak.', 'kaawwaaaaaaaaaak', 'kaaaaaaaaaaaakkk', '.kwwwwwwwwwaak..', '..kkwwwwwwkkak..', '....kkkkkk.kaak.', '...........kk.kk', '................', '................', '................'] },
  paw: { name:'Paw', rows:[
    '....w......w....', '....kk....kk....', '...kaak..kaak...', '.w.kaak..kaak.w.', '.kk.kk....kk.kk.', 'kaak........kaak', 'kaak..kkkk..kaak', '.kk.kkaaaakk.kk.', '...kaaaaaaaak...', '..kaaaaaaaaaak..', '..kaaaaaaaaaak..', '..kaaaaaaaaaak..', '...kaaakkaaak...', '....kkk..kkk....', '................', '................'] },
  ram: { name:'Ram', rows:[
    '..kkkk....kkkk..', '.kyyyyk..kyyyyk.', 'kyykkyykkyykkyyk', 'kyk..kykkyk..kyk', 'kyk.kkykkykk.kyk', '.kykyyk..kyykyk.', '..kkyakkkkaykk..', '...kaaaaaaaak...', '...kawkaakwak...', '...kaaaaaaaak...', '....kaaaaaak....', '....kaaaaaak....', '....ksassask....', '.....kssssk.....', '.....kssssk.....', '......kkkk......'] },
  sailboat: { name:'Sailboat', rows:[
    '.......k........', '.......kk.......', '.......kwk......', '......kkwwk.....', '.....kakwwwk....', '....kaakwwwwk...', '...kaaakwwwwwk..', '..kaaaakwwwwwwk.', '.kaaaaakkkkkkkkk', '.kkkkkkkk.......', 'kwwwwwwwwwwwwwk.', '.kwssssssssssk..', '..kkkkkkkkkkk...', 'kk..kkk..kkk..kk', 'swkkswwkkswwkksw', 'kkkkkkkkkkkkkkkk'] },
  claws: { name:'Claw Marks', rows:[
    '................', '................', '......a.........', '......as........', '...a...as..a....', '...as..as..as...', '....as.as..as...', '....as..as..as..', '....as..as..as..', '....as..as..as..', '.....as..as.as..', '.....a...as..a..', '.........as.....', '..........a.....', '................', '................'] },
  raven: { name:'Raven', rows:[
    '................', '........kkk.....', '.......kaaak....', '......kaawakk...', '......kaaaaaykk.', '.....kaaaaakkk..', '....kaaaaaak....', '...kaaaaaaak....', '..kaaasaaaak....', '.kaassaaaaak....', 'kaassaaaaak.....', 'kassaaaaak......', '.kkkaaaak.......', '....kyky........', '....k.k.........', '................'] },
  viking: { name:'Viking Helm', rows:[
    '.k............k.', 'kwk..........kwk', 'kwk..........kwk', 'kwwk........kwwk', '.kwwkkkkkkkkwwk.', '..kkggggggggkk..', '..kggggggggggk..', '.kggggggggggggk.', '.kgggggyygggggk.', 'kyyyyyyyyyyyyyyk', 'kgggkkkggkkkgggk', 'kggk..kggk..kggk', 'kggk..kggk..kggk', 'kggkkkkggkkkkggk', '.kkgggkkkkgggkk.', '...kkkk..kkkk...'] },
  kraken: { name:'Kraken', rows:[
    '.....kkkkkk.....', '....kaaaaaak....', '...kaaaaaaaak...', '...kaaaaaaaak...', '...kaaaaaaaak...', '...kawkaakwak...', '...kaaaaaaaak...', '..kaaaaaaaaaak..', '.kaakaakkaakaak.', 'kak.kak..kak.kak', 'ka.kak.kk.kak.ak', 'ka.ka.kaak.ak.ak', 'kak.ka.kk.ak.kak', '.k..kak..kak..k.', '....kk....kk....', '................'] },
  stag: { name:'Stag', rows:[
    '.s.s........s.s.', '.s.s..s..s..s.s.', '..ss.s....s.ss..', '...s.s....s.s...', '....ss....ss....', '.....s....s.....', '......s..s......', '.kkk.kkkkkk.kkk.', 'kaaakaaaaaakaaak', '.kkkaaaaaaaakkk.', '....kakaakak....', '....kaaaaaak....', '....kaaaaaak....', '.....kssssk.....', '.....kssssk.....', '......kkkk......'] },
  bull: { name:'Bull', rows:[
    '................', 'k..............k', 'wk............kw', 'wk............kw', 'gwk..........kwg', '.gwkkkkkkkkkkwg.', '..ggkaaaaaakgg..', '..kkaaaaaaaakk..', '...kaaaaaaaak...', '...kakaaaakak...', '...kaaaaaaaak...', '....kaaaaaak....', '....kssssssk....', '....kskkkksk....', '.....ksyysk.....', '......kkkk......'] },
  lynx: { name:'Lynx', rows:[
    '.k............k.', '.k............k.', '.kk..........kk.', '.kak........kak.', '.kaak......kaak.', 'kaaakkkkkkkkaaak', 'kaaaaaaaaaaaaaak', 'kasaasaaaasaasak', 'kaaykaaaaaakyaak', 'kaaaaaawwaaaaaak', 'kwaaaawwwwaaaawk', 'kwwaaawkkwaaawwk', 'kwwwwwwkkwwwwwwk', '.kwwwwwwwwwwwwk.', 'k.kwwwwwwwwwwk.k', '...kkkkkkkkkk...'] },
  polarbear: { name:'Polar Bear', rows:[
    '................', '.kkk........kkk.', 'kwggk......kggwk', 'kwgwkkkkkkkkwgwk', '.kwwwwwwwwwwwwk.', '.kwwwwwwwwwwwwk.', 'kwwwwwwwwwwwwwwk', 'kwwwwkwwwwkwwwwk', 'kwwwwwwwwwwwwwwk', 'kwwwwwggggwwwwwk', '.kwwwggggggwwwk.', '.kwwwgkkkkgwwwk.', '..kwwggkkggwwk..', '...kwggkkggwk...', '....kkkggkkk....', '.......kk.......'] },
  thunderbird: { name:'Thunderbird', rows:[
    '......kkkk......', '.....kaaaak.....', '.....kwaawk.....', '.....kayyak.....', 'kk...kkyykk...kk', 'kakk.kaaaak.kkak', 'kaaakkaaaakkaaak', 'kaaaaaayyaaaaaak', '.kaaaayaayaaaak.', '.kasaaayyaaasak.', '.kskasaaaasaksk.', '..k.ksaaaask.k..', '....kasaasak....', '...kskssssksk...', '...k.k.kk.k.k...', '................'] },
  knight: { name:'Knight Helm', cos:'emblem_toc', rows:[
    '.......rr.......', '......rrrr......', '.....rroorr.....', '....kkkkkkkk....', '...kggggggggk...', '..kwgggyygggwk..', '..kggggyyggggk..', '.kkkkkkyykkkkkk.', '.kgggggyygggggk.', '.kgkgkgyygkgkgk.', '.kgkgkgyygkgkgk.', '.kgggggyygggggk.', '..kggggaaggggk..', '..kkkkkkkkkkkk..', '.kyyyyyyyyyyyyk.', '.kkkkkkkkkkkkkk.'] },
  torch: { name:'Invitational Torch', cos:'emblem_inv', rows:[
    '.......kk.......', '......krrk......', '.....kroork.....', '....kroooork....', '....kroyyork....', '...kroyyyyork...', '...kroywwyork...', '..kkkkkkkkkkkk..', '..kyyyyyyyyyyk..', '...kyyyyyyyyk...', '....kbbbbbbk....', '....kaaaaaak....', '.....kbbbbk.....', '.....kbbbbk.....', '.....kbbbbk.....', '......kkkk......'] },
  wingpuck: { name:'Winged Ball', cos:'emblem_classic', rows:[
    '................', '................', '................', 'kk............kk', 'kwk..........kwk', 'kwwk........kwwk', 'kgwwk......kwwgk', '.kwgwkkkkkkwgwk.', '.kwwgkggggkgwwk.', '..kwwksssskwwk..', '...kwkaaaakwk...', '....kksssskk....', '......kkkk......', '................', '................', '................'] },
  frostcrown: { name:'Frost Crown', cos:'emblem_winter', rows:[
    '................', '.k....kkkk....k.', 'kak..kaaaak..kak', 'kaak.kaaaak.kaak', 'kaaakaaaaaakaaak', 'kaaaaaaaaaaaaaak', 'kwwwwwwwwwwwwwwk', 'kwswwswwwwswwswk', 'kkkkkkkkkkkkkkkk', '.kwk.kwkkwk.kwk.', '.kwk..kwwk..kwk.', '..k...kwwk...k..', '.......kk.......', '................', '................', '................'] },
  cup: { name:'Finale Cup', cos:'emblem_finale', rows:[
    '................', '..kkkkkkkkkkkk..', '..kyyyyyyyyyyk..', 'kkkywyyyyyywykkk', 'kyykwyyyyyywkyyk', 'ky.kyyyyyyyyk.yk', 'kyykyyyyyyyykyyk', '.kkkyyyyyyyykkk.', '...kyyyyyyyyk...', '....kyyyyyyk....', '.....kyyyyk.....', '.....kyyyyk.....', '....kaaaaaak....', '...kaaaaaaaak...', '...kkkkkkkkkk...', '................'] },
  ring: { name:'Champion Ring', cos:'emblem_po', rows:[
    '.....kkkkkk.....', '....kwwwwwwk....', '...kwgwwwwgwk...', '...kwwgwwgwwk...', '....kwwwwwwk....', '..kkykkkkkkykk..', '.kyyayyaayyayyk.', 'kyykkkkkkkkkkyyk', 'kyk..........kyk', 'kyk..........kyk', 'kyk..........kyk', 'kyyk........kyyk', '.kyykkkkkkkkyyk.', '..kyyyyyyyyyyk..', '...kkkkkkkkkk...', '................'] },
};
// expand symmetric emblems to full 16 columns
for (const k in EMBLEMS) {
  const e = EMBLEMS[k];
  if (e.sym) e.rows = e.rows.map(r => { const h = (r + '........').slice(0, 8); return h + h.split('').reverse().join(''); });
}
EMBLEMS.trident = Object.assign({}, EMBLEMS.anchor, { name: 'Anchor', hidden: true });   // the trident was retired: old saves show an anchor
const EMBLEM_IDS = Object.keys(EMBLEMS).filter(k => !EMBLEMS[k].hidden);

// name pools by hockey nation (no famous players' names): a player's first and last name come from the same pool
const NAME_POOLS = {
  CAN: { w: 30, first: ['Aaron','Adam','Aiden','Alex','Andrew','Austin','Barrett','Beckett','Ben','Blake','Brady','Brandon','Brayden','Brett','Brody','Bryce','Calder','Callum','Cam','Carter','Chase','Clayton','Coby','Cody','Cole','Colton','Connor','Corey','Craig','Curtis','Dale','Dallas','Dante','Darcy','Darren','Dawson','Dean','Declan','Derek','Devon','Doug','Dylan','Easton','Eli','Emmett','Evan','Finn','Garrett','Gavin','Gord','Graham','Grant','Greg','Hayden','Hunter','Jace','Jake','Jamie','Jared','Jaxon','Jesse','Jordan','Josh','Justin','Kade','Kane','Keegan','Kellan','Kieran','Kirk','Kyle','Landon','Lane','Levi','Liam','Logan','Luke','Mark','Mason','Matt','Max','Mitch','Murray','Nash','Nathan','Noah','Nolan','Owen','Parker','Peyton','Quinn','Reece','Reid','Rhett','Riley','Rory','Rowan','Ryan','Sawyer','Scott','Seth','Shane','Spencer','Stu','Tate','Taylor','Teague','Travis','Trent','Trey','Ty','Tyler','Wade','Wes','Wyatt','Zach'],
    last: ['Abbott','Aitken','Anderson','Armstrong','Ballantyne','Bannerman','Barclay','Baxter','Bell','Bennett','Blackwood','Bowman','Boyd','Brennan','Brodie','Buchanan','Burke','Caldwell','Cameron','Campbell','Carmichael','Chambers','Chisholm','Christie','Clarke','Coburn','Collins','Cooper','Coulter','Cowan','Craig','Crawford','Cullen','Cunningham','Dalgleish','Davidson','Dawes','Dixon','Dobson','Doyle','Drummond','Duncan','Dunlop','Dunne','Elliott','Fairweather','Falconer','Ferguson','Fisher','Fleming','Forsyth','Foster','Fraser','Gallagher','Gilchrist','Gillies','Gordon','Graves','Gretton','Gunn','Haig','Halliday','Hamilton','Harper','Hartley','Hayes','Henderson','Hogarth','Hollis','Hughes','Inglis','Ingram','Jamieson','Keane','Kennedy','Kerr','Kerrigan','Kirby','Kirkland','Laidlaw','Lawson','Lennox','Lindsay','Lockhart','Lyle','MacAskill','MacDonald','MacInnes','MacLean','MacLeod','MacPhail','Mackay','Maddox','Maitland','McAllister','McAuley','McBride','McCallum','McCrae','McFadden','McGillivray','McIntyre','McKenzie','McKinnon','McLaren','McNeil','McRae','Morrison','Muir','Munro','Murphy','Neal','Nicholson','O\'Brien','Ogilvie','Paterson','Pattison','Pearce','Pollock','Prentice','Pruitt','Quigley','Ramsay','Rankin','Renwick','Ritchie','Robertson','Ross','Russell','Sandford','Scobie','Shaw','Sinclair','Somerville','Sproule','Stewart','Strachan','Sutherland','Tait','Thorburn','Thornbury','Tolliver','Turner','Urquhart','Walker','Wallace','Walsh','Wardell','Watson','Weir','Whitlock','Wilson','Wishart','Wright','Yates','Young'] },
  QUE: { w: 13, first: ['Alain','Alexis','Andre','Antoine','Arnaud','Bastien','Benoit','Cedric','Charles','Damien','Denis','Dominic','Edouard','Emile','Eric','Etienne','Felix','Francis','Frederic','Gabriel','Guillaume','Henri','Hugo','Jacques','Jean','Jeremie','Jonathan','Julien','Justin','Laurent','Loic','Louis','Luc','Marc','Marc-Antoine','Martin','Mathieu','Maxime','Michel','Nathan','Nicolas','Noel','Olivier','Pascal','Patrice','Philippe','Pierre','Raphael','Remi','Rene','Samuel','Sebastien','Simon','Sylvain','Theo','Thomas','Vincent','William','Xavier','Yannick','Zachary'],
    last: ['Allard','Arsenault','Asselin','Beaudoin','Beaulieu','Belanger','Bergevin','Bisson','Blais','Boisvert','Bouchard','Boucher','Brassard','Brisebois','Caron','Chabot','Champagne','Charbonneau','Cloutier','Cote','Cousineau','Daigle','Demers','Deschamps','Desjardins','Dube','Dufresne','Duval','Fontaine','Fortier','Fournier','Gagne','Gagnon','Gaudet','Gauthier','Gendron','Giguere','Girard','Gosselin','Guay','Hamel','Hebert','Jolicoeur','Juneau','Labelle','Labonte','Lachance','Lacroix','Laflamme','Lalonde','Lambert','Landry','Langevin','Lapointe','Leblanc','Leclerc','Lefebvre','Lemay','Leveille','Levesque','Marcotte','Martel','Mercier','Michaud','Moreau','Morin','Nadeau','Ouellet','Ouimet','Paquette','Paradis','Pelletier','Perron','Picard','Poirier','Poulin','Proulx','Quintal','Rivard','Rochon','Rousseau','Roux','Sauve','Sevigny','Simard','Thibault','Thibodeau','Tremblay','Turcotte','Vachon','Vaillancourt','Villeneuve'] },
  USA: { w: 25, first: ['Adam','Austin','Ben','Blake','Bo','Bobby','Brady','Brian','Brock','Bryce','Caleb','Carson','Casey','Chad','Charlie','Chris','Clay','Cody','Cole','Colin','Conor','Dane','Danny','Derek','Dominic','Drew','Eli','Evan','Garrett','Gavin','Grady','Grant','Gus','Hank','Hayden','Hudson','Ike','Jack','Jake','Jason','Jesse','Jimmy','Joel','Joey','Jordan','Josh','Kent','Kevin','Kyle','Lance','Logan','Luke','Mason','Matt','Max','Mike','Miles','Nate','Nick','Noah','Ollie','Owen','Pat','Pete','Ray','Reese','Rob','Ryan','Sam','Sean','Seth','Shane','Spencer','Tanner','Tate','Ted','Todd','Tommy','Tony','Travis','Trevor','Troy','Tucker','Vinny','Walt','Wes','Will','Zane'],
    last: ['Adler','Bailey','Barnes','Bauman','Becker','Boland','Brandt','Brennan','Brooks','Burns','Byrne','Callahan','Carter','Cassidy','Coleman','Conley','Cox','Crowley','Dalton','Daly','Dempsey','Donovan','Driscoll','Duffy','Egan','Erickson','Fischer','Fitzgerald','Flynn','Foley','Gaffney','Gallo','Garner','Gibson','Gorski','Grady','Hagen','Haggerty','Halvorsen','Hanson','Harris','Healy','Hendricks','Hogan','Holmes','Jablonski','Jensen','Johnson','Kaminski','Keller','Kelly','Kenney','Kowal','Kowalski','Kramer','Kurtz','Larson','Lindahl','Lucas','Lynch','Madden','Maguire','Mahoney','Malone','McCarthy','Miller','Mitchell','Moran','Mulroney','Nelson','Nolan','Novotny','Nowak','O\'Connell','O\'Hara','Olson','Palmer','Peterson','Pratt','Pulaski','Quinn','Reilly','Reynolds','Riley','Rooney','Ryan','Sanders','Schmidt','Shea','Sheehan','Sorensen','Stanton','Stark','Strand','Sullivan','Swanson','Thompson','Tierney','Vance','Vaughn','Vogel','Wagner','Walsh','Ward','Whitman','Wozniak','Yoder','Zimmer'] },
  SWE: { w: 8, first: ['Adrian','Albin','Alfred','Alvin','Andreas','Anton','Arvid','Axel','Bjorn','Carl','David','Edvin','Einar','Elias','Emil','Erik','Filip','Fredrik','Gabriel','Gustav','Hampus','Henrik','Hugo','Isak','Jacob','Jesper','Joel','Johan','Jonas','Kalle','Kasper','Lars','Leo','Liam','Linus','Lucas','Ludvig','Magnus','Mats','Mattias','Max','Melker','Niklas','Nils','Oliver','Olle','Oscar','Pontus','Rasmus','Robin','Samuel','Sixten','Theo','Viktor','Vilhelm','William'],
    last: ['Ahlberg','Akerlund','Almqvist','Andersson','Backlund','Berg','Bergman','Bjorklund','Blomqvist','Brannstrom','Carlsson','Dahlgren','Edlund','Ekholm','Eklund','Ekstrom','Engstrom','Falk','Forsman','Frisk','Granlund','Gustafsson','Hagman','Hedlund','Hellberg','Hjalmarsson','Hoglund','Holm','Isaksson','Johansson','Jonsson','Karlsson','Kronberg','Lagerqvist','Larsson','Lind','Lindgren','Lindqvist','Ljungberg','Lofgren','Lundin','Magnusson','Malmberg','Mattsson','Nilsson','Norberg','Nordin','Nordqvist','Nyberg','Ohlin','Olofsson','Ostlund','Persson','Rosen','Sandberg','Sandstrom','Sjoberg','Sjostrom','Soderberg','Stenberg','Strand','Sundqvist','Svensson','Tornqvist','Ulmer','Wahlberg','Wallin','Westerlund','Wikstrom','Zetter'] },
  FIN: { w: 7, first: ['Aatu','Aleksi','Antti','Arttu','Eemeli','Eetu','Elmeri','Hannes','Henri','Iiro','Ilmari','Jaakko','Jani','Janne','Jarkko','Jere','Jesse','Joni','Joonas','Juho','Juuso','Kalle','Kari','Kasperi','Lassi','Lauri','Leevi','Markus','Matias','Mikko','Miro','Niklas','Olli','Onni','Oskari','Otto','Patrik','Pekka','Petteri','Rasmus','Roope','Sami','Santeri','Tapio','Teemu','Topi','Tuomas','Tuukka','Urho','Valtteri','Veli','Ville'],
    last: ['Aaltonen','Ahonen','Eskola','Hakala','Halonen','Hamalainen','Harju','Heikkila','Heikkinen','Heino','Hiltunen','Huttunen','Hyvonen','Jarvi','Jokela','Kallio','Karjalainen','Kemppainen','Kettunen','Kinnunen','Koivula','Korhonen','Koskinen','Kukkonen','Lahti','Laitinen','Lampinen','Lehtonen','Leinonen','Lindroos','Makela','Manninen','Mattila','Miettinen','Mustonen','Niemi','Nieminen','Nurmi','Ojala','Peltonen','Pesonen','Rantala','Repo','Saarinen','Salminen','Salonen','Seppala','Suominen','Toivonen','Turunen','Vaara','Vainio','Valimaki','Virtanen'] },
  RUS: { w: 7, first: ['Aleksandr','Alexei','Andrei','Anton','Arseni','Artem','Bogdan','Boris','Daniil','Danila','Denis','Dmitri','Egor','Fyodor','Gleb','Grigori','Igor','Ilya','Ivan','Kirill','Konstantin','Leonid','Matvei','Maxim','Mikhail','Nikita','Nikolai','Oleg','Pavel','Pyotr','Roman','Ruslan','Semyon','Sergei','Stanislav','Stepan','Timur','Vadim','Valeri','Vasili','Viktor','Vlad','Vladimir','Yaroslav','Yuri','Zakhar'],
    last: ['Abramov','Alekseev','Antonov','Baranov','Belov','Belyaev','Bogdanov','Borisov','Chernov','Danilov','Dorofeev','Egorov','Fedotov','Fomin','Frolov','Gavrilov','Golubev','Grigoriev','Gusev','Ivanov','Karpov','Kiselev','Komarov','Kozlov','Kuzmin','Lebedev','Makarov','Medvedev','Melnikov','Mironov','Morozov','Nesterov','Nikolaev','Novikov','Orlov','Pavlov','Petrov','Polyakov','Popov','Romanov','Rybakov','Semenov','Smirnov','Sokolov','Stepanov','Tarasov','Titov','Vasiliev','Vinogradov','Volkov','Yakovlev','Zaitsev','Zakharov','Zhukov'] },
  CZE: { w: 6, first: ['Adam','Ales','Daniel','David','Dominik','Filip','Jakub','Jan','Jaroslav','Jiri','Josef','Karel','Krystof','Ladislav','Libor','Lukas','Marcel','Marek','Martin','Matej','Michal','Milan','Miroslav','Oldrich','Ondrej','Patrik','Pavel','Petr','Radek','Robert','Roman','Simon','Stanislav','Tomas','Vaclav','Vit','Vojtech','Zdenek'],
    last: ['Bartos','Bednar','Benes','Blaha','Cermak','Cerny','Dolezal','Dvorak','Fiala','Fiser','Hajek','Holub','Horak','Hruska','Hudacek','Jandera','Jelinek','Kadlec','Klima','Kolar','Kopecky','Kovar','Kral','Kratochvil','Kubik','Kucera','Machala','Marek','Mares','Moravec','Musil','Novak','Pokorny','Polak','Pospisil','Prochazka','Rehak','Ruzicka','Sedlak','Simek','Soukup','Svoboda','Sykora','Tichy','Urban','Vacek','Vesely','Vlcek','Zak','Zeman'] },
  EUR: { w: 4, first: ['Andreas','Dominik','Elias','Fabian','Felix','Frederik','Gints','Janis','Jonas','Kevin','Kristaps','Lars','Leon','Lino','Luca','Lukas','Mads','Marco','Martins','Mathias','Mikkel','Moritz','Nico','Nikolaj','Oskar','Raphael','Reto','Rudolfs','Sander','Sven','Tim','Tobias','Yannick'],
    last: ['Andersen','Bauer','Baumann','Berzins','Brunner','Egli','Fehr','Fischer','Frei','Gerber','Graf','Haas','Hansen','Hoffmann','Huber','Jansons','Jorgensen','Kalnins','Keller','Kristiansen','Kruger','Larsen','Lindberg','Lorenz','Meier','Muller','Nielsen','Olsen','Ozols','Pedersen','Rasmussen','Ritter','Schmid','Schneider','Seiler','Sprukts','Thomsen','Vogt','Weber','Wolf','Zimmermann','Zubers'] },
  SVK: { w: 3, first: ['Adam','Andrej','Branislav','Dalibor','Erik','Filip','Jakub','Juraj','Kristian','Lubomir','Marian','Martin','Matus','Michal','Milos','Patrik','Peter','Richard','Samuel','Simon','Tomas','Viliam'],
    last: ['Bartek','Benko','Cesnak','Danko','Duris','Gajdos','Galik','Hanuska','Hornak','Hudec','Jurcik','Kollar','Kral','Lukac','Marcek','Mihalik','Orsag','Polacek','Repka','Sloboda','Sulik','Tomek','Uhrin','Varga','Zelenak'] },
};
// draws first and last names separately; any pairing that matches a famous footballer or NHL player (realnames.js) is drawn again
function genName(rng = Math.random) { for (let i = 0; i < 40; i++) { const n = genName0(rng); if (typeof isRealPlayerName !== 'function' || (!isRealPlayerName(n.first, n.last) && !isSignatureLast(n.last))) return n; } return { first: 'Alex', last: 'Smith', nat: 'CAN' }; }
function genName0(rng = Math.random) { let r = rng() * Object.values(NAME_POOLS).reduce((a, p) => a + p.w, 0); for (const [nat, p] of Object.entries(NAME_POOLS)) { r -= p.w; if (r < 0) return { first: pickR(p.first, rng), last: pickR(p.last, rng), nat }; } return { first: 'Alex', last: 'Smith', nat: 'CAN' }; }
const FIRST_NAMES = [...new Set(Object.values(NAME_POOLS).flatMap(p => p.first))], LAST_NAMES = [...new Set(Object.values(NAME_POOLS).flatMap(p => p.last))];

// attribute keys
const SK_ATTRS = [
  ['spd', 'Speed'], ['sta', 'Stamina'], ['pow', 'Shot Power'], ['acc', 'Accuracy'], ['pas', 'Passing'], ['stk', 'Dribbling'], ['def', 'Defense'], ['chk', 'Tackling'], ['fo', 'Set Pieces'],
];
const G_ATTRS = [
  ['ref', 'Reflexes'], ['pos', 'Positioning'], ['reb', 'Rebound Ctrl'], ['rec', 'Recovery'], ['sta', 'Stamina'],
];
const ARCHETYPES = {
  speedster: { name:'Speedster',            mods:{ spd:3, sta:1, stk:1, pow:-1, chk:-1 } },
  sniper:    { name:'Sniper',               mods:{ pow:2, acc:3, stk:1, def:-1, chk:-1 } },
  defensive: { name:'Defensive Specialist', mods:{ def:3, chk:1, pas:1, acc:-1, pow:-1, stk:-1 } },
  enforcer:  { name:'Physical Hard man',    mods:{ chk:3, pow:1, sta:1, acc:-1, spd:-1, stk:-2 } },
  playmaker: { name:'Playmaker',            mods:{ pas:3, acc:1, spd:1, stk:2, chk:-1, pow:-1, fo:1 } },
  balanced:  { name:'Balanced Player',      mods:{} },
  goalie:    { name:'Keeper Prospect',      mods:{} },
};

// ====================================================================
//  BALANCE TABLE: every tunable gameplay number in one place (Debug Mode edits a copy; RESET restores these)
// ====================================================================
const BAL = {
  card:  { straightRed: 0.15 },                                         // SOCCER: chance a foul from behind is a straight red
  pen:   { len: 30, trip: 0.1, behindMul: 1, shotZone: 'def' },          // timed minor = 30 game seconds; trip chance on a missed poke at a fast carrier
  pull:  { downOne: 11, downTwo: 18, minPeriod: 3 },                        // AI pulls its goalie with this many game seconds left (3rd period / OT never)
  fight: { maxPerTeam: 3, cooldown: 30, refuseSec: 10, refuseMul: 0.05, momentumSec: 10, momentumMul: 0.05, maxSec: 15, window: 210, aiChallenge: 0.3, simRate: 0.09, aiFaceoff: 0.0015 },
  inj:   { bigHit: 0.045, fight: 0.05, minor: [10, 30], moderate: [30, 60], pMinor: 0.70, pModerate: 0.24, carry: 0.40, carryGames: [1, 4], simRate: 0.10 },
  cond:  { base: 2.5, perMin: 2.2, tour: 1.5, recover: 7, rest: 30, start: 92 },
  minSkaters: 6,
  train: { chance: 0.35 },
  trait: { postgame: 0.008, event: 0.05, offseason: 0.06, reroll: 0.65, max: 3 },
  lead:  { assistMul: 0.6, naturalMul: 1.35, goalieAura: 0.5 },   // a goalie with a letter: his aura lifts whoever is out there, at half strength, when no skater leader is on
  morale: { refuseMul: 0.05, momentumMul: 0.05 },
};
const BAL_DEFAULTS = JSON.parse(JSON.stringify(BAL));
function resetBalance() { for (const k of Object.keys(BAL_DEFAULTS)) BAL[k] = JSON.parse(JSON.stringify(BAL_DEFAULTS[k])); }
// condition bands: label, minimum, performance penalty (fraction of each attribute), injury-risk multiplier
const COND_BANDS = [['Fresh', 80, 0, 1], ['Ready', 60, 0.015, 1.05], ['Tired', 40, 0.035, 1.25], ['Exhausted', 0, 0.06, 1.6]];
const condBand = c => COND_BANDS.find(b => (c ?? 100) >= b[1]) || COND_BANDS[3];

// ====================================================================
//  PLAYER TRAITS (max 3 per player). Every trait is a benefit; a few carry a small drawback.
//  mods: always-on attribute bonuses   when: 'clutch' (3rd/OT, within a goal) | 'trailing' | 'bigGame' (playoffs & tournaments)
//  fight: pow/dodge/bal/chin/counter/scare modifiers   injMul/condMul/stunMul/penMul/drainMul/devMul: multipliers
//  onIce: bonus to teammates on the ice with him    oppIce: change to opponents on the ice with him
// ====================================================================
const TRAITS = {
  sharpshooter:  { name: 'Sharpshooter', pos: 'S', rarity: 2, icon: '◎', desc: 'Picks corners: +Accuracy, +Shot Power.', mods: { acc: 0.7, pow: 0.3 } },
  playmaker:     { name: 'Playmaker', pos: 'S', rarity: 2, icon: '➹', desc: 'Sees the pitch: +Passing, +Dribbling.', mods: { pas: 0.8, stk: 0.2 } },
  speedster:     { name: 'Speedster', pos: 'S', rarity: 2, icon: '»', desc: 'Explosive stride: +Speed.', mods: { spd: 0.7 } },
  iron_lungs:    { name: 'Iron Lungs', pos: 'S', rarity: 1, icon: '◌', desc: 'Never gasses out: +Stamina, slower fatigue, recovers condition faster.', mods: { sta: 0.6 }, drainMul: 0.85, condMul: 0.85 },
  def_spec:      { name: 'Defensive Specialist', pos: 'S', rarity: 1, icon: '⛨', desc: 'Shuts down lanes: +Defense, +Tackling.', mods: { def: 0.8, chk: 0.2 } },
  rebound_hunter:{ name: 'Rebound Hunter', pos: 'S', rarity: 1, icon: '↺', desc: 'Lives at the six-yard box: bigger pickup range on rebounds, more second chances.', mods: { acc: 0.2 }, rebound: 3 },
  clutch:        { name: 'Clutch Performer', pos: 'S', rarity: 3, icon: '★', desc: 'Late in close games: +Accuracy, +Shot Power, +Dribbling.', when: 'clutch', mods: { acc: 0.7, pow: 0.6, stk: 0.4 } },
  comeback:      { name: 'Comeback Artist', pos: 'S', rarity: 2, icon: '↑', desc: 'When his team trails: +Speed, +Accuracy, +Passing.', when: 'trailing', mods: { spd: 0.5, acc: 0.5, pas: 0.3 } },
  enforcer:      { name: 'Hard man', pos: 'S', rarity: 2, icon: '✊', desc: 'Throws heavy: +Tackling, stronger punches, steadier in scuffles.', mods: { chk: 0.6 }, fight: { pow: 0.2, bal: 0.1 } },
  protector:     { name: 'Protector', pos: 'S', rarity: 2, icon: '⛉', desc: 'Has his teammates\' backs: linemates +Defense; scuffles harder for them.', onIce: { def: 0.25 }, fight: { pow: 0.1, bal: 0.1 } },
  hotheaded:     { name: 'Hotheaded', pos: 'S', rarity: 1, icon: '♨', desc: 'Plays on the edge: +Tackling, harder challenges. Minor drawback: takes more penalties.', mods: { chk: 0.6 }, fight: { pow: 0.15 }, penMul: 1.3 },
  disciplined:   { name: 'Disciplined', pos: 'S', rarity: 1, icon: '⚖', desc: 'Clean and smart: far fewer penalties, +Defense.', mods: { def: 0.3 }, penMul: 0.55 },
  iron_chin:     { name: 'Iron Ankles', pos: 'S', rarity: 2, icon: '◆', desc: 'Shrugs off knocks: fewer injuries, back up quicker.', fight: { chin: 0.35 }, injMul: 0.8, stunMul: 0.85 },
  counterpuncher:{ name: 'Aerial Threat', pos: 'S', rarity: 2, icon: '⤺', desc: 'Dominant in the air: wins more headers and crosses.', fight: { dodge: 0.25, counter: 0.5 } },
  steady_footing:{ name: 'Steady Footing', pos: 'S', rarity: 1, icon: '▣', desc: 'Hard to knock over: shorter stuns from hits, better scuffle balance, +Defense.', mods: { def: 0.2 }, stunMul: 0.7, fight: { bal: 0.25 } },
  intimidating:  { name: 'Intimidating', pos: 'S', rarity: 3, icon: '☠', desc: 'Opponents on the pitch with him lose Accuracy and Dribbling; few will scuffle him.', oppIce: { acc: -0.25, stk: -0.2 }, fight: { scare: 0.3 } },
  natural_leader:{ name: 'Natural Leader', pos: 'S', rarity: 3, icon: '♛', desc: 'Wearing a letter, his leadership style is 35% stronger.', leadMul: 1.35 },
  durable:       { name: 'Durable', pos: 'any', rarity: 1, icon: '✚', desc: 'Built to last: far fewer injuries, slower condition loss.', injMul: 0.55, condMul: 0.75 },
  tough:         { name: 'Tough', pos: 'S', rarity: 1, icon: '▲', desc: 'Shrugs off hits: shorter stuns, fewer injuries, +Tackling, steadier in scuffles.', mods: { chk: 0.2 }, stunMul: 0.75, injMul: 0.85, fight: { bal: 0.1, chin: 0.1 } },
  veteran:       { name: 'Veteran Presence', pos: 'S', rarity: 3, icon: '⌛', desc: 'Calms the bench: linemates +Passing, +Defense. Earned with age and games.', onIce: { pas: 0.2, def: 0.2 }, earnedOnly: true },
  rink_rat:      { name: 'Pitch Rat', pos: 'any', rarity: 1, icon: '⚙', desc: 'First on, last off: develops faster, +Stamina.', mods: { sta: 0.2 }, devMul: 1.5 },
  brick_wall:    { name: 'Brick Wall', pos: 'G', rarity: 2, icon: '▦', desc: 'Squares up: +Positioning, +Rebound Control.', mods: { pos: 0.7, reb: 0.4 } },
  acrobat:       { name: 'Acrobat', pos: 'G', rarity: 2, icon: '✶', desc: 'Spectacular reach: +Reflexes, +Recovery.', mods: { ref: 0.7, rec: 0.5 } },
  big_game:      { name: 'Big-Game Keeper', pos: 'G', rarity: 3, icon: '♜', desc: 'Rises in playoffs and tournaments: +Reflexes, +Positioning.', when: 'bigGame', mods: { ref: 0.6, pos: 0.4 } },
};
// pairs (or larger groups) that may never coexist on one player
const TRAIT_GROUPS = [
  ['hotheaded', 'disciplined'],          // temperament
  ['brick_wall', 'acrobat'],             // goaltending style
  ['sharpshooter', 'playmaker'],         // offensive identity
  ['speedster', 'enforcer'],             // build
];
const traitConflicts = (a, b) => a === b || TRAIT_GROUPS.some(g => g.includes(a) && g.includes(b));
const traitFits = (p, id) => { const t = TRAITS[id]; return !!t && (t.pos === 'any' || (t.pos === 'G') === (p.pos === 'G')); };
function canAddTrait(p, id) {
  const tr = p.traits || [];
  return traitFits(p, id) && tr.length < BAL.trait.max && !tr.some(x => traitConflicts(x, id));
}

// ====================================================================
//  LEADERSHIP STYLES: a personal bonus for the leader + an aura for linemates on the ice with him.
//  One aura per team at a time: the captain's if he is on the ice, otherwise one alternate's. Assistants are 60% strength.
//  aura keys: attribute bonuses, low3 (each linemate's three lowest attributes), all, goalie (own goalie's pos/ref),
//  late (3rd period / OT only), trailing (only while behind), recover (bench recovery and stamina drain)
// ====================================================================
const LEAD_STYLES = {
  general:      { name: 'The General', desc: 'Organises everyone: +Defense himself; each linemate\'s three weakest attributes improve.', personal: { def: 0.6 }, aura: { low3: 0.5 } },
  sharpshooter: { name: 'The Sharpshooter', desc: 'Leads by scoring: +Accuracy himself; linemates gain Shot Power and Accuracy.', personal: { acc: 0.6 }, aura: { pow: 0.35, acc: 0.35 } },
  enforcer:     { name: 'The Hard man', desc: 'Sets the physical tone: +Tackling himself; linemates gain Tackling and Defense.', personal: { chk: 0.6 }, aura: { chk: 0.35, def: 0.35 } },
  champion:     { name: 'The Champion', desc: 'Steady presence: +Stamina himself; linemates gain a little of everything and recover faster.', personal: { sta: 0.6 }, aura: { all: 0.15, recover: 0.15 } },
  maestro:      { name: 'The Maestro', unlock: 'franchise', desc: 'Conducts the attack: +Passing himself; linemates gain Passing and Dribbling.', personal: { pas: 0.6 }, aura: { pas: 0.35, stk: 0.35 } },
  jet:          { name: 'The Jet', unlock: 'franchise', desc: 'Pushes the pace: +Speed himself; linemates gain Speed and Stamina.', personal: { spd: 0.6 }, aura: { spd: 0.35, sta: 0.2 } },
  wall:         { name: 'The Wall', unlock: 'franchise', desc: 'Protects the six-yard box: +Defense and Tackling himself; linemates gain Defense and your keeper plays sharper.', personal: { def: 0.4, chk: 0.2 }, aura: { def: 0.3, goalie: 0.35 } },
  spark:        { name: 'The Spark Plug', unlock: 'franchise', desc: 'Never quits: +Dribbling himself; when trailing, linemates gain a big all-round boost.', personal: { stk: 0.6 }, aura: { trailing: 0.45 } },
  legend:       { name: 'The Legend', unlock: 'player', desc: 'A franchise icon (earned, his alone): +All attributes himself; linemates rise in the second half and extra time.', personal: { all: 0.3 }, aura: { late: 0.5 } },
  iron:         { name: 'The Iron Man', unlock: 'player', desc: 'Hundreds of games (earned, his alone): +Stamina and Defense himself; linemates tire far less.', personal: { sta: 0.6, def: 0.2 }, aura: { recover: 0.35, def: 0.15 } },
  // goalies only: their own four (a goalie with a letter is always out there, so his aura works at half strength
  // whenever no skater with a letter is on the ice; his personal bonus goes to his goalie ratings)
  backbone:     { name: 'The Backbone', gk: true, desc: 'Calm in the six-yard box: +Positioning himself; every player\'s three weakest attributes improve.', personal: { pos: 0.6 }, aura: { low3: 0.5 } },
  brickwall:    { name: 'The Brick Wall', gk: true, desc: 'Nothing gets by him: +Reflexes himself; the players in front of him gain Defense and Tackling.', personal: { ref: 0.6 }, aura: { def: 0.35, chk: 0.35 } },
  quarterback:  { name: 'The Quarterback', gk: true, desc: 'Starts the rush: +Rebound control himself; players gain Passing and Speed for quick breakouts.', personal: { reb: 0.6 }, aura: { pas: 0.35, spd: 0.35 } },
  rock:         { name: 'The Rock', gk: true, desc: 'Never rattled: +Recovery himself; players gain a little of everything and recover faster.', personal: { rec: 0.6 }, aura: { all: 0.15, recover: 0.15 } },
};
const BASE_STYLES = ['general', 'sharpshooter', 'enforcer', 'champion'];
const G_BASE_STYLES = ['backbone', 'brickwall', 'quarterback', 'rock'];
