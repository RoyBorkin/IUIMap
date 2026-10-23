// ─────────────────────────────────────────────────────────────
//  נתוני המשימה — כל הטקסטים והנקודות של האתר נמצאים בקובץ הזה.
//  נקודות: מתוך "טבלה של נקודות תת ימיות בחוף של הIUI".
//  כדי להוסיף תמונות: שימו קבצים בתיקייה assets/photos
//  והוסיפו אותם למערך photos של הנקודה, למשל:
//  photos: [{ src: 'assets/photos/nursery-1.jpg', caption: 'המשתלה ממערב' }]
//  (לכל תמונה צריך גם גרסה קטנה עם הסיומת ‎-s, למשל nursery-1-s.jpg)
//  model: סוג המודל התלת־ממדי (ראו js/models.js)
// ─────────────────────────────────────────────────────────────

// photoSet('nursery', 3) → nursery-1.jpg … nursery-3.jpg
const photoSet = (id, count) => Array.from({ length: count }, (_, i) => ({ src: `assets/photos/${id}-${i + 1}.jpg` }));

export const SITE = {
  title: 'מפת הקרקעית',
  place: 'חוף המכון הבין־אוניברסיטאי, אילת',
  slices: [3, 6, 9],
  // הגבהה אנכית של הקרקעית בתלת־ממד (1 = קנה מידה אמיתי)
  verticalExaggeration: 3,
};

export const LIVE_CAMERA_YOUTUBE_ID = '7t21fq-hh-4';

// lat / lon בפורמט מעלות + דקות עשרוניות, בדיוק כמו בטבלה.
// נקודה בלי נ.צ. מקבלת derive: { from, bearing, dist } — המיקום מחושב
// מאזימוט (מעלות) ומרחק (מטרים) מנקודה ידועה, ומסומן באתר כ"משוער".
export const POINTS = [
  {
    id: 'nursery', name: 'משתלה',
    en: {name: "Coral nursery", terrain: "Small stones and rubble"},
    lat: [29, 30.137], lon: [34, 55.103],
    depth: [7, 10], dims: [7.3, 6, 1.4], shape: 'box',
    terrain: 'אבנים קטנות ודרדרת', material: '',
    photos: photoSet('nursery', 28), model: 'nursery',
  },
  {
    id: 'tables3', name: '3 שולחנות',
    en: {name: "3 tables", terrain: "Gravel", material: "Metal", dimsText: "Three grid tables in a row along the shore, each 0.8 m wide, 1.7 m long and 1.2 m high, 5.5 m apart"},
    lat: [29, 30.126], lon: [34, 55.099],
    depth: [8, 10], dims: [0.8, 1.7, 1.2], shape: 'box', spacing: 5.5,
    dimsText: 'שלושה שולחנות רשת בשורה לאורך החוף, כל אחד ברוחב 0.8, אורך 1.7 וגובה 1.2 מ׳, במרחק 5.5 מ׳ זה מזה',
    terrain: 'חצץ', material: 'מתכת',
    photos: photoSet('tables3', 9), model: 'tables3',
  },
  {
    id: 'empty', name: 'שולחן ריק',
    en: {name: "Empty table", terrain: "Rubble and gravel", material: "Metal"},
    derive: { from: 'flowering', bearing: 60, dist: 6 },
    depth: [5.6], dims: [1.5, 1.5, 1.5], shape: 'box',
    terrain: 'דרדרת וחצץ', material: 'מתכת',
    photos: photoSet('empty', 3), model: 'empty',
  },
  {
    id: 'flowering', name: 'שולחן פורח',
    en: {name: "Flowering table", terrain: "Sand", material: "Metal, covered in coral"},
    lat: [29, 30.113], lon: [34, 55.080],
    depth: [5.6], dims: [0.8, 2.4, 0.6], shape: 'box',
    terrain: 'חול', material: 'מתכת, מכוסה אלמוגים',
    photos: photoSet('flowering', 7), model: 'flowering',
  },
  {
    id: 'current', name: 'בטונדה מד־זרם',
    en: {name: "Current-meter block", terrain: "Sand", material: "Concrete"},
    lat: [29, 30.121], lon: [34, 55.083],
    depth: [4.2], dims: [1, 1.1, 2.8], shape: 'box',
    terrain: 'חול', material: 'בטון',
    photos: photoSet('current', 2), model: 'current',
  },
  {
    id: 'pair', name: 'זוג בטונדות',
    en: {name: "Pair of blocks", terrain: "Rocks", material: "Concrete"},
    lat: [29, 30.114], lon: [34, 55.079],
    depth: [5], dims: [0.6, 2.3, 1], shape: 'box',
    terrain: 'סלעים', material: 'בטון',
    photos: photoSet('pair', 3), model: 'pair',
  },
  {
    id: 'pier', name: 'מזח',
    en: {name: "Pier", terrain: "Rocks", material: "Concrete", dimsText: "9 m wide", note: "The pier model is based on the satellite photo and the photos above and below the water: round concrete columns, a pier head with fender tyres and a railing, and a weather mast."},
    lat: [29, 30.110], lon: [34, 55.063],
    // the measured position lies ~9 m off the pier in the satellite image; snap it onto the pier head (m east, m north)
    snap: [-6, -6.5],
    depth: [4], dims: [9], dimsText: 'רוחב 9 מ׳', shape: 'pier',
    terrain: 'סלעים', material: 'בטון',
    note: 'המודל של המזח נבנה לפי תמונת הלוויין ולפי התמונות מעל ומתחת למים: עמודי בטון עגולים, ראש מזח עם צמיגים ומעקה, ותורן מטאורולוגי.',
    photos: photoSet('pier', 8),
  },
  {
    id: 'habitat', name: 'הביטט',
    en: {name: "Habitat", terrain: "Reef, rubble"},
    lat: [29, 30.069], lon: [34, 55.039],
    depth: [10, 11], dims: [7.8, 5.2, 2], shape: 'box',
    terrain: 'שונית, דרדרת', material: '',
    photos: photoSet('habitat', 7), model: 'habitat',
  },
  {
    id: 'habitat2', name: 'הביטט 2',
    en: {name: "Habitat 2", note: "An extra point about 15 m from the Habitat towards deeper water, about 4 m deeper. Size not measured yet."},
    derive: { from: 'habitat', bearing: 135, dist: 15 },
    depth: [14, 15], dims: [], shape: 'none',
    terrain: '', material: '',
    note: 'נקודה נוספת כ־15 מטר מההביטט לכיוון המים העמוקים, נמוכה ממנו בכ־4 מטר. המידות עדיין לא נמדדו.',
    photos: [],
  },
  {
    id: 'pyramid', name: 'פירמידה',
    en: {name: "Pyramid", terrain: "Reef, rubble", dimsText: "Triangular base with 1.6 m sides, 1 m high"},
    lat: [29, 30.057], lon: [34, 55.025],
    depth: [8], dims: [1.6, 1.6, 1], dimsText: 'בסיס משולש בצלע 1.6, גובה 1', shape: 'pyramid',
    terrain: 'שונית, דרדרת', material: '',
    photos: photoSet('pyramid', 3), model: 'pyramid',
  },
  {
    id: 'deep', name: 'שולחן עומק',
    en: {name: "Deep table", terrain: "Rubble"},
    derive: { from: 'empty', bearing: 130, dist: 10 },
    depth: [10, 12], dims: [3, 1.5, 1], shape: 'box',
    terrain: 'דרדרת', material: '',
    photos: [], model: 'table',
  },
  {
    id: 'shahar', name: 'השולחן של שחר',
    en: {name: "Shahar's table", terrain: "Rubble"},
    derive: { from: 'flowering', bearing: 130, dist: 13 },
    depth: [10, 12], dims: [6, 1, 1.5], shape: 'box',
    terrain: 'דרדרת', material: '',
    photos: [], model: 'table',
  },
  {
    id: 'cylinder', name: 'גליל ליד המזח',
    en: {name: "Cylinder by the pier", terrain: "Rocks", note: "30 m south-west of the pier, along the shore."},
    derive: { from: 'pier', along: 'shore', toward: 225, dist: 30 },
    depth: [4], dims: [0.5, 1, 0.5], shape: 'cylinder',
    terrain: 'סלעים', material: '',
    note: '30 מטר מהמזח, דרום־מערבה לאורך החוף.',
    photos: [], model: 'cylinder',
  },
  {
    id: 'leftblock', name: 'בטונדה ליד המזח',
    en: {name: "Block by the pier", terrain: "Rocks and sand", material: "Concrete", note: "About 10 m due west of the pier."},
    derive: { from: 'pier', bearing: 270, dist: 10 },
    depth: [3], dims: [1, 1, 1], shape: 'box',
    terrain: 'סלעים וחול', material: 'בטון',
    note: 'כ־10 מטר מערבית למזח.',
    photos: [], model: 'cube',
  },
  {
    id: 'camera', name: 'מצלמה',
    en: {name: "Camera", terrain: "Reef", note: "An underwater camera that streams live to the public."},
    lat: [29, 30.077], lon: [34, 55.027],
    depth: [4], dims: [], shape: 'camera',
    terrain: 'שונית', material: '',
    live: true,
    note: 'מצלמה תת־ימית ששידורה פתוח לציבור.',
    photos: [],
  },
];

// המסלול הראשי — סדר הצלילה, כולל אזימוט ומרחק כפי שנרשמו בטבלה.
export const ROUTE = [
  { from: 'nursery', to: 'tables3', bearing: 180, dist: '24–33' },
  { from: 'tables3', to: 'flowering', bearing: 240, dist: '22' },
  { from: 'flowering', to: 'current', bearing: 0, dist: '6' },
  { from: 'current', to: 'pair', bearing: 210, dist: '22' },
  { from: 'pair', to: 'pier', bearing: 240, dist: '28' },
  { from: 'pier', to: 'habitat', bearing: 240, dist: '30' },
  { from: 'habitat', to: 'pyramid', bearing: 210, dist: '70' },
];

// הסתעפויות מהמסלול הראשי לנקודות צד
export const BRANCHES = [
  { from: 'empty', to: 'flowering', bearing: 240, dist: '6' },
  { from: 'empty', to: 'deep', bearing: 130, dist: '10' },
  { from: 'flowering', to: 'shahar', bearing: 130, dist: '13' },
  { from: 'pier', to: 'cylinder', bearing: null, dist: '30' },
  { from: 'pier', to: 'leftblock', bearing: null, dist: '10' },
  { from: 'habitat', to: 'habitat2', bearing: 135, dist: '15' },
  { from: 'pyramid', to: 'camera', bearing: null, dist: '40' },
  { from: 'camera', to: 'pier', bearing: 40, dist: '' },
];


// ─────────────────────────────────────────────────────────────
//  שקופיות, בעברית ובאנגלית. Slides, in Hebrew and English.
//  type: 'text' (lead, bullets, list, stats, image) | 'groups' |
//        'route' | 'profile' | 'bands' | 'image'
// ─────────────────────────────────────────────────────────────
const IMG = (n) => `assets/photos/${n}.jpg`;

export const DECKS = {
  he: {
    plan: {
      title: 'תכנון המשימה',
      slides: [
        {
          type: 'text', title: 'מיפוי תת־ימי מול המכון',
          lead: 'מיפינו את השטח מול המכון הבין־אוניברסיטאי למדעי הים באילת, מצפון לדרום. המיפוי כלל שמונה נקודות ציון ותיאור של התכסית והתבליט.',
          bullets: ['בכל נקודה מדדנו אורך, רוחב וגובה, אזימוט ואת המרחק בין האובייקטים.'],
          image: IMG('satellite-1'), caption: 'חוף המכון והמזח מלמעלה. מקור: GovMap.',
        },
        {
          type: 'groups', title: 'חלוקת התפקידים',
          lead: 'היינו ארבעה בצוות והתחלקנו לשני זוגות.',
          groups: [
            { title: 'צוות הצלילה', sub: 'צלילת מיכלים', members: ['קורל', 'עמית'] },
            { title: 'צוות השנורקל', sub: 'שנורקל וצלילה חופשית', members: ['שירה', 'רועי'] },
          ],
        },
        {
          type: 'text', title: 'איך ביצענו את המדידות',
          list: [
            ['עומק', 'נמדד במחשב צלילה.'],
            ['ממדים', 'נמדדו ברולטקה.'],
            ['אזימוט ומרחק', 'שני הצוותים מדדו בין נקודות עוקבות, כדי להשוות בין התוצאות ולבדוק את המדידות זה של זה.'],
            ['מרחקים', 'ברולטקה כשהתאפשר. במקומות אחרים הערכנו לפי ספירת מכות סנפיר.'],
            ['רישום', 'בטבלאות שעל הסלייטים. את סוג הקרקעית, הכיסוי שלה והמבנים תיארנו במהלך המיפוי.'],
          ],
          image: IMG('nursery-15'), caption: 'מדידה ברולטקה מעל המשתלה.',
        },
        {
          type: 'text', title: 'מה בוצע בפועל והמגבלות',
          bullets: [
            'המיפוי התבצע לפי חלוקת התפקידים שתכננו.',
            'בגלל פרופיל הצלילה, צוות המיכלים מיפה רק את השטח שמצפון לרציף (נקודות 1–6). צוות השנורקלים השלים את המדידות החסרות והמשיך משם.',
            'סוללת המצלמה התרוקנה בנקודה 6, ולכן התיעוד המצולם מהנקודה הזאת והלאה מוגבל.',
            'העומק המרבי שאושר היה 10 מטרים. בפועל נמדד עומק מרבי של 10.4 מטרים, חריגה של 0.4 מטר מהמגבלה.',
          ],
          stats: [['50', 'דקות, משך צלילת המיכלים'], ['6', 'נקודות מצפון לרציף, בצלילת המיכלים'], ['10.4', 'מטר, העומק המרבי שנמדד']],
        },
        { type: 'route', title: 'המסלול' },
        { type: 'profile', title: 'חתך עומק לאורך המסלול' },
        { type: 'bands', title: 'הנקודות לפי עומק' },
      ],
    },
    divers: {
      title: 'צוות הצלילה',
      slides: [
        {
          type: 'text', title: 'צוות צוללי המיכלים',
          lead: 'קורל ועמית, בצלילת מיכלים.',
          bullets: [
            'מדדנו עומקים וממדים של האובייקטים.',
            'מדדנו את האזימוט לנקודה הבאה, ומדדנו או הערכנו את המרחק בין הנקודות.',
            'תיארנו את הקרקעית בכל נקודה.',
          ],
          image: IMG('divers-1'),
        },
        {
          type: 'text', title: 'הציוד',
          list: [
            ['ציוד צלילה מלא', 'לצלילת מיכלים.'],
            ['מצפן', 'למדידת אזימוט לנקודה הבאה.'],
            ['מחשב צלילה', 'למדידת עומק.'],
            ['רולטקה', 'לממדים ולמרחקים.'],
            ['סלייט', 'עם טבלה שהכנו מראש.'],
          ],
          image: IMG('nursery-16'), caption: 'מדידת המשתלה ברולטקה.',
        },
        {
          type: 'text', title: 'מה מיפינו',
          lead: 'בגלל פרופיל הצלילה מיפינו את השטח שמצפון לרציף, נקודות 1–6, מהמשתלה ועד המזח.',
          stats: [['50', 'דקות צלילה'], ['6', 'נקודות'], ['10.4', 'מטר, העומק המרבי']],
          image: IMG('tables3-5'), caption: 'מדידה ליד אחד משלושת השולחנות.',
        },
      ],
    },
    snorkel: {
      title: 'צוות המשקיפים',
      slides: [
        {
          type: 'text', title: 'צוות השנורקלים',
          lead: 'שירה ורועי, בשנורקל ובצלילה חופשית. פעלו מעל צוות הצלילה עד סיום הצלילה.',
          bullets: [
            'השלימו מדידות ותיעוד שצוות המיכלים לא הספיק, כולל עומקים וממדי אובייקטים לפי הצורך.',
            'מדדו אזימוטים ומרחקים ותיארו את הקרקעית.',
            'צילמו את האובייקטים מלמעלה ומהצד.',
          ],
          image: IMG('flowering-5'), caption: 'השולחן הפורח, צילום מלמעלה.',
        },
        {
          type: 'text', title: 'הציוד',
          list: [
            ['שנורקל ומסכה', ''], ['מצפן', ''], ['מצלמה', ''], ['רולטקה ומשקולת', ''], ['סלייט', 'עם טבלה מוכנה.'],
          ],
          image: IMG('pier-5'), caption: 'המזח מפני המים.',
        },
        {
          type: 'text', title: 'המשך המיפוי מדרום למזח',
          lead: 'אחרי שצוות המיכלים סיים במזח את 6 הנקודות הצפוניות, צוות השנורקל המשיך לבד לשתי הנקודות שמדרום למזח, והוסיף לאורך המסלול נקודות שתוכננו מראש להשלמה בשלב הזה.',
          image: IMG('pyramid-1'), caption: 'הפירמידה.',
        },
        {
          type: 'text', title: 'המדידות בנקודות האחרונות',
          bullets: [
            'כדי לחסוך בצלילות חופשיות, בחנו את צורת האובייקטים מפני המים והערכנו גודל לפי מרחק.',
            'באובייקט מלבני הערכנו שהיחס בין הצלעות הוא בערך 2:3. מדדנו צלע אחת והערכנו את השנייה לפי היחס.',
            'בפירמידה מדדנו צלע אחת, בהנחה שהצלעות המקבילות לה שוות באורכן, ומדדנו את הגובה.',
            'המצלמה שימשה נקודת ציון בלבד, ולכן לא מדדנו את הממדים שלה.',
            'כל נקודה כזו נבדקה בצלילה חופשית אחת או שתיים: אימות עומק או גובה ומדידה של ממד אחד, שממנו הוערכו השאר.',
          ],
        },
      ],
    },
  },
  en: {
    plan: {
      title: 'Mission plan',
      slides: [
        {
          type: 'text', title: 'Underwater mapping off the Institute',
          lead: 'We mapped the seabed off the Interuniversity Institute for Marine Sciences in Eilat, from north to south. The survey covered eight waypoints and a description of the bottom cover and relief.',
          bullets: ['At each point we measured length, width and height, the bearing, and the distance between objects.'],
          image: IMG('satellite-1'), caption: 'The Institute beach and pier from above. Source: GovMap.',
        },
        {
          type: 'groups', title: 'Who did what',
          lead: 'There were four of us, split into two pairs.',
          groups: [
            { title: 'Dive team', sub: 'Scuba', members: ['Coral', 'Amit'] },
            { title: 'Snorkel team', sub: 'Snorkel and freediving', members: ['Shira', 'Roy'] },
          ],
        },
        {
          type: 'text', title: 'How we measured',
          list: [
            ['Depth', 'With a dive computer.'],
            ['Size', 'With a measuring tape.'],
            ['Bearing and distance', 'Both teams measured between consecutive points, so we could compare results and check each other.'],
            ['Distances', 'With the tape where possible; elsewhere estimated by counting fin kicks.'],
            ['Recording', 'In tables on the slates. Bottom type, cover and structures were described during the survey.'],
          ],
          image: IMG('nursery-15'), caption: 'Taping a measurement over the nursery.',
        },
        {
          type: 'text', title: 'What we did, and the limits',
          bullets: [
            'The survey followed the roles we planned.',
            'Because of the dive profile, the scuba team only mapped the area north of the jetty (points 1–6). The snorkel team filled in the missing measurements and continued from there.',
            'The camera battery ran out at point 6, so there are fewer photos from that point on.',
            'The approved maximum depth was 10 m. The deepest reading was 10.4 m, 0.4 m over the limit.',
          ],
          stats: [['50', 'minutes, scuba dive time'], ['6', 'points north of the jetty, on scuba'], ['10.4', 'm, deepest reading']],
        },
        { type: 'route', title: 'The route' },
        { type: 'profile', title: 'Depth profile along the route' },
        { type: 'bands', title: 'Points by depth' },
      ],
    },
    divers: {
      title: 'Dive team',
      slides: [
        {
          type: 'text', title: 'The scuba team',
          lead: 'Coral and Amit, on scuba.',
          bullets: [
            'We measured the depth and size of each object.',
            'We took the bearing to the next point and measured or estimated the distance.',
            'We described the seabed at every point.',
          ],
          image: IMG('divers-1'),
        },
        {
          type: 'text', title: 'Equipment',
          list: [
            ['Full scuba gear', ''],
            ['Compass', 'For the bearing to the next point.'],
            ['Dive computer', 'For depth.'],
            ['Measuring tape', 'For sizes and distances.'],
            ['Slate', 'With a table we prepared in advance.'],
          ],
          image: IMG('nursery-16'), caption: 'Measuring the nursery with the tape.',
        },
        {
          type: 'text', title: 'What we mapped',
          lead: 'Because of the dive profile we mapped the area north of the jetty, points 1–6, from the nursery to the pier.',
          stats: [['50', 'minutes underwater'], ['6', 'points'], ['10.4', 'm, deepest reading']],
          image: IMG('tables3-5'), caption: 'Measuring at one of the three tables.',
        },
      ],
    },
    snorkel: {
      title: 'Snorkel team',
      slides: [
        {
          type: 'text', title: 'The snorkel team',
          lead: 'Shira and Roy, snorkelling and freediving. They worked above the dive team until the dive ended.',
          bullets: [
            'Filled in measurements and records the scuba team did not get to, including depths and object sizes.',
            'Measured bearings and distances and described the seabed.',
            'Photographed the objects from above and from the side.',
          ],
          image: IMG('flowering-5'), caption: 'The flowering table from above.',
        },
        {
          type: 'text', title: 'Equipment',
          list: [['Snorkel and mask', ''], ['Compass', ''], ['Camera', ''], ['Measuring tape and weight', ''], ['Slate', 'With a prepared table.']],
          image: IMG('pier-5'), caption: 'The pier from the surface.',
        },
        {
          type: 'text', title: 'Mapping south of the pier',
          lead: 'Once the scuba team finished the six northern points at the pier, the snorkel team carried on alone to the two points south of the pier, and added points along the route that were planned to be filled in at this stage.',
          image: IMG('pyramid-1'), caption: 'The pyramid.',
        },
        {
          type: 'text', title: 'Measuring the last points',
          bullets: [
            'To save freedives, we studied each object’s shape from the surface and estimated size from distance.',
            'For rectangular objects we estimated the sides at about 2:3, measured one side and worked out the other from the ratio.',
            'On the pyramid we measured one side, assuming the matching sides are equal, and measured the height.',
            'The camera was only a waypoint, so we did not measure it.',
            'Each of these points took one or two freedives: checking depth or height and measuring one dimension, from which the rest were estimated.',
          ],
        },
      ],
    },
  },
};

// Waterline traced from the Esri satellite image, north to south.
export const SHORELINE = [[29.503561, 34.91835], [29.503524, 34.918351], [29.503487, 34.918351], [29.503449, 34.918353], [29.503412, 34.918357], [29.503375, 34.918361], [29.503337, 34.918364], [29.5033, 34.918367], [29.503263, 34.918368], [29.503225, 34.918368], [29.503188, 34.918368], [29.503151, 34.918367], [29.503113, 34.918359], [29.503076, 34.918339], [29.503039, 34.918318], [29.503001, 34.918296], [29.502964, 34.91827], [29.502927, 34.918249], [29.502889, 34.918194], [29.502852, 34.918171], [29.502814, 34.918169], [29.502777, 34.918168], [29.50274, 34.918163], [29.502702, 34.918148], [29.502665, 34.918128], [29.502628, 34.918106], [29.50259, 34.918092], [29.502553, 34.918054], [29.502516, 34.918018], [29.502478, 34.917989], [29.502441, 34.917957], [29.502404, 34.917921], [29.502366, 34.91789], [29.502329, 34.917854], [29.502292, 34.917816], [29.502254, 34.91778], [29.502217, 34.917749], [29.502179, 34.917711], [29.502142, 34.917666], [29.502105, 34.917625], [29.502067, 34.917574], [29.50203, 34.917488], [29.501993, 34.917412], [29.501955, 34.917364], [29.501918, 34.917306], [29.501881, 34.917252], [29.501843, 34.917203], [29.501806, 34.917158], [29.501769, 34.917113], [29.501731, 34.917058], [29.501694, 34.917014], [29.501657, 34.916968], [29.501619, 34.916928], [29.501582, 34.916893], [29.501545, 34.916866], [29.501507, 34.916836], [29.50147, 34.916802], [29.501432, 34.916753], [29.501395, 34.9167], [29.501358, 34.916651], [29.50132, 34.916608], [29.501283, 34.916564], [29.501246, 34.91653], [29.501208, 34.916477], [29.501171, 34.916402], [29.501134, 34.916353], [29.501096, 34.916293], [29.501059, 34.91625], [29.500984, 34.916223]];

// Pier, measured on the satellite image: head centre offset from the pier point (m east, m north),
// direction of the walkway from the head towards the beach (degrees), head size and walkway width.
export const PIER = { headOffset: [0, 0], bearing: 321, headSize: 8.5, walkWidth: 2.6 };

// Building footprints on the beach, detected from the Esri satellite image (roof colour sampled).
// h: estimated height in metres.
export const BUILDINGS = [{"ll": [[29.5041983, 34.9178031], [29.5041138, 34.9180171], [29.5040337, 34.9179754], [29.5041183, 34.9177613]], "roof": "#f8f6e7"}, {"ll": [[29.5040389, 34.9176177], [29.5039339, 34.9177762], [29.5038022, 34.9176611], [29.5039072, 34.9175026]], "roof": "#a69d7f"}, {"ll": [[29.5036364, 34.9176023], [29.503639, 34.9178436], [29.5034949, 34.9178456], [29.5034923, 34.9176043]], "roof": "#fafaeb"}, {"ll": [[29.5033165, 34.9170243], [29.5036914, 34.9173103], [29.5035573, 34.9175422], [29.5031825, 34.9172562]], "roof": "#f4edcf"}, {"ll": [[29.5031801, 34.9172722], [29.5033385, 34.9173562], [29.5033136, 34.9174181], [29.5031553, 34.9173341]], "roof": "#cecac2"}, {"ll": [[29.5033079, 34.9175723], [29.5031917, 34.9176709], [29.5031092, 34.9175426], [29.5032254, 34.917444]], "roof": "#fdfef5"}, {"ll": [[29.5029924, 34.9178247], [29.5031394, 34.9178785], [29.5031199, 34.9179487], [29.5029729, 34.9178948]], "roof": "#fcf8d6"}, {"ll": [[29.502959, 34.9167643], [29.5031128, 34.9168596], [29.5030963, 34.9168947], [29.5029426, 34.9167994]], "roof": "#c9c7b9"}, {"ll": [[29.5030822, 34.9174333], [29.5029141, 34.9176975], [29.5028276, 34.9176249], [29.5029957, 34.9173606]], "roof": "#f6f5f0"}, {"ll": [[29.5030267, 34.9172359], [29.5029356, 34.9172785], [29.5029059, 34.9171946], [29.502997, 34.917152]], "roof": "#e4e8e6"}, {"ll": [[29.5028156, 34.917689], [29.5029017, 34.9177127], [29.502882, 34.9178074], [29.5027959, 34.9177837]], "roof": "#faf5da"}, {"ll": [[29.5027993, 34.9173683], [29.5026144, 34.9176709], [29.5024582, 34.9175449], [29.5026431, 34.9172423]], "roof": "#ece5c9"}, {"ll": [[29.5021883, 34.916892], [29.502283, 34.9169976], [29.5022337, 34.917056], [29.502139, 34.9169505]], "roof": "#dad3be"}, {"ll": [[29.502241, 34.917293], [29.5022268, 34.9173871], [29.5021471, 34.9173713], [29.5021613, 34.9172771]], "roof": "#f7f4e7"}, {"ll": [[29.5021497, 34.9168437], [29.5019931, 34.9170618], [29.5019121, 34.9169849], [29.5020687, 34.9167669]], "roof": "#fdfaf5"}, {"ll": [[29.5015614, 34.9165999], [29.5017299, 34.9167549], [29.5017055, 34.9167899], [29.501537, 34.9166349]], "roof": "#e9dfcf"}, {"ll": [[29.5016272, 34.9164997], [29.5015482, 34.9165854], [29.5014955, 34.9165212], [29.5015745, 34.9164356]], "roof": "#fbf5dc"}, {"ll": [[29.5014093, 34.9158071], [29.5015455, 34.9158874], [29.5015173, 34.9159506], [29.501381, 34.9158703]], "roof": "#fbf7e5"}, {"ll": [[29.5009869, 34.9157989], [29.5011212, 34.9158247], [29.5011062, 34.9159282], [29.5009718, 34.9159025]], "roof": "#f1eed8"}, {"ll": [[29.5009488, 34.9157507], [29.5009889, 34.9158481], [29.5009062, 34.9158932], [29.500866, 34.9157958]], "roof": "#bcc1ba"}, {"ll": [[29.5022078, 34.9165219], [29.5023142, 34.9166714], [29.5021486, 34.9168073], [29.5020599, 34.9166578]], "roof": "#e8dbc2"}, {"ll": [[29.5023852, 34.9172149], [29.5024561, 34.9173168], [29.5023556, 34.9174187], [29.5022787, 34.9173168]], "roof": "#1f342e"}, {"ll": [[29.5014272, 34.9160463], [29.50151, 34.9161618], [29.5013326, 34.9163181], [29.5012498, 34.9161958]], "roof": "#cfb48c"}];

// ─────────────────────────────────────────────────────────────
//  Depth lines read from the IUI beach sign ("מפת עומקים").
//  t: metres along the shore from the pier (positive = north-east),
//  then the distance from the waterline (m) at which the seabed reaches 3, 6 and 10 m.
//  Past 12 m the reef wall drops to 25 m (from the team's notes).
// ─────────────────────────────────────────────────────────────
export const ISOBATHS = [
  { t: -104, s3: 31.4, s6: 47.9, s10: 66.8 },
  { t: -60, s3: 32.6, s6: 53.4, s10: 85.5 },
  { t: -21, s3: 32.8, s6: 58.4, s10: 81.5 },
  { t: -8, s3: 33.5, s6: 51.4, s10: 67.0 },
  { t: 0, s3: 33.8, s6: 51.0, s10: 66.8 },
  { t: 31, s3: 34.5, s6: 52.6, s10: 67.0 },
  { t: 81, s3: 36.0, s6: 52.8, s10: 65.0 },
];
export const DROP = { d12After10: 9, wallTo25: 20, floor: 25 };

// ─────────────────────────────────────────────────────────────
//  Ground cover drawn on the GovMap screenshot ("מפת קרקע"):
//  red = reef, yellow = stones, everything else = sand.
//  Polygons are in that image's pixels; GROUND_MAP registers the image
//  to the site (anchored on the pier head, rotated and scaled to match the Esri imagery).
// ─────────────────────────────────────────────────────────────
export const GROUND_MAP = { anchorPx: [389, 565], metresPerPx: 0.30, rotationDeg: 45.5 };
export const COVER = [
  { type: 'reef', px: [[275,175],[300,215],[330,250],[345,272],[390,282],[392,230],[410,205],[395,165],[370,125]] },
  { type: 'rock', px: [[355,330],[390,322],[420,340],[432,362],[440,420],[437,455],[410,465],[385,455],[365,420],[352,375]] },
  { type: 'rock', px: [[338,440],[350,422],[360,428],[356,455],[342,468],[333,460]] },
  { type: 'reef', px: [[342,515],[352,507],[372,510],[370,528],[350,533]] },
  { type: 'reef', px: [[425,497],[450,515],[462,530],[440,552],[410,525],[415,505]] },
  { type: 'rock', px: [[463,570],[436,605],[450,630],[478,690],[515,665],[520,630],[505,600],[482,570]] },
  { type: 'reef', px: [[400,610],[365,622],[340,630],[332,665],[335,720],[340,800],[345,870],[352,920],[340,980],[330,1040],[460,1040],[490,1000],[505,950],[505,900],[520,850],[535,810],[520,790],[490,760],[465,720],[445,680],[440,640],[420,630]] },
];

// Two 1 m pipes lying side by side on the seabed, along the south side of the pier,
// from the beach out to the deep water. offset = metres south-west of the pier axis.
export const PIPES = { diameter: 1, offsets: [2.1, 3.1], color: '#34383b' };

// 3D coral specimens from the Smithsonian 3D Digitization program (CC0, public domain),
// loaded at runtime when the seabed simulation is on. size = typical colony width on the reef (m).
export const CORAL_MODELS = [
  { name: 'Pocillopora damicornis', size: 0.5, url: 'https://3d-api.si.edu/content/document/3d_package:1951c814-3758-4b7f-b0ba-8f996534ff2b/resources/usnm_93379-100k-2048_std_draco.glb' },
  { name: 'Porites lobata', size: 1.1, url: 'https://3d-api.si.edu/content/document/3d_package:010228bb-75de-4fff-a848-c70584ce1087/resources/usnm_646-100k-2048_std_draco.glb' },
  { name: 'Millepora alcicornis', size: 0.7, url: 'https://3d-api.si.edu/content/document/3d_package:92c491e7-d31d-403d-b091-316d45dfbc2c/resources/usnm_1494038-100k-2048_std_draco.glb' },
  { name: 'Goniastrea favulus', size: 0.8, url: 'https://3d-api.si.edu/content/document/3d_package:009463d3-6f58-4f5b-8e60-915805a876ee/resources/usnm_91201-100k-2048_std_draco.glb' },
];
