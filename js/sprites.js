/* ==========================================================================
   sprites.js — pixel-art sprite definitions & pre-rendering
   Each sprite is an array of strings; every char maps to a palette color.
   ========================================================================== */
const PAL = {
  '.': null,
  K: '#0f1014', k: '#2a2d36', W: '#f4f2ea', w: '#c9c6bb',
  S: '#e7b78e', s: '#b98457', D: '#3a2a20',
  B: '#3159a3', b: '#23407a', J: '#3d4257', j: '#2b2f3f',
  G: '#63a04a', g: '#3f6b2f', H: '#8bc46e',
  R: '#d3372b', r: '#8a1f18', O: '#ee8b2b', o: '#b85a14',
  Y: '#f5c518', y: '#b48a0e', P: '#9b4fd6', p: '#5f2e8a',
  T: '#6d8a4b', t: '#4a6033', M: '#7c8290', m: '#4a4f5c', L: '#a7adba',
  N: '#a0753f', n: '#6b4b26', Z: '#ff6a2a', E: '#34a5e5', e: '#1d6fa8',
};
const FLESH_PAL = { R: '#b0402e', r: '#7a2418', P: '#d47a6a', M: '#7c8290', m: '#4a4f5c', K: '#1a0c08' };
const BEAST_PAL = { M: '#7a3a28', L: '#a05a40', H: '#b8684a', D: '#4a2418', E: '#f5f0b0', T: '#e8dcc0', N: '#c9b48a', K: '#1a0c08' };

const SPRITE_DATA = {
  player: [
    '......KKKK......',
    '.....KDDDDK.....',
    '....KDDDDDDK....',
    '....KDSSSSSK....',
    '....KSKSSKSK....',
    '....KSSSSSSK....',
    '.....KSssSK.....',
    '....KBBBBBBK....',
    '...KBBBBBBBBK...',
    '..KSKBBBBBBKSK..',
    '..KKKBbBBbBKKK..',
    '....KJJJJJJK....',
    '....KJJKKJJK....',
    '....KJJK.KJJK...',
    '....KKKK.KKKK...',
    '................',
  ],
  zombie: [
    '......KKKK......',
    '.....KGGGGK.....',
    '....KGGGGGGK....',
    '....KGRGGRGK....',
    '....KGGGGGGK....',
    '.....KgGGgK.....',
    '....KJJJJJJK....',
    '..KGKJJJJJJKGK..',
    '.KGGKJJJJJJKGGK.',
    '.KKK.KJJJJK.KKK.',
    '.....KJJJJK.....',
    '.....KjjjjK.....',
    '.....KjjKjK.....',
    '.....KjjK.KjK...',
    '.....KKK..KKK...',
    '................',
  ],
  gun_pistol: [
    '................',
    '.....KKKKKKKK...',
    '....KLMMMMMMMK..',
    '....KKKmmKKKKK..',
    '......KnnK......',
    '......KnnK......',
    '......KKKK......',
    '................',
  ],
  gun_shotgun: [
    '................',
    '.KKKKKKKKKKKKKKK',
    'KNNNKMMMMMMMMMMK',
    'KNNNNKmmKKKKKKK.',
    '.KKKKKNNK.......',
    '.....KnnK.......',
    '.....KKKK.......',
    '................',
  ],
  gun_smg: [
    '................',
    '...KKKKKKKKKK...',
    '..KMMMMMMMMMMK..',
    '..KKKKmmKKKKKKK.',
    '....KmmmKKKK....',
    '....KmmmK.......',
    '....KKKKK.......',
    '................',
  ],
  gun_rifle: [
    '................',
    'KKKKKKKKKKKKKKKK',
    'KNNNKMMMMMMLMMMK',
    'KNNNNKmmKKKKKKKK',
    '.KKKKKmmKK.KK...',
    '.....KmmmK......',
    '.....KKKKK......',
    '................',
  ],
  gun_rocket: [
    '..KKKKKKKKKKKK..',
    '.KTTTTTTTTTTTTKK',
    'KTtTTTTTTTTTTKRK',
    'KTTTTTTTTTTTTKRK',
    '.KKKKKKKKKKKKKK.',
    '......KmmK......',
    '......KmmK......',
    '......KKKK......',
  ],
  gun_magnum: [
    '................',
    '....KKKKKKKKKKK.',
    '...KLLLLLLLLLLLK',
    '...KKKmmKKKKKKK.',
    '.....KmmKK......',
    '.....KnnK.......',
    '.....KKKK.......',
    '................',
  ],
  gun_flamer: [
    '................',
    '.KKKKKKKKKKKKKK.',
    'KRRRRRKMMMMMMMOK',
    'KrrrrrKKmmKKKKK.',
    '.KKKKKKmmK......',
    '......KmmK......',
    '......KKKK......',
    '................',
  ],
  gun_minigun: [
    '................',
    '..KKKKKKKKKKKKK.',
    '.KmMMMMMMMMMMMMK',
    '.KmKKKKKKKKKKKKK',
    '.KmMMMMMMMMMMMMK',
    '.KKKmmKKKKKKKKK.',
    '....KmmK........',
    '....KKKK........',
  ],
  heart_full: ['.KK..KK..','KRRKKRRK.','KRRRRRRK.','KRRRRRRK.','.KRRRRK..','..KRRK...','...KK....','.........'],
  heart_half: ['.KK..KK..','KRRKKkkK.','KRRRkkkK.','KRRRkkkK.','.KRRkkK..','..KRkK...','...KK....','.........'],
  heart_empty:['.KK..KK..','KkkKKkkK.','KkkkkkkK.','KkkkkkkK.','.KkkkkK..','..KkkK...','...KK....','.........'],
  pickup_health: [
    '.KKKKKKKKKK.','KRRRRWWRRRRK','KRRRRWWRRRRK','KRRWWWWWWRRK','KRRWWWWWWRRK','KRRRRWWRRRRK',
    'KRRRRWWRRRRK','KRrrrrrrrrrK','.KKKKKKKKKK.','............','............','............',
  ],
  pickup_ammo: [
    '............','..K..K..K...','.KYK.KYK.KYK','.KYK.KYK.KYK','.KYK.KYK.KYK','.KyK.KyK.KyK',
    '.KyK.KyK.KyK','.KMK.KMK.KMK','.KMK.KMK.KMK','.KKK.KKK.KKK','............','............',
  ],
  pickup_coin: [
    '....KKKK....','..KKYYYYKK..','.KYYYYYYYYK.','.KYYyyyyYYK.','KYYyYYYYyYYK','KYYyYKKYyYYK',
    'KYYyYKKYyYYK','KYYyYYYYyYYK','.KYYyyyyYYK.','.KyYYYYYYyK.','..KKyyyyKK..','....KKKK....',
  ],
  pickup_xp: [
    '.KKKKKKKKKK.','KGGGGGGGGGGK','KGGGGWWGGGGK','KGGGWWWWGGGK','KGGWWWWWWGGK','KGWWWWWWWWGK',
    'KGGGGWWGGGGK','KGGGGWWGGGGK','KGGGGWWGGGGK','KGgggggggggK','.KKKKKKKKKK.','............',
  ],
  pickup_crate: [
    '.KKKKKKKKKK.','KNNNNNNNNNNK','KNKNNNNNNKNK','KNNKNNNNKNNK','KNNNKNNKNNNK','KNNNNKKNNNNK',
    'KNNNNKKNNNNK','KNNNKNNKNNNK','KNNKNNNNKNNK','KNKnnnnnnKnK','KnnnnnnnnnnK','.KKKKKKKKKK.',
  ],
  icon_damage: [
    '.KKKKKKKKKK.','KRRRRRRRRRRK','KRRWRRRRWRRK','KRRRWRWRWRRK','KRRRRWWWRRRK','KRWWWWWWWWRK',
    'KRRRRWWWRRRK','KRRRWRWRWRRK','KRRWRRRRWRRK','KRRRRRRRRRRK','KrrrrrrrrrrK','.KKKKKKKKKK.',
  ],
  icon_firerate: [
    '.KKKKKKKKKK.','KEEEEEEEEEEK','KEWEEEWEEEEK','KEEWEEEWEEEK','KEEEWEEEWEEK','KEEEEWEEEWEK',
    'KEEEWEEEWEEK','KEEWEEEWEEEK','KEWEEEWEEEEK','KEEEEEEEEEEK','KeeeeeeeeeeK','.KKKKKKKKKK.',
  ],
  icon_maxhp: [
    '.KKKKKKKKKK.','KGGGGGGGGGGK','KGGWWGGWWGGK','KGWWWWWWWWGK','KGWWWWWWWWGK','KGGWWWWWWGGK',
    'KGGGWWWWGGGK','KGGGGWWGGGGK','KGGGGGGGGGGK','KGGGGGGGGGGK','KgggggggggGK','.KKKKKKKKKK.',
  ],
  icon_speed: [
    '.KKKKKKKKKK.','KYYYYYYYYYYK','KYYYKKKYYYYK','KYYKnnnKYYYK','KYYKnnnKYYYK','KYYKnnnnKYYK',
    'KYYKnnnnnKYK','KYKnnnnnnKYK','KYKKKKKKKKYK','KYYYYYYYYYYK','KyyyyyyyyyyK','.KKKKKKKKKK.',
  ],
  crown: ['K.K.K','KYKYK','KYYYK','KKKKK'],
  gun_flesh: [
    '.KKKKK..................',
    '.KMmmMKKKKKKKKKKKKKKKKK.',
    'KMRRPPRKmmmmmmmmmmmmmmmK',
    'KRRPPPRKMMMMMMMMMMMMMMMK',
    'KKRRPPRRRKKKKKKKKKKKKKK.',
    '.KrRRRPPRRKKK...........',
    '..KKrrRRPPRRRK..........',
    '...KmKKrRRPRRK..........',
    '...KmK.KKrRRK...........',
    '...KKK...KKK............',
  ],
  soldier: [
    '.....KKKKKKK....',
    '....KAAAAAAAK...',
    '...KAAAAAAAAAK..',
    '....KGRGGRGK....',
    '....KGGGGGGK....',
    '.....KgGGgK.....',
    '....KCCCCCCK....',
    '..KGKCCCCCCKGK..',
    '.KGGKCCCCCCKGGK.',
    '.KKK.KCCCCK.KKK.',
    '.....KCCCCK.....',
    '.....KccccK.....',
    '.....KccKcK.....',
    '.....KccK.KcK...',
    '.....KKK..KKK...',
    '................',
  ],
  gun_cannon: [
    '................',
    '..KKKKKKKKKKKKK.',
    '.KmMMMMMMMMMMMMK',
    '.KmmmmmmmmmmmmmK',
    '.KKKmmKKKKKKKKK.',
    '...KmmK.........',
    '...KmmK.........',
    '...KKKK.........',
  ],
  gun_m249: [
    '.....KK.............',
    '....KmmK..KKKK......',
    'KKKKKmmKKKKmmKKKKKKK',
    'KmmmmmmmmmmmmmmmmmmK',
    'KMmmKKKmmmmKmmmmmKKK',
    '.KKK.KmmK.KNNK.KmK..',
    '.....KKKK.KKKK.KKK..',
    '....................',
  ],
  samay: [
    '....HHHHHHH.....',
    '...HhHHHhHHH....',
    '..HHHHHHHHHHH...',
    '..HHSSSSSSSHH...',
    '...HSKSSSKSH....',
    '...HSSSSSSSH....',
    '...HsSsssSsH....',
    '....HsssssH.....',
    '...KRKRKRKRKm...',
    '..KSKRKRKRKKMK..',
    '..KKKRKRKRKRKK..',
    '....KJJJJJJK....',
    '....KJJKKJJK....',
    '....KJJK.KJJK...',
    '....KNNK.KNNK...',
    '................',
  ],
  samay_portrait: [
    '.......HHHHHHHHHH.......',
    '.....HHHhHHHHHhHHHH.....',
    '....HHHHHHhHHHHHHhHH....',
    '...HHhHHHHHHHHHHHHHHH...',
    '...HHHHHHHHHHHHHHHHHH...',
    '..HHHHHSSSSSSSSSSHHHHH..',
    '..HHHHSSSSSSSSSSSSHHHH..',
    '..HHHSSSSSSSSSSSSSSHHH..',
    '..HHHSSKKSSSSSSKKSSHHH..',
    '..HHHSSSSSSSSSSSSSSHHH..',
    '...HHSSSSSSsSSSSSSSHH...',
    '...HHSSSSSSSSSSSSSSHH...',
    '....HSsssSSSSSSSsssSH...',
    '....HSsssssWWWWsssssH...',
    '....HssssssssssssssH....',
    '.....HsssssssssssssH....',
    '......HsssssssssssH.....',
    '.......HHsssssssHH......',
    '....KRKRKKKHHHKKKRKRK...',
    '...KRKRKRKRKKKRKRKRKRK..',
    '..KRKRKRKRKRKRKRKRKRKRK.',
    '..KRKRKRKRKRKRKRKRKRKRK.',
    '..KRKRKRKRKRKRKRKRKRKRK.',
    '........................',
  ],
  spidermad: [
    '.....KKKKKK.....',
    '....KRRKRRRK....',
    '...KRRKRWWRRK...',
    '...KRKRRWKWRK...',
    '...KRRRKRRRRK...',
    '....KRRKRRRK....',
    '.....KRRRRK.....',
    '....KRRRRRRK....',
    '...KBKRRKRRKBK..',
    '..KBBKRKKKRKBBK.',
    '..KKKKRRKRRKKKK.',
    '....KRRRRRRK....',
    '....KBBKKBBK....',
    '....KBBK.KBBK...',
    '....KKKK.KKKK...',
    '................',
  ],
  spidermad_portrait: [
    '.......KKKKKKKKK........',
    '.....KKRRRRRRRRRKK......',
    '....KRRRKRRRKRRRRRK.....',
    '...KRRRRKRRRKRRRRRRK....',
    '...KRKRRRKRKRRRWWWRK....',
    '..KRRRKRRKRRRRWWWWWK....',
    '..KRRRRKRKRRRRWWKWWK....',
    '..KRKRRRKKRRRRWWKWWK....',
    '..KRRRKRRKRKRRRWWWRK....',
    '..KRRRRRKKRRRRRRRRRK....',
    '...KRRRKRRRKRRRRRRK.....',
    '...KRRRRKRRRKRRRRRK.....',
    '....KRRRRKRRRRRRRK......',
    '.....KKRRRRRRRRKK.......',
    '.......KKRRRRKK.........',
    '.....KKKKKRRKKKKK.......',
    '...KBBKRRRRRRRRRRKBBK...',
    '..KBBBKRRRRKKRRRRKBBBK..',
    '..KBBBKRRRKKKKRRRKBBBK..',
    '..KBBBKRRRKRRKRRRKBBBK..',
    '..KBBBKRRRRKKRRRRKBBBK..',
    '..KBBBKRRRRRRRRRRKBBBK..',
    '..KKKKKRRRRRRRRRRKKKKK..',
    '........................',
  ],
  genom: [
    '.....KKKKKK.....',
    '....KDDDDDDK....',
    '...KDWWDDWWDK...',
    '...KDWkDDkWDK...',
    '...KDDDDDDDDK...',
    '...KDWWWWWWDK...',
    '....KDWWWWDK....',
    '....KDDDDDDK....',
    '...KDKDDWWDDKDK.',
    '..KDDKDWDDWDKDDK',
    '..KKKKDDDDDDKKKK',
    '.....KDDDDDDK...',
    '.....KDDKKDDK...',
    '.....KDDK.KDDK..',
    '.....KKKK.KKKK..',
    '................',
  ],
  genom_venom: [
    '.........KKKKKK.........',
    '........KDDDDDDK........',
    '.......KDWWDDDWWDK......',
    '.......KDWWWDWWWDK......',
    '.......KDDWWDWWDDK......',
    '........KDDDDDDDK.......',
    '........KDWWWWWWDK......',
    '.......KKKDDDDDDKKK.....',
    '.....KKDDDDDDDDDDDDKK...',
    '...KKDDDdDDDDDDDDdDDDKK.',
    '..KDDDdDDDDWWWDDDDDdDDDK',
    '..KDDdDDDDWWDWWDDDDDdDDK',
    '..KDDdDDDWWDDDWWDDDDdDDK',
    '..KDDDDDDDDWDWDDDDDDDDDK',
    '.KDDDDKDDDDDWDDDDDKDDDDK',
    '.KDDDKKDDDDDDDDDDDKKDDDK',
    '.KWDDK.KDDDDDDDDDK.KDDWK',
    '.KWWDK.KDDdDDDdDDK.KDWWK',
    'KWDWDK.KDDDDDDDDDK.KDWDW',
    'KKKKKK.KDDDKKKDDDK.KKKKK',
    '.......KDDDK.KDDDK......',
    '.......KDDDK.KDDDK......',
    '.......KWDDK.KDDWK......',
    '.......KKKKK.KKKKK......',
  ],
  frogepepe: [
    '....KKKKKKK.....',
    '...KGGGGGGGK....',
    '..KGGGGGGGGGK...',
    '..KGWWWGWWWGK...',
    '..KGWKWGWKWGK...',
    '..KGGGGGGGGGK...',
    '..KGLLLLLLLGK...',
    '...KGLLLLLGK....',
    '....KGGGGGK.....',
    '...KBBBBBBBK....',
    '..KBBBBBBBBBK...',
    '..KGKBBBBBKGK...',
    '..KKKBBBBBKKK...',
    '....KbbKbbK.....',
    '....KbbKbbK.....',
    '....KKK.KKK.....',
  ],
  frogepepe_frog: [
    '.....KKK......KKK.......',
    '....KWWWK....KWWWK......',
    '...KWWKKWK..KWWKKWK.....',
    '...KWKKKWK..KWKKKWK.....',
    '..KGGWWWGGKKGGWWWGGK....',
    '.KGGGGGGGGGGGGGGGGGGK...',
    '.KGGGGGGGGGGGGGGGGGGGK..',
    'KGGGGGGGGGGGGGGGGGGGGGK.',
    'KGGGLLLLLLLLLLLLLLLLGGK.',
    'KGGLLLLLLLLLLLLLLLLLLGGK',
    'KGGGLLLLLLLLLLLLLLLLGGGK',
    'KGGGGGGGGGGGGGGGGGGGGGGK',
    '.KGGGGGGGGGGGGGGGGGGGGK.',
    '.KGGGGllllllllllllGGGGK.',
    '..KGGGlllllllllllllGGK..',
    '..KGGKllllllllllllKGGK..',
    '.KGGGK.KllllllllK.KGGGK.',
    '.KGGGK..KKKKKKKK..KGGGK.',
    'KGGGGK............KGGGGK',
    'KGGGGGK..........KGGGGGK',
    'KGKKGGK..........KGGKKGK',
    'KK..KGK..........KGK..KK',
    '.....KK..........KK.....',
    '........................',
  ],
  frogepepe_portrait: [
    '........KKKKKKKK........',
    '.....KKKGGGGGGGGKKK.....',
    '....KGGGGGGGGGGGGGGK....',
    '...KGGGGGGGGGGGGGGGGK...',
    '..KGGGGGGGGGGGGGGGGGGK..',
    '..KGGGKKKKGGGKKKKKGGGK..',
    '.KGGGKWWWWKGKWWWWWKGGGK.',
    '.KGGKWWWWWWKKWWWWWWWKGK.',
    '.KGGKWWKKWWKKWWKKKWWKGK.',
    '.KGGKWWKKKWKKWKKKKKWKGK.',
    '.KGGKWWWKKWKKWWKKKWWKGK.',
    '.KGGGKWWWWKGGKWWWWWKGGK.',
    '.KGGGGKKKKGGGGKKKKKGGGK.',
    '.KGGGGGGGGGGGGGGGGGGGGK.',
    '.KGGKLLLLLLLLLLLLLLLKGK.',
    '..KGLLLLLLLLLLLLLLLLLGK.',
    '..KGKLLLLLLLLLLLLLLLKGK.',
    '..KGGKKKKKKKKKKKKKKKGGK.',
    '...KGGGGGGGGGGGGGGGGGK..',
    '....KGGGGGGGGGGGGGGGK...',
    '.....KKGGGGGGGGGGGKK....',
    '....KBBBKKKKKKKKKBBBK...',
    '...KBBBBBBBBBBBBBBBBBK..',
    '...KKKKKKKKKKKKKKKKKKK..',
  ],
  bezuko: [
    '....KKKKKKKK....',
    '...KDWDWDDWDWK..',
    '..KHHHHHHHHHHK..',
    '..KHSSSSSSSHBK..',
    '..KHSEWSSEWSHK..',
    '..KHSRSSSSRSHK..',
    '..KHGGGGGGGGHK..',
    '..KHHSTTTSHHHK..',
    '..KHHKTtTKHHOK..',
    '..KOKPPPPPPKOK..',
    '...KPPKPPKPPK...',
    '...KPPYYYYPPK...',
    '...KPPPPPPPPK...',
    '....KppKppK.....',
    '....KppKppK.....',
    '....KKK.KKK.....',
  ],
  bezuko_demon: [
    '.......KKKKKKKKK........',
    '.....KKHHHHHHHHHKK......',
    '....KHHHHHHHHHHHHHK.....',
    '...KHHHCWKHHHHHHHHHK....',
    '...KHHCWKHSSSSSSHHHK....',
    '..KHHHCKSSSSSSSSSSHHK...',
    '..KHHKSSSVSSSSSVSSSKHK..',
    '..KHHKSEEWSSSSSWEESKHK..',
    '..KHHKSEEKSSSSSKEESKHK..',
    '..KHHKSSSSSSSSSSSSSKHK..',
    '..KHHKSSVSSKKKSSVSSKHK..',
    '..KHHKSSSKWKKKWKSSSKHK..',
    '..KHHKKSSSKKKKKSSSKKHK..',
    '..KHHHHKKSSSSSSSKKHHHK..',
    '.KHHHHHHKPPVPPVPPKHHHHK.',
    '.KHHHHHKPPPVPPPVPPKHHHK.',
    '.KHHHHKPPVPPPPPPVPPKHHK.',
    'KHHHHHKPPPPPPPPPPPPKHHHK',
    'KHHHHKPPPYYYYYYYYPPKHHHK',
    'KHHOKKPPPPPPPPPPPPKKOHHK',
    'KHOK.KpppppppppppK.KOHHK',
    'KKK..KpppppppppppK..KKKK',
    '.....KppppK.KppppK......',
    '.....KKKKK...KKKKK......',
  ],
  bezuko_portrait: [
    '..........KKKKKKKKKK..........',
    '........KKHHHHHHHHHHKK........',
    '.......KHDDDDDDDDDDDDDHK......',
    '......KHDDWDWDDDDWDWDDHHK.....',
    '.....KHHDDDWDWDDDWDWDDDHHK....',
    '.....KHHHDDDDDDDDDDDDDHHHK....',
    '....KHHHHHHHHHHHHHHHHHHHHBK...',
    '....KHHHHSSSSSSSSSSSSSHHBBBK..',
    '...KHHHSSSSSSSSSSSSSSSSHBBBK..',
    '...KHHSSSSSSSSSSSSSSSSSSHBK...',
    '...KHHSKKKKKSSSSSSKKKKKSSSHK..',
    '...KHSKWWWEEKSSSSKWWWEEKSSHK..',
    '...KHSKWWEEEKSSSSKWWEEEKSSHK..',
    '...KHSKWWEKEKSSSSKWWEKEKSSHK..',
    '...KHSKWWWEEKSSSSKWWWEEKSSHK..',
    '...KHSSKKKKKSSSSSSKKKKKSSSHK..',
    '...KHRRSSSSSSSSSSSSSSSSRRSHK..',
    '...KHRRRSSGGGGGGGGGGGGSRRRHK..',
    '...KHSSSGGGgggggggggggGGGSHK..',
    '...KHSSSKGGGGGGGGGGGGGGKSSHK..',
    '...KHSSSSKKKKTTTTTKKKKSSSSHK..',
    '....KHSSSSSSKTTTTTKSSSSSHHK...',
    '....KHHSSSSSKTTtTTKSSSSHHK....',
    '.....KHHHSSSKTTtTKSSSHHHK.....',
    '......KHHHHSSKTTKSSHHHHK......',
    '.......KHHHHKKTKKHHHHK........',
    '......KOHHHHHPPPPHHHHOK.......',
    '.....KOOKHHKPPPPPPKHHKOOK.....',
    '.....KKK.KKKKPPPPKKKK.KKK.....',
    '.............KKKK.............',
  ],
  katana: [
    '.......KKK............',
    'KWRWRWRKGKrrrrrrrrrrK.',
    'KRWRWRWKGKMMMMMMMMMMMK',
    '.......KKK............',
  ],
  eggreck: [
    '.....KKKKKK.....',
    '..KK.KGGGGK.KK..',
    '..KGKGGGGGGKGK..',
    '...KGGBBGBBGK...',
    '...KGWEGGWEGK...',
    '...KGGGGgGGGK...',
    '..KGGGKKKKGGGK..',
    '..KGGKTTTTKGGK..',
    '..KGGGKKKKGGGK..',
    '..KGGGGGGGGGGK..',
    '...KGGGGGGGGK...',
    '..KgKGGGGGGKgK..',
    '..KK.KKGGKK.KK..',
    '.....KgKKgK.....',
    '....KggK.KggK...',
    '....KKKK.KKKK...',
  ],
  fiona: [
    '.....KYKYK......',
    '...KRRRRRRRK....',
    '..KRRRRRRRRRK...',
    '.KRRKSSSSSKRRK..',
    '.KRRKSEGSEKRRK..',
    '.KRRKSSSPSKRRK..',
    '..KRKSSKKSKRK...',
    '..KRRKSSSSKRRK..',
    '...KDDGGGGDDK...',
    '...KDDYYYYDDK...',
    '...KDDDDDDDDK...',
    '..KDDDDDDDDDDK..',
    '..KDDDDDDDDDDK..',
    '.KDDDDDDDDDDDDK.',
    '.KKKKKKKKKKKKKK.',
    '...KKK....KKK...',
  ],
  videoman: [
    '....KKKKKKKK....',
    '...KHHHHHHHHK...',
    '..KHHHHHHHHHHK..',
    '..KHSSSSSSSSHK..',
    '..KHSEWSSEWSHK..',
    '..KHSSSSsSSSHK..',
    '..KHSMMMMMMSHK..',
    '...KSSsssSSSK...',
    '....KSSSSSK.....',
    '...KBBBWBBBK....',
    '..KWBBBWBBBWK...',
    '..KWKWWWWWKWK...',
    '..KKKWWWWWKKK...',
    '....KbbKbbK.....',
    '....KbbKbbK.....',
    '....KKK.KKK.....',
  ],
  kiya: [
    '....KKKKKKKK....',
    '...KHHHHHHHHK...',
    '..KHHHHHHHHHHK..',
    '..KHSSSSSSSSHK..',
    '.KKKKKKKKKKKKKK.',
    '.KKWWEKKKEWWKKK.',
    '..KHSSSSSSSSHK..',
    '..KHSSSWWSSSHK..',
    '..hKHSSSSSSHKh..',
    '..hhKNNNNNNKhh..',
    '..hhKNNNNNNKhh..',
    '..hKNNNNNNNNKh..',
    '...KNNNNNNNNK...',
    '...KnnKKKKnnK...',
    '...KnnK..KnnK...',
    '...KKKK..KKKK...',
  ],
  kiya_portrait: [
    '.........KKKKKKKKKK...........',
    '.......KKHHHHHHHHHHKK.........',
    '......KHHHHHHHHHHHHHHK........',
    '.....KHHHHHHHHHHHHHHHHK.......',
    '....KHHHHSSSSSSSSSSHHHHK......',
    '....KHHHSSSSSSSSSSSSHHHK......',
    '....KHHSSSSSSSSSSSSSSHHK......',
    '...KHHSSSSSSSSSSSSSSSSHHK.....',
    '...KHKKKKKKKKKKKKKKKKKKHK.....',
    '...KHKWWWWEEKKKKEEWWWWKKHK....',
    '...KHKWWEEEEKKKKEEEEWWKKHK....',
    '...KHKWWEEEEKKKKEEEEWWKKHK....',
    '...KHKKKKKKKKKKKKKKKKKKHK.....',
    '...KHHSSSSSSSLLSSSSSSSHHK.....',
    '...KHHSSSSSSLLLLSSSSSSHHK.....',
    '..hKHHSSSSSSSLLSSSSSSSHHKh....',
    '..hhKHSSSKKKKKKKKKKSSSHKhh....',
    '..hhhKHSSKWWWWWWWWKSSHKhhh....',
    '..hhhhKHSSKRRRRRRKSSHKhhhh....',
    '..hhhhKHHSSSKKKKSSSHHKhhhh....',
    '..hhhhKHHHSSSSSSSSHHHKhhhh....',
    '..hhhhhKHHHHSSSSHHHHKhhhhh....',
    '..hhhhhhKKHHHHHHHHKKhhhhhh....',
    '..hhhhhhhKNNNNNNNNKhhhhhhh....',
    '..hhhhhhKNNNNNNNNNNKhhhhhh....',
    '..hhhhhKNNNNNNNNNNNNKhhhhh....',
    '..hhhhKNNNNNNNNNNNNNNKhhhh....',
    '..hhhKNNNNNNNNNNNNNNNNKhhh....',
    '..hhKNNNNNNNNNNNNNNNNNNKhh....',
    '..KKKNNNNNNNNNNNNNNNNNNKKK....',
  ],
  videoman_portrait: [
    '..........KKKKKKKKKK..........',
    '.......KKKHHHHHHHHHHKKK.......',
    '.....KKHHHHHHHHHHHHHHHHKK.....',
    '....KHHHHHHHHHHHHHHHHHHHHK....',
    '....KHHHHHHHHHHHHHHHHHHHHK....',
    '...KHHHSSSSSSSSSSSSSSSSHHHK...',
    '...KHHSSSSSSSSSSSSSSSSSSHHK...',
    '...KHSSSSSSSSSSSSSSSSSSSSHK...',
    '...KHSSSKKKKSSSSSSKKKKSSSHK...',
    '...KHSSKWWEEKSSSSKWWEEKSSHK...',
    '...KHSSKWEEEKSSSSKWEEEKSSHK...',
    '...KHSSSKKKKSSSSSSKKKKSSSHK...',
    '...KHSSSSSSSSSssSSSSSSSSSHK...',
    '...KHSSSSSSSSssssSSSSSSSSHK...',
    '...KHSSSSSSSSsSSsSSSSSSSSHK...',
    '....KSSSSSMMMMMMMMMMSSSSSK....',
    '....KSSSMMMMMMMMMMMMMMSSSK....',
    '....KSSSMMMSSSSSSSSMMMSSSK....',
    '....KSSSSSSSsssssSSSSSSSSK....',
    '.....KSSSSSSSSSSSSSSSSSSK.....',
    '.....KSSSSSSSSSSSSSSSSSSK.....',
    '......KSSSSSSSSSSSSSSSSK......',
    '.......KSSSSSSSSSSSSSSK.......',
    '........KKSSSSSSSSSSKK........',
    '....KBBBKKKSSSSSSSSKKKBBBK....',
    '...KBBBBBBKKSSSSSSKKBBBBBBK...',
    '..KWWBBBBBBBKSSSSKBBBBBBBWWK..',
    '.KWWWWBBBBBBBKKKKBBBBBBBWWWWK.',
    '.KWWWWWWBBBBBWWWWBBBBBWWWWWWK.',
    '.KKKKKKKKKKKKKKKKKKKKKKKKKKKK.',
  ],
  jeffry: [
    '....KKKKKKKK....',
    '...KHHHHHHHHK...',
    '..KHHHHHHHHHHK..',
    '..KHSSSSSSSSHK..',
    '..KHSWESSEWSHK..',
    '..KHSSSSSSSSHK..',
    '..KHSSSsSSSSHK..',
    '..KHSSKKKKSSHK..',
    '...KSSSSSSSSK...',
    '....KSSSSSSK....',
    '..KJJJTTTTJJJK..',
    '.KJJJJTTTTJJJJK.',
    '.KJJJJJTTJJJJJK.',
    '.KjjKPPPPPPKjjK.',
    '....KPPKKPPK....',
    '....KppK.KppK...',
  ],
  jeffry_portrait: [
    '..........KKKKKKKKKK..........',
    '.......KKKHHHHHHHHHHKKK.......',
    '.....KKHHHHHHHHHHHHHHHHKK.....',
    '....KHHHHHHHHHHHHHHHHHHHHK....',
    '....KHHHHHHHHHHHHHHHHHHHHK....',
    '...KHHHSSSSSSSSSSSSSSSSHHHK...',
    '...KHHSSSSSSSSSSSSSSSSSSHHK...',
    '...KHSSSSSSSSSSSSSSSSSSSSHK...',
    '...KHSSSKKKKSSSSSSKKKKSSSHK...',
    '...KHSSKWWEEKSSSSKWWEEKSSHK...',
    '...KHSSKWEEEKSSSSKWEEEKSSHK...',
    '...KHSSSKKKKSSSSSSKKKKSSSHK...',
    '...KHSSSSSSSSSssSSSSSSSSSHK...',
    '...KHSSSSSSSSssssSSSSSSSSHK...',
    '...KHSSSSSSSSsSSsSSSSSSSSHK...',
    '....KSSSSSSSSSSSSSSSSSSSSK....',
    '....KSSSSSKKKKKKKKKKSSSSSK....',
    '....KSSSSSSKKKKKKKKSSSSSSK....',
    '.....KSSSSSSSSSSSSSSSSSSK.....',
    '.....KSSSSSSSSSSSSSSSSSSK.....',
    '......KSSSSSSSSSSSSSSSSK......',
    '.......KSSSSSSSSSSSSSSK.......',
    '........KKSSSSSSSSSSKK........',
    '....KJJJKKKSSSSSSSSKKKJJJK....',
    '...KJJJJJJKKSSSSSSKKJJJJJJK...',
    '..KJJJJJJJJKTTTTKJJJJJJJJJK...',
    '..KJJJJJJJJJKTTKJJJJJJJJJJK...',
    '..KJJJJJJJJJJTTJJJJJJJJJJJK...',
    '..KJJJJJJJJJJTTJJJJJJJJJJJK...',
    '..KKKKKKKKKKKKKKKKKKKKKKKKK...',
  ],
  jonny: [
    '.....KKKKKK.....',
    '...KKSSHHSSKK...',
    '..KSSSHHHHSSSK..',
    '..KSSSSSSSSSSK..',
    '..KSKKSSSSKKSK..',
    '..KSWESSSSEWSK..',
    '..KSSSSssSSSSK..',
    '..KSSKWWWWKSSK..',
    '...KsSSSSSSsK...',
    '....KsSSSSsK....',
    '..KLLLBBBBLLLK..',
    '.KLLLLBBBBLLLLK.',
    '.KLLLLLBBLLLLLK.',
    '.KllKDDDDDDKllK.',
    '....KDDKKDDK....',
    '....KddK.KddK...',
  ],
  jonny_portrait: [
    '..........KKKKKKKKKK..........',
    '........KKSSSSSSSSSSKK........',
    '......KKSSSSHHHHHHSSSSKK......',
    '.....KSSSSHHHHHHHHHHSSSSK.....',
    '....KSSSSHHHHHHHHHHHHSSSSK....',
    '....KSSSSSHHHHHHHHHHSSSSSK....',
    '...KSSSSSSSSHHHHHHSSSSSSSSK...',
    '...KSSSSSSSSSSSSSSSSSSSSSSK...',
    '...KSSSSSSSSSSSSSSSSSSSSSSK...',
    '.KSKSSSKKKKSSSSSSKKKKSSSSSKSK.',
    '.KSKSSKWWEEKSSSSKWWEEKSSSSKSK.',
    '.KSKSSKWEEEKSSSSKWEEEKSSSSKSK.',
    '...KSSSKKKKSSSSSSKKKKSSSSSK...',
    '...KSSSSSSSSSSssSSSSSSSSSSK...',
    '...KSSSSSSSSSssssSSSSSSSSSK...',
    '...KSSSSSSSSSsSSsSSSSSSSSSK...',
    '....KSSSSSsssssssssssSSSSK....',
    '....KsSSSSKKKKKKKKKSSSSsSK....',
    '....KssSSSSWWWWWWWSSSSssSK....',
    '.....KsssSSSKKKKKSSSsssSK.....',
    '.....KssssSSSSSSSSSssssSK.....',
    '......KsssssSSSSSsssssSK......',
    '.......KssssssSSssssssK.......',
    '........KKssssssssssKK........',
    '....KLLLKKKSSSSSSSSKKKLLLK....',
    '...KLLLLLLKKSSSSSSKKLLLLLLK...',
    '..KLLLLLLLLKBBBBBBKLLLLLLLLK..',
    '..KLLLLLLLLLKBBBBKLLLLLLLLLK..',
    '..KLLLLLLLLLLKBBKLLLLLLLLLLK..',
    '..KKKKKKKKKKKKKKKKKKKKKKKKKK..',
  ],
  shark: [
    '.......KK.......',
    '......KGGK......',
    '.....KGGGGK.....',
    '..KKKGGGGGGKKK..',
    '.KGGGGGGGGGGGGK.',
    'KGGEKGGGGGGKEGGK',
    'KGGGGGGGGGGGGGGK',
    'KGWTTTTTTTTTTWGK',
    'KGWTKTKTKTKTTWGK',
    '.KWWWWWWWWWWWWK.',
    '.KGWWWWWWWWWWGK.',
    '..KGWWWWWWWWGK..',
    '...KKGGGGGGKK...',
    '....KgK..KgK....',
    '...KBBBKKBBBK...',
    '...KSSSKKSSSK...',
  ],
  shark_portrait: [
    '.............KK...............',
    '............KGGK..............',
    '...........KGGGGK.............',
    '..........KGGGGGGK............',
    '.........KGGGGGGGGK...........',
    '.....KKKKGGGGGGGGGGKKKK.......',
    '..KKKGGGGGGGGGGGGGGGGGGKKK....',
    '.KGGGGGGGGGGGGGGGGGGGGGGGGK...',
    'KGGGGGGGGGGGGGGGGGGGGGGGGGGK..',
    'KGGGGKEEKGGGGGGGGKEEKGGGGGGK..',
    'KGGGKEEEEKGGGGGGKEEEEKGGGGGGK.',
    'KGGGKEEEEKGGGGGGKEEEEKGGGGGGK.',
    'KGGGGKEEKGGGGGGGGKEEKGGGGGGGK.',
    'KGGGGGGGGGGGGGGGGGGGGGGGGGGGK.',
    'KGGGGGGGGGGGGGGGGGGGGGGGGGGGK.',
    'KGKKKKKKKKKKKKKKKKKKKKKKKKKGK.',
    'KGKTTTTTTTTTTTTTTTTTTTTTTTTKGK',
    'KGKTKTKTKTKTKTKTKTKTKTKTKTTKGK',
    'KGKTTTTTTTTTTTTTTTTTTTTTTTTKGK',
    'KGKTKTKTKTKTKTKTKTKTKTKTKTTKGK',
    'KGKTTTTTTTTTTTTTTTTTTTTTTTTKGK',
    'KGKKKKKKKKKKKKKKKKKKKKKKKKKKGK',
    'KGGWWWWWWWWWWWWWWWWWWWWWWWWGGK',
    '.KGWWWWWWWWWWWWWWWWWWWWWWWWGK.',
    '..KWWWWWWWWWWWWWWWWWWWWWWWWK..',
    '...KKWWWWWWWWWWWWWWWWWWWWKK...',
    '.....KKKWWWWWWWWWWWWWWKKK.....',
    '.......KgKKKKKKKKKKKKgK.......',
    '.....KKBBBBKKKKKKKKBBBBKK.....',
    '.....KSSSSSSKKKKKKSSSSSSK.....',
  ],
  cry: [
    '.....KKKKKK.....',
    '...KKWWWWWWKK...',
    '..KWWWWWWWWWWK..',
    '..KWKKWWWWKKWK..',
    '..KWKwKWWKwKWK..',
    '..KWBKWWWWKBWK..',
    '..KWBWWWWWWBWK..',
    '..KWBKMMMMKBWK..',
    '..KWBKMMMMKBWK..',
    '...KWKMMMMKWK...',
    '....KWWMMWWK....',
    '.....KWWWWK.....',
    '..KCCCCCCCCCCK..',
    '.KCCCCCCCCCCCCK.',
    '.KccKCCCCCCKccK.',
    '....KccK.KccK...',
  ],
  blackegg: [
    '.....KKKKKK.....',
    '....KHHEEEEK....',
    '...KHHEEEEEEK...',
    '..KHHEEEEEEEeK..',
    '..KHEmmmEmmmeK..',
    '.KEEDDDEEEDDDeK.',
    '.KEEEEEEeEEEEeK.',
    '.KEEEEEeeeEEEeK.',
    '.KEEDMMMMMMDEeK.',
    '.KWWEEmmmmEEWWK.',
    '.KWwWWEEEEEWwWK.',
    '..KWwWwWWwWwWK..',
    '...KKwwwwwwKK...',
    '....KeK..KeK....',
    '...KSsSK.KSsSK..',
    '...KKKKK.KKKKK..',
  ],
  cry_portrait: [
    '..........KKKKKKKKKK..........',
    '.......KKKWWWWWWWWWWKKK.......',
    '.....KKWWWWWWWWWWWWWWWWKK.....',
    '....KWWWWWWWWWWWWWWWWWWWWK....',
    '...KWWWWWWWWWWWWWWWWWWWWWWK...',
    '..KWWWWWWWWWWWWWWWWWWWWWWWWK..',
    '..KWWWWWWWWWWWWWWWWWWWWWWWWK..',
    '..KWWWKKKKWWWWWWWWWWKKKKWWWK..',
    '..KWWKKwwwKWWWWWWWWKwwwKKWWK..',
    '..KWWKwwKKKWWWWWWWWKKKwwKWWK..',
    '..KWWKKKWWWWWWWWWWWWWWKKKWWK..',
    '..KWBBKWWWWWWWWWWWWWWWWKBBWK..',
    '..KWBBWWWWWWWWWWWWWWWWWWBBWK..',
    '..KWBBWWWWWWWWWWWWWWWWWWBBWK..',
    '..KWBBWWWWWWWwwWWWWWWWWWBBWK..',
    '..KWBBWWWWWWwwwwWWWWWWWWBBWK..',
    '..KWBBWWWWWWWwwWWWWWWWWWBBWK..',
    '..KWBBWWKKKKKKKKKKKKKKWWBBWK..',
    '..KWBBWKMMMMMMMMMMMMMMKWBBWK..',
    '..KWBBKMMMMMMMMMMMMMMMMKBBWK..',
    '..KWBBKMMMMRRRRRRRRMMMMKBBWK..',
    '..KWBBKMMMMRRRRRRRRMMMMKBBWK..',
    '..KWBBKMMMMMMMMMMMMMMMMKBBWK..',
    '...KWBKMMMMMMMMMMMMMMMMKBWK...',
    '....KWKKMMMMMMMMMMMMMMKKWK....',
    '.....KWWKKKKKKKKKKKKKKWWK.....',
    '......KWWWWWWWWWWWWWWWWK......',
    '.......KKWWWWWWWWWWWWKK.......',
    '..KCCCCCKKWWWWWWWWWWKKCCCCCK..',
    '..KKKKKKKKKKKKKKKKKKKKKKKKKK..',
  ],
  eggreck_portrait: [
    '..........KKKKKKKKKK..........',
    '........KKGGGGGGGGGGKK........',
    '.......KGGGGGGGGGGGGGGK.......',
    '..KKK.KGGGGGGGGGGGGGGGGK.KKK..',
    '.KGGGKGGGGGGGGGGGGGGGGGGKGGGK.',
    '.KGgGGGGGGGGGGGGGGGGGGGGGGgGK.',
    '..KKKGGGGBBBBGGGGGGBBBBGGKKK..',
    '....KGGGGBBBBBGGGGBBBBBGGGGK..',
    '....KGGGKWWWWKGGGGKWWWWKGGGK..',
    '....KGGGKWEEWKGGGGKWEEWKGGGK..',
    '....KGGGKWEMWKGGGGKWEMWKGGGK..',
    '....KGGGGKWWKGGGGGGKWWKGGGGK..',
    '....KGGGGGKKGGGPPGGGKKGGGGGK..',
    '....KGGGGGGGGGPPPPGGGGGGGGGK..',
    '....KGGGGGGGGGGPPGGGGGGGGGGK..',
    '....KGGGGGGGGGGGGGGGGGGGGGGK..',
    '....KGGGKKKKKKKKKKKKKKKKGGGK..',
    '....KGGKTTTTTTTTTTTTTTTTKGGK..',
    '....KGGKTTKTTKTTKTTKTTKTKGGK..',
    '....KGGKKKKKKKKKKKKKKKKKKGGK..',
    '....KGGGKTTTTTTTTTTTTTTKGGGK..',
    '....KGGGGKKKKKKKKKKKKKKGGGGK..',
    '.....KGGGGGGGGGGGGGGGGGGGGK...',
    '.....KGGGGGGGGGGGGGGGGGGGGK...',
    '......KGGGGGGGGGGGGGGGGGGK....',
    '.......KGGGGGGGGGGGGGGGGK.....',
    '........KKGGGGGGGGGGGGKK......',
    '..........KKKKKKKKKKKK........',
    '..............................',
    '..............................',
  ],
  genom_portrait: [
    '........KKKKKKKK........',
    '.....KKKDDDDDDDDKKK.....',
    '....KDDDDDDDDDDDDDDK....',
    '...KDDDDDDDDDDDDDDDDK...',
    '..KDDDDDDDDDDDDDDDDDDK..',
    '..KDDWWWWDDDDDDWWWWDDK..',
    '..KDWWWWWWDDDDWWWWWWDK..',
    '..KDWWkkWWDDDDWWkkWWDK..',
    '..KDWWkkWWDDDDWWkkWWDK..',
    '..KDDWWWWDDDDDDWWWWDDK..',
    '..KDDDDDDDDDDDDDDDDDDK..',
    '..KDDDDDDDDDDDDDDDDDDK..',
    '...KDDDWWWWWWWWWWDDDK...',
    '...KDDWWWWWWWWWWWWDDK...',
    '...KDDWKWKWKWKWKWWDDK...',
    '....KDRRRRRRRRRRRRDK....',
    '....KDDWWWWWWWWWWDDK....',
    '.....KDDWKWKWKWKDDK.....',
    '.....KDDDDWWWWDDDDK.....',
    '......KDDDDDDDDDDK......',
    '.......KDDDDDDDDK.......',
    '........KKKKKKKK........',
    '........................',
    '........................',
  ],
  drone: [
    '......KKKK......',
    '.....KDDDDK.....',
    '....KDDDDDDK....',
    '....KDDSSSDK....',
    '....KSKSSKSK....',
    '....KSSSSSSK....',
    '.....KSssSK.....',
    '....KBYOOYBK....',
    '...KBBYWWYBBK...',
    '..KSKBYOOYBKSK..',
    '..KKKBYWWYBKKK..',
    '....KJJJJJJK....',
    '....KJJKKJJK....',
    '....KJJK.KJJK...',
    '....KWWK.KWWK...',
    '................',
  ],
  beast: [
    '.........KKKKKK.........',
    '........KMMMMMMK........',
    '........KMMMMMMK........',
    '........KMEMMEMK........',
    '........KMMMMMMK........',
    '........KDTTTTDK........',
    '......KKKMMMMMMKKK......',
    '....KKMMMMMMMMMMMMKK....',
    '..KKMMLLMMMMMMMMLLMMKK..',
    '.KMMMLLLMMMMMMMMLLLMMMK.',
    'KMMMLLLMMMMDDMMMMLLLMMMK',
    'KMMLLLMMMMDDDDMMMMLLLMMK',
    'KMMLLMMMKMMDDMMKMMMLLMMK',
    'KMMLLMMKKMMMMMMKKMMLLMMK',
    'KMMLMMK.KMMMMMMK.KMMLMMK',
    'KMMMMMK.KMDDDDMK.KMMMMMK',
    'KMMMMMK.KMMMMMMK.KMMMMMK',
    'KHHMMMK.KMMMMMMK.KMMMHHK',
    'KHHHMMK.KMMKKMMK.KMMHHHK',
    'KNHHMMK.KMMK.KMMK.KMHHNK',
    'KNNHMK..KMMK.KMMK..KMHNK',
    'KKKKKK..KDDK.KDDK..KKKKK',
    '........KNNK.KNNK.......',
    '........KKKK.KKKK.......',
  ],
  icon_cart: [
    '..............',
    '.WW...........',
    '..WWWWWWWWWWW.',
    '...WWWWWWWWWW.',
    '...WWWWWWWWWW.',
    '...WWWWWWWWW..',
    '....WWWWWWWW..',
    '....W.........',
    '....WWWWWWWW..',
    '.....WW...WW..',
    '.....WW...WW..',
    '..............',
  ],
};

/* palette variants for zombie types */
const ZOMBIE_VARIANTS = {
  normal:   { G: '#63a04a', g: '#3f6b2f', R: '#d3372b', J: '#3d4257', j: '#2b2f3f' },
  fast:     { G: '#c9473a', g: '#8a2a20', R: '#f5c518', J: '#2a2d36', j: '#1d1f27' },
  tank:     { G: '#8a9a78', g: '#5c6b4e', R: '#d3372b', J: '#4a4f5c', j: '#33363f' },
  exploder: { G: '#ee8b2b', g: '#b85a14', R: '#f5c518', J: '#d3372b', j: '#8a1f18' },
  boss:     { G: '#9b4fd6', g: '#5f2e8a', R: '#f5c518', J: '#2a2d36', j: '#1d1f27' },
};

const Sprites = {
  cache: {},

  make(rows, override) {
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        const ch = rows[y][x];
        const col = (override && override[ch]) || PAL[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return c;
  },

  init() {
    for (const k in SPRITE_DATA) this.cache[k] = this.make(SPRITE_DATA[k]);
    for (const v in ZOMBIE_VARIANTS) {
      this.cache['zombie_' + v] = this.make(SPRITE_DATA.zombie, ZOMBIE_VARIANTS[v]);
      // Research Lab skins: the same zombies in blood-stained white lab coats
      this.cache['zombie_' + v + '_lab'] = this.make(SPRITE_DATA.zombie, Object.assign({}, ZOMBIE_VARIANTS[v], { J: '#e8e6dc', j: '#b8b6ae' }));
      const c = this.cache['zombie_' + v + '_lab'], x = c.getContext('2d'); x.fillStyle = '#8a1f18'; x.fillRect(6, 8, 1, 2); x.fillRect(9, 7, 2, 1); x.fillStyle = '#c8302a'; x.fillRect(7, 9, 1, 1); // blood on the coat
    }
    this.cache.player_hurt = this.make(SPRITE_DATA.player, { S: '#ff8a7a', B: '#ff5a4a', J: '#c04a3a', D: '#7a2a20' });
    for (const id in CHARACTERS) { const ch = CHARACTERS[id]; this.cache['player_' + id] = this.make(SPRITE_DATA[ch.sprite || 'player'], ch.pal); if (ch.portrait) this.cache['portrait_' + id] = this.make(SPRITE_DATA[ch.portrait], ch.pal); }
    this.cache.beast = this.make(SPRITE_DATA.beast, BEAST_PAL);
    this.cache.venom = this.make(SPRITE_DATA.genom_venom, { D: '#101014', d: '#2a2a34', W: '#f4f2ea', K: '#000000' });
    this.cache.frog = this.make(SPRITE_DATA.frogepepe_frog, CHARACTERS.frogepepe.pal);
    this.cache.fiona = this.make(SPRITE_DATA.fiona, { K: '#1e2a10', R: '#b0402a', S: '#9cc23a', E: '#5a3a1a', G: '#7a9a2a', P: '#6e9424', D: '#1f7a3a', Y: '#e8b84a', W: '#f4f2ea' });
    this.cache.katana = this.make(SPRITE_DATA.katana, { K: '#141018', W: '#f4f2ea', R: '#c0202a', G: '#3aa03a', r: '#b8202a', M: '#d8dce8' });
    this.cache.demon = this.make(SPRITE_DATA.bezuko_demon, Object.assign({}, CHARACTERS.bezuko.pal, { S: '#e9dccf', s: '#d0b8a8', E: '#ff3d8a' }));
    this.cache.gun_flesh = this.make(SPRITE_DATA.gun_flesh, FLESH_PAL);
    this.cache.gun_m249 = this.make(SPRITE_DATA.gun_m249, { m: '#2a2d33', M: '#4a4f58', N: '#4a6b3a', K: '#0f1014' });
    this.cache.truck = this.makeTruck();
    this.cache.beast_rage = this.make(SPRITE_DATA.beast, Object.assign({}, BEAST_PAL, { M: '#9a3a28', L: '#c05a40', E: '#ff4a2a' }));
    for (const id in BOSSES) this.cache['boss_' + id] = this.make(SPRITE_DATA.zombie, BOSSES[id].pal);
    // procedural map props
    this.cache.tree = this.makeTree();
    this.cache.car_red = this.makeCar('#b23a2e', '#7a231a');
    this.cache.car_blue = this.makeCar('#2e5aa0', '#1c3a6b');
    this.cache.car_grey = this.makeCar('#8a8f99', '#5a5e68');
    this.cache.car_wreck = this.makeCar('#3a3a3a', '#1f1f1f');
    this.cache.barrel = this.makeBarrel();
    this.cache.crate = this.makeCrate();
    this.cache.manhole = this.makeManhole();
    this.cache.stopsign = this.makeStopSign();
    this.cache.lamp = this.makeLamp();
    this.cache.hydrant = this.makeHydrant();
    this.cache.dumpster = this.makeDumpster();
    this.cache.container_red = this.makeContainer('#9a3a2e', '#6a2419');
    this.cache.container_blue = this.makeContainer('#2f5a8a', '#1e3a5c');
    this.cache.container_yellow = this.makeContainer('#b8902a', '#7a5e18');
    this.cache.bush = this.makeBush();
    this.cache.zombie_guard = this.make(SPRITE_DATA.soldier, { G: '#6b8a5a', g: '#4a6b3a', R: '#ff3a2a', A: '#3a4a2a', C: '#4a5d3a', c: '#2f3d25' });
    this.cache.gun_cannon = this.make(SPRITE_DATA.gun_cannon, { m: '#2a2d33', M: '#4a4f58', K: '#0f1014' });
    this.cache.house = this.makeHouse(); this.cache.sandbags = this.makeSandbags(); this.cache.barrier = this.makeBarrier(); this.cache.deadtree = this.makeDeadTree(); this.cache.grave = this.makeGrave(); this.cache.turret = this.makeTurret();
    this.cache.tires = this.makeTires(); this.cache.car_yellow = this.makeCar('#d8b020', '#8a6e10'); this.cache.car_white = this.makeCar('#e8e6dc', '#9a9890'); this.cache.cone = this.makeCone();
    this.cache.desk = this.makeDesk(); this.cache.server = this.makeServer(); this.cache.bench = this.makeBench(); this.cache.tank = this.makeTank();
    this.cache.toilet = this.makeToilet(); this.cache.sofa = this.makeSofa(); this.cache.table = this.makeTable(); this.cache.hazmat = this.makeHazmat(); this.cache.plant = this.makePlant();
    this.cache.fence_h = this.makeFence();
  },

  get(name) { return this.cache[name]; },

  /* draw sprite centred at (x,y) with options */
  draw(ctx, name, x, y, o = {}) {
    const img = this.cache[name];
    if (!img) return;
    const s = o.scale || 1;
    const w = img.width * s, h = img.height * s;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (o.angle) ctx.rotate(o.angle);
    if (o.flip) ctx.scale(-1, 1);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    const ox = o.ox != null ? o.ox : -w / 2, oy = o.oy != null ? o.oy : -h / 2;
    ctx.drawImage(img, ox, oy, w, h);
    ctx.restore();
  },

  /* render a sprite into a UI <canvas>, fit & centred, optional ring */
  renderTo(el, name, ring) {
    const img = this.cache[name];
    if (!img || !el) return;
    const ctx = el.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, el.width, el.height);
    const pad = ring ? 6 : 2;
    const s = Math.max(1, Math.floor(Math.min((el.width - pad * 2) / img.width, (el.height - pad * 2) / img.height)));
    if (ring) {
      ctx.strokeStyle = ring; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(el.width / 2, el.height / 2, el.width / 2 - 2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#1a1f2b'; ctx.fill();
    }
    ctx.drawImage(img, Math.floor((el.width - img.width * s) / 2), Math.floor((el.height - img.height * s) / 2), img.width * s, img.height * s);
  },

  /* ---------- procedural props ---------- */
  makeTree() {
    const c = document.createElement('canvas'); c.width = 22; c.height = 24;
    const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.beginPath(); x.arc(11, 11, 11, 0, 7); x.fill();
    x.fillStyle = '#2f6b2a'; x.beginPath(); x.arc(11, 11, 10, 0, 7); x.fill();
    x.fillStyle = '#4a9a3c'; x.beginPath(); x.arc(9, 9, 7, 0, 7); x.fill();
    x.fillStyle = '#6cbf55'; x.beginPath(); x.arc(7, 7, 3.5, 0, 7); x.fill();
    x.fillStyle = '#3d7d32';
    [[15, 14], [5, 15], [14, 5], [10, 16]].forEach(([px, py]) => x.fillRect(px, py, 2, 2));
    x.fillStyle = '#5a3a1f'; x.fillRect(9, 20, 4, 4);
    return c;
  },
  /* top-down car facing RIGHT: short hood + headlights at the right, windshield right behind it, small rear window + tail lights at the left */
  makeCar(col, dark) {
    const c = document.createElement('canvas'); c.width = 32; c.height = 16;
    const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(1, 1, 30, 14);
    x.fillStyle = '#1a1a1e'; x.fillRect(5, 0, 5, 16); x.fillRect(22, 0, 5, 16);        // wheels
    x.fillStyle = dark; x.fillRect(2, 2, 28, 12);
    x.fillStyle = col; x.fillRect(3, 3, 26, 9);
    x.fillStyle = dark; x.fillRect(12, 3, 8, 9);                                     // roof (darker)
    x.fillStyle = '#0f1014'; x.fillRect(19, 2, 6, 12); x.fillRect(7, 2, 4, 12);         // glass frames
    x.fillStyle = '#2a3d5c'; x.fillRect(20, 3, 4, 10); x.fillRect(8, 3, 2, 10);         // windshield (front) / rear window
    x.fillStyle = '#5a7aa8'; x.fillRect(20, 3, 1, 10); x.fillRect(8, 3, 1, 10);
    x.fillStyle = '#f5e08a'; x.fillRect(29, 3, 1, 3); x.fillRect(29, 10, 1, 3);         // headlights
    x.fillStyle = '#d3372b'; x.fillRect(2, 3, 1, 3); x.fillRect(2, 10, 1, 3);           // tail lights
    x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(25, 4, 3, 1);                    // hood shine
    return c;
  },
  /* Canimal's vehicle form: a red & blue semi cab, top-down, facing right */
  makeTruck() {
    const c = document.createElement('canvas'); c.width = 30; c.height = 16;
    const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(1, 1, 28, 14);
    x.fillStyle = '#1a1a1e'; x.fillRect(3, 0, 5, 16); x.fillRect(11, 0, 5, 16); x.fillRect(21, 0, 5, 16); // three axles
    x.fillStyle = '#1c3a8a'; x.fillRect(2, 2, 26, 12);          // blue chassis
    x.fillStyle = '#2b4fb0'; x.fillRect(3, 3, 13, 10);          // blue rear body
    x.fillStyle = '#c0281e'; x.fillRect(16, 2, 12, 12);         // red cab
    x.fillStyle = '#e04a3a'; x.fillRect(17, 3, 10, 2);
    x.fillStyle = '#0f1014'; x.fillRect(20, 2, 4, 12);          // windshield frame
    x.fillStyle = '#2a4a8a'; x.fillRect(21, 3, 2, 10); x.fillStyle = '#5a8ad8'; x.fillRect(21, 3, 1, 10); // glass
    x.fillStyle = '#c9ced8'; x.fillRect(27, 3, 2, 10); x.fillRect(17, 1, 1, 1); x.fillRect(19, 1, 1, 1); // chrome grille + exhaust stacks
    x.fillStyle = '#8a9099'; x.fillRect(27, 5, 2, 1); x.fillRect(27, 8, 2, 1); x.fillRect(27, 11, 2, 1);
    x.fillStyle = '#f5e08a'; x.fillRect(28, 3, 1, 2); x.fillRect(28, 11, 1, 2); // headlights
    x.fillStyle = '#c9ced8'; x.fillRect(4, 7, 11, 2);            // silver stripe
    x.fillStyle = '#d3372b'; x.fillRect(2, 3, 1, 2); x.fillRect(2, 11, 1, 2); // tail lights
    return c;
  },
  makeBarrel() {
    const c = document.createElement('canvas'); c.width = 12; c.height = 12;
    const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.beginPath(); x.arc(6, 6, 6, 0, 7); x.fill();
    x.fillStyle = '#7a4a1a'; x.beginPath(); x.arc(6, 6, 5, 0, 7); x.fill();
    x.fillStyle = '#a0682a'; x.beginPath(); x.arc(6, 6, 3.5, 0, 7); x.fill();
    x.fillStyle = '#5a3812'; x.fillRect(5, 3, 2, 6); x.fillRect(3, 5, 6, 2);
    return c;
  },
  makeCrate() {
    const c = document.createElement('canvas'); c.width = 14; c.height = 14;
    const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(0, 0, 14, 14);
    x.fillStyle = '#a0753f'; x.fillRect(1, 1, 12, 12);
    x.fillStyle = '#6b4b26'; x.fillRect(1, 1, 12, 1); x.fillRect(1, 12, 12, 1); x.fillRect(1, 1, 1, 12); x.fillRect(12, 1, 1, 12);
    for (let i = 2; i < 12; i++) { x.fillRect(i, i, 1, 1); x.fillRect(13 - i, i, 1, 1); }
    return c;
  },
  makeManhole() {
    const c = document.createElement('canvas'); c.width = 12; c.height = 12;
    const x = c.getContext('2d');
    x.fillStyle = '#1e2026'; x.beginPath(); x.arc(6, 6, 6, 0, 7); x.fill();
    x.fillStyle = '#4a4f5c'; x.beginPath(); x.arc(6, 6, 5, 0, 7); x.fill();
    x.fillStyle = '#2f333d'; x.beginPath(); x.arc(6, 6, 3, 0, 7); x.fill();
    x.fillStyle = '#5c616e'; x.fillRect(3, 6, 6, 1); x.fillRect(6, 3, 1, 6);
    return c;
  },
  makeStopSign() {
    const c = document.createElement('canvas'); c.width = 12; c.height = 12;
    const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(2, 0, 8, 2); x.fillRect(0, 2, 12, 8); x.fillRect(2, 10, 8, 2);
    x.fillStyle = '#c8302a'; x.fillRect(3, 1, 6, 1); x.fillRect(1, 3, 10, 6); x.fillRect(3, 10, 6, 1); x.fillRect(2, 2, 8, 8);
    x.fillStyle = '#ffffff'; x.fillRect(3, 5, 6, 2);
    return c;
  },
  makeLamp() {
    const c = document.createElement('canvas'); c.width = 10; c.height = 10;
    const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(3, 3, 4, 4);
    x.fillStyle = '#5c616e'; x.fillRect(4, 4, 2, 2);
    x.fillStyle = '#fff2b0'; x.fillRect(1, 1, 3, 3); x.fillRect(6, 6, 3, 3);
    return c;
  },
  makeHydrant() {
    const c = document.createElement('canvas'); c.width = 8; c.height = 8;
    const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(1, 1, 6, 6);
    x.fillStyle = '#c8302a'; x.fillRect(2, 2, 4, 4);
    x.fillStyle = '#ff7a70'; x.fillRect(3, 3, 1, 1);
    return c;
  },
  makeContainer(col, dark) {
    const c = document.createElement('canvas'); c.width = 48; c.height = 20;
    const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(0, 0, 48, 20);
    x.fillStyle = dark; x.fillRect(1, 1, 46, 18);
    x.fillStyle = col; x.fillRect(2, 2, 44, 12);
    for (let i = 4; i < 46; i += 4) { x.fillStyle = dark; x.fillRect(i, 2, 1, 16); }
    x.fillStyle = '#0f1014'; x.fillRect(1, 15, 46, 1);
    return c;
  },
  /* ---- the haunted house and its siege props ---- */
  makeHouse() {
    const W = 192, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const R = mulberry32(66);
    // ground shadow, then dark plank walls
    x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(4, 40, W - 8, H - 44);
    x.fillStyle = '#0f0c0e'; x.fillRect(8, 38, W - 16, H - 46);
    x.fillStyle = '#2a1e22'; x.fillRect(12, 42, W - 24, H - 54);
    for (let y = 46; y < H - 14; y += 8) { x.fillStyle = (y / 8) % 2 ? '#241a1e' : '#2e2226'; x.fillRect(12, y, W - 24, 6); if (R() < 0.5) { x.fillStyle = '#17101a'; x.fillRect(12 + R() * (W - 40), y + 2, 6 + R() * 14, 2); } }
    // crooked roof: two dark slabs with ragged shingles
    x.fillStyle = '#0f0c0e'; x.beginPath(); x.moveTo(2, 44); x.lineTo(W / 2 - 6, 4); x.lineTo(W - 2, 40); x.lineTo(W - 10, 46); x.lineTo(W / 2 - 6, 14); x.lineTo(10, 50); x.closePath(); x.fill();
    x.fillStyle = '#1c1418'; x.beginPath(); x.moveTo(8, 44); x.lineTo(W / 2 - 6, 8); x.lineTo(W - 8, 41); x.closePath(); x.fill();
    x.fillStyle = '#2a1e24'; for (let i = 0; i < 40; i++) { const t = i / 40; x.fillRect(8 + t * (W - 16), 44 - Math.abs(t - 0.48) * 70 + R() * 3, 4, 3); }
    // gable window (eye) + attic
    x.fillStyle = '#0f0c0e'; x.fillRect(W / 2 - 12, 20, 12, 12); x.fillStyle = '#5a0a0a'; x.fillRect(W / 2 - 10, 22, 8, 8);
    // windows: broken, glowing red
    [[26, 60], [56, 60], [116, 60], [146, 60], [26, 92], [146, 92]].forEach(([wx, wy]) => { x.fillStyle = '#0f0c0e'; x.fillRect(wx - 2, wy - 2, 20, 18); x.fillStyle = '#4a0a0a'; x.fillRect(wx, wy, 16, 14); x.fillStyle = '#7a1414'; x.fillRect(wx + 1, wy + 1, 6, 5); x.fillStyle = '#0f0c0e'; x.fillRect(wx + 7, wy, 2, 14); x.fillRect(wx, wy + 6, 16, 2); x.fillStyle = '#c9c6bb'; x.fillRect(wx + 10, wy + 9, 3, 1); x.fillRect(wx + 11, wy + 10, 1, 2); });
    // door: gaping, black, with a red glow
    x.fillStyle = '#0f0c0e'; x.fillRect(W / 2 - 14, 80, 28, 36); x.fillStyle = '#050305'; x.fillRect(W / 2 - 12, 82, 24, 34); x.fillStyle = 'rgba(180,20,20,0.35)'; x.fillRect(W / 2 - 12, 100, 24, 16);
    // porch, steps, hanging lamp, boards
    x.fillStyle = '#1c1418'; x.fillRect(W / 2 - 30, 116, 60, 6); x.fillStyle = '#2a1e22'; x.fillRect(W / 2 - 26, 118, 52, 2);
    x.fillStyle = '#3a2a1a'; x.fillRect(W / 2 - 34, 72, 3, 3); x.fillRect(W / 2 + 31, 72, 3, 3);
    x.fillStyle = '#4a3428'; [[30, 100], [140, 100]].forEach(([bx, by]) => { x.fillRect(bx, by, 18, 3); x.fillRect(bx + 2, by - 6, 3, 14); });
    // blood down the front
    x.fillStyle = '#4a0e0a'; [[40, 78], [150, 84], [96, 70]].forEach(([bx, by]) => { x.fillRect(bx, by, 3, 12 + R() * 10); x.fillRect(bx - 2, by, 7, 3); });
    return c;
  },
  makeSandbags() {
    const c = document.createElement('canvas'); c.width = 32; c.height = 14; const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(0, 2, 32, 12);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) { const px = 1 + i * 8 + (r % 2) * 4, py = 3 + r * 4; if (px > 24) continue; x.fillStyle = r === 0 ? '#8a7a56' : '#a08e64'; x.fillRect(px, py, 7, 3); x.fillStyle = '#6b5e42'; x.fillRect(px, py + 2, 7, 1); }
    return c;
  },
  makeBarrier() {
    const c = document.createElement('canvas'); c.width = 32; c.height = 12; const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(0, 0, 32, 12); x.fillStyle = '#8a8d96'; x.fillRect(1, 1, 30, 10); x.fillStyle = '#6b6e78'; x.fillRect(1, 8, 30, 3);
    for (let i = 0; i < 32; i += 8) { x.fillStyle = (i / 8) % 2 ? '#e0b830' : '#1b1c22'; x.fillRect(i + 1, 2, 7, 3); }
    return c;
  },
  makeDeadTree() {
    const c = document.createElement('canvas'); c.width = 22; c.height = 28; const x = c.getContext('2d');
    x.fillStyle = '#0f0c0e'; x.fillRect(9, 12, 4, 16); x.fillRect(5, 6, 3, 9); x.fillRect(14, 4, 3, 11); x.fillRect(2, 8, 4, 2); x.fillRect(16, 2, 4, 3); x.fillRect(11, 0, 2, 13);
    x.fillStyle = '#2a1e22'; x.fillRect(10, 14, 2, 13); x.fillRect(6, 8, 1, 6); x.fillRect(15, 6, 1, 8);
    return c;
  },
  makeGrave() {
    const c = document.createElement('canvas'); c.width = 10; c.height = 12; const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(1, 0, 8, 12); x.fillStyle = '#6b6e78'; x.fillRect(2, 1, 6, 10); x.fillStyle = '#4a4f5c'; x.fillRect(2, 8, 6, 3); x.fillStyle = '#2a2d36'; x.fillRect(4, 3, 2, 4); x.fillRect(3, 4, 4, 1);
    return c;
  },
  makeTurret() {
    const c = document.createElement('canvas'); c.width = 28; c.height = 28; const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.beginPath(); x.arc(14, 14, 13, 0, 7); x.fill(); x.fillStyle = '#3a3d45'; x.beginPath(); x.arc(14, 14, 11, 0, 7); x.fill(); x.fillStyle = '#4a4f58'; x.beginPath(); x.arc(14, 14, 7, 0, 7); x.fill();
    x.fillStyle = '#e0b830'; for (let a = 0; a < 6.28; a += 1.05) x.fillRect(14 + Math.cos(a) * 9 - 1, 14 + Math.sin(a) * 9 - 1, 2, 2);
    return c;
  },
  /* ---- race track props ---- */
  makeTires() {
    const c = document.createElement('canvas'); c.width = 16; c.height = 14; const x = c.getContext('2d');
    [[3, 8], [9, 8], [6, 4], [12, 4]].forEach(([px, py]) => { x.fillStyle = '#0f1014'; x.beginPath(); x.arc(px + 1, py + 1, 5, 0, 7); x.fill(); x.fillStyle = '#2a2d33'; x.beginPath(); x.arc(px + 1, py + 1, 4, 0, 7); x.fill(); x.fillStyle = '#4a4f58'; x.beginPath(); x.arc(px + 1, py + 1, 1.5, 0, 7); x.fill(); });
    return c;
  },
  makeCone() {
    const c = document.createElement('canvas'); c.width = 8; c.height = 8; const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(1, 1, 6, 6); x.fillStyle = '#ee8b2b'; x.fillRect(2, 2, 4, 4); x.fillStyle = '#fff'; x.fillRect(2, 4, 4, 1);
    return c;
  },
  /* ---- research lab furniture ---- */
  makeDesk() {
    const c = document.createElement('canvas'); c.width = 24; c.height = 14; const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(0, 0, 24, 14); x.fillStyle = '#c9c4b8'; x.fillRect(1, 1, 22, 12); x.fillStyle = '#a8a397'; x.fillRect(1, 11, 22, 2);
    x.fillStyle = '#1a1c22'; x.fillRect(4, 2, 9, 7); x.fillStyle = '#3a7fd8'; x.fillRect(5, 3, 7, 5); x.fillStyle = '#8ad0ff'; x.fillRect(6, 4, 3, 1);
    x.fillStyle = '#2a2d36'; x.fillRect(15, 4, 6, 4); x.fillStyle = '#f4f2ea'; x.fillRect(16, 9, 5, 2);
    return c;
  },
  makeServer() {
    const c = document.createElement('canvas'); c.width = 12; c.height = 18; const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(0, 0, 12, 18); x.fillStyle = '#2a2f3a'; x.fillRect(1, 1, 10, 16); x.fillStyle = '#3d4352';
    for (let i = 2; i < 16; i += 3) x.fillRect(2, i, 8, 2);
    for (let i = 3; i < 16; i += 3) { x.fillStyle = (i / 3) % 2 ? '#5fd35a' : '#3fa5ff'; x.fillRect(8, i, 1, 1); x.fillStyle = Math.random() < 0.3 ? '#ff4a3a' : '#5fd35a'; x.fillRect(3, i, 1, 1); }
    return c;
  },
  makeBench() {
    const c = document.createElement('canvas'); c.width = 32; c.height = 14; const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(0, 0, 32, 14); x.fillStyle = '#e8eaee'; x.fillRect(1, 1, 30, 12); x.fillStyle = '#b8bcc6'; x.fillRect(1, 11, 30, 2);
    [['#5fd35a', 4], ['#ff5a4a', 9], ['#3fa5ff', 14], ['#f5c518', 24]].forEach(([col, px]) => { x.fillStyle = '#0f1014'; x.fillRect(px, 3, 4, 7); x.fillStyle = col; x.fillRect(px + 1, 5, 2, 4); x.fillStyle = '#c9ced8'; x.fillRect(px + 1, 4, 2, 1); });
    x.fillStyle = '#2a2d36'; x.fillRect(18, 4, 5, 3); x.fillStyle = '#8ad0ff'; x.fillRect(19, 5, 3, 1);
    return c;
  },
  makeTank() {
    const c = document.createElement('canvas'); c.width = 14; c.height = 22; const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(0, 0, 14, 22); x.fillStyle = '#4a4f5c'; x.fillRect(1, 1, 12, 3); x.fillRect(1, 18, 12, 3);
    x.fillStyle = '#2fd8ff'; x.fillRect(2, 4, 10, 14); x.fillStyle = '#8af0ff'; x.fillRect(3, 5, 2, 12);
    x.fillStyle = '#1a4a5a'; x.fillRect(6, 7, 4, 3); x.fillRect(5, 10, 6, 6); x.fillStyle = '#0f2a33'; x.fillRect(7, 8, 1, 1); x.fillRect(9, 8, 1, 1);
    return c;
  },
  makeToilet() {
    const c = document.createElement('canvas'); c.width = 10; c.height = 12; const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(1, 0, 8, 4); x.fillRect(0, 4, 10, 8); x.fillStyle = '#e8eaee'; x.fillRect(2, 1, 6, 2); x.fillRect(1, 5, 8, 6);
    x.fillStyle = '#7fb8d8'; x.fillRect(3, 6, 4, 4);
    return c;
  },
  makeSofa() {
    const c = document.createElement('canvas'); c.width = 26; c.height = 12; const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(0, 0, 26, 12); x.fillStyle = '#2b3d6b'; x.fillRect(1, 1, 24, 10); x.fillStyle = '#3d558f'; x.fillRect(4, 4, 8, 6); x.fillRect(14, 4, 8, 6);
    return c;
  },
  makeTable() {
    const c = document.createElement('canvas'); c.width = 48; c.height = 18; const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(0, 2, 48, 14); x.fillStyle = '#3a3f4a'; x.fillRect(1, 3, 46, 12); x.fillStyle = '#4a5060'; x.fillRect(2, 4, 44, 3);
    x.fillStyle = '#1a1c22'; for (let i = 6; i < 44; i += 10) { x.fillRect(i, 0, 6, 2); x.fillRect(i, 16, 6, 2); }
    x.fillStyle = '#c9ced8'; x.fillRect(20, 8, 8, 4); x.fillStyle = '#3a7fd8'; x.fillRect(21, 9, 6, 2);
    return c;
  },
  makeHazmat() {
    const c = document.createElement('canvas'); c.width = 12; c.height = 12; const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.beginPath(); x.arc(6, 6, 6, 0, 7); x.fill(); x.fillStyle = '#e0b830'; x.beginPath(); x.arc(6, 6, 5, 0, 7); x.fill();
    x.fillStyle = '#1a1a1e'; x.fillRect(5, 3, 2, 2); x.fillRect(3, 7, 2, 2); x.fillRect(7, 7, 2, 2); x.fillRect(5, 5, 2, 2);
    return c;
  },
  makePlant() {
    const c = document.createElement('canvas'); c.width = 12; c.height = 14; const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(3, 9, 6, 5); x.fillStyle = '#8a6a4a'; x.fillRect(4, 10, 4, 3);
    x.fillStyle = '#2f6b2a'; x.beginPath(); x.arc(6, 6, 5, 0, 7); x.fill(); x.fillStyle = '#4a9a3c'; x.fillRect(3, 4, 3, 3); x.fillRect(7, 5, 2, 2);
    return c;
  },
  makeBush() {
    const c = document.createElement('canvas'); c.width = 14; c.height = 12;
    const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.beginPath(); x.ellipse(7, 6, 7, 6, 0, 0, 7); x.fill();
    x.fillStyle = '#2f6b2a'; x.beginPath(); x.ellipse(7, 6, 6, 5, 0, 0, 7); x.fill();
    x.fillStyle = '#4a9a3c'; x.beginPath(); x.ellipse(6, 5, 3.5, 3, 0, 0, 7); x.fill();
    return c;
  },
  makeFence() {
    const c = document.createElement('canvas'); c.width = 16; c.height = 8;
    const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(0, 2, 16, 4); x.fillRect(2, 0, 3, 8); x.fillRect(11, 0, 3, 8);
    x.fillStyle = '#c9b48a'; x.fillRect(0, 3, 16, 2); x.fillRect(3, 1, 1, 6); x.fillRect(12, 1, 1, 6);
    return c;
  },
  makeDumpster() {
    const c = document.createElement('canvas'); c.width = 24; c.height = 14;
    const x = c.getContext('2d');
    x.fillStyle = '#0f1014'; x.fillRect(0, 0, 24, 14);
    x.fillStyle = '#2f6b3a'; x.fillRect(1, 1, 22, 12);
    x.fillStyle = '#3f8a4a'; x.fillRect(2, 2, 20, 5);
    x.fillStyle = '#1f4a28'; x.fillRect(2, 8, 20, 4); x.fillRect(11, 1, 2, 12);
    return c;
  },
};
